// Stores per-guild config: default channel + allow_external_posts
// CHANGED/NEW: Sequelize model + init hook

import { DataTypes, Model } from "sequelize";
import { getSequelize } from "../../core/db.js";

export class DiscordGuild extends Model {}

export async function initGuildModels() {
  const sequelize = getSequelize();
  if (!sequelize) {
    console.warn("[GuildModel] No DB configured; guild settings won't persist this run.");
    return;
  }

  DiscordGuild.init(
    {
      guild_id: { type: DataTypes.STRING(32), primaryKey: true },
      guild_name: { type: DataTypes.STRING(200) },
      default_channel_id: { type: DataTypes.STRING(32), allowNull: true },
      allow_external_posts: { type: DataTypes.BOOLEAN, defaultValue: false },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    },
    {
      sequelize,
      tableName: "discord_guilds",
      timestamps: false
    }
  );

  await DiscordGuild.sync(); // creates table if missing (dev-friendly)
}
