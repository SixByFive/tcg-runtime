import { DataTypes } from 'sequelize';

// Cross-service read-only model — maps to the `profiles` table owned by user-service.
// No sync() — schema is managed by user-service.
export default function defineUserProfile(sequelize) {
  return sequelize.define('UserProfile', {
    id:       { type: DataTypes.UUID, primaryKey: true },
    userId:   { type: DataTypes.UUID, allowNull: false },
    address1: { type: DataTypes.STRING, allowNull: true },
    address2: { type: DataTypes.STRING, allowNull: true },
    city:     { type: DataTypes.STRING, allowNull: true },
    postcode: { type: DataTypes.STRING, allowNull: true },
    state:    { type: DataTypes.STRING, allowNull: true },
    country:  { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'profiles',
    timestamps: true,
  });
}
