// ============================================================
//  MINECRAFT DONATION BOT — Configuration
// ============================================================
const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: parseInt(process.env.ADMIN_ID),
  ADMIN_PROFILE_LINK: process.env.ADMIN_PROFILE_LINK,
  UKRAINE_CARD_DETAILS: process.env.UKRAINE_CARD_DETAILS,
  RCON: {
    host: process.env.RCON_HOST,
    port: parseInt(process.env.RCON_PORT),
    password: process.env.RCON_PASSWORD,
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
    fs.writeFileSync(DATA_FILE, JSON.stringify({ promos: {}, transactions: {}, supportTickets: {} }, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!data.supportTickets) data.supportTickets = {};
  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
//  Product catalog — ALL ranks: card + stars
// ============================================================
const RANKS = {
  core:     { label: "⚡ Core",     price: 50,   stars: 83   },
  apex:     { label: "🔥 Apex",     price: 100,  stars: 167  },
  prime:    { label: "💎 Prime",    price: 150,  stars: 250  },
  omega:    { label: "🌀 Omega",    price: 200,  stars: 333  },
  ultimate: { label: "🏆 Ultimate", price: 500,  stars: 833  },
  supreme:  { label: "👑 Supreme",  price: 1000, stars: 1667 },
};

// Монеты: любое количество >= 50, только Stars
// 50 монет = 15 Stars
const COINS_MIN = 50;
const COINS_STARS_PER_50 = 15;

// ============================================================
//  Translations
// ============================================================
const T = {
  ua: {
    welcome: "🎮 <b>Minecraft Donation Bot</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nЛаскаво просимо! Оберіть дію:",
    selectLang: "🌍 <b>Оберіть мову / Выберите язык:</b>",
    buyRank: "🎖 Купити ранг",
    buyCoins: "🪙 Купити монети",
    howto: "📖 Як купити",
    support: "💬 Підтримка",
    mainMenu: "🏠 Головне меню",
    selectRank: "🎖 <b>Оберіть ранг:</b>\n━━━━━━━━━━━━━━━━━━━━━━",
    enterNick: "✏️ Введіть ваш <b>Minecraft нікнейм</b>:",
    invalidNick: "❌ Невірний нікнейм. Тільки A-Z, 0-9, _ (2–16 символів).",
    promoAsk: "🎟 Маєте промокод? Введіть або пропустіть:",
    promoSkip: "⏭ Пропустити",
    promoApplied: (d, p, s) => `✅ Промокод застосовано!\nЗнижка: ${d}%\n💰 Ціна: <b>${p}₴</b> / <b>${s}⭐</b>`,
    selectPayment: "💳 <b>Оберіть спосіб оплати:</b>\n━━━━━━━━━━━━━━━━━━━━━━",
    payCard: "💳 Картка (UAH)",
    payStars: (n) => `⭐ Telegram Stars (${n}⭐)`,
    cardInstructions: (rank, price) =>
      `💳 <b>Оплата карткою</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nРанг: ${rank}\nСума: <b>${price}₴</b>\n\n📌 Реквізити:\n`,
    starsInstructions: (rank, stars) =>
      `⭐ <b>Оплата Telegram Stars</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nРанг: ${rank}\nЗірок: <b>${stars}⭐</b>\n\n📌 Надішліть зірки:\n`,
    afterPayment: "\n\n✅ Після оплати надішліть <b>скріншот</b> у цей чат.",
    screenshotReceived: (link) =>
      `✅ <b>Скріншот отримано!</b>\n\n⏱ Час розгляду — до <b>12 годин</b>.\nЯкщо донат не прийшов — підтримка:\n${link}`,
    coinsTitle: "🪙 <b>Купити монети</b>\n━━━━━━━━━━━━━━━━━━━━━━",
    coinsInfo: `Оплата: ⭐ Telegram Stars\n50 монет = 15⭐\n\n✏️ Введіть <b>Minecraft нікнейм</b>:`,
    enterCoins: (min) => `✏️ Введіть кількість монет (мінімум ${min}):`,
    invalidCoins: (min) => `❌ Мінімум ${min} монет. Введіть ціле число.`,
    coinsSummary: (nick, amount, stars) =>
      `🪙 <b>Купівля монет</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 Нікнейм: <code>${nick}</code>\n🪙 Монети: <b>${amount}</b>\n⭐ Потрібно: <b>${stars}⭐</b>`,
    sendStarsTo: "\n\n📌 Надішліть зірки:\n",
    sendScreenshot: "\n\n✅ Після відправки надішліть <b>скріншот</b>.",
    supportPrompt: "💬 <b>Підтримка</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nОпишіть проблему і надішліть:",
    supportSent: "✅ <b>Повідомлення надіслано!</b>\nАдміністратор відповість найближчим часом.",
    adminReply: "📩 <b>Відповідь підтримки:</b>\n\n",
    donateDone: (type, nick) => `🎉 <b>Донат отримано!</b>\n\n${type} видано гравцю <code>${nick}</code>.\n\nДякуємо за підтримку! 🙏`,
    donateRejected: (link) => `😔 Ваш донат було відхилено.\nПідтримка: ${link}`,
    howtoText:
      `📖 <b>Як купити донат?</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>1️⃣ Оберіть товар</b> — ранг або монети\n\n` +
      `<b>2️⃣ Введіть нікнейм</b> — точно як в грі\n\n` +
      `<b>3️⃣ Промокод</b> — введіть або пропустіть\n\n` +
      `<b>4️⃣ Оберіть оплату</b>\n` +
      `• 💳 Картка — для рангів\n` +
      `• ⭐ Stars — для рангів і монет\n\n` +
      `<b>5️⃣ Оплатіть</b> — по реквізитах або зірками\n\n` +
      `<b>6️⃣ Скріншот</b> — надішліть підтвердження\n\n` +
      `<b>7️⃣ Очікування</b> — до 12 годин\n\n` +
      `❓ Питання? Напишіть у підтримку!`,
  },
  ru: {
    welcome: "🎮 <b>Minecraft Donation Bot</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nДобро пожаловать! Выберите действие:",
    selectLang: "🌍 <b>Оберіть мову / Выберите язык:</b>",
    buyRank: "🎖 Купить ранг",
    buyCoins: "🪙 Купить монеты",
    howto: "📖 Как купить",
    support: "💬 Поддержка",
    mainMenu: "🏠 Главное меню",
    selectRank: "🎖 <b>Выберите ранг:</b>\n━━━━━━━━━━━━━━━━━━━━━━",
    enterNick: "✏️ Введите ваш <b>Minecraft никнейм</b>:",
    invalidNick: "❌ Неверный никнейм. Только A-Z, 0-9, _ (2–16 символов).",
    promoAsk: "🎟 Есть промокод? Введите или пропустите:",
    promoSkip: "⏭ Пропустить",
    promoApplied: (d, p, s) => `✅ Промокод применён!\nСкидка: ${d}%\n💰 Цена: <b>${p}₴</b> / <b>${s}⭐</b>`,
    selectPayment: "💳 <b>Выберите способ оплаты:</b>\n━━━━━━━━━━━━━━━━━━━━━━",
    payCard: "💳 Карта (UAH)",
    payStars: (n) => `⭐ Telegram Stars (${n}⭐)`,
    cardInstructions: (rank, price) =>
      `💳 <b>Оплата картой</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nРанг: ${rank}\nСумма: <b>${price}₴</b>\n\n📌 Реквизиты:\n`,
    starsInstructions: (rank, stars) =>
      `⭐ <b>Оплата Telegram Stars</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nРанг: ${rank}\nЗвёзд: <b>${stars}⭐</b>\n\n📌 Отправьте звёзды:\n`,
    afterPayment: "\n\n✅ После оплаты отправьте <b>скриншот</b> в этот чат.",
    screenshotReceived: (link) =>
      `✅ <b>Скриншот получен!</b>\n\n⏱ Время рассмотрения — до <b>12 часов</b>.\nЕсли донат не пришёл — поддержка:\n${link}`,
    coinsTitle: "🪙 <b>Купить монеты</b>\n━━━━━━━━━━━━━━━━━━━━━━",
    coinsInfo: `Оплата: ⭐ Telegram Stars\n50 монет = 15⭐\n\n✏️ Введите <b>Minecraft никнейм</b>:`,
    enterCoins: (min) => `✏️ Введите количество монет (минимум ${min}):`,
    invalidCoins: (min) => `❌ Минимум ${min} монет. Введите целое число.`,
    coinsSummary: (nick, amount, stars) =>
      `🪙 <b>Покупка монет</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 Никнейм: <code>${nick}</code>\n🪙 Монет: <b>${amount}</b>\n⭐ Нужно: <b>${stars}⭐</b>`,
    sendStarsTo: "\n\n📌 Отправьте звёзды:\n",
    sendScreenshot: "\n\n✅ После отправки пришлите <b>скриншот</b>.",
    supportPrompt: "💬 <b>Поддержка</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\nОпишите проблему и отправьте:",
    supportSent: "✅ <b>Сообщение отправлено!</b>\nАдминистратор ответит вам в ближайшее время.",
    adminReply: "📩 <b>Ответ поддержки:</b>\n\n",
    donateDone: (type, nick) => `🎉 <b>Донат выдан!</b>\n\n${type} выдан игроку <code>${nick}</code>.\n\nСпасибо за поддержку! 🙏`,
    donateRejected: (link) => `😔 Ваш донат был отклонён.\nПоддержка: ${link}`,
    howtoText:
      `📖 <b>Как купить донат?</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>1️⃣ Выберите товар</b> — ранг или монеты\n\n` +
      `<b>2️⃣ Введите никнейм</b> — точно как в игре\n\n` +
      `<b>3️⃣ Промокод</b> — введите или пропустите\n\n` +
      `<b>4️⃣ Выберите оплату</b>\n` +
      `• 💳 Карта — для рангов\n` +
      `• ⭐ Stars — для рангов и монет\n\n` +
      `<b>5️⃣ Оплатите</b> — по реквизитам или звёздами\n\n` +
      `<b>6️⃣ Скриншот</b> — пришлите подтверждение\n\n` +
      `<b>7️⃣ Ожидание</b> — до 12 часов\n\n` +
      `❓ Вопросы? Напишите в поддержку!`,
  },
};

// ============================================================
//  Bot & Express
// ============================================================
const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });
const app = express();
app.get("/ping", (_req, res) => res.send("OK"));
app.listen(3000, () => console.log("Keep-alive server on port 3000"));

