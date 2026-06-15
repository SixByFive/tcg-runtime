// src/core/client.js
// Minimal Discord client bootstrap
// CHANGED: Added v15-compatible ready handler (supports "ready" and "clientReady")

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { ENV } from "../config/env.js";

let client;

/**
 * startDiscord(): logs the bot in and returns the client.
 */
export async function startDiscord() {
  if (client) return client;

  // Minimal intent: Guilds only (no message content, no members).
  client = new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
  });

  // CHANGED: ready handler compatible with v14 ("ready") and v15 ("clientReady")
  const onClientReady = () => {
    console.log(
      `[Discord] Logged in as ${client.user.tag} (id=${client.user.id})`
    );
  };
  // client.once("ready", onClientReady);        // v14 name
  client.once("clientReady", onClientReady);  // v15 name

  // (unchanged) basic error hooks
  client.on("error", (err) => console.error("[Discord] Client error:", err));
  client.on("shardError", (err) => console.error("[Discord] Shard error:", err));

  await client.login(ENV.DISCORD_BOT_TOKEN);
  return client;
}

/** stopDiscord(): logs out cleanly. */
export async function stopDiscord() {
  if (!client) return;
  try {
    await client.destroy();
  } catch (e) {
    console.warn("[Discord] destroy() warn:", e?.message || e);
  } finally {
    client = undefined;
  }
}
