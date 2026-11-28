import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export type AuditOutcome = "success" | "failure" | "denied";

const AuditLogSchema = new Schema(
  {
    // Actor (who performed the operation)
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    actorRole: {
      type: String,
      required: true,
      index: true,
    },

    // Action & RBAC context
    action: {
      // e.g. "auth.login", "admin_user.create", "admin_user.update_access", "product.delete", "inventory.adjust"
      type: String,
      required: true,
      index: true,
    },
    requiredPermission: {
      // e.g. "users:manage", "products:write", "inventory:adjust"
      type: String,
      default: null,
    },
    outcome: {
      type: String,
      enum: ["success", "failure", "denied"],
      required: true,
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },

    // Target entity (optional for auth/system actions)
    targetType: {
      // e.g. "AdminUser", "Product", "Inventory", "Order", "Session"
      type: String,
      default: null,
      index: true,
    },
    targetId: {
      type: String,
      default: null,
      index: true,
    },
    targetLabel: {
      // Human-friendly identifier like email, SKU, or order number
      type: String,
      default: null,
    },

    // State snapshot / diff (sanitized—never store passwords or secrets)
    changes: {
      before: { type: Schema.Types.Mixed, default: null },
      after: { type: Schema.Types.Mixed, default: null },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },

    // Request / transport metadata
    method: { type: String, default: null },
    path: { type: String, default: null },
    statusCode: { type: Number, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },

    // Immutable timestamp
    createdAt: {
      type: Date,
      default: () => new Date(),
      immutable: true,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

// Compound indexes for common admin audit queries
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, outcome: 1, createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof AuditLogSchema>;

const AuditLog: Model<AuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<AuditLogDocument>("AuditLog", AuditLogSchema);

export default AuditLog;
