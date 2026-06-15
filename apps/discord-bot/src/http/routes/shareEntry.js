// bot/src/http/routes/shareEntry.js
//
// UPDATED (2026-01-26):
// - NEW: Add guild + channel discovery endpoints so the BACKEND can build a "Server + Channel" picker
//   WITHOUT having direct access to the bot token / discord.js client.
//     GET  /api/guilds
//     GET  /api/guilds/:guildId/channels
//
// - NEW: Optional hard validation on share-entry: if backend passes guildId, we ensure channel belongs to that guild.
// - NEW: Permission filtering for channels list (ViewChannel + SendMessages + EmbedLinks)
// - KEEP: Existing /api/share-entry posting behaviour and formatting (test-post style)
// - KEEP: requireBackendKey protection on all endpoints
//
// NOTES:
// - Your backend will:
//   1) Use Discord OAuth user token to prove membership in guildId (via /users/@me/guilds)
//   2) Call THIS bot service to list channels for that guild
//   3) Call /api/share-entry to post to chosen channelId
//
// This file assumes:
// - `discord` passed into buildShareEntryRouter(discord) is a logged-in discord.js Client
// - requireBackendKey validates Authorization: Bearer <SBF_API_KEY>

import express from "express";
import requireBackendKey from "../middleware/requireBackendKey.js";

import { buildCardChannelMessage } from "../../modules/share/formatters.js";

function safeTrim(v) {
  return typeof v === "string" ? v.trim() : "";
}

