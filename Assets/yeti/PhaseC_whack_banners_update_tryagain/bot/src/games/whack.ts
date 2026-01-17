// apps/bot/src/games/whack.ts
// Whack-a-Wombat module (Lottery-style UX):
// - Main shill post (photo + caption) in enabled public chats, auto-reposted on interval.
// - Quick-bet buttons (configurable) start a game.
// - Per-user game messages are kept clean (autoDelete) and are editable (single-message UX).
// - /whackadmin (global bot admin) to configure: imageUrl, caption, minBet, shill interval, quick bet buttons, dmOnly, autoDelete.

import type { Telegraf } from "telegraf";
import { Markup } from "telegraf";

type ApiFn = <T>(path: string, body?: any, method?: "GET" | "POST") => Promise<T>;

type Deps = {
  api: ApiFn;
  requirePublicChat: (ctx: any) => Promise<boolean>;
  isPublicChatEnabled: (ctx: any) => boolean;
  adminTgUserId?: string;
};

// ASCII-safe emoji (use escapes to avoid encoding surprises)
const E_HOLE = "\u{1F573}\uFE0F"; // hole
const E_WOMBAT = "\u{1F43E}"; // paw
const E_CAM = "\u{1F4F7}"; // camera
const E_ADMIN = "\u{1F6E0}\uFE0F"; // wrench
const E_REFRESH = "\u{1F504}"; // refresh
const E_CHECK = "\u2705";
const E_STOP = "\u{1F6D1}";
const E_CLOCK = "\u23F0";

// Result icons
const E_KOALA = "\u{1F428}"; // koala
const E_TROPHY = "\u{1F3C6}"; // trophy
const E_CROSS = "\u274C"; // cross
const E_EMPTY = "\u{1F573}\uFE0F"; // hole


// Callback data:
//   whack:play:<amt>
//   whack:hole:<stage>:<gameId>:<n>
//   whack:confirm:<stage>:<gameId>
//   whack:cancel:<stage>:<gameId>
//   whack:collect:<gameId>
//   whack:continue:<gameId>
//   whack:shill:refresh
//   whack:admin:menu
//   whack:admin:set:<field>

type WhackConfigRes = {
  ok: true;
  updated: string;
  imageUrl: string | null;
  caption: string | null;

  bannerWinNormalUrl: string | null;
  bannerWinGoldenUrl: string | null;
  bannerWinBothUrl: string | null;
  bannerLoseUrl: string | null;
  bannerTauntUrl: string | null;

  minBetHuman: string;
  quickBetButtons: number[];
  dmOnly: boolean;
  autoDelete: boolean;

  // If chatId sent
  chatId?: string;
  shillMessageId?: number | null;
  shillIntervalSec?: number;
  lastShillAtMs?: number | null;
};

type WhackStartRes = {
  gameId: string;
  betHuman: string;
  maxBetHuman: string;
  treasuryHuman: string;
  expiresAtMs: number;
  stage: number;
  status: string;
};

function isDM(ctx: any) {
  return String(ctx.chat?.type || "") === "private";
}

function getChatId(ctx: any) {
  return String(ctx.chat?.id ?? "");
}

function whoPlain(ctx: any) {
  const u = ctx.from;
  if (!u) return "Player";
  if (u.username) return `@${u.username}`;
  if (u.first_name) return u.first_name;
  return "Player";
}

function parseArgs(text?: string) {
  const t = String(text || "").trim();
  if (!t) return [];
  return t.split(/\s+/).filter(Boolean);
}

function getReplyMarkup(kb: any) {
  return kb && (kb as any).reply_markup ? (kb as any).reply_markup : undefined;
}

async function safeDelete(bot: Telegraf<any>, chatId: string, messageId?: number | null) {
  try {
    if (!chatId || !messageId) return;
    await bot.telegram.deleteMessage(chatId, messageId);
  } catch {
    // ignore
  }
}

async function safeSendMessage(bot: Telegraf<any>, chatId: string, text: string, extra?: any) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (e: any) {
    throw new Error(e?.message || "failed to send message");
  }
}

async function safeSendPhoto(bot: Telegraf<any>, chatId: string, imageUrl: string, caption: string, extra?: any) {
  try {
    return await bot.telegram.sendPhoto(chatId, imageUrl, { caption, ...(extra || {}) });
  } catch (e: any) {
    // fallback to text
    return await safeSendMessage(bot, chatId, caption, extra);
  }
}

async function safeEditText(bot: Telegraf<any>, chatId: string, messageId: number, text: string, reply_markup?: any) {
  try {
    await bot.telegram.editMessageText(chatId, messageId, undefined, text, reply_markup ? { reply_markup } : undefined);
    return true;
  } catch {
    return false;
  }
}

async function safeEditCaption(bot: Telegraf<any>, chatId: string, messageId: number, caption: string, reply_markup?: any) {
  try {
    await bot.telegram.editMessageCaption(chatId, messageId, undefined, caption, reply_markup ? { reply_markup } : undefined);
    return true;
  } catch {
    return false;
  }
}

async function safeEditPhoto(bot: Telegraf<any>, chatId: string, messageId: number, imageUrl: string, caption: string, reply_markup?: any) {
  try {
    await bot.telegram.editMessageMedia(
      chatId,
      messageId,
      undefined,
      { type: "photo", media: imageUrl, caption },
      reply_markup ? { reply_markup } : undefined
    );
    return true;
  } catch {
    return false;
  }
}

async function safeEditMedia(
  bot: Telegraf<any>,
  chatId: string,
  messageId: number,
  imageUrl: string,
  caption: string,
  reply_markup?: any
) {
  try {
    await bot.telegram.editMessageMedia(
      chatId,
      messageId,
      undefined,
      { type: "photo", media: imageUrl, caption },
      reply_markup ? { reply_markup } : undefined
    );
    return true;
  } catch {
    return false;
  }
}