// ============================================================
//  Sessions
// ============================================================
const sessions = {};
function getSession(chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  return sessions[chatId];
}
function clearSession(chatId) { sessions[chatId] = {}; }

// ============================================================
//  RCON — БЕЗ СЛЕША
// ============================================================
async function rconExec(command) {
  const cmd = command.startsWith("/") ? command.slice(1) : command;
  const rcon = await Rcon.connect({
    host: CONFIG.RCON.host,
    port: CONFIG.RCON.port,
    password: CONFIG.RCON.password,
  });
  const response = await rcon.send(cmd);
  await rcon.end();
  return response;
}

// ============================================================
//  Coins stars calculator
// ============================================================
function coinsToStars(amount) {
  return Math.ceil(amount * (COINS_STARS_PER_50 / COINS_MIN));
}

// ============================================================
//  Keyboard helpers
// ============================================================
function mainMenuBtn(lang) {
  return { text: T[lang].mainMenu, callback_data: "back_main" };
}
function withMainMenu(buttons, lang) {
  return { inline_keyboard: [...buttons, [mainMenuBtn(lang)]] };
}
function langKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🇺🇦 Українська", callback_data: "lang_ua" },
      { text: "🇷🇺 Русский", callback_data: "lang_ru" },
    ]],
  };
}
function mainMenuKeyboard(lang) {
  const t = T[lang];
  return {
    inline_keyboard: [
      [{ text: t.buyRank, callback_data: "menu_ranks" }, { text: t.buyCoins, callback_data: "menu_coins" }],
      [{ text: t.howto, callback_data: "menu_howto" }, { text: t.support, callback_data: "menu_support" }],
    ],
  };
}
function ranksKeyboard(lang) {
  const rows = Object.entries(RANKS).map(([id, r]) => [{
    text: `${r.label} — ${r.price}₴ / ${r.stars}⭐`,
    callback_data: `buy_rank_${id}`,
  }]);
  rows.push([mainMenuBtn(lang)]);
  return { inline_keyboard: rows };
}
function paymentKeyboard(rankId, finalPrice, finalStars, lang) {
  const t = T[lang];
  return {
    inline_keyboard: [
      [{ text: t.payCard, callback_data: `pay_card_${rankId}` }],
      [{ text: t.payStars(finalStars), callback_data: `pay_stars_${rankId}` }],
      [mainMenuBtn(lang)],
    ],
  };
}
function adminMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 Pending", callback_data: "admin_pending" }, { text: "📜 Все транзакции", callback_data: "admin_all_tx" }],
      [{ text: "🎟 Промокоды", callback_data: "admin_promos" }, { text: "🖥 RCON консоль", callback_data: "admin_rcon" }],
      [{ text: "💬 Поддержка", callback_data: "admin_support" }, { text: "📊 Статистика", callback_data: "admin_stats" }],
    ],
  };
}
function adminTxKeyboard(txId) {
  return {
    inline_keyboard: [
      [{ text: "✅ Подтвердить", callback_data: `admin_approve_${txId}` }, { text: "❌ Отклонить", callback_data: `admin_reject_${txId}` }],
      [{ text: "💬 Написать игроку", callback_data: `admin_msg_${txId}` }],
    ],
  };
}

