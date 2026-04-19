import { DataTypes } from 'sequelize';
export default function defineAdminAction(sequelize) {
  return sequelize.define('AdminAction', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    adminId:      { type: DataTypes.UUID, allowNull: false },
    action:       { type: DataTypes.STRING(50), allowNull: false },
    targetId:     { type: DataTypes.STRING(100), allowNull: true },
    targetType:   { type: DataTypes.STRING(50), allowNull: true },
    details:      { type: DataTypes.JSON, allowNull: true },
    ip:           { type: DataTypes.STRING(45), allowNull: true },
  }, { tableName: 'admin_actions', timestamps: true, updatedAt: false });
}
