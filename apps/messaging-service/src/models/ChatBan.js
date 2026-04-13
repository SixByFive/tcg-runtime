import { DataTypes } from 'sequelize';

export function defineChatBan(sequelize) {
  return sequelize.define('ChatBan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'chat_bans',
    indexes: [
      { unique: true, fields: ['userId'] },
      { fields: ['adminId'] },
    ],
  });
}
