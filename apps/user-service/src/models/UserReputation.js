import { DataTypes } from 'sequelize';

export default function defineUserReputation(sequelize) {
  return sequelize.define('UserReputation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId:              { type: DataTypes.UUID, allowNull: false, unique: true },
    score:               { type: DataTypes.INTEGER, defaultValue: 0 },
    positive:            { type: DataTypes.INTEGER, defaultValue: 0 },
    negative:            { type: DataTypes.INTEGER, defaultValue: 0 },
    neutral:             { type: DataTypes.INTEGER, defaultValue: 0 },
    completedTrades:     { type: DataTypes.INTEGER, defaultValue: 0 },
    completedMarketplace:{ type: DataTypes.INTEGER, defaultValue: 0 },
    flagged:             { type: DataTypes.BOOLEAN, defaultValue: false },
    banReason:           { type: DataTypes.STRING, allowNull: true },
    lastUpdated:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'user_reputations',
    timestamps: false,
    indexes: [
      { fields: ['userId'] },
      { fields: ['score'] },
      { fields: ['flagged'] },
    ],
  });
}
