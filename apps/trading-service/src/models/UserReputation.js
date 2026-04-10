import { DataTypes } from 'sequelize';

// Read/write reference to user-service's user_reputations table.
// trading-service updates reputation on trade completion/feedback.
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
  }, {
    tableName: 'user_reputations',
    // Never sync — owned by user-service
  });
}
