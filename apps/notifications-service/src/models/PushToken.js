import { DataTypes } from 'sequelize';

export default function definePushToken(sequelize) {
  return sequelize.define('PushToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: true, // 'ios' | 'android'
    },
    deviceName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    appVersion: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  }, {
    tableName: 'push_tokens',
    indexes: [
      { fields: ['userId'] },
      { unique: true, fields: ['token'] },
    ],
  });
}
