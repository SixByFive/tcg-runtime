// src/modules/guilds/commands/sbf.js
import { SlashCommandBuilder } from "discord.js";

import * as ping from "./subcommands/ping.js";
import * as testPost from "./subcommands/test-post.js";
import * as settings from "./subcommands/settings.js";
import * as setChannel from "./subcommands/set-channel.js";
import * as allowExternal from "./subcommands/allow-external.js";
import * as card from "./subcommands/card.js";
import * as cards from "./subcommands/cards.js";
import * as help from "./subcommands/help.js";
import * as status from "./subcommands/status.js";

// NOTE:
// - Keep subcommands in this one list so /core/commands.js only registers a single top-level /sbf command.
// - New tools should be shipped as additional subcommands here.
const subcommands = [ping, testPost, settings, setChannel, allowExternal, card, cards, help, status];

const builder = new SlashCommandBuilder()
  .setName("sbf")
  .setDescription("SixByFive bot commands")
  .setDMPermission(false);

for (const sc of subcommands) {
  builder.addSubcommand((opt) => {
    opt.setName(sc.name).setDescription(sc.description);
    if (typeof sc.build === "function") sc.build(opt);
    return opt;
  });
}

export const data = builder;

export async function execute(interaction) {
  const name = interaction.options.getSubcommand();
  const mod = subcommands.find((sc) => sc.name === name);

  if (!mod || typeof mod.execute !== "function") {
    // We haven't deferred here; subcommands do that.
    // So we must reply now to avoid "Unknown interaction".
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
    } else {
      await interaction.editReply({ content: "Unknown subcommand." });
    }
    return;
  }

  return mod.execute(interaction);
}