function buildShillText(cfg: WhackConfigRes) {

  const lines: string[] = [];
  lines.push(`${E_HOLE} Whack-a-Wombat (${cfg.updated})`);
  lines.push(`Min bet: ${cfg.minBetHuman} credits`);
  lines.push(`Normal: 1.7x   Golden: 2.2x   Both: 5.0x`);
  lines.push(`Stage 1: pick 1 hole. If you win, Collect or Go for 5x (second bet same amount).`);
  if (cfg.dmOnly) lines.push(`\nNote: gameplay is DM-only.`);
  return lines.join("\n");
}

function buildShillKeyboard(cfg: WhackConfigRes) {
  const opts = Array.isArray(cfg.quickBetButtons) && cfg.quickBetButtons.length ? cfg.quickBetButtons : [1, 3, 5];
  const buyRow = opts.slice(0, 3).map((n) => Markup.button.callback(`Play ${n}`, `whack:play:${n}`));
  return Markup.inlineKeyboard([
    buyRow,
    [
      Markup.button.callback(`${E_REFRESH} Refresh`, "whack:shill:refresh"),
      Markup.button.callback(`${E_ADMIN} Admin`, "whack:admin:menu"),
    ],
  ]);
}

function holesKeyboard(gameId: string, stage: number, selected?: number | null) {
  const label = (n: number) => (selected === n ? `\u2705${n}` : String(n));
  const mk = (n: number) => Markup.button.callback(label(n), `whack:hole:${stage}:${gameId}:${n}`);
  return Markup.inlineKeyboard([
    [mk(1), mk(2), mk(3)],
    [mk(4), mk(5), mk(6)],
    [
      Markup.button.callback("\u2705 Confirm", `whack:confirm:${stage}:${gameId}`),
      Markup.button.callback("\u2716 Cancel", `whack:cancel:${stage}:${gameId}`),
    ],
  ]);
}

function holesResultKeyboard(input: { pick: number | null; normalHole: number; goldenHole: number }) {
  const { pick, normalHole, goldenHole } = input;
  const label = (n: number) => {
    if (n === normalHole) return E_KOALA;
    if (n === goldenHole) return E_TROPHY;
    if (pick != null && n === pick && n !== normalHole && n !== goldenHole) return E_CROSS;
    return E_EMPTY;
  };
  const mk = (n: number) => Markup.button.callback(label(n), `whack:noop`);
  return Markup.inlineKeyboard([
    [mk(1), mk(2), mk(3)],
    [mk(4), mk(5), mk(6)],
  ]);
}

function holesResultKeyboardWithTryAgain(input: { pick: number | null; normalHole: number; goldenHole: number }) {
  const grid = holesResultKeyboard(input);
  const rows = (grid as any)?.reply_markup?.inline_keyboard || [];
  return Markup.inlineKeyboard([
    ...rows,
    [Markup.button.callback(`${E_REFRESH} Try again`, "whack:again")],
  ]);
}

function decideKeyboardWithGrid(
  gameId: string,
  input: { pick: number | null; normalHole: number; goldenHole: number }
) {
  const grid = holesResultKeyboard(input);
  // Extract keyboard rows from the Markup object
  const rows = (grid as any)?.reply_markup?.inline_keyboard || [];
  return Markup.inlineKeyboard([
    ...rows,
    [Markup.button.callback("💰 Collect", `whack:collect:${gameId}`)],
    [Markup.button.callback("🎯 Go for 5x", `whack:continue:${gameId}`)],
  ]);
}

function decideKeyboard(gameId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("\u{1F4B0} Collect", `whack:collect:${gameId}`)],
    [Markup.button.callback("\u{1F3AF} Go for 5x", `whack:continue:${gameId}`)],
    [Markup.button.callback("\u2716 Cancel", `whack:cancel:1:${gameId}`)],
  ]);
}

function buildPickingText(cfg: WhackConfigRes, stage: number, betHuman: string, treasuryHuman: string, maxBetHuman: string) {
  const lines: string[] = [];
  lines.push(`${E_HOLE} Whack-a-Wombat (${cfg.updated})`);
  lines.push(`Bet: ${betHuman} credits`);
  lines.push(`Treasury: ${treasuryHuman} credits (max bet ${maxBetHuman})`);
  lines.push(stage === 2 ? "\nStage 2: find the other wombat for 5.0x — pick 1 hole:" : "\nStage 1: pick 1 hole:");
  return lines.join("\n");
}

function buildDecideText(cfg: WhackConfigRes, r: any) {
  const kind = r.outcome === "GOLDEN" ? "Golden" : "Normal";
  const mult = (Number(r.pendingMultiplierTenths) / 10).toFixed(1);
  const lines: string[] = [];
  lines.push(`${E_HOLE} Whack-a-Wombat (${cfg.updated})`);
  lines.push(`\n${kind} wombat! Hole ${r.foundHole}`);
  lines.push(`Pending win: ${r.pendingPayoutHuman} credits (${mult}x)`);
  lines.push("\nCollect now, or bet the same amount again to try for 5.0x.");
  return lines.join("\n");
}