// ============================================================
//  Promo helpers
// ============================================================
function applyPromo(code, itemId, price, stars) {
  const data = loadData();
  const promo = data.promos[code.toUpperCase()];
  if (!promo) return { valid: false, reason: "Промокод не найден." };
  if (promo.uses >= promo.limit) return { valid: false, reason: "Промокод исчерпан." };
  if (promo.itemRestriction && promo.itemRestriction !== itemId)
    return { valid: false, reason: `Промокод только для "${promo.itemRestriction}".` };
  const pct = promo.discount;
  const finalPrice = Math.max(0, Math.floor(price * (1 - pct / 100)));
  const finalStars = Math.max(1, Math.ceil(stars * (1 - pct / 100)));
  return { valid: true, pct, finalPrice, finalStars };
}
function consumePromo(code) {
  const data = loadData();
  if (data.promos[code]) { data.promos[code].uses++; saveData(data); }
}

// ============================================================
//  Transaction helper
// ============================================================
function createTx(details) {
  const data = loadData();
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  data.transactions[txId] = { ...details, status: "pending", createdAt: new Date().toISOString() };
  saveData(data);
  return txId;
}

// ============================================================
//  /start
// ============================================================
bot.onText(/\/start/, (msg) => {
  clearSession(msg.chat.id);
  bot.sendMessage(msg.chat.id, T.ua.selectLang, { parse_mode: "HTML", reply_markup: langKeyboard() });
});

