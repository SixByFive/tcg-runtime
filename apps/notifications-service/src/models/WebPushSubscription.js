import { DataTypes } from 'sequelize';

export default function defineWebPushSubscription(sequelize) {
  return sequelize.define('WebPushSubscription', {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    // The subscription endpoint URL from the browser
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // P256DH key (base64url)
    p256dh: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Auth secret (base64url)
    auth: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    // Optional: browser/UA label for display
    userAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'web_push_subscriptions',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['endpoint'], unique: true },
    ],
  });
}
