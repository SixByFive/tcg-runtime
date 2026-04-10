import { createLogger } from '@sbf/logger';
import { OwnershipRecord, UserReputation } from '../models/index.js';

const logger = createLogger('trading-service:ownership');

/**
 * Write ownership records when a trade completes.
 * Each card moves from its current owner to the other party.
 */
export async function recordTradeCompleted(trade, cards) {
  try {
    for (const card of cards) {
      const newOwnerId = card.userId === trade.partyAId
        ? trade.partyBId
        : trade.partyAId;

      await OwnershipRecord.create({
        cardId:     card.cardId,
        ownerId:    newOwnerId,
        eventType:  'TRADE_COMPLETED',
        sourceType: 'TRADE',
        sourceId:   trade.id,
      });
    }

    // Increment completedTrades for both parties
    for (const userId of [trade.partyAId, trade.partyBId]) {
      const [rep] = await UserReputation.findOrCreate({
        where: { userId },
        defaults: { userId },
      });
      await rep.increment('completedTrades');
    }
  } catch (err) {
    // Non-fatal — log but don't break the trade completion
    logger.error({ msg: 'ownership_record_failed', tradeId: trade.id, error: err.message });
  }
}

/**
 * Write ownership records when an admin resolves a dispute.
 * resolvedInFavourOf: 'partyA' | 'partyB' — all cards go to the winning party.
 */
export async function recordDisputeResolved(trade, cards, resolvedInFavourOf) {
  try {
    const winnerId = resolvedInFavourOf === 'partyA' ? trade.partyAId : trade.partyBId;

    for (const card of cards) {
      await OwnershipRecord.create({
        cardId:     card.cardId,
        ownerId:    winnerId,
        eventType:  'DISPUTE_RESOLVED',
        sourceType: 'TRADE',
        sourceId:   trade.id,
      });
    }
  } catch (err) {
    logger.error({ msg: 'dispute_ownership_failed', tradeId: trade.id, error: err.message });
  }
}

/**
 * Update reputation after trade feedback.
 * rating 1-2 = negative, 3 = neutral, 4-5 = positive.
 */
export async function applyTradeFeedback(recipientId, rating) {
  const [rep] = await UserReputation.findOrCreate({
    where: { userId: recipientId },
    defaults: { userId: recipientId },
  });

  if (rating <= 2)      { rep.negative++; }
  else if (rating === 3){ rep.neutral++;  }
  else                  { rep.positive++; }

  rep.score = rep.positive - rep.negative;
  await rep.save();
}
