import { DataTypes } from 'sequelize';

export function defineChatMute(sequelize) {
  return sequelize.define('ChatMute', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    otherUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    mutedUntil: {
      type: DataTypes.DATE,
      allowNull: true, // null = muted forever
    },
  }, {
    tableName: 'chat_mutes',
    indexes: [
      { unique: true, fields: ['userId', 'otherUserId'] },
      { fields: ['userId'] },
      { fields: ['otherUserId'] },
    ],
  });
}
