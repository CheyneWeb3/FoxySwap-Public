import express from "express";
import type { GameContext } from "../_core/types";
import {
  ensureWhackTreasury,
  ensureWhackConfig,
  whackAdminUpdate,
  whackGetConfig,
  whackMarkShill,
  whackSetShillMessageId,
  whackStart,
  whackSelect,
  whackConfirm,
  whackCollect,
  whackContinue,
  whackCancel,
} from "./service";

export async function registerWhackGame(ctx: GameContext) {
  // Ensure the dedicated treasury exists
  await ensureWhackTreasury(ctx);
  await ensureWhackConfig(ctx);

  const r = express.Router();

  // bot-only
  r.use(ctx.requireBot);

  // Config for bot UX
  r.post(
    "/config",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackGetConfig(ctx, { chatId: body.chatId ? String(body.chatId) : undefined });
      res.json(out);
    })
  );

  // Admin update (bot enforces who is admin)
  r.post(
    "/adminUpdate",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackAdminUpdate(ctx, {
        imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
        caption: body.caption != null ? String(body.caption) : undefined,

        bannerWinNormalUrl: body.bannerWinNormalUrl != null ? String(body.bannerWinNormalUrl) : undefined,
        bannerWinGoldenUrl: body.bannerWinGoldenUrl != null ? String(body.bannerWinGoldenUrl) : undefined,
        bannerWinBothUrl: body.bannerWinBothUrl != null ? String(body.bannerWinBothUrl) : undefined,
        bannerLoseUrl: body.bannerLoseUrl != null ? String(body.bannerLoseUrl) : undefined,
        bannerTauntUrl: body.bannerTauntUrl != null ? String(body.bannerTauntUrl) : undefined,

        minBetHuman: body.minBetHuman != null ? String(body.minBetHuman) : undefined,
        quickBetButtons: Array.isArray(body.quickBetButtons) ? body.quickBetButtons : undefined,
        dmOnly: body.dmOnly != null ? !!body.dmOnly : undefined,
        autoDelete: body.autoDelete != null ? !!body.autoDelete : undefined,
        chatId: body.chatId != null ? String(body.chatId) : undefined,
        shillIntervalSec: body.shillIntervalSec != null ? Number(body.shillIntervalSec) : undefined,
      });
      res.json(out);
    })
  );

  // Bot stores the shill message id per-chat so it can delete/edit later
  r.post(
    "/setShill",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackSetShillMessageId(ctx, {
        chatId: String(body.chatId ?? ""),
        shillMessageId: Number(body.shillMessageId ?? 0),
      });
      res.json(out);
    })
  );

  // Mark that a shill repost happened (for metrics / spacing)
  r.post(
    "/markShill",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackMarkShill(ctx, { chatId: String(body.chatId ?? "") });
      res.json(out);
    })
  );

  // Start a game: /whack <bet>
  r.post(
    "/start",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackStart(ctx, {
        telegramUserId: String(body.telegramUserId ?? ""),
        telegramHandle: body.telegramHandle ? String(body.telegramHandle) : undefined,
        firstName: body.firstName ? String(body.firstName) : undefined,
        isBot: !!body.isBot,
        betHuman: String(body.betHuman ?? ""),
      });
      res.json(out);
    })
  );

  // Select hole for current stage
  r.post(
    "/select",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackSelect(ctx, {
        telegramUserId: String(body.telegramUserId ?? ""),
        gameId: String(body.gameId ?? ""),
        hole: Number(body.hole),
      });
      res.json(out);
    })
  );

  // Confirm current stage
  r.post(
    "/confirm",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackConfirm(ctx, {
        telegramUserId: String(body.telegramUserId ?? ""),
        gameId: String(body.gameId ?? ""),
      });
      res.json(out);
    })
  );

  // Collect stage-1 pending payout
  r.post(
    "/collect",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackCollect(ctx, {
        telegramUserId: String(body.telegramUserId ?? ""),
        gameId: String(body.gameId ?? ""),
      });
      res.json(out);
    })
  );

  // Continue to stage2 (locks second bet)
  r.post(
    "/continue",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackContinue(ctx, {
        telegramUserId: String(body.telegramUserId ?? ""),
        gameId: String(body.gameId ?? ""),
      });
      res.json(out);
    })
  );

  // Cancel current stage
  r.post(
    "/cancel",
    ctx.aw(async (req, res) => {
      const body = req.body || {};
      const out = await whackCancel(ctx, {
        telegramUserId: String(body.telegramUserId ?? ""),
        gameId: String(body.gameId ?? ""),
      });
      res.json(out);
    })
  );

  // Mount under /tg/game/whack
  ctx.app.use("/tg/game/whack", r);
}
