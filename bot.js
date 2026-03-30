// ============================================================
//  MINECRAFT DONATION BOT  —  Configuration
// ============================================================
const CONFIG = {
  BOT_TOKEN: "YOUR_BOT_TOKEN_HERE",
  ADMIN_ID: 123456789, // Your Telegram numeric user ID
  ADMIN_PROFILE_LINK: "https://t.me/your_admin_username",
  UKRAINE_CARD_DETAILS: "4441 1111 2222 3333 (ПриватБанк, Іван І.)",
  RCON: {
    host: "127.0.0.1",
    port: 25575,
    password: "your_rcon_password",
  },
};

// ============================================================
//  Dependencies
// ============================================================
const TelegramBot = require("node-telegram-bot-api");
const { Rcon } = require("rcon-client");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ============================================================
//  Data persistence
// ============================================================
const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ promos: {}, transactions: {} }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
//  Product catalog
// ============================================================
const RANKS = {
  core:     { label: "⚡ Core",     price: 50,   stars: 83 },
  apex:     { label: "🔥 Apex",     price: 100,  stars: 167 },
  prime:    { label: "💎 Prime",    price: 150,  stars: null },
  omega:    { label: "🌀 Omega",    price: 200,  stars: null },
  ultimate: { label: "🏆 Ultimate", price: 500,  stars: null },
  supreme:  { label: "👑 Supreme",  price: 1000, stars: null },
};

// Coins: min 50 (15 Stars), max 500. Stars = ceil(amount * 15 / 50)
const COINS_MIN = 50;
const COINS_MAX = 500;
const COINS_STARS_PER_50 = 15;

// ============================================================
//  Bot & Express init
// ============================================================
const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });

const app = express();
app.get("/ping", (_req, res) => res.send("OK"));
app.listen(3000, () => console.log("Keep-alive server on port 3000"));

// ============================================================
//  In-memory session store
// ============================================================
const sessions = {}; // chatId -> session object

function getSession(chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  return sessions[chatId];
}

function clearSession(chatId) {
  sessions[chatId] = {};
}

// ============================================================
//  RCON helper
// ============================================================
async function rconExec(command) {
  const rcon = await Rcon.connect({
    host: CONFIG.RCON.host,
    port: CONFIG.RCON.port,
    password: CONFIG.RCON.password,
  });
  const response = await rcon.send(command);
  await rcon.end();
  return response;
}

// ============================================================
//  Keyboards
// ============================================================
function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🎖 Купити ранг", callback_data: "menu_ranks" },
        { text: "🪙 Купити монети", callback_data: "menu_coins" },
      ],
      [{ text: "ℹ️ Підтримка", callback_data: "menu_support" }],
    ],
  };
}

function ranksKeyboard() {
  const rows = Object.entries(RANKS).map(([id, r]) => [
    {
      text: `${r.label} — ${r.price} ₴`,
      callback_data: `buy_rank_${id}`,
    },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "back_main" }]);
  return { inline_keyboard: rows };
}

function paymentMethodKeyboard(rankId) {
  const rank = RANKS[rankId];
  const buttons = [
    [
      {
        text: "💳 Картка України (UAH)",
        callback_data: `pay_card_${rankId}`,
      },
    ],
  ];
  if (rank.stars) {
    buttons.push([
      {
        text: `⭐ Telegram Stars (${rank.stars} зірок)`,
        callback_data: `pay_stars_${rankId}`,
      },
    ]);
  }
  buttons.push([{ text: "⬅️ Назад", callback_data: "menu_ranks" }]);
  return { inline_keyboard: buttons };
}

function confirmKeyboard(back) {
  return {
    inline_keyboard: [[{ text: "⬅️ Назад", callback_data: back }]],
  };
}

function adminTransactionKeyboard(txId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Підтвердити", callback_data: `admin_approve_${txId}` },
        { text: "❌ Відхилити", callback_data: `admin_reject_${txId}` },
      ],
    ],
  };
}

// ============================================================
//  Promo helpers
// ============================================================
function applyPromo(promoCode, itemId, originalPrice) {
  const data = loadData();
  const promo = data.promos[promoCode.toUpperCase()];
  if (!promo) return { valid: false, reason: "Промокод не знайдено." };
  if (promo.uses >= promo.limit)
    return { valid: false, reason: "Промокод вичерпано." };
  if (promo.itemRestriction && promo.itemRestriction !== itemId)
    return {
      valid: false,
      reason: `Цей промокод діє лише для "${promo.itemRestriction}".`,
    };
  const discount = Math.floor(originalPrice * (promo.discount / 100));
  const finalPrice = Math.max(0, originalPrice - discount);
  return { valid: true, discount, finalPrice, promo };
}

