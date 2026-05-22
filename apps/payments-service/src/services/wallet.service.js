import { createLogger } from '@sbf/logger';
import { Op } from 'sequelize';
import { WalletBalance, WalletTransaction, sequelize } from '../models/index.js';
import { createWalletTopupIntent as stripeCreateTopupIntent } from './stripe.service.js';
import { getOrCreateCustomer } from './stripe.service.js';

const logger = createLogger('payments-service:wallet');

const MIN_TOPUP_PENCE = 500;   // £5 minimum
const MAX_TOPUP_PENCE = 20000; // £200 maximum per transaction

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateBalance(userId, transaction) {
  const [row] = await WalletBalance.findOrCreate({
    where: { userId },
    defaults: { userId, balancePence: 0, heldPence: 0, currency: 'GBP' },
    transaction,
  });
  return row;
}

function toGBP(pence) {
  return Number((pence / 100).toFixed(2));
}

// ─── Top-up ───────────────────────────────────────────────────────────────────

/**
 * Creates a Stripe PaymentIntent for a wallet top-up and a pending
 * WalletTransaction record. The webhook completes the credit on success.
 *
 * @returns {{ clientSecret: string, paymentIntentId: string }}
 */
export async function createTopupIntent(userId, userEmail, amountPence) {
  if (!Number.isInteger(amountPence)) throw new Error('amountPence must be an integer');
  if (amountPence < MIN_TOPUP_PENCE) throw new Error(`Minimum top-up is £${toGBP(MIN_TOPUP_PENCE)}`);
  if (amountPence > MAX_TOPUP_PENCE) throw new Error(`Maximum top-up per transaction is £${toGBP(MAX_TOPUP_PENCE)}`);

  // Get or create Stripe customer so the card is saved for the user
  const customer = await getOrCreateCustomer(userId, userEmail);

  const intent = await stripeCreateTopupIntent({
    customerId: customer.id,
    amountPence,
    userId,
  });

  // Create a pending transaction — will be completed by the webhook
  await WalletTransaction.create({
    userId,
    type:                  'topup',
    amountPence,
    status:                'pending',
    description:           `Wallet top-up £${toGBP(amountPence)}`,
    stripePaymentIntentId: intent.id,
  });

  return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
}

/**
 * Called by the webhook when payment_intent.succeeded fires for a wallet top-up.
 * Marks the transaction complete and credits the balance — all in one DB transaction.
 */
export async function completeTopup(paymentIntentId) {
  const tx = await WalletTransaction.findOne({
    where: { stripePaymentIntentId: paymentIntentId, type: 'topup' },
  });
  if (!tx) {
    logger.warn(`completeTopup: no pending topup found for PI ${paymentIntentId}`);
    return;
  }
  if (tx.status === 'completed') return; // idempotent

  await sequelize.transaction(async (t) => {
    await tx.update({ status: 'completed' }, { transaction: t });
    const wallet = await getOrCreateBalance(tx.userId, t);
    await wallet.increment('balancePence', { by: tx.amountPence, transaction: t });
  });

  logger.info(`Wallet credited: user=${tx.userId} +${tx.amountPence}p (PI ${paymentIntentId})`);
}

// ─── Balance query ────────────────────────────────────────────────────────────

export async function getWalletSummary(userId, { limit = 20, offset = 0 } = {}) {
  const wallet = await WalletBalance.findOne({ where: { userId } });
  const balancePence = wallet?.balancePence ?? 0;
  const heldPence    = wallet?.heldPence    ?? 0;
  const currency     = wallet?.currency     ?? 'GBP';

  const { rows: transactions, count: total } = await WalletTransaction.findAndCountAll({
    where:  { userId, status: { [Op.ne]: 'failed' } },
    order:  [['createdAt', 'DESC']],
    limit:  Math.min(limit, 100),
    offset,
  });

  return {
    balancePence,
    balance:  toGBP(balancePence),
    heldPence,
    held:     toGBP(heldPence),
    currency,
    transactions: transactions.map(formatTx),
    total,
  };
}

function formatTx(tx) {
  return {
    id:                    tx.id,
    type:                  tx.type,
    amountPence:           tx.amountPence,
    amount:                toGBP(tx.amountPence),
    currency:              tx.currency,
    status:                tx.status,
    description:           tx.description,
    relatedTradeId:        tx.relatedTradeId,
    relatedOrderId:        tx.relatedOrderId,
    stripePaymentIntentId: tx.stripePaymentIntentId,
    createdAt:             tx.createdAt,
  };
}

