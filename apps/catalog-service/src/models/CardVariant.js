import { DataTypes } from 'sequelize';

export function defineCardVariant(sequelize) {
  return sequelize.define('CardVariant', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    card_id: DataTypes.STRING(80),
    variant: DataTypes.STRING(40),
    display_name: DataTypes.STRING(80),
  }, {
    tableName: 'm_card_variants',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['card_id', 'variant'] },
      { fields: ['card_id'] },
    ],
  });
}