function consumePromo(promoCode) {
  const data = loadData();
  if (data.promos[promoCode]) {
    data.promos[promoCode].uses += 1;
    saveData(data);
  }
}

// ============================================================
//  Transaction helpers
// ============================================================
function createTransaction(details) {
  const data = loadData();
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  data.transactions[txId] = { ...details, status: "pending", createdAt: new Date().toISOString() };
  saveData(data);
  return txId;
}

// ============================================================
//  Send main menu
// ============================================================
function sendMainMenu(chatId, text) {
  bot.sendMessage(
    chatId,
    text ||
      "👋 Ласкаво просимо до <b>Minecraft Donation Bot</b>!\n\nОберіть що хочете придбати:",
    { parse_mode: "HTML", reply_markup: mainMenuKeyboard() }
  );
}

// ============================================================
//  /start
// ============================================================
bot.onText(/\/start/, (msg) => {
  clearSession(msg.chat.id);
  sendMainMenu(msg.chat.id);
});

// ============================================================
//  /admin
// ============================================================
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== CONFIG.ADMIN_ID) return;
  sendAdminMenu(msg.chat.id);
});

function sendAdminMenu(chatId) {
  bot.sendMessage(chatId, "🛠 <b>Адмін панель</b>", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📋 Pending транзакції", callback_data: "admin_pending" },
          { text: "🎟 Промокоди", callback_data: "admin_promos" },
        ],
        [{ text: "🖥 RCON консоль", callback_data: "admin_rcon" }],
      ],
    },
  });
}

