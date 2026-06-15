// src/api/server.js
// Tiny Express API with /healthz and optional /api routes (needs Discord client)
//
// UPDATED (2026-01-26):
// - UPDATE: Log now includes the NEW share target routes:
//     - GET  /api/guilds
//     - GET  /api/guilds/:guildId/channels
// - KEEP: Mount /api routers WITHOUT "/api" in their internal paths.
// - KEEP: Auto-start only when run directly (npm run api)
// - KEEP: Clear log of enabled routes

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { ENV } from "../config/env.js";
import { pathToFileURL } from "node:url";

import { shareRouter } from "./routes/share.js";
import buildShareEntryRouter from "../http/routes/shareEntry.js";

let server;

/**
 * Start the HTTP server.
 * @param {import('discord.js').Client?} clientInstance - pass the logged-in Discord client to enable /api routes
 */
export function startHttp(clientInstance) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(ENV.NODE_ENV === "production" ? "combined" : "dev"));

  // Health check
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "sbf-bot-api", env: ENV.NODE_ENV });
  });

  if (clientInstance) {
    // Existing route group: POST /api/share-card
    app.use("/api", shareRouter(clientInstance));

    // Route group: /api/share-entry + NEW /api/guilds + NEW /api/guilds/:guildId/channels
    // (router defines routes WITHOUT "/api")
    app.use("/api", buildShareEntryRouter(clientInstance));

    console.log("[HTTP] /api routes enabled ✅ (Discord client injected)");
  } else {
    console.warn("[HTTP] No Discord client passed; /api routes are disabled.");
  }

  server = app.listen(ENV.PORT || 4001, () => {
    console.log(`[HTTP] Listening on :${ENV.PORT || 4001}`);

    if (clientInstance) {
      // UPDATED: include the new endpoints
      console.log(
        [
          "[HTTP] Available:",
          "GET /healthz",
          "POST /api/share-card",
          "POST /api/share-entry",
          "GET /api/guilds",
          "GET /api/guilds/:guildId/channels",
        ].join(", ")
      );
    } else {
      console.log("[HTTP] Available: GET /healthz");
    }
  });

  return server;
}

export async function stopHttp() {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
  server = undefined;
}

/* ===== AUTO-START WHEN RUN DIRECTLY (cross-platform) =====
   For standalone API runs (e.g., `npm run api`) where you don't have
   a Discord client to pass in, this will start the server WITHOUT /api routes. */
const isDirect =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirect) startHttp(undefined);