// ─── Withdrawal ──────────────────────────────────────────────────────────────

const MIN_WITHDRAWAL_PENCE = 1000; // £10 minimum

/**
 * Request a wallet withdrawal. Debits the balance immediately and creates a
 * pending withdrawal transaction. Bank details are stored in metadataJson
 * for admin processing.
 *
 * @param {string} userId
 * @param {number} amountPence
 * @param {{ sortCode: string, accountNumber: string, accountName: string }} bankDetails
 * @returns {{ id, amountPence, amount, status, createdAt }}
 */
export async function requestWithdrawal(userId, amountPence, bankDetails = {}) {
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    throw new Error('amountPence must be a positive integer');
  }
  if (amountPence < MIN_WITHDRAWAL_PENCE) {
    throw new Error(`Minimum withdrawal is £${toGBP(MIN_WITHDRAWAL_PENCE)}`);
  }

  const { sortCode, accountNumber, accountName } = bankDetails;
  if (!sortCode || !accountNumber) {
    throw new Error('Sort code and account number are required');
  }

  // Normalise sort code to digits only for storage, validate length
  const sortDigits = sortCode.replace(/\D/g, '');
  if (sortDigits.length !== 6) throw new Error('Sort code must be 6 digits (e.g. 12-34-56)');
  if (!/^\d{8}$/.test(accountNumber.trim())) throw new Error('Account number must be 8 digits');

  const nameLabel = accountName?.trim() || 'account';

  let tx;
  await sequelize.transaction(async (t) => {
    const wallet = await getOrCreateBalance(userId, t);
    if (wallet.balancePence < amountPence) {
      throw new Error(
        `Insufficient balance. Available: £${toGBP(wallet.balancePence)}, requested: £${toGBP(amountPence)}`,
      );
    }
    await wallet.decrement('balancePence', { by: amountPence, transaction: t });
    tx = await WalletTransaction.create({
      userId,
      type:        'withdrawal',
      amountPence,
      currency:    'GBP',
      status:      'pending',
      description: `Withdrawal to ${nameLabel} — processing 1–3 business days`,
      metadataJson: {
        sortCode:      sortDigits,
        accountNumber: accountNumber.trim(),
        ...(accountName?.trim() ? { accountName: accountName.trim() } : {}),
      },
    }, { transaction: t });
  });

  logger.info(`Withdrawal requested: user=${userId} ${amountPence}p → ${nameLabel}`);
  return formatTx(tx);
}

// ─── Sale credit ─────────────────────────────────────────────────────────────

/**
 * Credit a seller's wallet when a marketplace order completes without Stripe Connect.
 * Called by marketplace-service when the buyer confirms receipt.
 */
export async function creditForSale(sellerId, amountPence, { orderId, description } = {}) {
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    throw new Error('amountPence must be a positive integer');
  }
  await sequelize.transaction(async (t) => {
    const wallet = await getOrCreateBalance(sellerId, t);
    await wallet.increment('balancePence', { by: amountPence, transaction: t });
    await WalletTransaction.create({
      userId:         sellerId,
      type:           'sale_credit',
      amountPence,
      currency:       'GBP',
      status:         'completed',
      description:    description || `Sale credit £${toGBP(amountPence)}`,
      relatedOrderId: orderId || null,
    }, { transaction: t });
  });
  logger.info(`Sale credit: seller=${sellerId} +${amountPence}p order=${orderId}`);
}

// ─── Purchase spend / refund ──────────────────────────────────────────────────

/**
 * Immediately debit a buyer's wallet for a marketplace purchase.
 * Called before the order is shipped — funds sit with the platform until
 * the buyer confirms receipt (same escrow model as Stripe manual capture).
 */
export async function spendForPurchase(userId, amountPence, { orderId, description } = {}) {
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    throw new Error('amountPence must be a positive integer');
  }
  await sequelize.transaction(async (t) => {
    const wallet = await getOrCreateBalance(userId, t);
    if (wallet.balancePence < amountPence) {
      throw new Error(
        `Insufficient wallet balance. Available: £${toGBP(wallet.balancePence)}, required: £${toGBP(amountPence)}`,
      );
    }
    await wallet.decrement('balancePence', { by: amountPence, transaction: t });
    await WalletTransaction.create({
      userId,
      type:           'purchase_spend',
      amountPence,
      currency:       'GBP',
      status:         'completed',
      description:    description || `Marketplace purchase £${toGBP(amountPence)}`,
      relatedOrderId: orderId || null,
    }, { transaction: t });
  });
  logger.info(`Wallet purchase spend: user=${userId} -${amountPence}p order=${orderId}`);
}

