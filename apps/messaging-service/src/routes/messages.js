import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth, requireAdmin } from '@sbf/auth';
import { notifyUser } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';
import {
  Message,
  ChatAgreement,
  ChatBlock,
  ChatMute,
  ReportedUser,
  ChatBan,
} from '../models/index.js';

const router = Router();
const logger = createLogger('messaging-service:routes');

const CHAT_RULES =
  'Be respectful. No harassment, hate speech, or threats. No sharing personal info. No scams/spam. Report abusive behaviour.';

async function pushRealtime(userId, event, data) {
  const url = process.env.REALTIME_SERVICE_URL || 'http://localhost:4018';
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return;
  await fetch(`${url}/internal/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
    body: JSON.stringify({ userId, event, data }),
  }).catch(() => {});
}

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /messages/rules
router.get('/rules', (_req, res) => {
  res.json({ text: CHAT_RULES });
});

// ─── Authenticated ────────────────────────────────────────────────────────────

// GET /messages/chats — list my recent conversations
router.get('/chats', requireAuth, async (req, res) => {
  try {
    const me       = req.user.sub;
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);

    // Load last 5000 messages involving me
    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ senderId: me }, { receiverId: me }],
      },
      order: [['createdAt', 'DESC']],
      limit: 5000,
    });

    // Group by the other party
    const chatMap = new Map();
    for (const msg of messages) {
      const otherId = msg.senderId === me ? msg.receiverId : msg.senderId;

      // Skip messages deleted for me
      const visibleToMe =
        !(msg.senderId === me && msg.deletedBySender) &&
        !(msg.receiverId === me && msg.deletedByReceiver);
      if (!visibleToMe) continue;

      if (!chatMap.has(otherId)) {
        chatMap.set(otherId, { userId: otherId, lastMessage: msg, unreadCount: 0 });
      }

      if (msg.receiverId === me && !msg.isRead && !msg.deletedByReceiver) {
        chatMap.get(otherId).unreadCount += 1;
      }
    }

    const chats = Array.from(chatMap.values());
    const total = chats.length;
    const paged = chats.slice((page - 1) * pageSize, page * pageSize);

    res.json({ chats: paged, total, page, pageSize });
  } catch (err) {
    logger.error({ msg: 'myChats_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/chats/:userId — conversation with a specific user
router.get('/chats/:userId', requireAuth, async (req, res) => {
  try {
    const me      = req.user.sub;
    const other   = req.params.userId;
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);

    // Check blocks in both directions
    const block = await ChatBlock.findOne({
      where: {
        [Op.or]: [
          { blockerId: me,    blockedId: other },
          { blockerId: other, blockedId: me    },
        ],
      },
    });
    if (block) return res.status(403).json({ error: 'BLOCKED' });

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: me,    receiverId: other },
          { senderId: other, receiverId: me    },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // Filter visibility
    const visible = messages.filter((msg) => {
      if (msg.senderId === me    && msg.deletedBySender)   return false;
      if (msg.receiverId === me  && msg.deletedByReceiver) return false;
      return true;
    });

    res.json({ messages: visible, page, pageSize });
  } catch (err) {
    logger.error({ msg: 'chatWithUser_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await Message.count({
      where: {
        receiverId:        req.user.sub,
        isRead:            false,
        deletedByReceiver: false,
      },
    });
    res.json({ count });
  } catch (err) {
    logger.error({ msg: 'unreadCount_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/send
router.post('/send', requireAuth, async (req, res) => {
  try {
    const me                       = req.user.sub;
    const { receiverId, content, meta } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'content exceeds 2000 characters' });
    }
    if (receiverId === me) {
      return res.status(400).json({ error: 'cannot send message to yourself' });
    }

    // Check blocks in both directions
    const block = await ChatBlock.findOne({
      where: {
        [Op.or]: [
          { blockerId: me,         blockedId: receiverId },
          { blockerId: receiverId, blockedId: me         },
        ],
      },
    });
    if (block) return res.status(403).json({ error: 'BLOCKED' });

    // Check chat ban
    const ban = await ChatBan.findOne({ where: { userId: me } });
    if (ban) return res.status(403).json({ error: 'CHAT_BANNED' });

    // Check chat agreement
    const agreement = await ChatAgreement.findOne({ where: { userId: me } });
    if (!agreement) return res.status(403).json({ error: 'CHAT_AGREEMENT_REQUIRED' });

    const message = await Message.create({
      senderId:   me,
      receiverId,
      content:    content.trim(),
      meta:       meta ?? null,
    });

    // Notify receiver (fire and forget)
    notifyUser({
      userId:    receiverId,
      type:      'chat_message',
      title:     'New Message',
      body:      'You have a new message.',
      sendEmail: false,
    }).catch(() => {});

    // Realtime push to receiver
    pushRealtime(receiverId, 'newMessage', { from: me });

    res.status(201).json(message);
  } catch (err) {
    logger.error({ msg: 'send_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/read/:userId — mark messages from :userId as read
router.post('/read/:userId', requireAuth, async (req, res) => {
  try {
    const me    = req.user.sub;
    const other = req.params.userId;

    await Message.update(
      { isRead: true },
      {
        where: {
          senderId:   other,
          receiverId: me,
          isRead:     false,
        },
      },
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'markRead_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /messages/chat/:userId — soft delete conversation
router.delete('/chat/:userId', requireAuth, async (req, res) => {
  try {
    const me    = req.user.sub;
    const other = req.params.userId;

    // Messages I sent to them — mark deletedBySender
    await Message.update(
      { deletedBySender: true },
      { where: { senderId: me, receiverId: other } },
    );

    // Messages they sent me — mark deletedByReceiver
    await Message.update(
      { deletedByReceiver: true },
      { where: { senderId: other, receiverId: me } },
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'deleteChat_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/report/message
router.post('/report/message', requireAuth, async (req, res) => {
  try {
    const me                        = req.user.sub;
    const { messageId, reason, details } = req.body;

    if (!messageId || !reason) {
      return res.status(400).json({ error: 'messageId and reason are required' });
    }

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Visibility check — reporter must be sender or receiver and not have deleted it
    const isSender   = message.senderId === me;
    const isReceiver = message.receiverId === me;
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (isSender   && message.deletedBySender)   return res.status(404).json({ error: 'Message not found' });
    if (isReceiver && message.deletedByReceiver) return res.status(404).json({ error: 'Message not found' });

    await message.update({
      isFlagged:   true,
      flagReason:  reason,
      flaggedById: me,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'reportMessage_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/report/user
router.post('/report/user', requireAuth, async (req, res) => {
  try {
    const me                         = req.user.sub;
    const { userId, reason, details } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({ error: 'userId and reason are required' });
    }

    await ReportedUser.create({
      userId,
      reporterId: me,
      reason,
      details: details ?? null,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'reportUser_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/agreed
router.get('/agreed', requireAuth, async (req, res) => {
  try {
    const row = await ChatAgreement.findOne({ where: { userId: req.user.sub } });
    res.json({ agreed: !!row });
  } catch (err) {
    logger.error({ msg: 'agreed_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/agree
router.post('/agree', requireAuth, async (req, res) => {
  try {
    await ChatAgreement.findOrCreate({
      where:    { userId: req.user.sub },
      defaults: { userId: req.user.sub, agreedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'agree_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/mutes
router.get('/mutes', requireAuth, async (req, res) => {
  try {
    const mutes = await ChatMute.findAll({ where: { userId: req.user.sub } });
    res.json({ mutes });
  } catch (err) {
    logger.error({ msg: 'mutes_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/blocks
router.get('/blocks', requireAuth, async (req, res) => {
  try {
    const blocks = await ChatBlock.findAll({ where: { blockerId: req.user.sub } });
    res.json({ blocks });
  } catch (err) {
    logger.error({ msg: 'blocks_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/mute/:userId
router.post('/mute/:userId', requireAuth, async (req, res) => {
  try {
    const me    = req.user.sub;
    const other = req.params.userId;
    const mutedUntil = req.body.mutedUntil ? new Date(req.body.mutedUntil) : null;

    const [mute] = await ChatMute.findOrCreate({
      where:    { userId: me, otherUserId: other },
      defaults: { userId: me, otherUserId: other, mutedUntil },
    });

    await mute.update({ mutedUntil });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'mute_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /messages/mute/:userId
router.delete('/mute/:userId', requireAuth, async (req, res) => {
  try {
    await ChatMute.destroy({
      where: { userId: req.user.sub, otherUserId: req.params.userId },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'unmute_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/block/:userId
router.post('/block/:userId', requireAuth, async (req, res) => {
  try {
    const me    = req.user.sub;
    const other = req.params.userId;
    const reason = req.body.reason ?? null;

    await ChatBlock.findOrCreate({
      where:    { blockerId: me, blockedId: other },
      defaults: { blockerId: me, blockedId: other, reason },
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'block_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /messages/block/:userId
router.delete('/block/:userId', requireAuth, async (req, res) => {
  try {
    await ChatBlock.destroy({
      where: { blockerId: req.user.sub, blockedId: req.params.userId },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'unblock_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /messages/admin/reports/users
router.get('/admin/reports/users', requireAdmin, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.isCleared !== undefined) {
      where.isCleared = req.query.isCleared === 'true';
    }

    const { count, rows } = await ReportedUser.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ reports: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error({ msg: 'adminReportsUsers_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /messages/admin/reports/messages
router.get('/admin/reports/messages', requireAdmin, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = { isFlagged: true };
    if (req.query.senderId)   where.senderId   = req.query.senderId;
    if (req.query.receiverId) where.receiverId = req.query.receiverId;

    const { count, rows } = await Message.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ messages: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error({ msg: 'adminReportsMessages_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/admin/ban/:userId
router.post('/admin/ban/:userId', requireAdmin, async (req, res) => {
  try {
    const userId  = req.params.userId;
    const adminId = req.user.sub;
    const reason  = req.body.reason ?? null;

    await ChatBan.upsert({ userId, adminId, reason });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'adminBan_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /messages/admin/ban/:userId
router.delete('/admin/ban/:userId', requireAdmin, async (req, res) => {
  try {
    await ChatBan.destroy({ where: { userId: req.params.userId } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'adminUnban_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /messages/admin/messages/:id — hard delete
router.delete('/admin/messages/:id', requireAdmin, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    await message.destroy();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'adminDeleteMessage_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/admin/clear-report/:userId
router.post('/admin/clear-report/:userId', requireAdmin, async (req, res) => {
  try {
    await ReportedUser.update(
      { isCleared: true },
      { where: { userId: req.params.userId } },
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ msg: 'adminClearReport_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /messages/admin/send-system — send a system message to any user
router.post('/admin/send-system', requireAdmin, async (req, res) => {
  const { receiverId, content, meta } = req.body;
  if (!receiverId || !content) {
    return res.status(400).json({ error: 'receiverId and content are required' });
  }
  try {
    const message = await Message.create({
      senderId:        req.user.sub,
      receiverId,
      content,
      isSystemMessage: true,
      meta:            meta ?? null,
    });

    await pushRealtime(receiverId, 'message', {
      id:         message.id,
      senderId:   message.senderId,
      content:    message.content,
      isSystemMessage: true,
      createdAt:  message.createdAt,
    });

    res.status(201).json(message);
  } catch (err) {
    logger.error({ msg: 'adminSendSystem_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
