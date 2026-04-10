import { DataTypes } from 'sequelize';

export const TRADE_STATUSES = [
  'INITIATED',
  'NEGOTIATING',
  'AGREED',
  'PROOF_PENDING',
  'LOCKED',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
];

// Statuses that allow cancellation
export const CANCELLABLE = new Set(['INITIATED', 'NEGOTIATING', 'AGREED', 'PROOF_PENDING']);
// Statuses that allow responding (accept/counter/decline)
export const RESPONDABLE = new Set(['INITIATED', 'NEGOTIATING']);
// Statuses that allow raising a dispute
export const DISPUTABLE  = new Set(['AGREED', 'PROOF_PENDING', 'LOCKED', 'IN_TRANSIT']);

export default function defineTrade(sequelize) {
  return sequelize.define('Trade', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.ENUM(...TRADE_STATUSES), allowNull: false, defaultValue: 'INITIATED' },
    partyAId:    { type: DataTypes.UUID, allowNull: false },
    partyBId:    { type: DataTypes.UUID, allowNull: false },
    initiatorId: { type: DataTypes.UUID, allowNull: false },

    // Shipping
    addressA:         { type: DataTypes.TEXT,         allowNull: true },
    addressB:         { type: DataTypes.TEXT,         allowNull: true },
    shippingMethodA:  { type: DataTypes.STRING,       allowNull: true },
    shippingMethodB:  { type: DataTypes.STRING,       allowNull: true },
    trackingNumberA:  { type: DataTypes.STRING,       allowNull: true },
    trackingNumberB:  { type: DataTypes.STRING,       allowNull: true },

    // Value & top-up (top-up flow is prep only — not active)
    valueA:     { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    valueB:     { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    topUpAmount:{ type: DataTypes.DECIMAL(12, 2), allowNull: true },
    topUpPaidBy:{ type: DataTypes.UUID,           allowNull: true },
    topUpPaidAt:{ type: DataTypes.DATE,           allowNull: true },

    // Proof verification flags
    proofAVerified: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
    proofBVerified: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },

    // Negotiation tracking
    counterCount:  { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    lastCounterBy: { type: DataTypes.UUID,    allowNull: true },

    // Timestamps
    agreedAt:     { type: DataTypes.DATE, allowNull: true },
    lockedAt:     { type: DataTypes.DATE, allowNull: true },
    completedAt:  { type: DataTypes.DATE, allowNull: true },
    cancelledAt:  { type: DataTypes.DATE, allowNull: true },
    cancelledBy:  { type: DataTypes.UUID, allowNull: true },
    cancelledReason: { type: DataTypes.TEXT, allowNull: true },

    // JSON: { confirmedReceived: [userId, ...] }
    metaJson:   { type: DataTypes.JSON, allowNull: true },

    // Dispute
    disputeId:  { type: DataTypes.UUID, allowNull: true },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'trades',
    indexes: [
      { fields: ['partyAId'] },
      { fields: ['partyBId'] },
      { fields: ['initiatorId'] },
      { fields: ['status'] },
    ],
  });
}
