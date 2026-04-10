import { DataTypes } from 'sequelize';

export default function defineUserNotificationPref(sequelize) {
  return sequelize.define('UserNotificationPref', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    inappEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    emailEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    pushEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    // 'instant' | 'daily'
    digest: {
      type: DataTypes.STRING(16),
      defaultValue: 'instant',
      allowNull: false,
    },
    // "HH:MM" 24-hour — quiet hours suppress email/push delivery
    quietStart: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    quietEnd: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
  }, {
    tableName: 'user_notification_prefs',
  });
}