function buildResolvedText(cfg: WhackConfigRes, r: any) {
  const lines: string[] = [];
  lines.push(`${E_HOLE} Whack-a-Wombat (${cfg.updated})`);

  if (r.outcome === "MISS") {
    lines.push("\nMiss!");
    lines.push(`Normal: hole ${r.normalHole}`);
    lines.push(`Golden: hole ${r.goldenHole}`);
    lines.push("\nTry again.");
    return lines.join("\n");
  }

  if (r.outcome === "FIVE_X") {
    lines.push("\n\u{1F389} You found the other wombat!");
    lines.push(`Payout: ${r.payoutHuman} credits (5.0x)`);
    lines.push(`\nNormal: hole ${r.normalHole}`);
    lines.push(`Golden: hole ${r.goldenHole}`);
    return lines.join("\n");
  }

  if (r.outcome === "SECOND_MISS") {
    lines.push("\nUnlucky — missed the second wombat.");
    lines.push(`You still collect your first win: ${r.payoutHuman} credits`);
    lines.push(`\nNormal: hole ${r.normalHole}`);
    lines.push(`Golden: hole ${r.goldenHole}`);
    return lines.join("\n");
  }

  // collect result
  if (r.payoutHuman) {
    lines.push(`\nCollected: ${r.payoutHuman} credits`);
    if (r.normalHole != null && r.goldenHole != null) {
      lines.push(`\nNormal: hole ${r.normalHole}`);
      lines.push(`Golden: hole ${r.goldenHole}`);
    }
    return lines.join("\n");
  }

  return lines.join("\n");
}

