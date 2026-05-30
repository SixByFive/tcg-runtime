import { Router } from 'express';
import { Op } from 'sequelize';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '@sbf/auth';
import { notifyUser, NotificationType, checkCapabilities } from '@sbf/contracts';
import {
  Trade, TradeCard, TradeProof, TradeDispute,
  TradeBan, sequelize,
} from '../models/index.js';
import {
  CANCELLABLE, RESPONDABLE, DISPUTABLE,
} from '../models/Trade.js';
import { saveProofImage, moderateProof } from '../services/proof.service.js';
import { recordTradeCompleted, applyTradeFeedback } from '../services/ownership.service.js';

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Tight limit on trade initiation: 5/min, 50/day per user
const initiateMinuteLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: req => req.user?.sub || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many trade requests — try again in a minute' },
});

const initiateDayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  keyGenerator: req => req.user?.sub || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Daily trade limit reached — try again tomorrow' },
});

// ── Public routes (no auth) ───────────────────────────────────────────────────

// GET /trades/browse — public listing of INITIATED trades (trade board)
router.get('/browse', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Number(req.query.pageSize) || 20);

    const { count, rows } = await Trade.findAndCountAll({
      where: { status: 'INITIATED' },
      include: [{ model: TradeCard, as: 'cards' }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      // Strip private fields from public view
      attributes: { exclude: ['addressA', 'addressB', 'trackingNumberA', 'trackingNumberB'] },
    });
    res.json({ trades: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All routes below require authentication
router.use(requireAuth);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isParty(trade, userId) {
  return trade.partyAId === userId || trade.partyBId === userId;
}

function otherParty(trade, userId) {
  return trade.partyAId === userId ? trade.partyBId : trade.partyAId;
}

function tradeWith(id) {
  return {
    include: [
      { model: TradeCard,    as: 'cards'   },
      { model: TradeProof,   as: 'proofs'  },
      { model: TradeDispute, as: 'dispute' },
    ],
    where: { id },
  };
}

async function notify(userId, type, title, body, linkUrl, meta) {
  await notifyUser({ userId, type, title, body, linkUrl, meta }).catch(() => {});
}

// ── Check trade ban ───────────────────────────────────────────────────────────

async function checkNotBanned(req, res, next) {
  const ban = await TradeBan.findByPk(req.user.sub);
  if (ban) return res.status(403).json({ error: 'Your account is restricted from trading', reason: ban.reason });
  next();
}

// ── GET /trades — my trades ───────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Number(req.query.pageSize) || 20);
    const where    = {
      [Op.or]: [{ partyAId: req.user.sub }, { partyBId: req.user.sub }],
    };
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await Trade.findAndCountAll({
      where,
      include: [{ model: TradeCard, as: 'cards' }],
      order: [['updatedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ trades: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /trades/:id/proof — fetch proof records for a trade ──────────────────

router.get('/:id/proof', async (req, res) => {
  try {
    const trade = await Trade.findByPk(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (!isParty(trade, req.user.sub) && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const proofs = await TradeProof.findAll({ where: { tradeId: trade.id }, order: [['uploadedAt', 'ASC']] });
    res.json(proofs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /trades/:id ───────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const trade = await Trade.findOne(tradeWith(req.params.id));
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (!isParty(trade, req.user.sub) && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades — initiate ───────────────────────────────────────────────────

router.post('/', checkNotBanned, initiateMinuteLimiter, initiateDayLimiter, async (req, res) => {
  const { userId, offeredCards = [], wantedCards = [], topUpAmount } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId (the other party) is required' });
  if (userId === req.user.sub) return res.status(400).json({ error: 'Cannot trade with yourself' });
  if (!offeredCards.length && !wantedCards.length) {
    return res.status(400).json({ error: 'At least one card must be offered or requested' });
  }

  // Enforce subscription active trade limit
  const caps = await checkCapabilities(req.user.sub);
  if (caps.maxActiveTrades !== null) {
    const activeCount = await Trade.count({
      where: {
        partyAId: req.user.sub,
        status: { [Op.notIn]: ['COMPLETED', 'CANCELLED'] },
      },
    });
    if (activeCount >= caps.maxActiveTrades) {
      return res.status(403).json({
        error: 'Active trade limit reached',
        limit: caps.maxActiveTrades,
        plan: caps.planName,
      });
    }
  }

  const t = await sequelize.transaction();
  try {
    const trade = await Trade.create({
      partyAId:    req.user.sub,
      partyBId:    userId,
      initiatorId: req.user.sub,
      status:      'INITIATED',
      topUpAmount: topUpAmount != null ? Number(topUpAmount) : null,
      topUpPaidBy: topUpAmount != null ? req.user.sub : null,
    }, { transaction: t });

    const cardRows = [
      ...offeredCards.map(c => ({ ...c, tradeId: trade.id, userId: req.user.sub })),
      ...wantedCards.map(c => ({ ...c, tradeId: trade.id, userId: userId })),
    ];
    await TradeCard.bulkCreate(cardRows, { transaction: t });

    await t.commit();

    await notify(userId, NotificationType.TRADE_OFFER,
      'New trade offer',
      `You have a new trade offer.`,
      `/trades/${trade.id}`,
      { tradeId: trade.id },
    );

    const full = await Trade.findOne(tradeWith(trade.id));
    res.status(201).json(full);
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/respond — accept / counter / decline ─────────────────────

router.post('/:id/respond', async (req, res) => {
  const { accept, counterCards } = req.body;
  if (accept == null) return res.status(400).json({ error: 'accept (boolean) is required' });

  const t = await sequelize.transaction();
  try {
    const trade = await Trade.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!trade) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(404).json({ error: 'Trade not found' }); }
    if (!isParty(trade, req.user.sub)) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(403).json({ error: 'Forbidden' }); }
    if (!RESPONDABLE.has(trade.status)) {
      if (!t.finished) await t.rollback().catch(() => {});
      return res.status(409).json({ error: `Cannot respond to a trade with status ${trade.status}` });
    }

    const other = otherParty(trade, req.user.sub);

    // Counter offer
    if (!accept && counterCards?.length) {
      await TradeCard.destroy({ where: { tradeId: trade.id }, transaction: t });
      await TradeCard.bulkCreate(
        counterCards.map(c => ({ ...c, tradeId: trade.id, userId: req.user.sub })),
        { transaction: t },
      );
      await trade.update({
        status: 'NEGOTIATING',
        counterCount: trade.counterCount + 1,
        lastCounterBy: req.user.sub,
      }, { transaction: t });
      await t.commit();

      await notify(other, NotificationType.TRADE_OFFER,
        'Counter offer received',
        'The other party has made a counter offer.',
        `/trades/${trade.id}`,
        { tradeId: trade.id },
      );
    }
    // Decline
    else if (!accept) {
      await trade.update({
        status: 'CANCELLED',
        cancelledBy: req.user.sub,
        cancelledAt: new Date(),
        cancelledReason: req.body.reason || 'Declined',
      }, { transaction: t });
      await t.commit();

      await notify(other, NotificationType.TRADE_DECLINED,
        'Trade declined',
        'Your trade offer was declined.',
        `/trades/${trade.id}`,
        { tradeId: trade.id },
      );
    }
    // Accept
    else {
      await trade.update({ status: 'AGREED', agreedAt: new Date() }, { transaction: t });
      await t.commit();

      for (const uid of [trade.partyAId, trade.partyBId]) {
        await notify(uid, NotificationType.TRADE_OFFER,
          'Trade agreed!',
          'Both parties have agreed. Please upload your proof photo to continue.',
          `/trades/${trade.id}`,
          { tradeId: trade.id },
        );
      }
    }

    const full = await Trade.findOne(tradeWith(trade.id));
    res.json(full);
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/cancel ───────────────────────────────────────────────────

router.post('/:id/cancel', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const trade = await Trade.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!trade) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(404).json({ error: 'Trade not found' }); }
    if (!isParty(trade, req.user.sub)) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(403).json({ error: 'Forbidden' }); }
    if (!CANCELLABLE.has(trade.status)) {
      if (!t.finished) await t.rollback().catch(() => {});
      return res.status(409).json({ error: `Cannot cancel a trade with status ${trade.status}` });
    }

    await trade.update({
      status: 'CANCELLED',
      cancelledBy: req.user.sub,
      cancelledAt: new Date(),
      cancelledReason: req.body.reason || null,
    }, { transaction: t });
    await t.commit();

    const other = otherParty(trade, req.user.sub);
    await notify(other, NotificationType.TRADE_DECLINED,
      'Trade cancelled',
      'The trade has been cancelled.',
      `/trades/${trade.id}`,
      { tradeId: trade.id },
    );

    res.json(await Trade.findOne(tradeWith(trade.id)));
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/proof — upload proof image ───────────────────────────────

router.post('/:id/proof', async (req, res) => {
  const { proofImage, proofCode } = req.body;
  if (!proofImage) return res.status(400).json({ error: 'proofImage (base64) is required' });

  const t = await sequelize.transaction();
  try {
    const trade = await Trade.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!trade) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(404).json({ error: 'Trade not found' }); }
    if (!isParty(trade, req.user.sub)) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(403).json({ error: 'Forbidden' }); }
    if (!['AGREED', 'PROOF_PENDING'].includes(trade.status)) {
      if (!t.finished) await t.rollback().catch(() => {});
      return res.status(409).json({ error: `Trade must be AGREED or PROOF_PENDING to upload proof (current: ${trade.status})` });
    }

    const imagePath = await saveProofImage(trade.id, req.user.sub, proofImage);
    const modResult = await moderateProof(imagePath, proofCode);
    const approved  = modResult === 'approved';

    const proof = await TradeProof.create({
      tradeId:          trade.id,
      userId:           req.user.sub,
      proofImagePath:   imagePath,
      proofCode:        proofCode || null,
      uploadedAt:       new Date(),
      moderatedAt:      approved ? new Date() : null,
      moderationResult: modResult,
    }, { transaction: t });

    // Set the verified flag for this party
    const isPartyA = trade.partyAId === req.user.sub;
    const updates  = {};
    if (approved) {
      updates[isPartyA ? 'proofAVerified' : 'proofBVerified'] = true;
    }
    if (trade.status === 'AGREED') updates.status = 'PROOF_PENDING';

    // Auto-advance to LOCKED when both parties verified
    const proofANow = isPartyA ? approved : trade.proofAVerified;
    const proofBNow = isPartyA ? trade.proofBVerified : approved;
    if (proofANow && proofBNow) {
      updates.status  = 'LOCKED';
      updates.lockedAt = new Date();
    }

    await trade.update(updates, { transaction: t });
    await t.commit();

    const other = otherParty(trade, req.user.sub);
    if (updates.status === 'LOCKED') {
      for (const uid of [trade.partyAId, trade.partyBId]) {
        await notify(uid, NotificationType.TRADE_COMPLETE,
          'Trade locked — please ship',
          'Both proofs verified. Please ship your cards and submit your tracking number.',
          `/trades/${trade.id}`,
          { tradeId: trade.id },
        );
      }
    } else {
      await notify(other, NotificationType.TRADE_OFFER,
        'Proof uploaded',
        approved
          ? 'The other party has uploaded their proof. Please upload yours to continue.'
          : 'Proof is pending admin review.',
        `/trades/${trade.id}`,
        { tradeId: trade.id },
      );
    }

    res.status(201).json({ proof, trade: await Trade.findOne(tradeWith(trade.id)) });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/tracking — submit tracking number ───────────────────────

router.post('/:id/tracking', async (req, res) => {
  const { trackingNumber } = req.body;
  if (!trackingNumber) return res.status(400).json({ error: 'trackingNumber is required' });

  const t = await sequelize.transaction();
  try {
    const trade = await Trade.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!trade) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(404).json({ error: 'Trade not found' }); }
    if (!isParty(trade, req.user.sub)) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(403).json({ error: 'Forbidden' }); }
    if (trade.status !== 'LOCKED') {
      if (!t.finished) await t.rollback().catch(() => {});
      return res.status(409).json({ error: 'Trade must be LOCKED to submit tracking' });
    }

    const isPartyA = trade.partyAId === req.user.sub;
    const updates  = { [isPartyA ? 'trackingNumberA' : 'trackingNumberB']: trackingNumber };
    // Advance to IN_TRANSIT on first tracking submission
    if (!trade.trackingNumberA && !trade.trackingNumberB) updates.status = 'IN_TRANSIT';
    await trade.update(updates, { transaction: t });
    await t.commit();

    const other = otherParty(trade, req.user.sub);
    await notify(other, NotificationType.INFO,
      'Tracking number added',
      `Your trade partner has shipped their cards. Tracking: ${trackingNumber}`,
      `/trades/${trade.id}`,
      { tradeId: trade.id, trackingNumber },
    );

    res.json(await Trade.findOne(tradeWith(trade.id)));
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/confirm — confirm received ───────────────────────────────

router.post('/:id/confirm', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const trade = await Trade.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!trade) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(404).json({ error: 'Trade not found' }); }
    if (!isParty(trade, req.user.sub)) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(403).json({ error: 'Forbidden' }); }
    if (trade.status !== 'IN_TRANSIT') {
      if (!t.finished) await t.rollback().catch(() => {});
      return res.status(409).json({ error: 'Trade must be IN_TRANSIT to confirm receipt' });
    }

    const meta       = trade.metaJson || {};
    const confirmed  = new Set(meta.confirmedReceived || []);
    confirmed.add(req.user.sub);
    const updates    = { metaJson: { ...meta, confirmedReceived: [...confirmed] } };
    const both       = confirmed.has(trade.partyAId) && confirmed.has(trade.partyBId);

    if (both) {
      updates.status      = 'COMPLETED';
      updates.completedAt = new Date();
    }

    await trade.update(updates, { transaction: t });
    await t.commit();

    if (both) {
      const cards = await TradeCard.findAll({ where: { tradeId: trade.id } });
      await recordTradeCompleted(trade, cards);

      for (const uid of [trade.partyAId, trade.partyBId]) {
        await notify(uid, NotificationType.TRADE_COMPLETE,
          'Trade completed!',
          'Both parties have confirmed receipt. Leave feedback for your trade partner.',
          `/trades/${trade.id}`,
          { tradeId: trade.id },
        );
      }
    } else {
      const other = otherParty(trade, req.user.sub);
      await notify(other, NotificationType.INFO,
        'Cards received',
        'Your trade partner has confirmed receipt. Please confirm yours when your cards arrive.',
        `/trades/${trade.id}`,
        { tradeId: trade.id },
      );
    }

    res.json(await Trade.findOne(tradeWith(trade.id)));
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/dispute — raise dispute ──────────────────────────────────

router.post('/:id/dispute', async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const t = await sequelize.transaction();
  try {
    const trade = await Trade.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!trade) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(404).json({ error: 'Trade not found' }); }
    if (!isParty(trade, req.user.sub)) { if (!t.finished) await t.rollback().catch(() => {}); return res.status(403).json({ error: 'Forbidden' }); }
    if (!DISPUTABLE.has(trade.status)) {
      if (!t.finished) await t.rollback().catch(() => {});
      return res.status(409).json({ error: `Cannot raise a dispute on a trade with status ${trade.status}` });
    }

    const dispute = await TradeDispute.create({
      tradeId: trade.id, raisedById: req.user.sub, reason, status: 'open',
    }, { transaction: t });

    await trade.update({ status: 'DISPUTED', disputeId: dispute.id }, { transaction: t });
    await t.commit();

    const other = otherParty(trade, req.user.sub);
    await notify(other, NotificationType.WARNING,
      'Trade dispute raised',
      'Your trade partner has raised a dispute. An admin will review.',
      `/trades/${trade.id}`,
      { tradeId: trade.id, disputeId: dispute.id },
    );

    res.status(201).json({ dispute, trade: await Trade.findOne(tradeWith(trade.id)) });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trades/:id/feedback — leave feedback after completion ───────────────

router.post('/:id/feedback', async (req, res) => {
  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }

  try {
    const trade = await Trade.findByPk(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (!isParty(trade, req.user.sub)) return res.status(403).json({ error: 'Forbidden' });
    if (trade.status !== 'COMPLETED') {
      return res.status(409).json({ error: 'Can only leave feedback on completed trades' });
    }

    const recipientId = otherParty(trade, req.user.sub);
    await applyTradeFeedback(recipientId, Number(rating));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
