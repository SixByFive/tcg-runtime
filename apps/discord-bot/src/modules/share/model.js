// Stores each share attempt for auditing/rate limits later.
import { DataTypes, Model } from "sequelize";
import { getSequelize } from "../../core/db.js";

export class DiscordShareLog extends Model {}

export async function initShareModels() {
  const sequelize = getSequelize();
  if (!sequelize) {
    console.warn("[ShareModel] No DB configured; share logs won't persist this run.");
    return;
  }

  DiscordShareLog.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      guild_id: { type: DataTypes.STRING(32), allowNull: false },
      channel_id: { type: DataTypes.STRING(32), allowNull: false },
      discord_user_id: { type: DataTypes.STRING(32), allowNull: true },
      type: { type: DataTypes.STRING(32), allowNull: false }, // collection|trade|wishlist
      card_id: { type: DataTypes.STRING(64), allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: false },
      ok: { type: DataTypes.BOOLEAN, defaultValue: false },
      error: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { sequelize, tableName: "discord_share_logs", timestamps: false }
  );

  await DiscordShareLog.sync(); // dev-friendly; replace with migrations later
}
