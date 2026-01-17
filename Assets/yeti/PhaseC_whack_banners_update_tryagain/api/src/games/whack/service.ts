import crypto from "crypto";
import { WhackChat, WhackConfig, WhackGame } from "./model";
import type { GameContext } from "../_core/types";

export const WHACK_TREASURY_ID = "whack";
export const WHACK_CONFIG_ID = "global";

const VERSION_DATE = "2026-01-17"; // requested: date the game build

const HOLES = [1, 2, 3, 4, 5, 6] as const;

function randInt(minIncl: number, maxExcl: number) {
  return crypto.randomInt(minIncl, maxExcl);
}

function pickTwoDistinctHoles(): { normalHole: number; goldenHole: number } {
  const a = HOLES[randInt(0, HOLES.length)];
  let b = HOLES[randInt(0, HOLES.length)];
  while (b === a) b = HOLES[randInt(0, HOLES.length)];
  // Randomly assign which is normal vs golden (50/50)
  if (randInt(0, 2) === 0) return { normalHole: a, goldenHole: b };
  return { normalHole: b, goldenHole: a };
}

function nowPlusMs(ms: number) {
  return new Date(Date.now() + ms);
}

export function maxBetRawFromTreasury(treasury: any, d128ToBig: (v: any) => bigint): bigint {
  const bal = d128ToBig(treasury?.balanceYetiRaw);
  const bps = Number(treasury?.maxBetBps ?? 1000);
  if (!Number.isFinite(bps) || bps <= 0) return 0n;
  return (bal * BigInt(bps)) / 10000n;
}