function hasText(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function pickViewUrl(body) {
  const direct =
    body?.links?.view ||
    body?.entry?.links?.view ||
    body?.payload?.links?.view ||
    body?.viewUrl ||
    body?.entry?.viewUrl ||
    body?.payload?.viewUrl ||
    null;

  return hasText(direct) ? safeTrim(direct) : null;
}

function normalizeRequestedBy(body, payload) {
  const rb = body?.requestedBy || payload?.requestedBy || null;

  // ✅ Accept "ryan" as string
  if (typeof rb === "string" && hasText(rb)) {
    return { username: safeTrim(rb) };
  }

  // ✅ Accept object shapes
  if (rb && typeof rb === "object") {
    const username = safeTrim(rb.username || rb.displayName || rb.name || "");
    return username ? { username } : null;
  }

  return null;
}

function normalizeCard(body) {
  const payload = body?.entry || body?.payload || body || {};
  const card = payload?.card || {};

  // Prefer "big" image so the channel post matches your test-post style
  const imageUrl =
    card?.images?.large ||
    card?.images?.small ||
    payload?.imageUrl ||
    payload?.card?.imageUrl ||
    null;

  const priceGBP =
    payload?.pricing?.priceGBP ??
    payload?.pricing?.gbp ??
    payload?.priceGBP ??
    null;

  return {
    payload,
    card,
    type: safeTrim(body?.type || payload?.type) || "collection",
    channelId: safeTrim(body?.channelId || payload?.channelId || ""),
    // ✅ NEW: optional guildId for extra validation
    guildId: safeTrim(body?.guildId || payload?.guildId || ""),
    messageText: safeTrim(body?.message || payload?.message || ""),
    viewUrl: pickViewUrl(body),
    requestedBy: normalizeRequestedBy(body, payload),
    cardForFormatter: {
      // Your formatter supports cardName OR name, and id/cardId
      id: payload?.cardId || card?.cardId || card?.id || payload?.id || null,
      cardId: payload?.cardId || card?.cardId || card?.id || payload?.id || null,
      name: card?.name || payload?.cardName || payload?.name || null,
      number: card?.number || payload?.number || null,
      setCode: card?.setCode || payload?.setCode || null,
      setName: card?.setName || card?.set?.name || payload?.setName || null,
      rarity: card?.rarity || payload?.rarity || null,
      priceGBP,
      imageUrl,
    },
  };
}

/* ========================================================================== */
/*                              NEW HELPERS                                   */
/* ========================================================================== */

function isTextPostableChannel(ch) {
  // discord.js v14: isTextBased() covers text/news/thread/etc; we still filter out DMs.
  if (!ch) return false;
  if (typeof ch.isTextBased === "function" && !ch.isTextBased()) return false;

  // We only want guild channels, not DMs
  if (!ch.guildId) return false;

  return true;
}

function channelBotCanPost(ch, botUser) {
  if (!ch || !botUser) return false;

  const perms = ch.permissionsFor?.(botUser) || null;
  if (!perms) return false;

  // Keep this strict because your message includes embeds + button
  return (
    perms.has("ViewChannel") &&
    perms.has("SendMessages") &&
    perms.has("EmbedLinks")
  );
}

/* ========================================================================== */
/*                                ROUTER                                      */
/* ========================================================================== */

export function buildShareEntryRouter(discord) {
  const router = express.Router();

  /* ------------------------------------------------------------------------ */
  /* NEW: LIST GUILDS (SERVERS) THE BOT IS IN                                  */
  /* ------------------------------------------------------------------------ */
  //
  // GET /api/guilds
  // Response:
  //   { ok:true, guilds:[{ id, name, iconURL? }] }
  //
  // Backend will intersect this with user's /users/@me/guilds list to produce
  // a server picker that only includes servers the user is in AND bot is in.
  router.get("/guilds", requireBackendKey, async (req, res) => {
    try {
      const guilds = discord?.guilds?.cache
        ? Array.from(discord.guilds.cache.values())
        : [];

      const out = guilds
        .map((g) => ({
          id: g.id,
          name: g.name,
          // iconURL can be null; safe for UI
          iconURL: typeof g.iconURL === "function" ? g.iconURL({ size: 64 }) : null,
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      return res.json({ ok: true, guilds: out });
    } catch (e) {
      console.error("[/api/guilds] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "Internal error" });
    }
  });

  /* ------------------------------------------------------------------------ */
  /* NEW: LIST CHANNELS FOR A GIVEN GUILD THAT THE BOT CAN POST TO             */
  /* ------------------------------------------------------------------------ */
  //
  // GET /api/guilds/:guildId/channels
  // Response:
  //   { ok:true, channels:[{ id, name, type }] }
  //
  // Filters to channels where bot has: ViewChannel + SendMessages + EmbedLinks
  router.get("/guilds/:guildId/channels", requireBackendKey, async (req, res) => {
    try {
      const guildId = safeTrim(req.params.guildId || "");
      if (!guildId) return res.status(400).json({ ok: false, error: "Missing guildId" });

      const guild = discord?.guilds?.cache?.get(guildId) || null;
      if (!guild) {
        return res.status(404).json({ ok: false, error: "Guild not found / bot not in guild" });
      }

      // Ensure cache is populated
      const channels = await guild.channels.fetch().catch(() => null);
      if (!channels) {
        return res.status(500).json({ ok: false, error: "Failed to fetch guild channels" });
      }

      const botUser = discord?.user || null;

      const out = [];
      for (const [, ch] of channels) {
        if (!isTextPostableChannel(ch)) continue;
        if (!channelBotCanPost(ch, botUser)) continue;

        out.push({
          id: ch.id,
          name: ch.name,
          type: ch.type, // numeric enum from discord.js
        });
      }

      out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return res.json({ ok: true, channels: out });
    } catch (e) {
      console.error("[/api/guilds/:guildId/channels] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "Internal error" });
    }
  });

  /* ------------------------------------------------------------------------ */
  /* EXISTING: SHARE ENTRY                                                     */
  /* ------------------------------------------------------------------------ */
  //
  // POST /api/share-entry
  // Body (backend -> bot):
  //   {
  //     "type": "collection" | "wishlist",
  //     "channelId": "...",
  //     "guildId": "...",           // ✅ NEW optional: if provided, bot validates channel belongs to guild
  //     "entry": { ... },           // or "payload"
  //     "message": "optional",
  //     "requestedBy": "ryan" | { username: "ryan" },
  //     "links": { "view": "https://..." }
  //   }
  router.post("/share-entry", requireBackendKey, async (req, res) => {
    try {
      const body = req.body || {};

      const {
        channelId,
        guildId, // ✅ NEW
        type,
        messageText,
        viewUrl,
        requestedBy,
        cardForFormatter,
      } = normalizeCard(body);

      if (!channelId) {
        return res.status(400).json({ ok: false, error: "Missing channelId" });
      }

      if (!cardForFormatter?.name && !cardForFormatter?.cardId) {
        return res.status(400).json({ ok: false, error: "Missing card name/cardId" });
      }

      const channel = await discord.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return res.status(404).json({ ok: false, error: "Channel not found / bot lacks access" });
      }

      // ✅ NEW: If guildId is provided, validate the channel is in that guild (prevents mismatched IDs)
      if (guildId) {
        const chGuildId = channel?.guildId ? String(channel.guildId) : "";
        if (!chGuildId || chGuildId !== String(guildId)) {
          return res.status(400).json({
            ok: false,
            error: "channel_not_in_guild",
            details: { guildId: String(guildId), channelGuildId: chGuildId || null },
          });
        }
      }

      // ✅ NEW: Permission guard (optional but useful)
      // (If channel exists but bot cannot post/embed, fail cleanly)
      if (!channelBotCanPost(channel, discord?.user)) {
        return res.status(403).json({
          ok: false,
          error: "bot_missing_permissions",
          details: "Need ViewChannel + SendMessages + EmbedLinks in target channel",
        });
      }

      // ✅ If no custom message, we still post a nice line including username if we have it.
      const username = requestedBy?.username || null;
      const contentLine = messageText
        ? `“${messageText}”`
        : username
        ? `**${username}** shared a card from their **${type}**.`
        : `Someone shared a card from their **${type}**.`;

      // ✅ Use your restored test-post style embed + button
      const msg = buildCardChannelMessage({
        env: process.env,
        requestedBy: username || requestedBy || null,
        iconURL: null,
        contentLine,
        card: cardForFormatter,
        viewUrl: viewUrl || null,
      });

      await channel.send(msg);

      return res.json({ ok: true });
    } catch (e) {
      console.error("[/api/share-entry] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "Internal error" });
    }
  });

  return router;
}

// ✅ KEEP: default export so server.js can import it as default
export default buildShareEntryRouter;
