import { DataTypes } from 'sequelize';

export default function defineInventoryItem(sequelize) {
  return sequelize.define('InventoryItem', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productListingId: { type: DataTypes.UUID, allowNull: false, unique: true },
    onHand:           { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    reserved:         { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    sold:             { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  }, {
    tableName: 'inventory_items',
    timestamps: true,
    indexes: [{ fields: ['productListingId'] }],
  });
}
