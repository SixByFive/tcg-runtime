// bot/src/http/middleware/requireBackendKey.js
//
// UPDATED (2026-01-24):
// - FIX: Provide a real DEFAULT export so ESM imports work:
//     import requireBackendKey from "../middleware/requireBackendKey.js";
// - KEEP: Named export `requireBackendKey` still works.
// - KEEP: Accept key from DISCORD_BOT_API_KEY or SBF_API_KEY
// - KEEP: Accept header x-sbf-key or x-sbf-api-key

import { ENV } from "../../config/env.js";

// Constant-time-ish compare to avoid trivial timing differences
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function requireBackendKey(req, res, next) {
  const expected =
    process.env.DISCORD_BOT_API_KEY ||
    process.env.SBF_API_KEY ||
    ENV.DISCORD_BOT_API_KEY ||
    ENV.SBF_API_KEY ||
    "";

  if (!expected) {
    console.error(
      "[requireBackendKey] Missing server key. Set DISCORD_BOT_API_KEY (or SBF_API_KEY)."
    );
    return res.status(500).json({
      ok: false,
      error: "server_misconfigured",
      message: "Bot missing DISCORD_BOT_API_KEY (or SBF_API_KEY).",
    });
  }

  const got = req.header("x-sbf-key") || req.header("x-sbf-api-key") || "";

  if (process.env.DEBUG_BACKEND_KEY === "1") {
    console.log(
      "[requireBackendKey] headerPresent=",
      !!got,
      "headerLen=",
      got.length
    );
  }

  if (!got || !safeEqual(String(got), String(expected))) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  return next();
}

// ✅ FIX: REAL DEFAULT EXPORT (prevents your ESM error)
export default requireBackendKey;
