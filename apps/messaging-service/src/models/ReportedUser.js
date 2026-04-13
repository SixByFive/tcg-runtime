import { DataTypes } from 'sequelize';

export function defineReportedUser(sequelize) {
  return sequelize.define('ReportedUser', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    reporterId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isCleared: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  }, {
    tableName: 'reported_users',
    indexes: [
      { fields: ['userId'] },
      { fields: ['reporterId'] },
      { fields: ['isCleared'] },
    ],
  });
}
