import { DataTypes } from 'sequelize';

/**
 * Cross-service reference to user_reputations table (owned by user-service).
 * Marketplace-service writes completedMarketplace++ and positive/neutral/negative
 * when buyer leaves feedback after order completion.
 * No sync — table is managed by user-service.
 */
export default function defineUserReputation(sequelize) {
  return sequelize.define('UserReputation', {
    userId:               { type: DataTypes.UUID, primaryKey: true },
    score:                { type: DataTypes.INTEGER, defaultValue: 0 },
    positive:             { type: DataTypes.INTEGER, defaultValue: 0 },
    negative:             { type: DataTypes.INTEGER, defaultValue: 0 },
    neutral:              { type: DataTypes.INTEGER, defaultValue: 0 },
    completedTrades:      { type: DataTypes.INTEGER, defaultValue: 0 },
    completedMarketplace: { type: DataTypes.INTEGER, defaultValue: 0 },
    flagged:              { type: DataTypes.BOOLEAN, defaultValue: false },
    banReason:            { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'user_reputations',
    timestamps: false,
  });
}
