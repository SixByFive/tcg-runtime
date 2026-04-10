import { Router } from 'express';
import { requireAdmin } from '@sbf/auth';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { Trade, TradeCard, TradeProof, TradeDispute, TradeBan } from '../models/index.js';
import { recordDisputeResolved } from '../services/ownership.service.js';

const router = Router();
router.use(requireAdmin);

// GET /trades/admin/list — all trades (paginated)
router.get('/list', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.userId) {
      const { Op } = await import('sequelize');
      where[Op.or] = [{ partyAId: req.query.userId }, { partyBId: req.query.userId }];
    }

    const { count, rows } = await Trade.findAndCountAll({
      where,
      include: [
        { model: TradeCard,    as: 'cards'   },
        { model: TradeDispute, as: 'dispute' },
      ],
      order: [['updatedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ trades: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /trades/admin/disputes — open disputes
router.get('/disputes', async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const where  = status === 'all' ? {} : { status };
    const rows   = await TradeDispute.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /trades/admin/:id/resolve-dispute
router.post('/:id/resolve-dispute', async (req, res) => {
  const { resolution, resolvedInFavourOf } = req.body;
  if (!resolution) return res.status(400).json({ error: 'resolution is required' });
  if (resolvedInFavourOf && !['partyA', 'partyB'].includes(resolvedInFavourOf)) {
    return res.status(400).json({ error: 'resolvedInFavourOf must be "partyA" or "partyB"' });
  }

  try {
    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: TradeCard,    as: 'cards'   },
        { model: TradeDispute, as: 'dispute' },
      ],
    });
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (trade.status !== 'DISPUTED') {
      return res.status(409).json({ error: 'Trade is not in DISPUTED status' });
    }

    if (trade.dispute) {
      await trade.dispute.update({
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      });
    }

    await trade.update({
      status: 'COMPLETED',
      completedAt: new Date(),
      adminNotes: resolution,
    });

    if (resolvedInFavourOf && trade.cards?.length) {
      await recordDisputeResolved(trade, trade.cards, resolvedInFavourOf);
    }

    for (const userId of [trade.partyAId, trade.partyBId]) {
      await notifyUser({
        userId,
        type: NotificationType.INFO,
        title: 'Trade dispute resolved',
        body: `An admin has resolved your trade dispute: ${resolution}`,
        linkUrl: `/trades/${trade.id}`,
        meta: { tradeId: trade.id },
      }).catch(() => {});
    }

    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /trades/admin/:id/proof-approve — manually approve a pending proof
router.post('/:id/proof-approve', async (req, res) => {
  const { proofId, party } = req.body; // party: 'A' | 'B'
  if (!proofId || !party) return res.status(400).json({ error: 'proofId and party (A|B) required' });

  try {
    const proof = await TradeProof.findByPk(proofId);
    if (!proof) return res.status(404).json({ error: 'Proof not found' });
    await proof.update({ moderationResult: 'approved', moderatedAt: new Date() });

    const trade = await Trade.findByPk(proof.tradeId);
    if (trade) {
      const updates = { [`proof${party}Verified`]: true };
      if (trade.proofAVerified && trade.proofBVerified) {
        updates.status   = 'LOCKED';
        updates.lockedAt = new Date();
      }
      await trade.update(updates);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /trades/admin/block-user — ban a user from trading
router.post('/block-user', async (req, res) => {
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const [ban, created] = await TradeBan.findOrCreate({
      where: { userId },
      defaults: { userId, reason: reason || null, bannedBy: req.user.sub },
    });
    if (!created) await ban.update({ reason: reason || ban.reason, bannedBy: req.user.sub });
    res.status(created ? 201 : 200).json({ ok: true, ban });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /trades/admin/block-user/:userId — lift a trade ban
router.delete('/block-user/:userId', async (req, res) => {
  try {
    const deleted = await TradeBan.destroy({ where: { userId: req.params.userId } });
    if (!deleted) return res.status(404).json({ error: 'No ban found for that user' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /trades/admin/block-user — list all trade bans
router.get('/block-user', async (req, res) => {
  try {
    const bans = await TradeBan.findAll({ order: [['bannedAt', 'DESC']] });
    res.json(bans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
