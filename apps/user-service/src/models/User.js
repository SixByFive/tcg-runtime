// Read-only view of the users table owned by auth-service.
// Only maps fields needed for display/management — no auth fields.
import { DataTypes } from 'sequelize';

export default function defineUser(sequelize) {
  return sequelize.define('User', {
    id:            { type: DataTypes.UUID, primaryKey: true },
    username:      { type: DataTypes.STRING(30), allowNull: false },
    email:         { type: DataTypes.STRING, allowNull: false },
    password:      { type: DataTypes.STRING, allowNull: true },  // needed for deleteAccount only
    isAdmin:       { type: DataTypes.BOOLEAN, defaultValue: false },
    isBanned:      { type: DataTypes.BOOLEAN, defaultValue: false },
    emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastLogin:     { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'users',
    timestamps: true,
  });
}
