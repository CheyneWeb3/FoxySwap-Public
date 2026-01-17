import mongoose, { Schema, model } from "mongoose";

// Avoid OverwriteModelError in dev/hmr
function getModel<T = any>(name: string, schema: Schema) {
  return (mongoose.models[name] as any) || model<T>(name, schema);
}

const D128 = mongoose.Types.Decimal128;

export type WhackStatus = "CHOOSING" | "DECIDE" | "CHOOSING2" | "RESOLVED" | "CANCELLED";
export type WhackFoundKind = "NORMAL" | "GOLDEN" | null;
export type WhackOutcome = "MISS" | "NORMAL" | "GOLDEN" | "SECOND_MISS" | "FIVE_X" | null;

const WhackGameSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    telegramUserId: { type: String, required: true, index: true },
    treasuryId: { type: String, required: true, index: true, default: "whack" },

    betYetiRaw: { type: Schema.Types.Decimal128, required: true },
    fee1YetiRaw: { type: Schema.Types.Decimal128, default: D128.fromString("0") },
    toTreasury1Raw: { type: Schema.Types.Decimal128, default: D128.fromString("0") },

    // Stage 2
    bet2YetiRaw: { type: Schema.Types.Decimal128, default: undefined },
    fee2YetiRaw: { type: Schema.Types.Decimal128, default: D128.fromString("0") },
    toTreasury2Raw: { type: Schema.Types.Decimal128, default: D128.fromString("0") },

    stage: { type: Number, required: true, default: 1 },
    status: { type: String, required: true, index: true, default: "CHOOSING" },

    // Picks (current stage only; single pick enforced)
    pick: { type: Number, default: undefined }, // 1..6
    pick2: { type: Number, default: undefined }, // stage2 pick

    // Hidden wombat holes (do not reveal to client until resolved)
    normalHole: { type: Number, required: true }, // 1..6
    goldenHole: { type: Number, required: true }, // 1..6

    foundKind: { type: String, default: null }, // NORMAL|GOLDEN
    foundHole: { type: Number, default: undefined },

    pendingPayoutRaw: { type: Schema.Types.Decimal128, default: D128.fromString("0") },
    pendingMultiplierTenths: { type: Number, default: 0 }, // 17 or 22

    outcome: { type: String, default: null },
    payoutRaw: { type: Schema.Types.Decimal128, default: D128.fromString("0") },
    multiplierTenths: { type: Number, default: 0 }, // 0,17,22,50

    expiresAt: { type: Date, required: true, index: true },

    createdAt: { type: Date, default: () => new Date(), index: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { collection: "whack_games" }
);

WhackGameSchema.index({ telegramUserId: 1, createdAt: -1 });
WhackGameSchema.index({ status: 1, expiresAt: 1 });

export const WhackGame = getModel("WhackGame", WhackGameSchema);

// ---------------- Whack config + shill state ----------------

export interface WhackConfigDoc {
  configId: string; // singleton: "global"
  imageUrl?: string;
  caption?: string;

  // Result banners (optional URLs)
  bannerWinNormalUrl?: string;
  bannerWinGoldenUrl?: string;
  bannerWinBothUrl?: string;
  bannerLoseUrl?: string;
  bannerTauntUrl?: string;

  minBetYetiRaw: any; // Decimal128
  quickBetButtons: number[]; // e.g. [1,3,5]
  dmOnly: boolean;
  autoDelete: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export interface WhackChatDoc {
  chatId: string; // group/supergroup id as string
  shillMessageId?: number;
  shillIntervalSec: number; // 0 disables
  lastShillAt?: Date;
  updatedAt: Date;
  createdAt: Date;
}

const WhackConfigSchema = new Schema<WhackConfigDoc>(
  {
    configId: { type: String, unique: true, index: true, required: true },
    imageUrl: { type: String },
    caption: { type: String },

    bannerWinNormalUrl: { type: String },
    bannerWinGoldenUrl: { type: String },
    bannerWinBothUrl: { type: String },
    bannerLoseUrl: { type: String },
    bannerTauntUrl: { type: String },

    minBetYetiRaw: { type: Schema.Types.Decimal128, required: true },
    quickBetButtons: { type: [Number], required: true },
    dmOnly: { type: Boolean, required: true },
    autoDelete: { type: Boolean, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { minimize: false, collection: "whack_config" }
);

const WhackChatSchema = new Schema<WhackChatDoc>(
  {
    chatId: { type: String, unique: true, index: true, required: true },
    shillMessageId: { type: Number },
    shillIntervalSec: { type: Number, required: true },
    lastShillAt: { type: Date },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { minimize: false, collection: "whack_chats" }
);

export const WhackConfig = mongoose.models.WhackConfig || mongoose.model<WhackConfigDoc>("WhackConfig", WhackConfigSchema);
export const WhackChat = mongoose.models.WhackChat || mongoose.model<WhackChatDoc>("WhackChat", WhackChatSchema);
