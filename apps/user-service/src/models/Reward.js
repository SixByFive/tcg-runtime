import { DataTypes } from 'sequelize';

export default function defineReward(sequelize) {
  return sequelize.define('Reward', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    achievementId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    grantedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'rewards',
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
    ],
  });
}