// ============================================================
//  /admin
// ============================================================
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== CONFIG.ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, `🛠 <b>Админ панель</b>\n━━━━━━━━━━━━━━━━━━━━━━`, {
    parse_mode: "HTML", reply_markup: adminMainKeyboard(),
  });
});

// ============================================================
//  Callback handler
// ============================================================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const d = query.data;
  const msgId = query.message.message_id;
  await bot.answerCallbackQuery(query.id);

  const sess = getSession(chatId);
  const lang = sess.lang || "ua";
  const t = T[lang];

  // ── Language ───────────────────────────────────────────────
  if (d === "lang_ua" || d === "lang_ru") {
    const l = d === "lang_ua" ? "ua" : "ru";
    sess.lang = l;
    return bot.editMessageText(T[l].welcome, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(l),
    });
  }

  // ── Back to main ───────────────────────────────────────────
  if (d === "back_main") {
    const l = sess.lang || "ua";
    clearSession(chatId);
    getSession(chatId).lang = l;
    return bot.editMessageText(T[l].welcome, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(l),
    });
  }

  // ── How to buy ─────────────────────────────────────────────
  if (d === "menu_howto") {
    return bot.editMessageText(t.howtoText, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: withMainMenu([], lang),
    });
  }

  // ── Support ────────────────────────────────────────────────
  if (d === "menu_support") {
    sess.step = "support_msg";
    return bot.editMessageText(t.supportPrompt, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: withMainMenu([], lang),
    });
  }

  // ── Ranks list ─────────────────────────────────────────────
  if (d === "menu_ranks") {
    return bot.editMessageText(t.selectRank, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: ranksKeyboard(lang),
    });
  }

  // ── Coins ──────────────────────────────────────────────────
  if (d === "menu_coins") {
    sess.type = "coins";
    sess.step = "nickname";
    return bot.editMessageText(
      `${t.coinsTitle}\n\n${t.coinsInfo}`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([], lang) }
    );
  }

  // ── Select rank ────────────────────────────────────────────
  if (d.startsWith("buy_rank_")) {
    const rankId = d.replace("buy_rank_", "");
    const rank = RANKS[rankId];
    if (!rank) return;
    sess.type = "rank";
    sess.rankId = rankId;
    sess.step = "nickname";
    return bot.editMessageText(
      `${rank.label}\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 ${rank.price}₴ / ${rank.stars}⭐\n\n${t.enterNick}`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([], lang) }
    );
  }

  // ── Skip promo ─────────────────────────────────────────────
  if (d === "skip_promo") {
    sess.promoCode = null;
    const rank = RANKS[sess.rankId];
    sess.finalPrice = rank.price;
    sess.finalStars = rank.stars;
    sess.step = "payment_method";
    return bot.editMessageText(t.selectPayment, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: paymentKeyboard(sess.rankId, sess.finalPrice, sess.finalStars, lang),
    });
  }

  // ── Pay card ───────────────────────────────────────────────
  if (d.startsWith("pay_card_")) {
    const rankId = d.replace("pay_card_", "");
    const rank = RANKS[rankId];
    sess.paymentMethod = "card";
    sess.step = "awaiting_screenshot";
    return bot.editMessageText(
      t.cardInstructions(rank.label, sess.finalPrice) +
      `<code>${CONFIG.UKRAINE_CARD_DETAILS}</code>` +
      t.afterPayment,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([], lang) }
    );
  }

  // ── Pay stars ──────────────────────────────────────────────
  if (d.startsWith("pay_stars_")) {
    const rankId = d.replace("pay_stars_", "");
    const rank = RANKS[rankId];
    sess.paymentMethod = "stars";
    sess.step = "awaiting_screenshot";
    return bot.editMessageText(
      t.starsInstructions(rank.label, sess.finalStars) +
      CONFIG.ADMIN_PROFILE_LINK +
      t.afterPayment,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([], lang) }
    );
  }

  // ── Admin only ─────────────────────────────────────────────
  if (userId !== CONFIG.ADMIN_ID) return;

  if (d === "admin_back") {
    return bot.editMessageText(`🛠 <b>Админ панель</b>\n━━━━━━━━━━━━━━━━━━━━━━`, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: adminMainKeyboard(),
    });
  }
  if (d === "admin_pending") return showPending(chatId, msgId);
  if (d === "admin_all_tx") return showAllTx(chatId, msgId);
  if (d === "admin_promos") return showPromos(chatId, msgId);
  if (d === "admin_rcon") return startRcon(chatId, msgId);
  if (d === "admin_support") return showTickets(chatId, msgId);
  if (d === "admin_stats") return showStats(chatId, msgId);
  if (d === "admin_create_promo") return startCreatePromo(chatId);
  if (d === "promo_restrict_none") {
    if (sess.adminStep === "promo_restriction") saveNewPromo(chatId, sess, null);
    return;
  }
  if (d.startsWith("admin_approve_")) return approveTx(chatId, msgId, d.replace("admin_approve_", ""));
  if (d.startsWith("admin_reject_")) return rejectTx(chatId, msgId, d.replace("admin_reject_", ""));
  if (d.startsWith("admin_msg_")) {
    sess.adminStep = "msg_player";
    sess.msgTxId = d.replace("admin_msg_", "");
    return bot.sendMessage(chatId, `✏️ Введите сообщение для игрока:`);
  }
  if (d.startsWith("admin_reply_ticket_")) {
    sess.adminStep = "reply_ticket";
    sess.replyTicketId = d.replace("admin_reply_ticket_", "");
    return bot.sendMessage(chatId, `✏️ Введите ответ игроку:`);
  }
  if (d.startsWith("admin_delete_promo_")) return deletePromo(chatId, msgId, d.replace("admin_delete_promo_", ""));
});