/**
 * Refund a buyer's wallet when a wallet-paid order is cancelled.
 */
export async function refundPurchase(userId, amountPence, { orderId, description } = {}) {
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    throw new Error('amountPence must be a positive integer');
  }
  await sequelize.transaction(async (t) => {
    const wallet = await getOrCreateBalance(userId, t);
    await wallet.increment('balancePence', { by: amountPence, transaction: t });
    await WalletTransaction.create({
      userId,
      type:           'purchase_refund',
      amountPence,
      currency:       'GBP',
      status:         'completed',
      description:    description || `Purchase refund £${toGBP(amountPence)}`,
      relatedOrderId: orderId || null,
    }, { transaction: t });
  });
  logger.info(`Wallet purchase refund: user=${userId} +${amountPence}p order=${orderId}`);
}

// ─── Trade escrow ─────────────────────────────────────────────────────────────

/**
 * Hold funds from a user's wallet for a pending trade.
 * Reduces balancePence and increases heldPence.
 * Called by trading-service when a trade reaches LOCKED.
 */
export async function holdForTrade(userId, amountPence, tradeId) {
  await sequelize.transaction(async (t) => {
    const wallet = await getOrCreateBalance(userId, t);

    if (wallet.balancePence < amountPence) {
      throw new Error(`Insufficient wallet balance. Available: £${toGBP(wallet.balancePence)}, required: £${toGBP(amountPence)}`);
    }

    await wallet.decrement('balancePence', { by: amountPence, transaction: t });
    await wallet.increment('heldPence',    { by: amountPence, transaction: t });

    await WalletTransaction.create({
      userId,
      type:           'trade_hold',
      amountPence,
      status:         'completed',
      description:    `Trade escrow hold`,
      relatedTradeId: tradeId,
    }, { transaction: t });
  });

  logger.info(`Wallet hold: user=${userId} ${amountPence}p for trade=${tradeId}`);
}

/**
 * Release a trade hold back to the user (trade cancelled or failed).
 * Reduces heldPence and increases balancePence.
 */
export async function releaseHold(userId, tradeId) {
  const holdTx = await WalletTransaction.findOne({
    where: { userId, type: 'trade_hold', relatedTradeId: tradeId, status: 'completed' },
  });
  if (!holdTx) {
    logger.warn(`releaseHold: no hold found for user=${userId} trade=${tradeId}`);
    return;
  }

  const amountPence = holdTx.amountPence;

  await sequelize.transaction(async (t) => {
    const wallet = await getOrCreateBalance(userId, t);
    await wallet.increment('balancePence', { by: amountPence, transaction: t });
    await wallet.decrement('heldPence',    { by: amountPence, transaction: t });

    await WalletTransaction.create({
      userId,
      type:           'trade_refund',
      amountPence,
      status:         'completed',
      description:    `Trade cancelled — funds returned`,
      relatedTradeId: tradeId,
    }, { transaction: t });
  });

  logger.info(`Wallet hold released: user=${userId} ${amountPence}p for trade=${tradeId}`);
}

/**
 * Complete a trade transfer: move held funds from payer to recipient.
 * fromUserId must have a matching trade_hold for this tradeId.
 */
export async function completeTradeTransfer(fromUserId, toUserId, tradeId) {
  const holdTx = await WalletTransaction.findOne({
    where: { userId: fromUserId, type: 'trade_hold', relatedTradeId: tradeId, status: 'completed' },
  });
  if (!holdTx) {
    logger.warn(`completeTradeTransfer: no hold found for user=${fromUserId} trade=${tradeId}`);
    return;
  }

  const amountPence = holdTx.amountPence;

  await sequelize.transaction(async (t) => {
    // Remove from payer's hold
    const payer = await getOrCreateBalance(fromUserId, t);
    await payer.decrement('heldPence', { by: amountPence, transaction: t });

    // Credit recipient
    const recipient = await getOrCreateBalance(toUserId, t);
    await recipient.increment('balancePence', { by: amountPence, transaction: t });

    await WalletTransaction.create({
      userId:         toUserId,
      type:           'trade_credit',
      amountPence,
      status:         'completed',
      description:    `Trade completed — cash received`,
      relatedTradeId: tradeId,
    }, { transaction: t });
  });

  logger.info(`Trade transfer complete: ${fromUserId} → ${toUserId} ${amountPence}p for trade=${tradeId}`);
}