// ============================================================
//  Callback query router
// ============================================================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const msgId = query.message.message_id;

  await bot.answerCallbackQuery(query.id);

  // ── Main menu ──────────────────────────────────────────────
  if (data === "back_main" || data === "menu_main") {
    clearSession(chatId);
    return bot.editMessageText(
      "👋 Ласкаво просимо до <b>Minecraft Donation Bot</b>!\n\nОберіть що хочете придбати:",
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: mainMenuKeyboard() }
    );
  }

  if (data === "menu_support") {
    return bot.editMessageText(
      `💬 <b>Підтримка</b>\n\nЯкщо виникли питання — зверніться до адміністратора:\n${CONFIG.ADMIN_PROFILE_LINK}`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "back_main" }]] } }
    );
  }

  // ── Ranks list ─────────────────────────────────────────────
  if (data === "menu_ranks") {
    clearSession(chatId);
    return bot.editMessageText(
      "🎖 <b>Оберіть ранг:</b>",
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: ranksKeyboard() }
    );
  }

  // ── Buy rank → ask nickname ────────────────────────────────
  if (data.startsWith("buy_rank_")) {
    const rankId = data.replace("buy_rank_", "");
    const sess = getSession(chatId);
    sess.type = "rank";
    sess.rankId = rankId;
    sess.step = "nickname";
    return bot.editMessageText(
      `${RANKS[rankId].label} — <b>${RANKS[rankId].price} ₴</b>\n\n✏️ Введіть ваш <b>Minecraft нікнейм</b>:`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "menu_ranks" }]] } }
    );
  }

  // ── Coins menu ─────────────────────────────────────────────
  if (data === "menu_coins") {
    const sess = getSession(chatId);
    sess.type = "coins";
    sess.step = "nickname";
    return bot.editMessageText(
      `🪙 <b>Купити монети</b>\n\nМін: ${COINS_MIN} | Макс: ${COINS_MAX}\nОплата: ⭐ Telegram Stars\n\n✏️ Введіть ваш <b>Minecraft нікнейм</b>:`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "back_main" }]] } }
    );
  }

  // ── Payment method selection ───────────────────────────────
  if (data.startsWith("pay_card_") || data.startsWith("pay_stars_")) {
    const isCard = data.startsWith("pay_card_");
    const rankId = data.replace(/pay_(card|stars)_/, "");
    const sess = getSession(chatId);
    sess.paymentMethod = isCard ? "card" : "stars";

    const rank = RANKS[rankId];
    let finalPrice = rank.price;
    let discountText = "";

    if (sess.promoCode) {
      const res = applyPromo(sess.promoCode, rankId, rank.price);
      if (res.valid) {
        finalPrice = res.finalPrice;
        discountText = `\n🎟 Промокод застосовано: -${res.discount} ₴`;
      }
    }

    sess.finalPrice = finalPrice;
    sess.step = "awaiting_screenshot";

    if (isCard) {
      return bot.editMessageText(
        `💳 <b>Оплата карткою</b>\n\n` +
          `Ранг: ${rank.label}\nСума: <b>${finalPrice} ₴</b>${discountText}\n\n` +
          `📌 Реквізити:\n<code>${CONFIG.UKRAINE_CARD_DETAILS}</code>\n\n` +
          `Після оплати — надішліть <b>скріншот підтвердження</b> у цей чат.`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
          reply_markup: confirmKeyboard(`buy_rank_${rankId}`) }
      );
    } else {
      const starsAmount = rank.stars;
      return bot.editMessageText(
        `⭐ <b>Оплата Telegram Stars</b>\n\n` +
          `Ранг: ${rank.label}\nКількість зірок: <b>${starsAmount} ⭐</b>${discountText}\n\n` +
          `📌 Надішліть зірки на профіль адміна:\n${CONFIG.ADMIN_PROFILE_LINK}\n\n` +
          `Після відправки — надішліть <b>скріншот</b> у цей чат.`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
          reply_markup: confirmKeyboard(`buy_rank_${rankId}`) }
      );
    }
  }

  // ── Skip promo ─────────────────────────────────────────────
  if (data === "skip_promo") {
    const sess = getSession(chatId);
    sess.promoCode = null;
    if (sess.type === "rank") {
      return bot.editMessageText(
        `💳 <b>Оберіть спосіб оплати:</b>`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
          reply_markup: paymentMethodKeyboard(sess.rankId) }
      );
    }
  }

  // ── Admin callbacks ────────────────────────────────────────
  if (userId !== CONFIG.ADMIN_ID) return;

  if (data === "admin_pending") return showPendingTransactions(chatId, msgId);
  if (data === "admin_promos") return showPromos(chatId, msgId);
  if (data === "admin_rcon") return startRconInput(chatId, msgId);
  if (data === "admin_create_promo") return startCreatePromo(chatId);
  if (data === "admin_back") return sendAdminMenu(chatId);

  if (data.startsWith("admin_approve_")) {
    const txId = data.replace("admin_approve_", "");
    return approveTransaction(chatId, msgId, txId);
  }

  if (data.startsWith("admin_reject_")) {
    const txId = data.replace("admin_reject_", "");
    return rejectTransaction(chatId, msgId, txId);
  }

  if (data.startsWith("admin_delete_promo_")) {
    const code = data.replace("admin_delete_promo_", "");
    return deletePromo(chatId, msgId, code);
  }
});

