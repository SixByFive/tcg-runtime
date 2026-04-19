import { DataTypes } from 'sequelize';
export default function defineUserAchievement(sequelize) {
  return sequelize.define('UserAchievement', {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId:        { type: DataTypes.UUID, allowNull: false },
    achievementId: { type: DataTypes.UUID, allowNull: false },
    earnedAt:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    data:          { type: DataTypes.JSON, allowNull: true },
  }, {
    tableName: 'user_achievements', timestamps: false,
    indexes: [{ unique: true, fields: ['userId', 'achievementId'] }],
  });
}
