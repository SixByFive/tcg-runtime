import { DataTypes } from 'sequelize';

export default function defineAuditLog(sequelize) {
  return sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    targetId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    targetType: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'audit_logs',
    indexes: [
      { fields: ['userId'] },
      { fields: ['action'] },
      { fields: ['targetId', 'targetType'] },
      { fields: ['createdAt'] },
    ],
  });
}
