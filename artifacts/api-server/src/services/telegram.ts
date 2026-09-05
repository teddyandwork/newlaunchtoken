import { logger } from "../lib/logger";
import type { NormalizedToken } from "../providers/types";

type TelegramState = "connected" | "disconnected" | "unconfigured";

let state: TelegramState =
  process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID
    ? "connected"
    : "unconfigured";

export function requireTelegramLink(): boolean {
  return process.env.REQUIRE_TELEGRAM?.toLowerCase() !== "false";
}

export function isValidTelegramLink(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      ["t.me", "www.t.me", "telegram.me", "www.telegram.me", "telegram.dog"].includes(
        hostname,
      ) &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

export function getTelegramState(): TelegramState {
  return state;
}

function keyboardFor(token: NormalizedToken): Array<Array<{ text: string; url: string }>> {
  const rows: Array<Array<{ text: string; url: string }>> = [];
  const socialRow: Array<{ text: string; url: string }> = [];
  if (token.telegram) socialRow.push({ text: "📱 Join Telegram", url: token.telegram });
  if (token.twitter) socialRow.push({ text: "🐦 Follow X", url: token.twitter });
  if (token.website) socialRow.push({ text: "🌐 Visit Website", url: token.website });
  if (socialRow.length > 0) rows.push(socialRow);
  if (token.chartUrl) rows.push([{ text: "📊 Open Chart", url: token.chartUrl }]);
  return rows;
}

function headlineFor(source: string): string {
  if (source === "dexscreener") return "NOW TRENDING ON DEXSCREENER";
  if (source === "dextools") return "NOW TRENDING ON DEXTOOLS";
  if (source === "pumpfun") return "NEW ON PUMP.FUN";
  return `NEW TOKEN — ${source.toUpperCase()}`;
}

function messageFor(token: NormalizedToken): string {
  const symbol = token.symbol ? `$${token.symbol}` : token.name ?? token.address;
  const lines = [
    `🔔 ${headlineFor(token.source)}`,
    "",
    `🪙 Token: ${symbol}`,
    `⛓️ Network: ${token.chain}`,
    "",
  ];
  if (token.telegram) lines.push("📱 Telegram: Join");
  if (token.twitter) lines.push("🐦 Twitter: Follow");
  if (token.website) lines.push("🌐 Website: Visit");
  lines.push("", "📋 Contract:", token.address);
  return lines.join("\n");
}

async function requestTelegram(
  method: "sendMessage" | "sendPhoto" | "getMe",
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: { message_id?: number }; description?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    state = "unconfigured";
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
        description?: string;
      };
      if (response.ok && payload.ok) {
        state = "connected";
        return {
          ok: true,
          result: payload.result,
          description: payload.description,
        };
      }
      if (response.status < 500 && response.status !== 429) {
        state = "disconnected";
        throw new Error(payload.description ?? `Telegram responded with ${response.status}`);
      }
      lastError = new Error(payload.description ?? `Telegram responded with ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Telegram request failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  state = "disconnected";
  throw lastError ?? new Error("Telegram request failed");
}

export async function checkTelegram(): Promise<TelegramState> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) {
    state = "unconfigured";
    return state;
  }
  try {
    await requestTelegram("getMe", {});
  } catch (error) {
    logger.warn({ err: error }, "Telegram health check failed");
  }
  return state;
}

export async function sendTelegramAlert(
  token: NormalizedToken,
): Promise<{ messageId: string }> {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) {
    state = "unconfigured";
    throw new Error("TELEGRAM_CHANNEL_ID is not configured");
  }
  if (requireTelegramLink() && !isValidTelegramLink(token.telegram)) {
    throw new Error(
      token.telegram
        ? "SKIPPED — INVALID TELEGRAM LINK"
        : "SKIPPED — NO VALID TELEGRAM LINK",
    );
  }

  const text = messageFor(token);
  const inlineKeyboard = keyboardFor(token);
  const replyMarkup = inlineKeyboard.length
    ? { inline_keyboard: inlineKeyboard }
    : undefined;

  if (token.logoUrl) {
    const result = await requestTelegram("sendPhoto", {
      chat_id: channelId,
      photo: token.logoUrl,
      caption: text,
      reply_markup: replyMarkup,
    });
    return { messageId: String(result.result?.message_id ?? "") };
  }

  const result = await requestTelegram("sendMessage", {
    chat_id: channelId,
    text,
    disable_web_page_preview: false,
    reply_markup: replyMarkup,
  });
  return { messageId: String(result.result?.message_id ?? "") };
}

export async function sendTelegramTestMessage(): Promise<{ messageId: string }> {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) {
    state = "unconfigured";
    throw new Error("TELEGRAM_CHANNEL_ID is not configured");
  }
  const result = await requestTelegram("sendMessage", {
    chat_id: channelId,
    text: "✅ Token Radar connectivity test",
  });
  return { messageId: String(result.result?.message_id ?? "") };
}