// ============================================================
//  Message handler
// ============================================================
bot.on("message", async (msg) => {
  if (!msg.text && !msg.photo) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const sess = getSession(chatId);
  const lang = sess.lang || "ua";
  const t = T[lang];

  // Screenshot
  if (msg.photo) {
    if (sess.step === "awaiting_screenshot") return handleScreenshot(msg, sess);
    return;
  }

  const text = msg.text.trim();
  if (text.startsWith("/")) return;

  // ── Admin steps ────────────────────────────────────────────
  if (userId === CONFIG.ADMIN_ID) {
    if (sess.adminStep === "rcon_command") {
      sess.adminStep = null;
      try {
        const res = await rconExec(text);
        bot.sendMessage(chatId, `✅ <b>RCON:</b>\n<code>${res || "(пусто)"}</code>`, { parse_mode: "HTML" });
      } catch (e) {
        bot.sendMessage(chatId, `❌ RCON ошибка: ${e.message}`);
      }
      return;
    }
    if (sess.adminStep === "msg_player") {
      const data = loadData();
      const tx = data.transactions[sess.msgTxId];
      sess.adminStep = null;
      if (tx) {
        bot.sendMessage(tx.chatId, `📩 <b>Сообщение от администратора:</b>\n\n${text}`, { parse_mode: "HTML" });
        bot.sendMessage(chatId, "✅ Отправлено.");
      }
      return;
    }
    if (sess.adminStep === "reply_ticket") {
      const data = loadData();
      const ticket = data.supportTickets[sess.replyTicketId];
      sess.adminStep = null;
      if (ticket) {
        const tl = T[ticket.lang || "ua"];
        bot.sendMessage(ticket.chatId, tl.adminReply + text, { parse_mode: "HTML" });
        ticket.status = "answered";
        saveData(data);
        bot.sendMessage(chatId, "✅ Ответ отправлен.");
      }
      return;
    }
    if (sess.adminStep) return handleAdminPromoInput(chatId, text, sess);
  }

  // ── Support ────────────────────────────────────────────────
  if (sess.step === "support_msg") {
    sess.step = null;
    const data = loadData();
    const ticketId = `ticket_${Date.now()}`;
    data.supportTickets[ticketId] = {
      chatId, userId,
      username: msg.from.username || msg.from.first_name,
      lang, message: text, status: "open",
      createdAt: new Date().toISOString(),
    };
    saveData(data);
    bot.sendMessage(CONFIG.ADMIN_ID,
      `🆘 <b>Новый тикет</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <code>${ticketId}</code>\n` +
      `👤 @${msg.from.username || msg.from.first_name} | 🌍 ${lang.toUpperCase()}\n\n` +
      `💬 ${text}`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "↩️ Ответить", callback_data: `admin_reply_ticket_${ticketId}` }]] },
      }
    );
    bot.sendMessage(chatId, t.supportSent, { parse_mode: "HTML", reply_markup: mainMenuKeyboard(lang) });
    return;
  }

  // ── Nickname ───────────────────────────────────────────────
  if (sess.step === "nickname") {
    if (!/^[a-zA-Z0-9_]{2,16}$/.test(text)) {
      return bot.sendMessage(chatId, t.invalidNick);
    }
    sess.nickname = text;
    if (sess.type === "coins") {
      sess.step = "coins_amount";
      return bot.sendMessage(chatId, t.enterCoins(COINS_MIN));
    }
    // Rank → promo
    sess.step = "promo";
    return bot.sendMessage(chatId, t.promoAsk, {
      reply_markup: {
        inline_keyboard: [
          [{ text: t.promoSkip, callback_data: "skip_promo" }],
          [mainMenuBtn(lang)],
        ],
      },
    });
  }

  // ── Promo ──────────────────────────────────────────────────
  if (sess.step === "promo") {
    const rank = RANKS[sess.rankId];
    const res = applyPromo(text, sess.rankId, rank.price, rank.stars);
    if (!res.valid) return bot.sendMessage(chatId, `❌ ${res.reason}`);

    sess.promoCode = text.toUpperCase();
    sess.finalPrice = res.finalPrice;
    sess.finalStars = res.finalStars;
    sess.step = "payment_method";

    return bot.sendMessage(chatId,
      t.promoApplied(res.pct, res.finalPrice, res.finalStars) + `\n\n` + t.selectPayment,
      { parse_mode: "HTML", reply_markup: paymentKeyboard(sess.rankId, sess.finalPrice, sess.finalStars, lang) }
    );
  }

  // ── Coins amount — любое число >= COINS_MIN ────────────────
  if (sess.step === "coins_amount") {
    const amount = parseInt(text, 10);
    if (isNaN(amount) || amount < COINS_MIN || !Number.isInteger(amount)) {
      return bot.sendMessage(chatId, t.invalidCoins(COINS_MIN));
    }
    sess.coinsAmount = amount;
    sess.starsNeeded = coinsToStars(amount);
    sess.step = "awaiting_screenshot";

    return bot.sendMessage(chatId,
      t.coinsSummary(sess.nickname, amount, sess.starsNeeded) +
      t.sendStarsTo + CONFIG.ADMIN_PROFILE_LINK +
      t.sendScreenshot,
      { parse_mode: "HTML", reply_markup: withMainMenu([], lang) }
    );
  }
});

