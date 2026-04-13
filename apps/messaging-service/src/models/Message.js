import { DataTypes } from 'sequelize';

export function defineMessage(sequelize) {
  return sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    deletedBySender: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    deletedByReceiver: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    flagReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    flaggedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isSystemMessage: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    reminderSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'messages',
    indexes: [
      { fields: ['senderId'] },
      { fields: ['receiverId'] },
      { fields: ['createdAt'] },
      { fields: ['isFlagged'] },
      { fields: ['expiresAt'] },
      { fields: ['isSystemMessage'] },
      { fields: ['reminderSentAt'] },
    ],
  });
}