// ============================================================
//  Text message handler (multi-step flows)
// ============================================================
bot.on("message", async (msg) => {
  if (!msg.text && !msg.photo) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const sess = getSession(chatId);

  // ── Photo / screenshot submission ─────────────────────────
  if (msg.photo) {
    if (sess.step !== "awaiting_screenshot") return;
    return handleScreenshot(msg, sess);
  }

  const text = msg.text.trim();
  if (text.startsWith("/")) return; // handled by onText

  // ── Admin: RCON input ──────────────────────────────────────
  if (userId === CONFIG.ADMIN_ID && sess.adminStep === "rcon_command") {
    sess.adminStep = null;
    try {
      const result = await rconExec(text);
      bot.sendMessage(chatId, `✅ RCON відповідь:\n<code>${result || "(порожньо)"}</code>`, {
        parse_mode: "HTML",
      });
    } catch (e) {
      bot.sendMessage(chatId, `❌ RCON помилка: ${e.message}`);
    }
    return;
  }

  // ── Admin: Create promo steps ──────────────────────────────
  if (userId === CONFIG.ADMIN_ID && sess.adminStep) {
    return handleAdminPromoInput(chatId, text, sess);
  }

  // ── User flow: nickname ────────────────────────────────────
  if (sess.step === "nickname") {
    if (!/^[a-zA-Z0-9_]{2,16}$/.test(text)) {
      return bot.sendMessage(
        chatId,
        "❌ Невірний нікнейм. Лише літери, цифри та підкреслення (2–16 символів)."
      );
    }
    sess.nickname = text;

    if (sess.type === "coins") {
      sess.step = "coins_amount";
      return bot.sendMessage(
        chatId,
        `✏️ Введіть кількість монет (${COINS_MIN}–${COINS_MAX}):`
      );
    }

    // rank flow → promo step
    sess.step = "promo";
    return bot.sendMessage(
      chatId,
      `🎟 Маєте промокод? Введіть його або пропустіть:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏭ Пропустити", callback_data: "skip_promo" }],
          ],
        },
      }
    );
  }

  // ── User flow: promo code ──────────────────────────────────
  if (sess.step === "promo") {
    const res = applyPromo(text, sess.rankId, RANKS[sess.rankId].price);
    if (!res.valid) {
      return bot.sendMessage(chatId, `❌ ${res.reason}`);
    }
    sess.promoCode = text.toUpperCase();
    sess.step = "payment_method";
    return bot.sendMessage(
      chatId,
      `✅ Промокод застосовано! Знижка: ${res.discount} ₴ → Підсумкова ціна: <b>${res.finalPrice} ₴</b>\n\nОберіть спосіб оплати:`,
      { parse_mode: "HTML", reply_markup: paymentMethodKeyboard(sess.rankId) }
    );
  }

  // ── User flow: coins amount ────────────────────────────────
  if (sess.step === "coins_amount") {
    const amount = parseInt(text, 10);
    if (isNaN(amount) || amount < COINS_MIN || amount > COINS_MAX) {
      return bot.sendMessage(
        chatId,
        `❌ Невірна кількість. Введіть число від ${COINS_MIN} до ${COINS_MAX}.`
      );
    }
    sess.coinsAmount = amount;
    const starsNeeded = Math.ceil(amount * (COINS_STARS_PER_50 / COINS_MIN));
    sess.starsNeeded = starsNeeded;
    sess.step = "awaiting_screenshot";

    return bot.sendMessage(
      chatId,
      `🪙 <b>Купівля монет</b>\n\n` +
        `Нікнейм: <code>${sess.nickname}</code>\n` +
        `Монети: <b>${amount}</b>\n` +
        `Потрібно зірок: <b>${starsNeeded} ⭐</b>\n\n` +
        `📌 Надішліть зірки на профіль адміна:\n${CONFIG.ADMIN_PROFILE_LINK}\n\n` +
        `Після відправки — надішліть <b>скріншот</b> у цей чат.`,
      { parse_mode: "HTML" }
    );
  }
});

// ============================================================
//  Screenshot handler
// ============================================================
async function handleScreenshot(msg, sess) {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  let description = "";
  let rconCommand = "";

  if (sess.type === "rank") {
    const rank = RANKS[sess.rankId];
    description =
      `📦 <b>Тип:</b> Ранг\n` +
      `🎖 <b>Ранг:</b> ${rank.label}\n` +
      `👤 <b>Нікнейм:</b> <code>${sess.nickname}</code>\n` +
      `💰 <b>Ціна:</b> ${sess.finalPrice} ₴\n` +
      `💳 <b>Оплата:</b> ${sess.paymentMethod === "card" ? "Картка" : "Telegram Stars"}\n` +
      (sess.promoCode ? `🎟 <b>Промокод:</b> ${sess.promoCode}\n` : "");
    rconCommand = `/lp user ${sess.nickname} parent set ${sess.rankId}`;
  } else {
    description =
      `📦 <b>Тип:</b> Монети\n` +
      `🪙 <b>Кількість:</b> ${sess.coinsAmount}\n` +
      `👤 <b>Нікнейм:</b> <code>${sess.nickname}</code>\n` +
      `⭐ <b>Зірки:</b> ${sess.starsNeeded}`;
    rconCommand = `/eco give ${sess.nickname} ${sess.coinsAmount}`;
  }

  const txId = createTransaction({
    chatId,
    userId: msg.from.id,
    username: msg.from.username || msg.from.first_name,
    type: sess.type,
    rankId: sess.rankId || null,
    coinsAmount: sess.coinsAmount || null,
    nickname: sess.nickname,
    paymentMethod: sess.paymentMethod || "stars",
    finalPrice: sess.finalPrice || null,
    starsNeeded: sess.starsNeeded || null,
    promoCode: sess.promoCode || null,
    rconCommand,
    fileId,
  });

  if (sess.promoCode) consumePromo(sess.promoCode);

  // Notify admin
  await bot.sendPhoto(CONFIG.ADMIN_ID, fileId, {
    caption:
      `🔔 <b>Нова транзакція</b> #<code>${txId}</code>\n\n` +
      description +
      `\n\n💻 <b>RCON:</b> <code>${rconCommand}</code>`,
    parse_mode: "HTML",
    reply_markup: adminTransactionKeyboard(txId),
  });

  // Notify user
  bot.sendMessage(
    chatId,
    "✅ <b>Скріншот отримано!</b>\n\nЧас розгляду — до <b>12 годин</b>.\nЯкщо донат не прийшов — зверніться до підтримки:\n" +
      CONFIG.ADMIN_PROFILE_LINK,
    { parse_mode: "HTML" }
  );

  clearSession(chatId);
}

// ============================================================
//  Admin: pending transactions
// ============================================================
async function showPendingTransactions(chatId, msgId) {
  const data = loadData();
  const pending = Object.entries(data.transactions).filter(
    ([, tx]) => tx.status === "pending"
  );

  if (pending.length === 0) {
    return bot.editMessageText("📋 Немає pending транзакцій.", {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }

  for (const [txId, tx] of pending) {
    const desc =
      `🆔 <code>${txId}</code>\n` +
      `👤 Нік: <code>${tx.nickname}</code>\n` +
      `📦 Тип: ${tx.type === "rank" ? `Ранг ${tx.rankId}` : `Монети ${tx.coinsAmount}`}\n` +
      `💻 RCON: <code>${tx.rconCommand}</code>\n` +
      `🕐 ${new Date(tx.createdAt).toLocaleString("uk-UA")}`;

    await bot.sendPhoto(chatId, tx.fileId, {
      caption: desc,
      parse_mode: "HTML",
      reply_markup: adminTransactionKeyboard(txId),
    });
  }

  if (msgId) {
    bot.editMessageText("📋 <b>Pending транзакції:</b>", {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }
}

// ============================================================
//  Admin: approve / reject
// ============================================================
async function approveTransaction(chatId, msgId, txId) {
  const data = loadData();
  const tx = data.transactions[txId];
  if (!tx || tx.status !== "pending") {
    return bot.editMessageCaption("⚠️ Транзакція не знайдена або вже оброблена.", {
      chat_id: chatId,
      message_id: msgId,
    });
  }

  try {
    const result = await rconExec(tx.rconCommand);
    tx.status = "approved";
    saveData(data);

    bot.editMessageCaption(
      `✅ <b>Підтверджено</b> #<code>${txId}</code>\nRCON: <code>${result || "OK"}</code>`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML" }
    );

    bot.sendMessage(
      tx.chatId,
      `🎉 Ваш донат <b>${
        tx.type === "rank" ? `ранг ${tx.rankId}` : `${tx.coinsAmount} монет`
      }</b> для <code>${tx.nickname}</code> підтверджено та виданий!`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    bot.sendMessage(chatId, `❌ RCON помилка: ${e.message}`);
  }
}

async function rejectTransaction(chatId, msgId, txId) {
  const data = loadData();
  const tx = data.transactions[txId];
  if (!tx || tx.status !== "pending") return;

  tx.status = "rejected";
  saveData(data);

  bot.editMessageCaption(`❌ <b>Відхилено</b> #<code>${txId}</code>`, {
    chat_id: chatId,
    message_id: msgId,
    parse_mode: "HTML",
  });

  bot.sendMessage(
    tx.chatId,
    `😔 На жаль, ваш донат було відхилено. Зверніться до підтримки:\n${CONFIG.ADMIN_PROFILE_LINK}`
  );
}

// ============================================================
//  Admin: promos
// ============================================================
function showPromos(chatId, msgId) {
  const data = loadData();
  const promos = Object.entries(data.promos);

  let text = "🎟 <b>Промокоди:</b>\n\n";
  const buttons = [];

  if (promos.length === 0) {
    text += "Немає промокодів.";
  } else {
    for (const [code, p] of promos) {
      text += `• <code>${code}</code> — ${p.discount}% знижка, ${p.uses}/${p.limit} використань`;
      if (p.itemRestriction) text += `, тільки для: ${p.itemRestriction}`;
      text += "\n";
      buttons.push([
        { text: `🗑 Видалити ${code}`, callback_data: `admin_delete_promo_${code}` },
      ]);
    }
  }

  buttons.push([{ text: "➕ Створити промокод", callback_data: "admin_create_promo" }]);
  buttons.push([{ text: "⬅️ Назад", callback_data: "admin_back" }]);

  if (msgId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

function deletePromo(chatId, msgId, code) {
  const data = loadData();
  delete data.promos[code];
  saveData(data);
  bot.answerCallbackQuery; // already answered
  showPromos(chatId, msgId);
}

function startCreatePromo(chatId) {
  const sess = getSession(chatId);
  sess.adminStep = "promo_code";
  bot.sendMessage(chatId, "✏️ Введіть <b>код промокоду</b> (лише великі літери/цифри):", {
    parse_mode: "HTML",
  });
}

function handleAdminPromoInput(chatId, text, sess) {
  if (sess.adminStep === "promo_code") {
    if (!/^[A-Z0-9_]{2,20}$/.test(text.toUpperCase())) {
      return bot.sendMessage(chatId, "❌ Невірний формат коду. Використовуйте A-Z, 0-9, _");
    }
    sess.newPromoCode = text.toUpperCase();
    sess.adminStep = "promo_discount";
    return bot.sendMessage(chatId, "✏️ Введіть <b>відсоток знижки</b> (1–100):", {
      parse_mode: "HTML",
    });
  }

  if (sess.adminStep === "promo_discount") {
    const d = parseInt(text, 10);
    if (isNaN(d) || d < 1 || d > 100) {
      return bot.sendMessage(chatId, "❌ Введіть число від 1 до 100.");
    }
    sess.newPromoDiscount = d;
    sess.adminStep = "promo_limit";
    return bot.sendMessage(chatId, "✏️ Введіть <b>ліміт використань</b> (наприклад, 10):", {
      parse_mode: "HTML",
    });
  }

  if (sess.adminStep === "promo_limit") {
    const l = parseInt(text, 10);
    if (isNaN(l) || l < 1) {
      return bot.sendMessage(chatId, "❌ Введіть ціле число > 0.");
    }
    sess.newPromoLimit = l;
    sess.adminStep = "promo_restriction";
    return bot.sendMessage(
      chatId,
      `✏️ Обмежити промокод для конкретного товару? Введіть ID рангу (${Object.keys(RANKS).join(", ")}) або <b>none</b>:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🚫 Без обмеження (none)", callback_data: "promo_restrict_none" }]],
        },
      }
    );
  }

  if (sess.adminStep === "promo_restriction") {
    const restriction =
      text.toLowerCase() === "none" ? null : text.toLowerCase();
    if (restriction && !RANKS[restriction]) {
      return bot.sendMessage(chatId, `❌ Невірний ID рангу. Допустимі: ${Object.keys(RANKS).join(", ")}`);
    }
    saveNewPromo(chatId, sess, restriction);
  }
}

bot.on("callback_query", async (query) => {
  if (query.data === "promo_restrict_none" && query.from.id === CONFIG.ADMIN_ID) {
    await bot.answerCallbackQuery(query.id);
    const sess = getSession(query.message.chat.id);
    if (sess.adminStep === "promo_restriction") {
      saveNewPromo(query.message.chat.id, sess, null);
    }
  }
});

function saveNewPromo(chatId, sess, restriction) {
  const data = loadData();
  data.promos[sess.newPromoCode] = {
    discount: sess.newPromoDiscount,
    limit: sess.newPromoLimit,
    uses: 0,
    itemRestriction: restriction,
  };
  saveData(data);
  sess.adminStep = null;

  bot.sendMessage(
    chatId,
    `✅ Промокод <code>${sess.newPromoCode}</code> створено!\n` +
      `Знижка: ${sess.newPromoDiscount}%\nЛіміт: ${sess.newPromoLimit}\n` +
      `Обмеження: ${restriction || "немає"}`,
    { parse_mode: "HTML" }
  );
}

// ============================================================
//  Admin: RCON console
// ============================================================
function startRconInput(chatId, msgId) {
  const sess = getSession(chatId);
  sess.adminStep = "rcon_command";
  if (msgId) {
    bot.editMessageText(
      "🖥 <b>RCON консоль</b>\n\nВведіть команду для відправки на сервер:",
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] } }
    );
  }
}

// ============================================================
//  Error handling
// ============================================================
bot.on("polling_error", (err) => console.error("Polling error:", err.message));

console.log("🤖 Minecraft Donation Bot запущено!");