// ============================================================
//  Screenshot handler
// ============================================================
async function handleScreenshot(msg, sess) {
  const chatId = msg.chat.id;
  const lang = sess.lang || "ua";
  const t = T[lang];
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  let description = "";
  let rconCommand = "";

  if (sess.type === "rank") {
    const rank = RANKS[sess.rankId];
    description =
      `📦 <b>Тип:</b> Ранг\n` +
      `🎖 <b>Ранг:</b> ${rank.label}\n` +
      `👤 <b>Ник:</b> <code>${sess.nickname}</code>\n` +
      `💰 <b>Оплата:</b> ${sess.paymentMethod === "card" ? sess.finalPrice + "₴ 💳" : sess.finalStars + "⭐ Stars"}\n` +
      `🌍 <b>Язык:</b> ${lang.toUpperCase()}\n` +
      (sess.promoCode ? `🎟 <b>Промокод:</b> ${sess.promoCode}\n` : "");
    rconCommand = `lp user ${sess.nickname} parent set ${sess.rankId}`;
  } else {
    description =
      `📦 <b>Тип:</b> Монеты\n` +
      `🪙 <b>Количество:</b> ${sess.coinsAmount}\n` +
      `👤 <b>Ник:</b> <code>${sess.nickname}</code>\n` +
      `⭐ <b>Звёзд:</b> ${sess.starsNeeded}\n` +
      `🌍 <b>Язык:</b> ${lang.toUpperCase()}`;
    rconCommand = `eco give ${sess.nickname} ${sess.coinsAmount}`;
  }

  const txId = createTx({
    chatId, userId: msg.from.id,
    username: msg.from.username || msg.from.first_name,
    lang, type: sess.type,
    rankId: sess.rankId || null,
    coinsAmount: sess.coinsAmount || null,
    nickname: sess.nickname,
    paymentMethod: sess.paymentMethod || "stars",
    finalPrice: sess.finalPrice || null,
    finalStars: sess.finalStars || null,
    starsNeeded: sess.starsNeeded || null,
    promoCode: sess.promoCode || null,
    rconCommand, fileId,
  });

  if (sess.promoCode) consumePromo(sess.promoCode);

  await bot.sendPhoto(CONFIG.ADMIN_ID, fileId, {
    caption:
      `🔔 <b>Новая транзакция</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <code>${txId}</code>\n\n` +
      description +
      `\n\n💻 <b>RCON:</b>\n<code>${rconCommand}</code>`,
    parse_mode: "HTML",
    reply_markup: adminTxKeyboard(txId),
  });

  bot.sendMessage(chatId, t.screenshotReceived(CONFIG.ADMIN_PROFILE_LINK), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(lang),
  });

  const savedLang = lang;
  clearSession(chatId);
  getSession(chatId).lang = savedLang;
}

