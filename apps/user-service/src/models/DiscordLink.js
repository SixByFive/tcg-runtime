import { DataTypes } from 'sequelize';

// Read-only view into the auth-service's user_discord_links table.
// No sync — this table is owned and managed by auth-service.
export default function defineDiscordLink(sequelize) {
  return sequelize.define('DiscordLink', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    discordUserId: DataTypes.STRING,
    discordUsername: DataTypes.STRING,
    avatar: DataTypes.STRING,
    linkedAt: DataTypes.DATE,
    discordAccessTokenEnc:  DataTypes.STRING,
    discordRefreshTokenEnc: DataTypes.STRING,
    discordTokenExpiresAt:  DataTypes.DATE,
  }, {
    tableName: 'user_discord_links',
    timestamps: false,
  });
}