export function registerWhack(bot: Telegraf<any>, deps: Deps) {
  const { api, requirePublicChat, isPublicChatEnabled } = deps;
  // Prefer injected admin id from bot registry, but fall back to env so this
  // module can be updated without touching the central registry.
  const ADMIN_TG_USER_ID = String(deps.adminTgUserId || process.env.ADMIN_TG_USER_ID || "").trim();

  // key = chatId:userId
  const lastGameMsg = new Map<string, { messageId: number; hasPhoto: boolean; imageUrl?: string | null }>();
  const adminWait = new Map<string, { field: string; expiresAt: number; chatId?: string }>();
  const lastEphemeralByChat = new Map<string, number>();
  const nextShillAtByChat = new Map<string, number>();
  const loseStreakByUser = new Map<string, { count: number; updatedAt: number }>();
  const lastBetByUser = new Map<string, string>();

  function resetStreak(userId: string) {
    loseStreakByUser.delete(userId);
  }

  function incStreak(userId: string) {
    const now = Date.now();
    const prev = loseStreakByUser.get(userId);
    // Expire streak after 12h of inactivity
    if (!prev || now - prev.updatedAt > 12 * 60 * 60 * 1000) {
      loseStreakByUser.set(userId, { count: 1, updatedAt: now });
      return 1;
    }
    const next = { count: prev.count + 1, updatedAt: now };
    loseStreakByUser.set(userId, next);
    return next.count;
  }


  function isAdmin(ctx: any) {
    return !!ADMIN_TG_USER_ID && String(ctx.from?.id ?? "") === ADMIN_TG_USER_ID;
  }

  function adminKey(ctx: any) {
    return `${getChatId(ctx)}:${String(ctx.from?.id ?? "")}`;
  }

  async function sendEphemeral(ctx: any, text: string, ttlMs = 9000) {
    const chatId = getChatId(ctx);
    const prev = lastEphemeralByChat.get(chatId);
    if (prev) await safeDelete(bot, chatId, prev);
    const msg = await ctx.reply(text);
    const mid = msg?.message_id;
    if (mid) {
      lastEphemeralByChat.set(chatId, mid);
      setTimeout(() => safeDelete(bot, chatId, mid), ttlMs).unref?.();
    }
  }

  async function getCfg(chatId?: string): Promise<WhackConfigRes> {
    const r = await api<WhackConfigRes>("/tg/game/whack/config", chatId ? { chatId } : {});
    return r;
  }

  async function ensureAllowed(ctx: any, cfg: WhackConfigRes): Promise<boolean> {
    if (!isDM(ctx)) {
      // if DM-only, block groups
      if (cfg.dmOnly) {
        await sendEphemeral(ctx, "Whack is DM-only right now. DM me to play.", 12000);
        return false;
      }

      // respect global public chat enable + allowlist
      if (!(await requirePublicChat(ctx))) return false;
    }
    return true;
  }

  function gameKey(chatId: string, userId: string) {
    return `${chatId}:${userId}`;
  }

  async function startGame(ctx: any, chatId: string, cfg: WhackConfigRes, betHuman: string) {
    const from = ctx.from;
    if (!from) return;

    const userId = String(from.id);

    // If in group and dmOnly, DM the user instead
    if (!isDM(ctx) && cfg.dmOnly) {
      try {
        await ctx.answerCbQuery("Check DM");
      } catch {}

      const r = await api<WhackStartRes>("/tg/game/whack/start", {
        telegramUserId: userId,
        telegramHandle: from.username ? String(from.username) : undefined,
        firstName: from.first_name ? String(from.first_name) : undefined,
        isBot: !!from.is_bot,
        betHuman,
      });

      lastBetByUser.set(userId, betHuman);

      const dmChatId = String(from.id);
      const dmCfg = await getCfg();
      const text = buildPickingText(dmCfg, 1, r.betHuman, r.treasuryHuman, r.maxBetHuman);
      await sendOrEditGameMessage({
        chatId: dmChatId,
        userId,
        text,
        kb: holesKeyboard(r.gameId, 1, null),
        imageUrl: dmCfg.imageUrl,
        forceNew: true,
        autoDelete: dmCfg.autoDelete,
      });
      return;
    }

    // Otherwise: play in current chat (DM or allowed group)
    if (!(await ensureAllowed(ctx, cfg))) return;

    const r = await api<WhackStartRes>("/tg/game/whack/start", {
      telegramUserId: userId,
      telegramHandle: from.username ? String(from.username) : undefined,
      firstName: from.first_name ? String(from.first_name) : undefined,
      isBot: !!from.is_bot,
      betHuman,
    });

    lastBetByUser.set(userId, betHuman);

    const text = buildPickingText(cfg, 1, r.betHuman, r.treasuryHuman, r.maxBetHuman);
    await sendOrEditGameMessage({
      chatId,
      userId,
      text,
      kb: holesKeyboard(r.gameId, 1, null),
      imageUrl: cfg.imageUrl,
      forceNew: true,
      autoDelete: cfg.autoDelete,
    });

    // Also refresh shill after a purchase/game start (requested behavior)
    if (!cfg.dmOnly && !isDM(ctx)) {
      try {
        await repostShill(chatId, { forceNew: false });
      } catch {}
    }
  }

  async function sendOrEditGameMessage(params: {
    chatId: string;
    userId: string;
    text: string;
    kb?: any;
    imageUrl?: string | null;
    forceNew?: boolean;
    autoDelete?: boolean;
  }) {
    const key = gameKey(params.chatId, params.userId);
    const prev = lastGameMsg.get(key);

    const desiredImg = String(params.imageUrl || "").trim();

    // try edit existing (single-message UX)
    if (!params.forceNew && prev?.messageId) {
      const reply_markup = params.kb ? getReplyMarkup(params.kb) : undefined;

      // If the message has a photo and we want to swap the banner image, use editMessageMedia.
      if (prev.hasPhoto && desiredImg && desiredImg !== String(prev.imageUrl || "").trim()) {
        const okMedia = await safeEditMedia(bot, params.chatId, prev.messageId, desiredImg, params.text, reply_markup);
        if (okMedia) {
          lastGameMsg.set(key, { messageId: prev.messageId, hasPhoto: true, imageUrl: desiredImg });
          return { messageId: prev.messageId, hasPhoto: true };
        }
      }

      // Otherwise just edit caption/text.
      const ok = prev.hasPhoto
        ? await safeEditCaption(bot, params.chatId, prev.messageId, params.text, reply_markup)
        : await safeEditText(bot, params.chatId, prev.messageId, params.text, reply_markup);
      if (ok) {
        lastGameMsg.set(key, { messageId: prev.messageId, hasPhoto: prev.hasPhoto, imageUrl: prev.imageUrl });
        return { messageId: prev.messageId, hasPhoto: prev.hasPhoto };
      }
    }

    // delete previous if requested
    if (params.autoDelete && prev?.messageId) {
      await safeDelete(bot, params.chatId, prev.messageId);
    }

    // send new
    const reply_markup = params.kb ? getReplyMarkup(params.kb) : undefined;
    let sent: any;
    let hasPhoto = false;

    if (desiredImg) {
      sent = await safeSendPhoto(bot, params.chatId, desiredImg, params.text, reply_markup ? { reply_markup } : undefined);
      hasPhoto = !!(sent && (sent.photo || sent.document));
    } else {
      sent = await safeSendMessage(bot, params.chatId, params.text, reply_markup ? { reply_markup } : undefined);
    }

    const messageId = sent?.message_id;
    if (messageId) lastGameMsg.set(key, { messageId, hasPhoto, imageUrl: desiredImg || null });
    return { messageId, hasPhoto };
  }

  // --- Shill post ---
  async function repostShill(chatId: string, opts?: { forceNew?: boolean }) {
    const cfg = await getCfg(chatId);
    const text = buildShillText(cfg);
    const kb = buildShillKeyboard(cfg);
    const reply_markup = getReplyMarkup(kb);

    const oldId = cfg.shillMessageId ? Number(cfg.shillMessageId) : null;

    // Try edit caption/text if not forced and we have an existing msg
    if (!opts?.forceNew && oldId) {
      const okCaption = await safeEditCaption(bot, chatId, oldId, text, reply_markup);
      if (okCaption) return { ok: true as const, messageId: oldId };
      const okText = await safeEditText(bot, chatId, oldId, text, reply_markup);
      if (okText) return { ok: true as const, messageId: oldId };
    }

    if (oldId) await safeDelete(bot, chatId, oldId);

    let sent: any;
    if (cfg.imageUrl) {
      sent = await bot.telegram.sendPhoto(chatId, cfg.imageUrl, { caption: text, reply_markup });
    } else {
      sent = await bot.telegram.sendMessage(chatId, text, { reply_markup });
    }

    const messageId = sent?.message_id;
    if (messageId) {
      await api<any>("/tg/game/whack/setShill", { chatId, shillMessageId: messageId });
    }
    return { ok: true as const, messageId };
  }

  // --- Commands ---
  bot.command("whack", async (ctx) => {
    try {
      const cfg = await getCfg(getChatId(ctx));
      if (!(await ensureAllowed(ctx, cfg))) return;

      const parts = parseArgs(ctx.message?.text);
      const amount = parts[1];
      if (!amount) {
        await sendEphemeral(ctx, `Usage: /whack <amount>  (min ${cfg.minBetHuman})`, 12000);
        return;
      }

      const from = ctx.from;
      if (!from) return;

      const r = await api<WhackStartRes>("/tg/game/whack/start", {
        telegramUserId: String(from.id),
        telegramHandle: from.username ? String(from.username) : undefined,
        firstName: from.first_name ? String(from.first_name) : undefined,
        isBot: !!from.is_bot,
        betHuman: String(amount),
      });

      const text = buildPickingText(cfg, 1, r.betHuman, r.treasuryHuman, r.maxBetHuman);
      await sendOrEditGameMessage({
        chatId: getChatId(ctx),
        userId: String(from.id),
        text,
        kb: holesKeyboard(r.gameId, 1, null),
        imageUrl: cfg.imageUrl,
        forceNew: true,
        autoDelete: cfg.autoDelete,
      });
    } catch (e: any) {
      await ctx.reply(`Error: ${e?.message || e}`);
    }
  });

  // Admin
  bot.command("whackadmin", async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        await sendEphemeral(ctx, "Not admin.", 8000);
        return;
      }
      if (!isDM(ctx)) {
        await sendEphemeral(ctx, "Run /whackadmin in DM.", 12000);
        return;
      }

      const cfg = await getCfg();
      const lines: string[] = [];
      lines.push(`${E_ADMIN} Whack Admin (${cfg.updated})`);
      lines.push(`Image: ${cfg.imageUrl ? cfg.imageUrl : "(none)"}`);
      lines.push(`Caption: ${cfg.caption ? cfg.caption : "(none)"}`);
      lines.push(`Min bet: ${cfg.minBetHuman}`);
      lines.push(`Quick bets: ${(cfg.quickBetButtons || []).join(", ")}`);
      lines.push(`DM-only: ${cfg.dmOnly ? "ON" : "OFF"}`);
      lines.push(`Auto-delete: ${cfg.autoDelete ? "ON" : "OFF"}`);
      lines.push("\nTip: shill interval is per chat. Use /chatid in the target group then set interval.");

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(`${E_CAM} Set imageUrl`, "whack:admin:set:imageUrl")],
        [Markup.button.callback(`Set caption`, "whack:admin:set:caption")],
        [Markup.button.callback(`🖼️ Banner images`, "whack:admin:banners")],
        [Markup.button.callback(`Set min bet`, "whack:admin:set:minBet")],
        [Markup.button.callback(`Set quick bets`, "whack:admin:set:quickBets")],
        [Markup.button.callback(`Toggle DM-only`, "whack:admin:set:dmOnly")],
        [Markup.button.callback(`Toggle auto-delete`, "whack:admin:set:autoDelete")],
        [Markup.button.callback(`${E_CLOCK} Set shill interval (sec)`, "whack:admin:set:shillInterval")],
        [Markup.button.callback(`${E_STOP} Disable shill (sec=0)`, "whack:admin:set:shillDisable")],
      ]);

      await ctx.reply(lines.join("\n"), kb);
    } catch (e: any) {
      await ctx.reply(`Error: ${e?.message || e}`);
    }
  });

  bot.action(/^whack:admin:banners$/i, async (ctx) => {
    try {
      if (!isAdmin(ctx)) return ctx.answerCbQuery("Not admin", { show_alert: true });
      if (!isDM(ctx)) return ctx.answerCbQuery("Use in DM", { show_alert: true });

      const cfg = await getCfg();
      const lines: string[] = [];
      lines.push(`${E_ADMIN} Whack Admin — Banners (${cfg.updated})`);
      lines.push(`Start image: ${cfg.imageUrl ? cfg.imageUrl : "(none)"}`);
      lines.push(`
Set optional banner images used on results:`);
      lines.push(`Win Normal: ${cfg.bannerWinNormalUrl ? "set" : "(none)"}`);
      lines.push(`Win Golden: ${cfg.bannerWinGoldenUrl ? "set" : "(none)"}`);
      lines.push(`Win Both: ${cfg.bannerWinBothUrl ? "set" : "(none)"}`);
      lines.push(`Lose: ${cfg.bannerLoseUrl ? "set" : "(none)"}`);
      lines.push(`Taunt (3 misses): ${cfg.bannerTauntUrl ? "set" : "(none)"}`);

      const b = (has: boolean, label: string, field: string) =>
        Markup.button.callback(`${has ? "✅" : "⬜"} ${label}`, `whack:admin:set:${field}`);

      const kb = Markup.inlineKeyboard([
        [b(!!cfg.bannerWinNormalUrl, "Win Normal", "bannerWinNormal")],
        [b(!!cfg.bannerWinGoldenUrl, "Win Golden", "bannerWinGolden")],
        [b(!!cfg.bannerWinBothUrl, "Win Both (5x)", "bannerWinBoth")],
        [b(!!cfg.bannerLoseUrl, "Lose", "bannerLose")],
        [b(!!cfg.bannerTauntUrl, "Taunt (3 misses)", "bannerTaunt")],
        [Markup.button.callback("⬅️ Back", "whack:admin:main")],
      ]);

      // Prefer editing the existing admin message
      try {
        await ctx.editMessageText(lines.join("\n"), kb as any);
      } catch {
        await ctx.reply(lines.join("\n"), kb);
      }
      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^whack:admin:main$/i, async (ctx) => {
    try {
      if (!isAdmin(ctx)) return ctx.answerCbQuery("Not admin", { show_alert: true });
      if (!isDM(ctx)) return ctx.answerCbQuery("Use in DM", { show_alert: true });

      const cfg = await getCfg();
      const lines: string[] = [];
      lines.push(`${E_ADMIN} Whack Admin (${cfg.updated})`);
      lines.push(`Image: ${cfg.imageUrl ? cfg.imageUrl : "(none)"}`);
      lines.push(`Caption: ${cfg.caption ? cfg.caption : "(none)"}`);
      lines.push(`Min bet: ${cfg.minBetHuman}`);
      lines.push(`Quick bets: ${(cfg.quickBetButtons || []).join(", ")}`);
      lines.push(`DM-only: ${cfg.dmOnly ? "ON" : "OFF"}`);
      lines.push(`Auto-delete: ${cfg.autoDelete ? "ON" : "OFF"}`);
      lines.push("\nTip: shill interval is per chat. Use /chatid in the target group then set interval.");

      const kb = Markup.inlineKeyboard([
        [Markup.button.callback(`${E_CAM} Set imageUrl`, "whack:admin:set:imageUrl")],
        [Markup.button.callback(`Set caption`, "whack:admin:set:caption")],
        [Markup.button.callback(`🖼️ Banner images`, "whack:admin:banners")],
        [Markup.button.callback(`Set min bet`, "whack:admin:set:minBet")],
        [Markup.button.callback(`Set quick bets`, "whack:admin:set:quickBets")],
        [Markup.button.callback(`Toggle DM-only`, "whack:admin:set:dmOnly")],
        [Markup.button.callback(`Toggle auto-delete`, "whack:admin:set:autoDelete")],
        [Markup.button.callback(`${E_CLOCK} Set shill interval (sec)`, "whack:admin:set:shillInterval")],
        [Markup.button.callback(`${E_STOP} Disable shill (sec=0)`, "whack:admin:set:shillDisable")],
      ]);

      try {
        await ctx.editMessageText(lines.join("\n"), kb as any);
      } catch {
        await ctx.reply(lines.join("\n"), kb);
      }
      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  // Admin menu buttons
  bot.action(/^whack:admin:set:(imageUrl|caption|minBet|quickBets|dmOnly|autoDelete|shillInterval|shillDisable|bannerWinNormal|bannerWinGolden|bannerWinBoth|bannerLose|bannerTaunt)$/i, async (ctx) => {
    try {
      if (!isAdmin(ctx)) return ctx.answerCbQuery("Not admin", { show_alert: true });
      if (!isDM(ctx)) return ctx.answerCbQuery("Use in DM", { show_alert: true });

      const field = String((ctx.callbackQuery as any)?.data || "").split(":").pop() || "";
      const key = adminKey(ctx);
      const exp = Date.now() + 2 * 60 * 1000;
      adminWait.set(key, { field, expiresAt: exp });

      if (field === "dmOnly") {
        const cfg = await getCfg();
        await api<any>("/tg/game/whack/adminUpdate", { dmOnly: !cfg.dmOnly });
        await ctx.answerCbQuery(`${E_CHECK} Toggled DM-only`);
        return;
      }

      if (field === "autoDelete") {
        const cfg = await getCfg();
        await api<any>("/tg/game/whack/adminUpdate", { autoDelete: !cfg.autoDelete });
        await ctx.answerCbQuery(`${E_CHECK} Toggled auto-delete`);
        return;
      }

      if (field === "shillDisable") {
        await sendEphemeral(ctx, "Reply with the chatId to disable shill for (or 'this' to use current chat).", 25000);
        adminWait.set(key, { field: "shillInterval", expiresAt: exp, chatId: "__ASK_CHAT__" });
        await ctx.answerCbQuery("OK");
        return;
      }

      const prompts: Record<string, string> = {
        imageUrl: "Send the new image URL (or 'none').",
        bannerWinNormal: "Send Win Normal banner image URL (or 'none').",
        bannerWinGolden: "Send Win Golden banner image URL (or 'none').",
        bannerWinBoth: "Send Win Both (5x) banner image URL (or 'none').",
        bannerLose: "Send Lose banner image URL (or 'none').",
        bannerTaunt: "Send Taunt banner image URL (or 'none').",
        caption: "Send the new caption text.",
        minBet: "Send the new min bet (credits), e.g. 1 or 2.5",
        quickBets: "Send quick bet buttons as comma list, e.g. 1,3,5",
        shillInterval: "Send: <chatId> <seconds>  (example: -1001234567890 900). Use 0 to disable.",
      };

      await sendEphemeral(ctx, prompts[field] || "Send value...", 25000);
      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  // Admin prompt listener (DM only)
  bot.on("text", async (ctx, next) => {
    try {
      const key = adminKey(ctx);
      const w = adminWait.get(key);
      if (!w) return next();
      if (Date.now() > w.expiresAt) {
        adminWait.delete(key);
        return next();
      }

      if (!isAdmin(ctx) || !isDM(ctx)) return next();

      const txt = String(ctx.message?.text || "").trim();
      const field = w.field;

      if (field === "imageUrl") {
        await api<any>("/tg/game/whack/adminUpdate", { imageUrl: txt.toLowerCase() === "none" ? "" : txt });
        adminWait.delete(key);
        await sendEphemeral(ctx, `${E_CHECK} Updated image URL.`, 12000);
        return;
      }

      if (field === "bannerWinNormal" || field === "bannerWinGolden" || field === "bannerWinBoth" || field === "bannerLose" || field === "bannerTaunt") {
        const v = txt.toLowerCase() === "none" ? "" : txt;
        const body: any = {};
        if (field === "bannerWinNormal") body.bannerWinNormalUrl = v;
        if (field === "bannerWinGolden") body.bannerWinGoldenUrl = v;
        if (field === "bannerWinBoth") body.bannerWinBothUrl = v;
        if (field === "bannerLose") body.bannerLoseUrl = v;
        if (field === "bannerTaunt") body.bannerTauntUrl = v;
        await api<any>("/tg/game/whack/adminUpdate", body);
        adminWait.delete(key);
        await sendEphemeral(ctx, `${E_CHECK} Updated banner.`, 12000);
        return;
      }

      if (field === "caption") {
        await api<any>("/tg/game/whack/adminUpdate", { caption: txt });
        adminWait.delete(key);
        await sendEphemeral(ctx, `${E_CHECK} Updated caption.`, 12000);
        return;
      }

      if (field === "minBet") {
        await api<any>("/tg/game/whack/adminUpdate", { minBetHuman: txt });
        adminWait.delete(key);
        await sendEphemeral(ctx, `${E_CHECK} Updated min bet.`, 12000);
        return;
      }

      if (field === "quickBets") {
        const arr = txt
          .split(/[,\s]+/)
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x > 0);
        await api<any>("/tg/game/whack/adminUpdate", { quickBetButtons: arr });
        adminWait.delete(key);
        await sendEphemeral(ctx, `${E_CHECK} Updated quick bets.`, 12000);
        return;
      }

      if (field === "shillInterval") {
        const parts = txt.split(/\s+/).filter(Boolean);
        if (parts.length < 2) {
          await sendEphemeral(ctx, "Format: <chatId> <seconds>", 12000);
          return;
        }
        const chatId = parts[0];
        const sec = Number(parts[1]);
        await api<any>("/tg/game/whack/adminUpdate", { chatId, shillIntervalSec: sec });
        adminWait.delete(key);
        await sendEphemeral(ctx, `${E_CHECK} Updated shill interval for ${chatId} to ${sec}s`, 15000);
        return;
      }

      return next();
    } catch (e: any) {
      try {
        await sendEphemeral(ctx, `Error: ${e?.message || e}`, 15000);
      } catch {}
      return next();
    }
  });

  // --- Shill refresh ---
  bot.action(/^whack:shill:refresh$/i, async (ctx) => {
    try {
      const chatId = String((ctx.callbackQuery as any)?.message?.chat?.id ?? "");
      if (!chatId) return ctx.answerCbQuery("no chat", { show_alert: true });

      const cfg = await getCfg(chatId);
      if (cfg.dmOnly) {
        await ctx.answerCbQuery("DM-only", { show_alert: true });
        return;
      }

      // Only refresh if chat is enabled for public commands
      if (!isDM(ctx)) {
        const ok = await requirePublicChat(ctx);
        if (!ok) {
          try {
            await ctx.answerCbQuery("Public disabled", { show_alert: true });
          } catch {}
          return;
        }
      }

      await repostShill(chatId, { forceNew: false });
      await ctx.answerCbQuery(`${E_CHECK} Updated`);
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  // --- Quick bet (from shill) ---
  bot.action(/^whack:play:(\d+(?:\.\d+)?)$/i, async (ctx) => {
    try {
      const amount = String((ctx.match as any)?.[1] ?? "");
      const from = ctx.from;
      if (!from) return;

      const chatId = String((ctx.callbackQuery as any)?.message?.chat?.id ?? getChatId(ctx));
      const cfg = await getCfg(chatId);

      await startGame(ctx, chatId, cfg, amount);
      try {
        await ctx.answerCbQuery("Started");
      } catch {}
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  // --- Try again (on completion) ---
  bot.action(/^whack:again$/i, async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      const chatId = String((ctx.callbackQuery as any)?.message?.chat?.id ?? getChatId(ctx));
      const cfg = await getCfg(chatId);

      const userId = String(from.id);
      const remembered = String(lastBetByUser.get(userId) || "").trim();
      const fallback = String((cfg.quickBetButtons?.[0] ?? 1));
      const amount = remembered || fallback;

      await startGame(ctx, chatId, cfg, amount);
      try {
        await ctx.answerCbQuery("Started");
      } catch {}
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  // --- Gameplay callbacks ---
  bot.action(/^whack:hole:(\d+):([a-f0-9\-]+):(\d+)$/i, async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const stage = Number((ctx.match as any)[1]);
      const gameId = String((ctx.match as any)[2]);
      const hole = Number((ctx.match as any)[3]);

      const cfg = await getCfg(getChatId(ctx));

      await api<any>("/tg/game/whack/select", {
        telegramUserId: String(from.id),
        gameId,
        hole,
      });

      const text = stage === 2 ? `Stage 2: pick 1 hole:` : `Stage 1: pick 1 hole:`;
      await sendOrEditGameMessage({
        chatId: getChatId(ctx),
        userId: String(from.id),
        text: `${E_HOLE} Whack-a-Wombat (${cfg.updated})\n\n${text}`,
        kb: holesKeyboard(gameId, stage, hole),
        imageUrl: cfg.imageUrl,
        forceNew: false,
        autoDelete: cfg.autoDelete,
      });

      await ctx.answerCbQuery("Selected");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^whack:noop$/i, async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
  });

  bot.action(/^whack:confirm:(\d+):([a-f0-9\-]+)$/i, async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      const gameId = String((ctx.match as any)[2]);
      const chatId = getChatId(ctx);

      const cfg = await getCfg(chatId);
      const r = await api<any>("/tg/game/whack/confirm", {
        telegramUserId: String(from.id),
        gameId,
      });

      const userId = String(from.id);
      const outcome = String(r.outcome || "");

      const pick: number | null =
        (r.pick != null ? Number(r.pick) : null) ?? (r.secondPick != null ? Number(r.secondPick) : null) ?? (r.foundHole != null ? Number(r.foundHole) : null);

      const bannerFor = (taunt: boolean) => {
        if (taunt && cfg.bannerTauntUrl) return cfg.bannerTauntUrl;
        if (outcome === "FIVE_X" && cfg.bannerWinBothUrl) return cfg.bannerWinBothUrl;
        if (outcome === "NORMAL" && cfg.bannerWinNormalUrl) return cfg.bannerWinNormalUrl;
        if (outcome === "GOLDEN" && cfg.bannerWinGoldenUrl) return cfg.bannerWinGoldenUrl;
        if ((outcome === "MISS" || outcome === "SECOND_MISS") && cfg.bannerLoseUrl) return cfg.bannerLoseUrl;
        return cfg.imageUrl;
      };

      if (r.status === "DECIDE") {
        resetStreak(userId);
        const kb = decideKeyboardWithGrid(gameId, { pick, normalHole: Number(r.normalHole), goldenHole: Number(r.goldenHole) });
        await sendOrEditGameMessage({
          chatId,
          userId,
          text: buildDecideText(cfg, r),
          kb,
          imageUrl: bannerFor(false),
          forceNew: false,
          autoDelete: cfg.autoDelete,
        });
        await ctx.answerCbQuery("Result");
        return;
      }

      if (r.status === "RESOLVED") {
        let taunt = false;
        if (outcome === "MISS") {
          const c = incStreak(userId);
          if (c >= 3) {
            taunt = true;
            resetStreak(userId);
          }
        } else {
          resetStreak(userId);
        }

        const kb = holesResultKeyboardWithTryAgain({ pick, normalHole: Number(r.normalHole), goldenHole: Number(r.goldenHole) });
        const base = buildResolvedText(cfg, r);
        const text = taunt ? `${base}

🧠 Take the hint... try a different hole next time.` : base;

        await sendOrEditGameMessage({
          chatId,
          userId,
          text,
          kb,
          imageUrl: bannerFor(taunt),
          forceNew: false,
          autoDelete: cfg.autoDelete,
        });
        await ctx.answerCbQuery("Done");
        return;
      }

      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^whack:collect:([a-f0-9\-]+)$/i, async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const gameId = String((ctx.match as any)[1]);
      const chatId = getChatId(ctx);

      const cfg = await getCfg(chatId);
      const r = await api<any>('/tg/game/whack/collect', {
        telegramUserId: String(from.id),
        gameId,
      });

      const userId = String(from.id);
      resetStreak(userId);

      const outcome = String(r.outcome || '');
      let img = cfg.imageUrl;
      if (outcome === 'NORMAL' && cfg.bannerWinNormalUrl) img = cfg.bannerWinNormalUrl;
      if (outcome === 'GOLDEN' && cfg.bannerWinGoldenUrl) img = cfg.bannerWinGoldenUrl;

      const kb = holesResultKeyboardWithTryAgain({ pick: Number(r.foundHole ?? r.pick ?? null), normalHole: Number(r.normalHole), goldenHole: Number(r.goldenHole) });

      await sendOrEditGameMessage({
        chatId,
        userId,
        text: buildResolvedText(cfg, r),
        kb,
        imageUrl: img,
        forceNew: false,
        autoDelete: cfg.autoDelete,
      });
      await ctx.answerCbQuery('Collected');
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^whack:continue:([a-f0-9\-]+)$/i, async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const gameId = String((ctx.match as any)[1]);
      const cfg = await getCfg(getChatId(ctx));
      const r = await api<any>("/tg/game/whack/continue", {
        telegramUserId: String(from.id),
        gameId,
      });
      const text = `${E_HOLE} Whack-a-Wombat (${cfg.updated})\n\nStage 2: bet locked again (${r.betHuman} credits).\nPick 1 hole:`;
      await sendOrEditGameMessage({
        chatId: getChatId(ctx),
        userId: String(from.id),
        text,
        kb: holesKeyboard(gameId, 2, null),
        imageUrl: cfg.imageUrl,
        forceNew: false,
        autoDelete: cfg.autoDelete,
      });
      await ctx.answerCbQuery("Stage 2");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  bot.action(/^whack:cancel:(\d+):([a-f0-9\-]+)$/i, async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const gameId = String((ctx.match as any)[2]);
      const cfg = await getCfg(getChatId(ctx));
      const r = await api<any>("/tg/game/whack/cancel", {
        telegramUserId: String(from.id),
        gameId,
      });
      if (r.status === "CANCELLED") {
        await sendOrEditGameMessage({
          chatId: getChatId(ctx),
          userId: String(from.id),
          text: `${E_STOP} Cancelled. Bet refunded.`,
          imageUrl: cfg.imageUrl,
          forceNew: false,
          autoDelete: cfg.autoDelete,
        });
        await ctx.answerCbQuery("Cancelled");
        return;
      }

      if (r.status === "DECIDE") {
        await sendOrEditGameMessage({
          chatId: getChatId(ctx),
          userId: String(from.id),
          text: `${E_HOLE} Whack-a-Wombat (${cfg.updated})\n\nStage 2 cancelled. Your first win is still pending.\nChoose:`,
          kb: decideKeyboard(gameId),
          imageUrl: cfg.imageUrl,
          forceNew: false,
          autoDelete: cfg.autoDelete,
        });
        await ctx.answerCbQuery("Reverted");
        return;
      }

      await ctx.answerCbQuery("OK");
    } catch (e: any) {
      try {
        await ctx.answerCbQuery(`Error: ${e?.message || e}`, { show_alert: true });
      } catch {}
    }
  });

  // --- Poller: shill repost loop ---
  function parseChatList(): string[] {
    return String(process.env.PUBLIC_CHAT_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const tickMs = Math.max(10, Number(process.env.WHACK_SHILL_TICK_SEC || "30")) * 1000;

  setInterval(async () => {
    const chats = parseChatList();
    if (chats.length === 0) return;

    for (const chatId of chats) {
      try {
        const cfg = await getCfg(chatId);
        if (cfg.dmOnly) continue;

        const enabled = Number(cfg.shillIntervalSec ?? 900);
        if (!Number.isFinite(enabled) || enabled <= 0) continue;

        // If the bot is globally disabled for public in this chat, skip
        // (We can't reliably infer chat type here; this is a best-effort guard.)
        // The enable/allowlist check is already enforced on gameplay.
        const now = Date.now();
        const next = nextShillAtByChat.get(chatId) ?? now + enabled * 1000;
        if (now < next) continue;

        await repostShill(chatId, { forceNew: true });
        await api<any>("/tg/game/whack/markShill", { chatId });
        nextShillAtByChat.set(chatId, now + Math.max(60, enabled) * 1000);
      } catch {
        // ignore
      }
    }
  }, tickMs);
}
