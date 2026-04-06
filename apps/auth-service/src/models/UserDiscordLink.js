import { DataTypes } from 'sequelize';

export default function defineUserDiscordLink(sequelize) {
  return sequelize.define('UserDiscordLink', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    discordUserId:      { type: DataTypes.STRING(32) },
    discordUsername:    { type: DataTypes.STRING(100) },
    avatar:             { type: DataTypes.STRING(100) },
    linkedAt:           { type: DataTypes.DATE },
    // AES-256-GCM encrypted tokens stored as iv.tag.data (base64)
    discordAccessTokenEnc:  { type: DataTypes.TEXT },
    discordRefreshTokenEnc: { type: DataTypes.TEXT },
    discordTokenExpiresAt:  { type: DataTypes.DATE },
  }, {
    tableName: 'user_discord_links',
    timestamps: false,
    indexes: [{ fields: ['discordUserId'] }],
  });
}
