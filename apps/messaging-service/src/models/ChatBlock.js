import { DataTypes } from 'sequelize';

export function defineChatBlock(sequelize) {
  return sequelize.define('ChatBlock', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    blockerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    blockedId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'chat_blocks',
    indexes: [
      { unique: true, fields: ['blockerId', 'blockedId'] },
      { fields: ['blockerId'] },
      { fields: ['blockedId'] },
    ],
  });
}
