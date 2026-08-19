import { DataTypes } from 'sequelize';

export default function defineUser(sequelize) {
  return sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      // null for Google-only accounts
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      // Active TOTP secret (only set after 2FA is verified and enabled)
      twoFactorSecret: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Temporary secret stored between /2fa/setup and /2fa/verify
      twoFactorPending: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      isBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      verifyToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      verifyTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      chatBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      referrerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // First-touch marketing attribution captured when the account is created.
      // These deliberately contain only campaign metadata, never a raw landing URL.
      utmSource: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      utmMedium: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      utmCampaign: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      utmContent: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      // Age / parental-control fields
      dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      restrictionLevel: {
        type: DataTypes.TINYINT,
        defaultValue: 0,
        allowNull: false,
        comment: '0=none, 1=teen, 2=child',
      },
      parentEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parentApproved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      tableName: 'users',
      indexes: [
        { fields: ['email'] },
        { fields: ['username'] },
        { fields: ['resetToken'] },
        { fields: ['verifyToken'] },
        { fields: ['googleId'] },
        { fields: ['referrerId'] },
      ],
    },
  );
}