export async function ensureWhackTreasury(ctx: GameContext) {
  // Create if missing. Keep maxBetBps default 1000 (10%).
  await ctx.Treasury.updateOne(
    { treasuryId: WHACK_TREASURY_ID },
    {
      $setOnInsert: {
        treasuryId: WHACK_TREASURY_ID,
        name: "Whack Treasury",
        enabled: true,
        maxBetBps: 1000,
        balanceYetiRaw: ctx.d128(0n),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function ensureWhackConfig(ctx: GameContext) {
  // Defaults are conservative and can be changed via /whackadmin
  const now = new Date();
  await WhackConfig.updateOne(
    { configId: WHACK_CONFIG_ID },
    {
      $setOnInsert: {
        configId: WHACK_CONFIG_ID,
        imageUrl: "",
        caption: "Whack-a-Wombat",
        // Result banners (optional URLs)
        bannerWinNormalUrl: "",
        bannerWinGoldenUrl: "",
        bannerWinBothUrl: "",
        bannerLoseUrl: "",
        bannerTauntUrl: "",

        minBetYetiRaw: ctx.d128(ctx.parseUnits("1", ctx.yetiDecimals)),
        quickBetButtons: [1, 3, 5],
        dmOnly: false,
        autoDelete: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

async function getWhackConfigDoc(ctx: GameContext) {
  await ensureWhackConfig(ctx);
  const cfg: any = await WhackConfig.findOne({ configId: WHACK_CONFIG_ID }).lean();
  if (!cfg) throw new Error("whack config missing");
  return cfg;
}

export async function whackGetConfig(ctx: GameContext, input: { chatId?: string }) {
  const cfg: any = await getWhackConfigDoc(ctx);
  const minBetRaw = ctx.d128ToBig(cfg.minBetYetiRaw);
  const out: any = {
    ok: true,
    updated: VERSION_DATE,
    imageUrl: cfg.imageUrl || null,
    caption: cfg.caption || null,

    bannerWinNormalUrl: (cfg as any).bannerWinNormalUrl || null,
    bannerWinGoldenUrl: (cfg as any).bannerWinGoldenUrl || null,
    bannerWinBothUrl: (cfg as any).bannerWinBothUrl || null,
    bannerLoseUrl: (cfg as any).bannerLoseUrl || null,
    bannerTauntUrl: (cfg as any).bannerTauntUrl || null,

    minBetHuman: ctx.formatUnits(minBetRaw, ctx.yetiDecimals),
    quickBetButtons: Array.isArray(cfg.quickBetButtons) ? cfg.quickBetButtons : [1, 3, 5],
    dmOnly: !!cfg.dmOnly,
    autoDelete: !!cfg.autoDelete,
  };

  if (input.chatId) {
    const chatId = String(input.chatId);
    const chat: any = await WhackChat.findOne({ chatId }).lean();
    out.chatId = chatId;
    out.shillMessageId = chat?.shillMessageId ?? null;
    out.shillIntervalSec = Number(chat?.shillIntervalSec ?? 900);
    out.lastShillAtMs = chat?.lastShillAt ? new Date(chat.lastShillAt).getTime() : null;
  }

  return out;
}

export async function whackAdminUpdate(
  ctx: GameContext,
  input: {
    imageUrl?: string | null;
    caption?: string | null;

    bannerWinNormalUrl?: string | null;
    bannerWinGoldenUrl?: string | null;
    bannerWinBothUrl?: string | null;
    bannerLoseUrl?: string | null;
    bannerTauntUrl?: string | null;

    minBetHuman?: string | null;
    quickBetButtons?: number[] | null;
    dmOnly?: boolean | null;
    autoDelete?: boolean | null;
    chatId?: string | null;
    shillIntervalSec?: number | null;
  }
) {
  const now = new Date();
  const $set: any = { updatedAt: now };

  if (input.imageUrl != null) $set.imageUrl = String(input.imageUrl || "").trim();
  if (input.caption != null) $set.caption = String(input.caption || "").trim();

  if (input.bannerWinNormalUrl != null) $set.bannerWinNormalUrl = String(input.bannerWinNormalUrl || "").trim();
  if (input.bannerWinGoldenUrl != null) $set.bannerWinGoldenUrl = String(input.bannerWinGoldenUrl || "").trim();
  if (input.bannerWinBothUrl != null) $set.bannerWinBothUrl = String(input.bannerWinBothUrl || "").trim();
  if (input.bannerLoseUrl != null) $set.bannerLoseUrl = String(input.bannerLoseUrl || "").trim();
  if (input.bannerTauntUrl != null) $set.bannerTauntUrl = String(input.bannerTauntUrl || "").trim();

  if (input.minBetHuman != null) {
    const raw = ctx.parseUnits(String(input.minBetHuman || "0"), ctx.yetiDecimals);
    if (raw < 0n) throw new Error("bad minBet");
    $set.minBetYetiRaw = ctx.d128(raw);
  }

  if (input.quickBetButtons != null) {
    const arr = Array.isArray(input.quickBetButtons) ? input.quickBetButtons : [];
    const cleaned = arr
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0)
      .slice(0, 6);
    if (cleaned.length === 0) throw new Error("quickBetButtons empty");
    $set.quickBetButtons = cleaned;
  }

  if (input.dmOnly != null) $set.dmOnly = !!input.dmOnly;
  if (input.autoDelete != null) $set.autoDelete = !!input.autoDelete;

  await ensureWhackConfig(ctx);
  await WhackConfig.updateOne({ configId: WHACK_CONFIG_ID }, { $set });

  // per-chat shill interval
  if (input.chatId && input.shillIntervalSec != null) {
    const chatId = String(input.chatId);
    const sec = Math.max(0, Math.floor(Number(input.shillIntervalSec)));
    if (!Number.isFinite(sec)) throw new Error("bad shillIntervalSec");
    await WhackChat.updateOne(
      { chatId },
      {
        $setOnInsert: { chatId, createdAt: now },
        $set: { shillIntervalSec: sec, updatedAt: now },
      },
      { upsert: true }
    );
  }

  return { ok: true };
}

export async function whackSetShillMessageId(ctx: GameContext, input: { chatId: string; shillMessageId: number }) {
  const chatId = String(input.chatId);
  const msgId = Number(input.shillMessageId);
  if (!chatId) throw new Error("bad chatId");
  if (!Number.isFinite(msgId) || msgId <= 0) throw new Error("bad shillMessageId");
  const now = new Date();
  await WhackChat.updateOne(
    { chatId },
    {
      $setOnInsert: { chatId, createdAt: now },
      $set: { shillMessageId: msgId, updatedAt: now },
    },
    { upsert: true }
  );
  return { ok: true };
}

export async function whackMarkShill(ctx: GameContext, input: { chatId: string }) {
  const chatId = String(input.chatId);
  if (!chatId) throw new Error("bad chatId");
  const now = new Date();
  await WhackChat.updateOne(
    { chatId },
    {
      $setOnInsert: { chatId, createdAt: now },
      $set: { lastShillAt: now, updatedAt: now },
    },
    { upsert: true }
  );
  return { ok: true };
}

export async function whackStart(ctx: GameContext, input: {
  telegramUserId: string;
  telegramHandle?: string;
  firstName?: string;
  isBot?: boolean;
  betHuman: string;
}) {
  if (await ctx.getRailsPaused()) throw new Error("rails paused");

  const telegramUserId = String(input.telegramUserId);
  await ctx.ensureUser({
    telegramUserId,
    telegramHandle: input.telegramHandle,
    firstName: input.firstName,
    isBot: !!input.isBot,
  });

  const user: any = await ctx.TgUser.findOne({ telegramUserId }).lean();
  if (!user) throw new Error("user not found");
  if (user.blacklisted) throw new Error("blacklisted");

  const betRaw = ctx.parseUnits(String(input.betHuman), ctx.yetiDecimals);
  if (betRaw <= 0n) throw new Error("bad bet");

  // Enforce min bet from config
  const cfg: any = await getWhackConfigDoc(ctx);
  const minBetRaw = ctx.d128ToBig(cfg.minBetYetiRaw);
  if (betRaw < minBetRaw) throw new Error(`min bet is ${ctx.formatUnits(minBetRaw, ctx.yetiDecimals)}`);

  const t: any = await ctx.getTreasury(WHACK_TREASURY_ID);
  if (!t) throw new Error("whack treasury missing");
  if (!t.enabled) throw new Error("whack treasury disabled");
  const maxBetRaw = maxBetRawFromTreasury(t, ctx.d128ToBig);
  if (betRaw > maxBetRaw) throw new Error(`max bet is ${ctx.formatUnits(maxBetRaw, ctx.yetiDecimals)}`);

  // Basic solvency check for stage1 worst case (golden 2.2x)
  const treasuryBal = ctx.d128ToBig(t.balanceYetiRaw);
  const fee = ctx.fee3pct(betRaw);
  const net = betRaw - fee;
  const afterIn = treasuryBal + net;
  const worstStage1 = (betRaw * 22n) / 10n;
  if (afterIn < worstStage1) throw new Error("treasury insufficient to cover payouts");

  // Lock bet immediately
  const userBal = ctx.d128ToBig(user.balanceYetiRaw);
  if (userBal < betRaw) throw new Error("insufficient balance");

  const updated = await ctx.TgUser.updateOne(
    { telegramUserId, balanceYetiRaw: { $gte: ctx.d128(betRaw) } },
    { $inc: { balanceYetiRaw: ctx.d128(-betRaw) }, $set: { updatedAt: new Date() } }
  );
  if (!updated.modifiedCount) throw new Error("insufficient balance");

  const id = crypto.randomUUID();
  const holes = pickTwoDistinctHoles();
  const expiresAt = nowPlusMs(2 * 60 * 1000);

  await WhackGame.create({
    id,
    telegramUserId,
    treasuryId: WHACK_TREASURY_ID,
    betYetiRaw: ctx.d128(betRaw),
    stage: 1,
    status: "CHOOSING",
    pick: undefined,
    normalHole: holes.normalHole,
    goldenHole: holes.goldenHole,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await ctx.safeLedgerAcct("GAME_BET_LOCK", id, {
    telegramUserId,
    deltaYetiRaw: ctx.d128(-betRaw),
    meta: { game: "whack", stage: 1 },
  });

  return {
    gameId: id,
    betRaw: betRaw.toString(),
    betHuman: ctx.formatUnits(betRaw, ctx.yetiDecimals),
    maxBetRaw: maxBetRaw.toString(),
    maxBetHuman: ctx.formatUnits(maxBetRaw, ctx.yetiDecimals),
    treasuryRaw: treasuryBal.toString(),
    treasuryHuman: ctx.formatUnits(treasuryBal, ctx.yetiDecimals),
    expiresAtMs: expiresAt.getTime(),
    stage: 1,
    status: "CHOOSING" as const,
  };
}

export async function whackSelect(ctx: GameContext, input: { telegramUserId: string; gameId: string; hole: number }) {
  const telegramUserId = String(input.telegramUserId);
  const gameId = String(input.gameId);
  const hole = Number(input.hole);
  if (!Number.isFinite(hole) || hole < 1 || hole > 6) throw new Error("bad hole");

  const g: any = await WhackGame.findOne({ id: gameId, telegramUserId }).lean();
  if (!g) throw new Error("game not found");
  if (new Date(g.expiresAt).getTime() < Date.now()) throw new Error("game expired");

  if (g.status === "CHOOSING") {
    await WhackGame.updateOne({ id: gameId }, { $set: { pick: hole, updatedAt: new Date() } });
    return { stage: 1, status: "CHOOSING" as const, pick: hole };
  }
  if (g.status === "CHOOSING2") {
    await WhackGame.updateOne({ id: gameId }, { $set: { pick2: hole, updatedAt: new Date() } });
    return { stage: 2, status: "CHOOSING2" as const, pick: hole };
  }

  throw new Error("game not selectable");
}

export async function whackConfirm(ctx: GameContext, input: { telegramUserId: string; gameId: string }) {
  if (await ctx.getRailsPaused()) throw new Error("rails paused");

  const telegramUserId = String(input.telegramUserId);
  const gameId = String(input.gameId);
  const g: any = await WhackGame.findOne({ id: gameId, telegramUserId }).lean();
  if (!g) throw new Error("game not found");
  if (new Date(g.expiresAt).getTime() < Date.now()) throw new Error("game expired");

  const treasuryId = WHACK_TREASURY_ID;
  const t: any = await ctx.getTreasury(treasuryId);
  if (!t || !t.enabled) throw new Error("whack treasury unavailable");

  const betRaw = ctx.d128ToBig(g.betYetiRaw);

  if (g.status === "CHOOSING") {
    const pick = Number(g.pick);
    if (!Number.isFinite(pick) || pick < 1 || pick > 6) throw new Error("pick a hole first");

    const fee = ctx.fee3pct(betRaw);
    const net = betRaw - fee;

    // Settle bet1 into treasuries
    await ctx.incTreasuryBalance(treasuryId, net);
    await ctx.incTreasuryBalance("fee", fee);
    await ctx.safeLedgerAcct("GAME_BET_IN", gameId, { treasuryId, deltaYetiRaw: ctx.d128(net), meta: { game: "whack", stage: 1 } });
    await ctx.safeLedgerAcct("FEE", gameId + ":WHACK1", { treasuryId: "fee", deltaYetiRaw: ctx.d128(fee), meta: { game: "whack", stage: 1 } });

    // Determine hit
    const normalHole = Number(g.normalHole);
    const goldenHole = Number(g.goldenHole);

    let outcome: "MISS" | "NORMAL" | "GOLDEN" = "MISS";
    let multTenths = 0;
    if (pick === normalHole) {
      outcome = "NORMAL";
      multTenths = 17;
    } else if (pick === goldenHole) {
      outcome = "GOLDEN";
      multTenths = 22;
    }

    if (outcome === "MISS") {
      await WhackGame.updateOne(
        { id: gameId },
        {
          $set: {
            status: "RESOLVED",
            stage: 1,
            fee1YetiRaw: ctx.d128(fee),
            toTreasury1Raw: ctx.d128(net),
            outcome: "MISS",
            payoutRaw: ctx.d128(0n),
            multiplierTenths: 0,
            updatedAt: new Date(),
          },
        }
      );

      return {
        status: "RESOLVED" as const,
        stage: 1,
        outcome: "MISS" as const,
        pick,
        betRaw: betRaw.toString(),
        betHuman: ctx.formatUnits(betRaw, ctx.yetiDecimals),
        payoutRaw: "0",
        payoutHuman: "0",
        normalHole,
        goldenHole,
      };
    }

    const pending = (betRaw * BigInt(multTenths)) / 10n;

    // Keep pending payout in game until user collects or continues
    await WhackGame.updateOne(
      { id: gameId },
      {
        $set: {
          status: "DECIDE",
          stage: 1,
          fee1YetiRaw: ctx.d128(fee),
          toTreasury1Raw: ctx.d128(net),
          foundKind: outcome === "NORMAL" ? "NORMAL" : "GOLDEN",
          foundHole: pick,
          pendingPayoutRaw: ctx.d128(pending),
          pendingMultiplierTenths: multTenths,
          outcome,
          updatedAt: new Date(),
        },
      }
    );

    return {
      status: "DECIDE" as const,
      stage: 1,
      outcome,
      betRaw: betRaw.toString(),
      betHuman: ctx.formatUnits(betRaw, ctx.yetiDecimals),
      foundHole: pick,
      foundKind: outcome,
      pick,
      normalHole,
      goldenHole,
      pendingPayoutRaw: pending.toString(),
      pendingPayoutHuman: ctx.formatUnits(pending, ctx.yetiDecimals),
      pendingMultiplierTenths: multTenths,
    };
  }

  if (g.status === "CHOOSING2") {
    const pick2 = Number(g.pick2);
    if (!Number.isFinite(pick2) || pick2 < 1 || pick2 > 6) throw new Error("pick a hole first");

    const foundKind: "NORMAL" | "GOLDEN" = String(g.foundKind) === "NORMAL" ? "NORMAL" : "GOLDEN";
    const target = foundKind === "NORMAL" ? Number(g.goldenHole) : Number(g.normalHole);

    const fee = ctx.fee3pct(betRaw);
    const net = betRaw - fee;

    await ctx.incTreasuryBalance(treasuryId, net);
    await ctx.incTreasuryBalance("fee", fee);
    await ctx.safeLedgerAcct("GAME_BET_IN", gameId + ":2", { treasuryId, deltaYetiRaw: ctx.d128(net), meta: { game: "whack", stage: 2 } });
    await ctx.safeLedgerAcct("FEE", gameId + ":WHACK2", { treasuryId: "fee", deltaYetiRaw: ctx.d128(fee), meta: { game: "whack", stage: 2 } });

    const pending = ctx.d128ToBig(g.pendingPayoutRaw);

    const success = pick2 === target;
    const normalHole = Number(g.normalHole);
    const goldenHole = Number(g.goldenHole);

    if (success) {
      const payout = betRaw * 5n;

      const t2: any = await ctx.getTreasury(treasuryId);
      const bal2 = ctx.d128ToBig(t2.balanceYetiRaw);
      if (bal2 < payout) throw new Error("treasury insufficient for payout");

      await ctx.incTreasuryBalance(treasuryId, -payout);
      await ctx.TgUser.updateOne(
        { telegramUserId },
        { $inc: { balanceYetiRaw: ctx.d128(payout) }, $set: { updatedAt: new Date() } }
      );

      await ctx.safeLedgerAcct("GAME_PAYOUT", gameId, { telegramUserId, deltaYetiRaw: ctx.d128(payout), meta: { game: "whack", outcome: "FIVE_X" } });
      await ctx.safeLedgerAcct("GAME_TREASURY_OUT", gameId, { treasuryId, deltaYetiRaw: ctx.d128(-payout), meta: { game: "whack", outcome: "FIVE_X" } });

      await WhackGame.updateOne(
        { id: gameId },
        {
          $set: {
            status: "RESOLVED",
            stage: 2,
            fee2YetiRaw: ctx.d128(fee),
            toTreasury2Raw: ctx.d128(net),
            outcome: "FIVE_X",
            payoutRaw: ctx.d128(payout),
            multiplierTenths: 50,
            pick2,
            updatedAt: new Date(),
          },
        }
      );

      return {
        status: "RESOLVED" as const,
        stage: 2,
        outcome: "FIVE_X" as const,
        betHuman: ctx.formatUnits(betRaw, ctx.yetiDecimals),
        payoutHuman: ctx.formatUnits(payout, ctx.yetiDecimals),
        normalHole,
        goldenHole,
        foundHole: Number(g.foundHole),
        secondPick: pick2,
      };
    }

    // Second miss: pay the pending payout (stage1 win) and lose the 2nd bet
    const t2: any = await ctx.getTreasury(treasuryId);
    const bal2 = ctx.d128ToBig(t2.balanceYetiRaw);
    if (bal2 < pending) throw new Error("treasury insufficient for payout");

    await ctx.incTreasuryBalance(treasuryId, -pending);
    await ctx.TgUser.updateOne(
      { telegramUserId },
      { $inc: { balanceYetiRaw: ctx.d128(pending) }, $set: { updatedAt: new Date() } }
    );

    await ctx.safeLedgerAcct("GAME_PAYOUT", gameId + ":PENDING", {
      telegramUserId,
      deltaYetiRaw: ctx.d128(pending),
      meta: { game: "whack", outcome: "SECOND_MISS" },
    });
    await ctx.safeLedgerAcct("GAME_TREASURY_OUT", gameId + ":PENDING", {
      treasuryId,
      deltaYetiRaw: ctx.d128(-pending),
      meta: { game: "whack", outcome: "SECOND_MISS" },
    });

    await WhackGame.updateOne(
      { id: gameId },
      {
        $set: {
          status: "RESOLVED",
          stage: 2,
          fee2YetiRaw: ctx.d128(fee),
          toTreasury2Raw: ctx.d128(net),
          outcome: "SECOND_MISS",
          payoutRaw: ctx.d128(pending),
          multiplierTenths: Number(g.pendingMultiplierTenths ?? 0),
          pick2,
          updatedAt: new Date(),
        },
      }
    );

    return {
      status: "RESOLVED" as const,
      stage: 2,
      outcome: "SECOND_MISS" as const,
      betHuman: ctx.formatUnits(betRaw, ctx.yetiDecimals),
      payoutHuman: ctx.formatUnits(pending, ctx.yetiDecimals),
      normalHole,
      goldenHole,
      foundHole: Number(g.foundHole),
      secondPick: pick2,
    };
  }

  throw new Error("cannot confirm in current state");
}

export async function whackCollect(ctx: GameContext, input: { telegramUserId: string; gameId: string }) {
  if (await ctx.getRailsPaused()) throw new Error("rails paused");

  const telegramUserId = String(input.telegramUserId);
  const gameId = String(input.gameId);
  const g: any = await WhackGame.findOne({ id: gameId, telegramUserId }).lean();
  if (!g) throw new Error("game not found");
  if (g.status !== "DECIDE") throw new Error("nothing to collect");

  const pending = ctx.d128ToBig(g.pendingPayoutRaw);
  const treasuryId = WHACK_TREASURY_ID;

  const t: any = await ctx.getTreasury(treasuryId);
  const bal = ctx.d128ToBig(t.balanceYetiRaw);
  if (bal < pending) throw new Error("treasury insufficient for payout");

  await ctx.incTreasuryBalance(treasuryId, -pending);
  await ctx.TgUser.updateOne(
    { telegramUserId },
    { $inc: { balanceYetiRaw: ctx.d128(pending) }, $set: { updatedAt: new Date() } }
  );

  await ctx.safeLedgerAcct("GAME_PAYOUT", gameId + ":COLLECT", { telegramUserId, deltaYetiRaw: ctx.d128(pending), meta: { game: "whack", outcome: g.outcome } });
  await ctx.safeLedgerAcct("GAME_TREASURY_OUT", gameId + ":COLLECT", { treasuryId, deltaYetiRaw: ctx.d128(-pending), meta: { game: "whack", outcome: g.outcome } });

  const normalHole = Number(g.normalHole);
  const goldenHole = Number(g.goldenHole);

  await WhackGame.updateOne(
    { id: gameId },
    {
      $set: {
        status: "RESOLVED",
        outcome: g.outcome,
        payoutRaw: ctx.d128(pending),
        multiplierTenths: Number(g.pendingMultiplierTenths ?? 0),
        updatedAt: new Date(),
      },
    }
  );

  return {
    status: "RESOLVED" as const,
    stage: 1,
    outcome: String(g.outcome),
    payoutHuman: ctx.formatUnits(pending, ctx.yetiDecimals),
    normalHole,
    goldenHole,
    foundHole: Number(g.foundHole),
  };
}

export async function whackContinue(ctx: GameContext, input: { telegramUserId: string; gameId: string }) {
  if (await ctx.getRailsPaused()) throw new Error("rails paused");

  const telegramUserId = String(input.telegramUserId);
  const gameId = String(input.gameId);
  const g: any = await WhackGame.findOne({ id: gameId, telegramUserId }).lean();
  if (!g) throw new Error("game not found");
  if (g.status !== "DECIDE") throw new Error("not eligible to continue");

  const betRaw = ctx.d128ToBig(g.betYetiRaw);

  // Bet cap for second attempt uses current treasury
  const t: any = await ctx.getTreasury(WHACK_TREASURY_ID);
  if (!t || !t.enabled) throw new Error("whack treasury unavailable");
  const maxBetRaw = maxBetRawFromTreasury(t, ctx.d128ToBig);
  if (betRaw > maxBetRaw) throw new Error(`max bet is ${ctx.formatUnits(maxBetRaw, ctx.yetiDecimals)}`);

  // Solvency check for 5x payout
  const treasuryBal = ctx.d128ToBig(t.balanceYetiRaw);
  const fee = ctx.fee3pct(betRaw);
  const net = betRaw - fee;
  const afterIn = treasuryBal + net;
  const worst = betRaw * 5n;
  if (afterIn < worst) throw new Error("treasury insufficient to cover 5x payout");

  const user: any = await ctx.TgUser.findOne({ telegramUserId }).lean();
  if (!user) throw new Error("user not found");
  if (user.blacklisted) throw new Error("blacklisted");
  const bal = ctx.d128ToBig(user.balanceYetiRaw);
  if (bal < betRaw) throw new Error("insufficient balance");

  const updated = await ctx.TgUser.updateOne(
    { telegramUserId, balanceYetiRaw: { $gte: ctx.d128(betRaw) } },
    { $inc: { balanceYetiRaw: ctx.d128(-betRaw) }, $set: { updatedAt: new Date() } }
  );
  if (!updated.modifiedCount) throw new Error("insufficient balance");

  const expiresAt = nowPlusMs(2 * 60 * 1000);
  await WhackGame.updateOne(
    { id: gameId },
    {
      $set: {
        stage: 2,
        status: "CHOOSING2",
        bet2YetiRaw: ctx.d128(betRaw),
        pick2: undefined,
        expiresAt,
        updatedAt: new Date(),
      },
    }
  );

  await ctx.safeLedgerAcct("GAME_BET_LOCK", gameId + ":2", {
    telegramUserId,
    deltaYetiRaw: ctx.d128(-betRaw),
    meta: { game: "whack", stage: 2 },
  });

  return {
    status: "CHOOSING2" as const,
    stage: 2,
    betHuman: ctx.formatUnits(betRaw, ctx.yetiDecimals),
    expiresAtMs: expiresAt.getTime(),
  };
}

export async function whackCancel(ctx: GameContext, input: { telegramUserId: string; gameId: string }) {
  const telegramUserId = String(input.telegramUserId);
  const gameId = String(input.gameId);
  const g: any = await WhackGame.findOne({ id: gameId, telegramUserId }).lean();
  if (!g) throw new Error("game not found");

  const betRaw = ctx.d128ToBig(g.betYetiRaw);

  if (g.status === "CHOOSING") {
    // Refund bet1
    await ctx.TgUser.updateOne(
      { telegramUserId },
      { $inc: { balanceYetiRaw: ctx.d128(betRaw) }, $set: { updatedAt: new Date() } }
    );
    await ctx.safeLedgerAcct("GAME_BET_REFUND", gameId, { telegramUserId, deltaYetiRaw: ctx.d128(betRaw), meta: { game: "whack", stage: 1 } });
    await WhackGame.updateOne({ id: gameId }, { $set: { status: "CANCELLED", updatedAt: new Date() } });
    return { status: "CANCELLED" as const, stage: 1 };
  }

  if (g.status === "CHOOSING2") {
    // Refund bet2 and revert to DECIDE
    await ctx.TgUser.updateOne(
      { telegramUserId },
      { $inc: { balanceYetiRaw: ctx.d128(betRaw) }, $set: { updatedAt: new Date() } }
    );
    await ctx.safeLedgerAcct("GAME_BET_REFUND", gameId + ":2", { telegramUserId, deltaYetiRaw: ctx.d128(betRaw), meta: { game: "whack", stage: 2 } });
    await WhackGame.updateOne(
      { id: gameId },
      { $set: { status: "DECIDE", stage: 1, bet2YetiRaw: undefined, pick2: undefined, updatedAt: new Date() } }
    );
    return { status: "DECIDE" as const, stage: 1 };
  }

  throw new Error("cannot cancel in current state");
}
