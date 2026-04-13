import { DataTypes } from 'sequelize';

export function defineChatAgreement(sequelize) {
  return sequelize.define('ChatAgreement', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    agreedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    tableName: 'chat_agreements',
  });
}
