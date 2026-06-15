// src/events/interactionCreate.js
// CHANGED: No central defer. Subcommands must defer immediately.
// CHANGED: Version-safe (supports isChatInputCommand() and isCommand()).
// CHANGED: One-and-only-one handler via guardOnce.

import { guardOnce } from "../core/onceGuard.js";
import { Collection, Events } from "discord.js";
import * as sbf from "../modules/guilds/commands/sbf.js";

// Register top-level commands here
const commands = new Collection([["sbf", sbf]]);

/**
 * Register with: client.on(Events.InteractionCreate, onInteractionCreate)
 */
export async function onInteractionCreate(interaction) {
  try {
    const isChat =
      typeof interaction?.isChatInputCommand === "function"
        ? interaction.isChatInputCommand()
        : typeof interaction?.isCommand === "function"
        ? interaction.isCommand()
        : false;

    if (!isChat) return;

    // Prevent double-handling
    if (!guardOnce(interaction.id)) return;

    const cmd = commands.get(interaction.commandName);
    if (!cmd || typeof cmd.execute !== "function") {
      // We haven't deferred, so we must reply now
      await safeReply(interaction, {
        content: "Unknown command.",
        ephemeral: true,
      });
      return;
    }

    // Delegate. Subcommand is responsible for defer+reply lifecycle.
    await cmd.execute(interaction);
  } catch (fatal) {
    console.error("[interactionCreate] fatal", fatal);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "Interaction failed unexpectedly.",
          ephemeral: true,
        });
      }
    } catch {}
  }
}

async function safeReply(interaction, payload) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply(payload);
    }
    return await interaction.editReply(payload);
  } catch (e) {
    console.warn("[interactionCreate] safeReply failed:", e?.message);
  }
}
