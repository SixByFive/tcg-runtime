// src/index.js
// CHANGED: Pass the Discord client into registerCommands(client).
// CHANGED: No getCommandHandlers import (router lives inside interaction handler).

import { ENV } from "./config/env.js";
import { startDiscord, stopDiscord } from "./core/client.js";
import { startHttp, stopHttp } from "./api/server.js";
import { getSequelize, closeSequelize } from "./core/db.js";
import { registerCommands } from "./core/commands.js";
import { onInteractionCreate } from "./events/interactionCreate.js";
import { initGuildModels } from "./modules/guilds/model.js";
import { initShareModels } from "./modules/share/model.js";

async function main() {
  console.log(`[Boot] SBF Bot starting (env=${ENV.NODE_ENV})`);
  console.log("[Boot] Mode: all (Discord + HTTP API)");

  // DB init (safe if DB_* not set; your stub no-ops)
  try {
    getSequelize();
  } catch (e) {
    console.error("[DB] init error:", e);
  }

  // Init models (ensure tables exist in dev)
  try {
    await initGuildModels();
    if (typeof initShareModels === "function") {
      await initShareModels();
    }
  } catch (e) {
    console.error("[DB] model init error:", e);
  }

  // Start Discord first so we can pass the client to the API and registrar
  const client = await startDiscord();

  // Start HTTP API (pass client so /api/share-card can post)
  startHttp(client);

  // Register slash commands (guild-scoped if DEV_GUILD_ID is set)
  // CHANGED: pass the client; core/commands will fallback to ENV if needed
  await registerCommands(client);

  // Route interactions (pass the function; do NOT call it)
  client.on("interactionCreate", onInteractionCreate);

  console.log("[Boot] All services started.");
}

async function shutdown(signal = "SIGTERM") {
  console.log(`[Shutdown] Received ${signal}, closing...`);
  try { await stopDiscord(); } catch {}
  try { await stopHttp(); } catch {}
  try { await closeSequelize(); } catch {}
  console.log("[Shutdown] Bye.");
  process.exit(0);
}

process.on("unhandledRejection", (err) => {
  console.error("[Fatal] UnhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[Fatal] UncaughtException:", err);
  shutdown("FATAL");
});
["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => shutdown(sig)));

main().catch((e) => {
  console.error("[Boot] Failed to start:", e);
  process.exit(1);
});