// ============================================================
//  Admin: pending
// ============================================================
async function showPending(chatId, msgId) {
  const data = loadData();
  const pending = Object.entries(data.transactions).filter(([, tx]) => tx.status === "pending");
  if (pending.length === 0) {
    return bot.editMessageText("📋 Нет pending транзакций.", {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }
  bot.editMessageText(`📋 <b>Pending: ${pending.length}</b>`, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
  });
  for (const [txId, tx] of pending) {
    await bot.sendPhoto(chatId, tx.fileId, {
      caption:
        `🆔 <code>${txId}</code>\n` +
        `👤 @${tx.username} | <code>${tx.nickname}</code>\n` +
        `📦 ${tx.type === "rank" ? `Ранг: ${tx.rankId}` : `Монет: ${tx.coinsAmount}`}\n` +
        `💰 ${tx.paymentMethod === "card" ? tx.finalPrice + "₴" : (tx.finalStars || tx.starsNeeded) + "⭐"} | 🌍 ${tx.lang?.toUpperCase()}\n` +
        `💻 <code>${tx.rconCommand}</code>\n` +
        `🕐 ${new Date(tx.createdAt).toLocaleString("ru-RU")}`,
      parse_mode: "HTML",
      reply_markup: adminTxKeyboard(txId),
    });
  }
}

// ============================================================
//  Admin: all transactions
// ============================================================
async function showAllTx(chatId, msgId) {
  const data = loadData();
  const all = Object.entries(data.transactions).slice(-15).reverse();
  if (all.length === 0) {
    return bot.editMessageText("📋 Нет транзакций.", {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }
  let text = `📜 <b>Последние транзакции:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const [, tx] of all) {
    const e = tx.status === "approved" ? "✅" : tx.status === "rejected" ? "❌" : "⏳";
    text += `${e} <code>${tx.nickname}</code> | ${tx.type === "rank" ? tx.rankId : tx.coinsAmount + "🪙"} | ${new Date(tx.createdAt).toLocaleDateString("ru-RU")}\n`;
  }
  bot.editMessageText(text, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
  });
}

// ============================================================
//  Admin: approve / reject
// ============================================================
async function approveTx(chatId, msgId, txId) {
  const data = loadData();
  const tx = data.transactions[txId];
  if (!tx || tx.status !== "pending") {
    return bot.editMessageCaption("⚠️ Уже обработана.", { chat_id: chatId, message_id: msgId });
  }
  try {
    const result = await rconExec(tx.rconCommand);
    tx.status = "approved";
    saveData(data);
    bot.editMessageCaption(
      `✅ <b>Подтверждено</b> <code>${txId}</code>\nRCON: <code>${result || "OK"}</code>`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML" }
    );
    const tl = T[tx.lang || "ua"];
    const typeText = tx.type === "rank" ? `Ранг <b>${tx.rankId}</b>` : `<b>${tx.coinsAmount} монет</b>`;
    bot.sendMessage(tx.chatId, tl.donateDone(typeText, tx.nickname), { parse_mode: "HTML" });
  } catch (e) {
    bot.sendMessage(chatId,
      `❌ RCON ошибка: ${e.message}\n\nВыполните вручную:\n<code>${tx.rconCommand}</code>`,
      { parse_mode: "HTML" }
    );
  }
}

async function rejectTx(chatId, msgId, txId) {
  const data = loadData();
  const tx = data.transactions[txId];
  if (!tx || tx.status !== "pending") return;
  tx.status = "rejected";
  saveData(data);
  bot.editMessageCaption(`❌ <b>Отклонено</b> <code>${txId}</code>`, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
  });
  const tl = T[tx.lang || "ua"];
  bot.sendMessage(tx.chatId, tl.donateRejected(CONFIG.ADMIN_PROFILE_LINK));
}

// ============================================================
//  Admin: support tickets
// ============================================================
async function showTickets(chatId, msgId) {
  const data = loadData();
  const open = Object.entries(data.supportTickets).filter(([, t]) => t.status === "open");
  if (open.length === 0) {
    return bot.editMessageText("💬 Нет открытых тикетов.", {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }
  bot.editMessageText(`💬 <b>Открытые тикеты: ${open.length}</b>`, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
  });
  for (const [id, ticket] of open) {
    await bot.sendMessage(chatId,
      `🆘 <code>${id}</code>\n👤 @${ticket.username} | 🌍 ${ticket.lang?.toUpperCase()}\n` +
      `🕐 ${new Date(ticket.createdAt).toLocaleString("ru-RU")}\n\n💬 ${ticket.message}`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "↩️ Ответить", callback_data: `admin_reply_ticket_${id}` }]] },
      }
    );
  }
}

// ============================================================
//  Admin: statistics
// ============================================================
function showStats(chatId, msgId) {
  const data = loadData();
  const txs = Object.values(data.transactions);
  const approved = txs.filter(t => t.status === "approved").length;
  const pending = txs.filter(t => t.status === "pending").length;
  const rejected = txs.filter(t => t.status === "rejected").length;
  const rankCounts = {};
  txs.filter(t => t.type === "rank" && t.status === "approved").forEach(t => {
    rankCounts[t.rankId] = (rankCounts[t.rankId] || 0) + 1;
  });
  const top = Object.entries(rankCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([r, c]) => `  ${RANKS[r]?.label || r}: ${c}x`).join("\n") || "  —";

  bot.editMessageText(
    `📊 <b>Статистика</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📦 Всего: <b>${txs.length}</b>\n` +
    `✅ Выдано: <b>${approved}</b>\n` +
    `⏳ Pending: <b>${pending}</b>\n` +
    `❌ Отклонено: <b>${rejected}</b>\n\n` +
    `💬 Тикетов: <b>${Object.keys(data.supportTickets).length}</b>\n` +
    `🎟 Промокодов: <b>${Object.keys(data.promos).length}</b>\n\n` +
    `🏆 <b>Топ ранги:</b>\n${top}`,
    {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    }
  );
}

// ============================================================
//  Admin: promos
// ============================================================
function showPromos(chatId, msgId) {
  const data = loadData();
  const promos = Object.entries(data.promos);
  let text = `🎟 <b>Промокоды:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  const buttons = [];
  if (promos.length === 0) {
    text += "Нет промокодов.";
  } else {
    for (const [code, p] of promos) {
      text += `• <code>${code}</code> — ${p.discount}% | ${p.uses}/${p.limit}`;
      if (p.itemRestriction) text += ` | только: ${p.itemRestriction}`;
      text += "\n";
      buttons.push([{ text: `🗑 Удалить ${code}`, callback_data: `admin_delete_promo_${code}` }]);
    }
  }
  buttons.push([{ text: "➕ Создать промокод", callback_data: "admin_create_promo" }]);
  buttons.push([{ text: "⬅️ Назад", callback_data: "admin_back" }]);
  const opts = { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } };
  if (msgId) bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts });
  else bot.sendMessage(chatId, text, opts);
}

