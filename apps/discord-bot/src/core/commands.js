// src/core/commands.js
// CHANGED: Robust appId resolution. Uses client.application.id if available,
// otherwise falls back to ENV.DISCORD_CLIENT_ID. Clear logs + guild/global split.

import { Routes } from "discord.js";
import { REST } from "@discordjs/rest";
import * as sbf from "../modules/guilds/commands/sbf.js";
import { ENV } from "../config/env.js";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

/**
 * Register slash commands.
 * @param {import('discord.js').Client | undefined} client
 */
export async function registerCommands(client) {
  // Prefer the live client's application id; fallback to env.
  let appId = client?.application?.id;
  if (!appId) {
    appId = ENV.DISCORD_CLIENT_ID;
    if (!appId) {
      throw new Error(
        "[Commands] Missing application id. Provide ENV.DISCORD_CLIENT_ID or pass a logged-in client."
      );
    } else {
      console.warn(
        `[Commands] Using ENV.DISCORD_CLIENT_ID (${appId}) since client.application.id is not available yet.`
      );
    }
  }

  const body = [sbf.data.toJSON()];
  const devGuild = process.env.DEV_GUILD_ID?.trim();

  if (devGuild) {
    console.log(`[Commands] Registering ${body.length} to dev guild ${devGuild} (app ${appId})`);
    await rest.put(Routes.applicationGuildCommands(appId, devGuild), { body });
    console.log("[Commands] Dev guild commands up to date.");
  } else {
    console.log(`[Commands] Registering ${body.length} globally (app ${appId})`);
    await rest.put(Routes.applicationCommands(appId), { body });
    console.log("[Commands] Global commands up to date (can take a minute to propagate).");
  }
}
