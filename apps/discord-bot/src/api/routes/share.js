// src/api/routes/share.js
// POST /api/share-card
//
// UPDATED (2026-01-22):
// - FIX: Provide a NAMED export `shareRouter` so api/server.js can do:
//     import { shareRouter } from "./routes/share.js";
// - KEEP: Also export default for compatibility.
// - SECURITY: Simple shared secret via header "x-sbf-key" (matches ENV.SBF_API_KEY)
//
// Notes:
// - This router is mounted at "/api" in src/api/server.js
// - So the full path becomes: POST /api/share-card

import { Router } from "express";
import { postShare } from "../../modules/share/share.service.js";
import { ENV } from "../../config/env.js";

/**
 * Named export (the thing your server.js expects)
 * @param {import("discord.js").Client} client
 */
export function shareRouter(client) {
  const r = Router();

  r.post("/share-card", async (req, res) => {
    try {
      // Basic auth: X-SBF-KEY must match env
      const key = req.header("x-sbf-key");
      if (!ENV.SBF_API_KEY || key !== ENV.SBF_API_KEY) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const { guildId, channelId, discordUserId, type, card, caption } = req.body || {};

      if (!guildId || !type || !card?.name) {
        return res.status(400).json({
          ok: false,
          error: "Missing required fields (guildId, type, card.name)",
        });
      }

      const resp = await postShare({
        client,
        guildId,
        channelId,
        discordUserId,
        type, // "collection" | "trade" | "wishlist"
        card,
        context: { source: "external", caption },
      });

      if (!resp?.ok) return res.status(400).json(resp || { ok: false, error: "failed" });

      return res.json({ ok: true, channelId: resp.channelId });
    } catch (err) {
      console.error("[API] /share-card error:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  return r;
}

// ALSO export default for compatibility with default-import style
export default shareRouter;