function deletePromo(chatId, msgId, code) {
  const data = loadData();
  delete data.promos[code];
  saveData(data);
  showPromos(chatId, msgId);
}

function startCreatePromo(chatId) {
  getSession(chatId).adminStep = "promo_code";
  bot.sendMessage(chatId, "✏️ Введите <b>код промокода</b> (A-Z, 0-9, _):", { parse_mode: "HTML" });
}

function handleAdminPromoInput(chatId, text, sess) {
  if (sess.adminStep === "promo_code") {
    if (!/^[A-Z0-9_]{2,20}$/i.test(text)) return bot.sendMessage(chatId, "❌ Только A-Z, 0-9, _");
    sess.newPromoCode = text.toUpperCase();
    sess.adminStep = "promo_discount";
    return bot.sendMessage(chatId, "✏️ Введите <b>% скидки</b> (1–100):", { parse_mode: "HTML" });
  }
  if (sess.adminStep === "promo_discount") {
    const d = parseInt(text, 10);
    if (isNaN(d) || d < 1 || d > 100) return bot.sendMessage(chatId, "❌ Введите число 1–100.");
    sess.newPromoDiscount = d;
    sess.adminStep = "promo_limit";
    return bot.sendMessage(chatId, "✏️ Введите <b>лимит использований</b>:", { parse_mode: "HTML" });
  }
  if (sess.adminStep === "promo_limit") {
    const l = parseInt(text, 10);
    if (isNaN(l) || l < 1) return bot.sendMessage(chatId, "❌ Введите число > 0.");
    sess.newPromoLimit = l;
    sess.adminStep = "promo_restriction";
    return bot.sendMessage(chatId,
      `✏️ Ограничить для ранга? (${Object.keys(RANKS).join(", ")}) или кнопка:`,
      { reply_markup: { inline_keyboard: [[{ text: "🚫 Без ограничения", callback_data: "promo_restrict_none" }]] } }
    );
  }
  if (sess.adminStep === "promo_restriction") {
    const restriction = text.toLowerCase() === "none" ? null : text.toLowerCase();
    if (restriction && !RANKS[restriction])
      return bot.sendMessage(chatId, `❌ Неверный ранг. Доступные: ${Object.keys(RANKS).join(", ")}`);
    saveNewPromo(chatId, sess, restriction);
  }
}

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
  bot.sendMessage(chatId,
    `✅ Промокод <code>${sess.newPromoCode}</code> создан!\n` +
    `${sess.newPromoDiscount}% | Лимит: ${sess.newPromoLimit} | Ограничение: ${restriction || "нет"}`,
    { parse_mode: "HTML" }
  );
}

// ============================================================
//  Admin: RCON console
// ============================================================
function startRcon(chatId, msgId) {
  getSession(chatId).adminStep = "rcon_command";
  bot.editMessageText(
    `🖥 <b>RCON консоль</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⚠️ Без слеша!\nПример: <code>lp user Steve parent set vip</code>\n\nВведите команду:`,
    {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    }
  );
}

// ============================================================
//  Error handling
// ============================================================
bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("🤖 Minecraft Donation Bot запущено!");
