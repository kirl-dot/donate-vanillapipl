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
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ promos: {}, transactions: {}, supportTickets: {} }, null, 2)
    );
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!data.supportTickets) data.supportTickets = {};
  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
//  Product catalog
// ============================================================
const RANKS = {
  core:     { label: "⚡ Core",     price: 50,   stars: 83  },
  apex:     { label: "🔥 Apex",     price: 100,  stars: 167 },
  prime:    { label: "💎 Prime",    price: 150,  stars: null },
  omega:    { label: "🌀 Omega",    price: 200,  stars: null },
  ultimate: { label: "🏆 Ultimate", price: 500,  stars: null },
  supreme:  { label: "👑 Supreme",  price: 1000, stars: null },
};

const COINS_MIN = 50;
const COINS_MAX = 500;
const COINS_STARS_PER_50 = 15;

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
function clearSession(chatId) {
  sessions[chatId] = {};
}

// ============================================================
//  RCON — БЕЗ СЛЕША!
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
//  Helpers
// ============================================================
const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━";

function mainMenuBtn() {
  return { text: "🏠 Главное меню", callback_data: "back_main" };
}

function withMainMenu(buttons) {
  return { inline_keyboard: [...buttons, [mainMenuBtn()]] };
}

// ============================================================
//  Keyboards
// ============================================================
function mainMenuKeyboard(lang) {
  if (lang === "ru") {
    return {
      inline_keyboard: [
        [
          { text: "🎖 Купить ранг", callback_data: "ru_menu_ranks" },
          { text: "🪙 Купить монеты", callback_data: "ru_menu_coins" },
        ],
        [
          { text: "📖 Как купить", callback_data: "ru_howto" },
          { text: "💬 Поддержка", callback_data: "support_ru" },
        ],
      ],
    };
  }
  return {
    inline_keyboard: [
      [
        { text: "🎖 Купити ранг", callback_data: "menu_ranks" },
        { text: "🪙 Купити монети", callback_data: "menu_coins" },
      ],
      [
        { text: "📖 Як купити", callback_data: "howto" },
        { text: "💬 Підтримка", callback_data: "support_ua" },
      ],
    ],
  };
}

function langSelectKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🇺🇦 Українська", callback_data: "lang_ua" },
        { text: "🇷🇺 Русский", callback_data: "lang_ru" },
      ],
    ],
  };
}

function ranksKeyboard(lang) {
  if (lang === "ru") {
    return {
      inline_keyboard: [
        [{ text: `${RANKS.core.label} — ${RANKS.core.stars}⭐`, callback_data: `buy_rank_core_ru` }],
        [{ text: `${RANKS.apex.label} — ${RANKS.apex.stars}⭐`, callback_data: `buy_rank_apex_ru` }],
        [mainMenuBtn()],
      ],
    };
  }
  const rows = Object.entries(RANKS).map(([id, r]) => {
    const starsText = r.stars ? ` / ${r.stars}⭐` : "";
    return [{ text: `${r.label} — ${r.price}₴${starsText}`, callback_data: `buy_rank_${id}_ua` }];
  });
  rows.push([mainMenuBtn()]);
  return { inline_keyboard: rows };
}

function paymentMethodKeyboard(rankId, lang) {
  const rank = RANKS[rankId];
  const buttons = [];
  if (lang === "ua") {
    buttons.push([{ text: "💳 Картка України (UAH)", callback_data: `pay_card_${rankId}` }]);
  }
  if (rank.stars) {
    buttons.push([{
      text: `⭐ Telegram Stars (${rank.stars} ${lang === "ru" ? "звёзд" : "зірок"})`,
      callback_data: `pay_stars_${rankId}`,
    }]);
  }
  buttons.push([mainMenuBtn()]);
  return { inline_keyboard: buttons };
}

function adminMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📋 Pending", callback_data: "admin_pending" },
        { text: "📜 Все транзакции", callback_data: "admin_all_tx" },
      ],
      [
        { text: "🎟 Промокоды", callback_data: "admin_promos" },
        { text: "🖥 RCON консоль", callback_data: "admin_rcon" },
      ],
      [
        { text: "💬 Поддержка", callback_data: "admin_support" },
        { text: "📊 Статистика", callback_data: "admin_stats" },
      ],
    ],
  };
}

function adminTransactionKeyboard(txId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Подтвердить", callback_data: `admin_approve_${txId}` },
        { text: "❌ Отклонить", callback_data: `admin_reject_${txId}` },
      ],
      [{ text: "💬 Написать игроку", callback_data: `admin_msg_${txId}` }],
    ],
  };
}

// ============================================================
//  Howto texts
// ============================================================
const HOWTO_UA =
  `📖 <b>Як купити донат?</b>\n${DIVIDER}\n\n` +
  `<b>1️⃣ Оберіть товар</b>\nВиберіть ранг або монети\n\n` +
  `<b>2️⃣ Введіть нікнейм</b>\nТочно як в грі (2–16 символів)\n\n` +
  `<b>3️⃣ Промокод</b>\nВведіть або пропустіть\n\n` +
  `<b>4️⃣ Оплата карткою</b>\nПерекажіть суму на реквізити\n\n` +
  `<b>5️⃣ Або оплата Stars</b>\nВідправте зірки адміну\n\n` +
  `<b>6️⃣ Скріншот</b>\nНадішліть підтвердження оплати\n\n` +
  `<b>7️⃣ Очікування</b>\nДонат видається до 12 годин\n\n` +
  `❓ Питання? Підтримка завжди допоможе!`;

const HOWTO_RU =
  `📖 <b>Как купить донат?</b>\n${DIVIDER}\n\n` +
  `<b>1️⃣ Выберите товар</b>\nВыберите ранг или монеты\n\n` +
  `<b>2️⃣ Введите никнейм</b>\nТочно как в игре (2–16 символов)\n\n` +
  `<b>3️⃣ Промокод</b>\nВведите или пропустите\n\n` +
  `<b>4️⃣ Оплата Stars</b>\nОтправьте звёзды на профиль админа\n\n` +
  `<b>5️⃣ Скриншот</b>\nПришлите подтверждение отправки\n\n` +
  `<b>6️⃣ Ожидание</b>\nДонат выдаётся до 12 часов\n\n` +
  `❓ Вопросы? Пишите в поддержку!`;

// ============================================================
//  Promo helpers
// ============================================================
function applyPromo(promoCode, itemId, originalPrice) {
  const data = loadData();
  const promo = data.promos[promoCode.toUpperCase()];
  if (!promo) return { valid: false, reason: "Промокод не найден." };
  if (promo.uses >= promo.limit) return { valid: false, reason: "Промокод исчерпан." };
  if (promo.itemRestriction && promo.itemRestriction !== itemId)
    return { valid: false, reason: `Промокод только для "${promo.itemRestriction}".` };
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
//  /start
// ============================================================
bot.onText(/\/start/, (msg) => {
  clearSession(msg.chat.id);
  bot.sendMessage(msg.chat.id,
    `🎮 <b>Minecraft Donation Bot</b>\n${DIVIDER}\n\n🌍 <b>Выберите язык / Оберіть мову:</b>`,
    { parse_mode: "HTML", reply_markup: langSelectKeyboard() }
  );
});

// ============================================================
//  /admin
// ============================================================
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== CONFIG.ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, `🛠 <b>Админ панель</b>\n${DIVIDER}`, {
    parse_mode: "HTML",
    reply_markup: adminMainKeyboard(),
  });
});

// ============================================================
//  Callback query router
// ============================================================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const msgId = query.message.message_id;

  await bot.answerCallbackQuery(query.id);

  // ── Language ───────────────────────────────────────────────
  if (data === "lang_ua" || data === "lang_ru") {
    const lang = data === "lang_ua" ? "ua" : "ru";
    const sess = getSession(chatId);
    sess.lang = lang;
    const text = lang === "ru"
      ? `🎮 <b>Minecraft Donation Bot</b>\n${DIVIDER}\n\nДобро пожаловать! Выберите действие:`
      : `🎮 <b>Minecraft Donation Bot</b>\n${DIVIDER}\n\nЛаскаво просимо! Оберіть дію:`;
    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(lang),
    });
  }

  // ── Back to main ───────────────────────────────────────────
  if (data === "back_main") {
    const sess = getSession(chatId);
    const lang = sess.lang || "ua";
    clearSession(chatId);
    getSession(chatId).lang = lang;
    const text = lang === "ru"
      ? `🎮 <b>Minecraft Donation Bot</b>\n${DIVIDER}\n\nДобро пожаловать! Выберите действие:`
      : `🎮 <b>Minecraft Donation Bot</b>\n${DIVIDER}\n\nЛаскаво просимо! Оберіть дію:`;
    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(lang),
    });
  }

  // ── Howto ──────────────────────────────────────────────────
  if (data === "howto") {
    return bot.editMessageText(HOWTO_UA, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: withMainMenu([]),
    });
  }
  if (data === "ru_howto") {
    return bot.editMessageText(HOWTO_RU, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: withMainMenu([]),
    });
  }

  // ── Support ────────────────────────────────────────────────
  if (data === "support_ua" || data === "support_ru") {
    const isRu = data === "support_ru";
    const sess = getSession(chatId);
    sess.step = "support_msg";
    sess.lang = isRu ? "ru" : "ua";
    return bot.editMessageText(
      isRu
        ? `💬 <b>Поддержка</b>\n${DIVIDER}\n\nОпишите вашу проблему и отправьте сообщение:`
        : `💬 <b>Підтримка</b>\n${DIVIDER}\n\nОпишіть вашу проблему і надішліть повідомлення:`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
    );
  }

  // ── Ranks ──────────────────────────────────────────────────
  if (data === "menu_ranks") {
    const sess = getSession(chatId);
    sess.lang = "ua";
    return bot.editMessageText(
      `🎖 <b>Оберіть ранг:</b>\n${DIVIDER}`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: ranksKeyboard("ua") }
    );
  }
  if (data === "ru_menu_ranks") {
    const sess = getSession(chatId);
    sess.lang = "ru";
    return bot.editMessageText(
      `🎖 <b>Выберите ранг:</b>\n${DIVIDER}\n\n⚠️ Для RU: только Core и Apex (оплата Stars)`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: ranksKeyboard("ru") }
    );
  }

  // ── Coins ──────────────────────────────────────────────────
  if (data === "menu_coins") {
    const sess = getSession(chatId);
    sess.type = "coins"; sess.lang = "ua"; sess.step = "nickname";
    return bot.editMessageText(
      `🪙 <b>Купити монети</b>\n${DIVIDER}\n\nМін: ${COINS_MIN} | Макс: ${COINS_MAX}\nОплата: ⭐ Stars\n\n✏️ Введіть <b>Minecraft нікнейм</b>:`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
    );
  }
  if (data === "ru_menu_coins") {
    const sess = getSession(chatId);
    sess.type = "coins"; sess.lang = "ru"; sess.step = "nickname";
    return bot.editMessageText(
      `🪙 <b>Купить монеты</b>\n${DIVIDER}\n\nМин: ${COINS_MIN} | Макс: ${COINS_MAX}\nОплата: ⭐ Stars\n\n✏️ Введите <b>Minecraft никнейм</b>:`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
    );
  }

  // ── Buy rank ───────────────────────────────────────────────
  if (data.startsWith("buy_rank_")) {
    const raw = data.replace("buy_rank_", "");
    const lang = raw.endsWith("_ru") ? "ru" : "ua";
    const rankId = raw.replace(/_ru$|_ua$/, "");
    const rank = RANKS[rankId];
    if (!rank) return;

    const sess = getSession(chatId);
    sess.type = "rank"; sess.rankId = rankId; sess.lang = lang; sess.step = "nickname";

    const priceText = lang === "ru"
      ? `${rank.stars}⭐ Telegram Stars`
      : `${rank.price}₴${rank.stars ? ` / ${rank.stars}⭐` : ""}`;

    return bot.editMessageText(
      `${rank.label}\n${DIVIDER}\n💰 Цена: <b>${priceText}</b>\n\n` +
      (lang === "ru" ? "✏️ Введите ваш <b>Minecraft никнейм</b>:" : "✏️ Введіть ваш <b>Minecraft нікнейм</b>:"),
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
    );
  }

  // ── Payment ────────────────────────────────────────────────
  if (data.startsWith("pay_card_") || data.startsWith("pay_stars_")) {
    const isCard = data.startsWith("pay_card_");
    const rankId = data.replace(/pay_(card|stars)_/, "");
    const sess = getSession(chatId);
    const rank = RANKS[rankId];
    sess.paymentMethod = isCard ? "card" : "stars";
    sess.finalPrice = isCard ? rank.price : rank.stars;

    if (sess.promoCode && isCard) {
      const res = applyPromo(sess.promoCode, rankId, rank.price);
      if (res.valid) sess.finalPrice = res.finalPrice;
    }

    sess.step = "awaiting_screenshot";

    if (isCard) {
      return bot.editMessageText(
        `💳 <b>Оплата карткою</b>\n${DIVIDER}\n\n` +
        `Ранг: ${rank.label}\nСума: <b>${sess.finalPrice}₴</b>\n\n` +
        `📌 Реквізити:\n<code>${CONFIG.UKRAINE_CARD_DETAILS}</code>\n\n` +
        `✅ Після оплати надішліть <b>скріншот</b>:`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
      );
    } else {
      return bot.editMessageText(
        `⭐ <b>Оплата Telegram Stars</b>\n${DIVIDER}\n\n` +
        `Ранг: ${rank.label}\nЗірок: <b>${rank.stars}⭐</b>\n\n` +
        `📌 Надішліть зірки:\n${CONFIG.ADMIN_PROFILE_LINK}\n\n` +
        `✅ Після відправки надішліть <b>скріншот</b>:`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
      );
    }
  }

  // ── Skip promo ─────────────────────────────────────────────
  if (data === "skip_promo") {
    const sess = getSession(chatId);
    sess.promoCode = null;
    const isRu = sess.lang === "ru";
    const rank = RANKS[sess.rankId];

    if (isRu) {
      sess.paymentMethod = "stars";
      sess.finalPrice = rank.stars;
      sess.step = "awaiting_screenshot";
      return bot.editMessageText(
        `⭐ <b>Оплата Telegram Stars</b>\n${DIVIDER}\n\n` +
        `Ранг: ${rank.label}\nЗвёзд: <b>${rank.stars}⭐</b>\n\n` +
        `📌 Отправьте звёзды:\n${CONFIG.ADMIN_PROFILE_LINK}\n\n` +
        `✅ После отправки пришлите <b>скриншот</b>:`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: withMainMenu([]) }
      );
    }
    return bot.editMessageText(
      `💳 <b>Оберіть спосіб оплати:</b>\n${DIVIDER}`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: paymentMethodKeyboard(sess.rankId, "ua") }
    );
  }

  // ── Admin callbacks ────────────────────────────────────────
  if (userId !== CONFIG.ADMIN_ID) return;

  if (data === "admin_pending") return showPendingTransactions(chatId, msgId);
  if (data === "admin_all_tx") return showAllTransactions(chatId, msgId);
  if (data === "admin_promos") return showPromos(chatId, msgId);
  if (data === "admin_rcon") return startRconInput(chatId, msgId);
  if (data === "admin_support") return showSupportTickets(chatId, msgId);
  if (data === "admin_stats") return showStats(chatId, msgId);
  if (data === "admin_create_promo") return startCreatePromo(chatId);
  if (data === "admin_back") {
    return bot.editMessageText(`🛠 <b>Админ панель</b>\n${DIVIDER}`, {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      reply_markup: adminMainKeyboard(),
    });
  }
  if (data.startsWith("admin_approve_")) return approveTransaction(chatId, msgId, data.replace("admin_approve_", ""));
  if (data.startsWith("admin_reject_")) return rejectTransaction(chatId, msgId, data.replace("admin_reject_", ""));
  if (data.startsWith("admin_msg_")) {
    const txId = data.replace("admin_msg_", "");
    const sess = getSession(chatId);
    sess.adminStep = "msg_player";
    sess.msgTxId = txId;
    return bot.sendMessage(chatId, `✏️ Введите сообщение для игрока (транзакция <code>${txId}</code>):`, { parse_mode: "HTML" });
  }
  if (data.startsWith("admin_reply_ticket_")) {
    const ticketId = data.replace("admin_reply_ticket_", "");
    const sess = getSession(chatId);
    sess.adminStep = "reply_ticket";
    sess.replyTicketId = ticketId;
    return bot.sendMessage(chatId, `✏️ Введите ответ на тикет <code>${ticketId}</code>:`, { parse_mode: "HTML" });
  }
  if (data.startsWith("admin_delete_promo_")) return deletePromo(chatId, msgId, data.replace("admin_delete_promo_", ""));
  if (data === "promo_restrict_none") {
    const sess = getSession(chatId);
    if (sess.adminStep === "promo_restriction") saveNewPromo(chatId, sess, null);
  }
});

// ============================================================
//  Message handler
// ============================================================
bot.on("message", async (msg) => {
  if (!msg.text && !msg.photo) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const sess = getSession(chatId);

  // Screenshot
  if (msg.photo) {
    if (sess.step === "awaiting_screenshot") return handleScreenshot(msg, sess);
    return;
  }

  const text = msg.text.trim();
  if (text.startsWith("/")) return;

  // Admin: RCON
  if (userId === CONFIG.ADMIN_ID && sess.adminStep === "rcon_command") {
    sess.adminStep = null;
    try {
      const result = await rconExec(text);
      bot.sendMessage(chatId, `✅ <b>RCON ответ:</b>\n<code>${result || "(пусто)"}</code>`, { parse_mode: "HTML" });
    } catch (e) {
      bot.sendMessage(chatId, `❌ RCON ошибка: ${e.message}`);
    }
    return;
  }

  // Admin: message player
  if (userId === CONFIG.ADMIN_ID && sess.adminStep === "msg_player") {
    const txId = sess.msgTxId;
    sess.adminStep = null;
    const dbData = loadData();
    const tx = dbData.transactions[txId];
    if (tx) {
      bot.sendMessage(tx.chatId, `📩 <b>Сообщение от администратора:</b>\n\n${text}`, { parse_mode: "HTML" });
      bot.sendMessage(chatId, "✅ Сообщение отправлено игроку.");
    }
    return;
  }

  // Admin: reply ticket
  if (userId === CONFIG.ADMIN_ID && sess.adminStep === "reply_ticket") {
    const ticketId = sess.replyTicketId;
    sess.adminStep = null;
    const dbData = loadData();
    const ticket = dbData.supportTickets[ticketId];
    if (ticket) {
      bot.sendMessage(ticket.chatId,
        `📩 <b>Ответ поддержки:</b>\n\n${text}`,
        { parse_mode: "HTML" }
      );
      ticket.status = "answered";
      ticket.answer = text;
      saveData(dbData);
      bot.sendMessage(chatId, "✅ Ответ отправлен.");
    }
    return;
  }

  // Admin: promo creation
  if (userId === CONFIG.ADMIN_ID && sess.adminStep) {
    return handleAdminPromoInput(chatId, text, sess);
  }

  // User: support message
  if (sess.step === "support_msg") {
    sess.step = null;
    const isRu = sess.lang === "ru";
    const dbData = loadData();
    const ticketId = `ticket_${Date.now()}`;
    dbData.supportTickets[ticketId] = {
      chatId, userId,
      username: msg.from.username || msg.from.first_name,
      lang: sess.lang || "ua",
      message: text,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    saveData(dbData);

    bot.sendMessage(CONFIG.ADMIN_ID,
      `🆘 <b>Новый тикет поддержки</b>\n${DIVIDER}\n` +
      `🆔 <code>${ticketId}</code>\n` +
      `👤 @${msg.from.username || msg.from.first_name}\n` +
      `🌍 ${isRu ? "RU" : "UA"}\n\n` +
      `💬 <b>Сообщение:</b>\n${text}`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "↩️ Ответить", callback_data: `admin_reply_ticket_${ticketId}` }]] },
      }
    );

    bot.sendMessage(chatId,
      isRu
        ? `✅ <b>Сообщение отправлено!</b>\nАдминистратор ответит вам в ближайшее время.`
        : `✅ <b>Повідомлення надіслано!</b>\nАдміністратор відповість найближчим часом.`,
      { parse_mode: "HTML", reply_markup: mainMenuKeyboard(sess.lang || "ua") }
    );
    return;
  }

  // User: nickname
  if (sess.step === "nickname") {
    if (!/^[a-zA-Z0-9_]{2,16}$/.test(text)) {
      return bot.sendMessage(chatId,
        sess.lang === "ru"
          ? "❌ Неверный никнейм. Только A-Z, 0-9, _ (2–16 символов)."
          : "❌ Невірний нікнейм. Тільки A-Z, 0-9, _ (2–16 символів)."
      );
    }
    sess.nickname = text;
    const isRu = sess.lang === "ru";

    if (sess.type === "coins") {
      sess.step = "coins_amount";
      return bot.sendMessage(chatId,
        isRu ? `✏️ Введите количество монет (${COINS_MIN}–${COINS_MAX}):` : `✏️ Введіть кількість монет (${COINS_MIN}–${COINS_MAX}):`
      );
    }

    sess.step = "promo";
    return bot.sendMessage(chatId,
      isRu ? `🎟 Есть промокод? Введите или пропустите:` : `🎟 Маєте промокод? Введіть або пропустіть:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: isRu ? "⏭ Пропустить" : "⏭ Пропустити", callback_data: "skip_promo" }],
            [mainMenuBtn()],
          ],
        },
      }
    );
  }

  // User: promo
  if (sess.step === "promo") {
    const isRu = sess.lang === "ru";
    const rank = RANKS[sess.rankId];
    const res = applyPromo(text, sess.rankId, rank.price);
    if (!res.valid) return bot.sendMessage(chatId, `❌ ${res.reason}`);

    sess.promoCode = text.toUpperCase();

    if (isRu) {
      const discountedStars = Math.ceil(rank.stars * (1 - res.promo.discount / 100));
      sess.paymentMethod = "stars";
      sess.finalPrice = discountedStars;
      sess.step = "awaiting_screenshot";
      return bot.sendMessage(chatId,
        `✅ Промокод применён! Скидка: ${res.promo.discount}%\n\n` +
        `⭐ <b>Оплата Stars</b>\n${DIVIDER}\n` +
        `Ранг: ${rank.label}\nЗвёзд: <b>${discountedStars}⭐</b>\n\n` +
        `📌 Отправьте звёзды:\n${CONFIG.ADMIN_PROFILE_LINK}\n\n` +
        `✅ После отправки пришлите <b>скриншот</b>:`,
        { parse_mode: "HTML", reply_markup: withMainMenu([]) }
      );
    }

    sess.step = "payment_method";
    return bot.sendMessage(chatId,
      `✅ Промокод застосовано! Знижка: ${res.discount}₴ → <b>${res.finalPrice}₴</b>\n\nОберіть спосіб оплати:`,
      { parse_mode: "HTML", reply_markup: paymentMethodKeyboard(sess.rankId, "ua") }
    );
  }

  // User: coins amount
  if (sess.step === "coins_amount") {
    const isRu = sess.lang === "ru";
    const amount = parseInt(text, 10);
    if (isNaN(amount) || amount < COINS_MIN || amount > COINS_MAX) {
      return bot.sendMessage(chatId,
        isRu ? `❌ Введите число от ${COINS_MIN} до ${COINS_MAX}.` : `❌ Введіть число від ${COINS_MIN} до ${COINS_MAX}.`
      );
    }
    sess.coinsAmount = amount;
    const starsNeeded = Math.ceil(amount * (COINS_STARS_PER_50 / COINS_MIN));
    sess.starsNeeded = starsNeeded;
    sess.step = "awaiting_screenshot";

    return bot.sendMessage(chatId,
      (isRu ? `🪙 <b>Покупка монет</b>` : `🪙 <b>Купівля монет</b>`) +
      `\n${DIVIDER}\n\n` +
      `👤 Ник: <code>${sess.nickname}</code>\n` +
      `🪙 Монет: <b>${amount}</b>\n` +
      `⭐ Нужно звёзд: <b>${starsNeeded}⭐</b>\n\n` +
      `📌 ${isRu ? "Отправьте звёзды" : "Надішліть зірки"}:\n${CONFIG.ADMIN_PROFILE_LINK}\n\n` +
      `✅ ${isRu ? "После отправки пришлите скриншот." : "Після відправки надішліть скріншот."}`,
      { parse_mode: "HTML", reply_markup: withMainMenu([]) }
    );
  }
});

// ============================================================
//  Screenshot handler
// ============================================================
async function handleScreenshot(msg, sess) {
  const chatId = msg.chat.id;
  const isRu = sess.lang === "ru";
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  let description = "";
  let rconCommand = "";

  if (sess.type === "rank") {
    const rank = RANKS[sess.rankId];
    description =
      `📦 <b>Тип:</b> Ранг\n` +
      `🎖 <b>Ранг:</b> ${rank.label}\n` +
      `👤 <b>Ник:</b> <code>${sess.nickname}</code>\n` +
      `💰 <b>Оплата:</b> ${sess.paymentMethod === "card" ? sess.finalPrice + "₴ (Картка)" : sess.finalPrice + "⭐ (Stars)"}\n` +
      `🌍 <b>Язык:</b> ${isRu ? "RU" : "UA"}\n` +
      (sess.promoCode ? `🎟 <b>Промокод:</b> ${sess.promoCode}\n` : "");
    rconCommand = `lp user ${sess.nickname} parent set ${sess.rankId}`;
  } else {
    description =
      `📦 <b>Тип:</b> Монеты\n` +
      `🪙 <b>Количество:</b> ${sess.coinsAmount}\n` +
      `👤 <b>Ник:</b> <code>${sess.nickname}</code>\n` +
      `⭐ <b>Звёзд:</b> ${sess.starsNeeded}\n` +
      `🌍 <b>Язык:</b> ${isRu ? "RU" : "UA"}`;
    rconCommand = `eco give ${sess.nickname} ${sess.coinsAmount}`;
  }

  const txId = createTransaction({
    chatId, userId: msg.from.id,
    username: msg.from.username || msg.from.first_name,
    lang: sess.lang || "ua",
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

  await bot.sendPhoto(CONFIG.ADMIN_ID, fileId, {
    caption:
      `🔔 <b>Новая транзакция</b>\n${DIVIDER}\n` +
      `🆔 <code>${txId}</code>\n\n` +
      description +
      `\n\n💻 <b>RCON команда:</b>\n<code>${rconCommand}</code>`,
    parse_mode: "HTML",
    reply_markup: adminTransactionKeyboard(txId),
  });

  bot.sendMessage(chatId,
    isRu
      ? `✅ <b>Скриншот получен!</b>\n\n⏱ Время рассмотрения — до <b>12 часов</b>.\nЕсли донат не пришёл — обратитесь в поддержку:\n${CONFIG.ADMIN_PROFILE_LINK}`
      : `✅ <b>Скріншот отримано!</b>\n\n⏱ Час розгляду — до <b>12 годин</b>.\nЯкщо донат не прийшов — зверніться до підтримки:\n${CONFIG.ADMIN_PROFILE_LINK}`,
    { parse_mode: "HTML", reply_markup: mainMenuKeyboard(sess.lang || "ua") }
  );

  const savedLang = sess.lang;
  clearSession(chatId);
  getSession(chatId).lang = savedLang;
}

// ============================================================
//  Admin: pending
// ============================================================
async function showPendingTransactions(chatId, msgId) {
  const dbData = loadData();
  const pending = Object.entries(dbData.transactions).filter(([, tx]) => tx.status === "pending");

  if (pending.length === 0) {
    return bot.editMessageText("📋 Нет pending транзакций.", {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }

  bot.editMessageText(`📋 <b>Pending транзакции: ${pending.length}</b>`, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
  });

  for (const [txId, tx] of pending) {
    await bot.sendPhoto(chatId, tx.fileId, {
      caption:
        `🆔 <code>${txId}</code>\n` +
        `👤 @${tx.username} | <code>${tx.nickname}</code>\n` +
        `📦 ${tx.type === "rank" ? `Ранг: ${tx.rankId}` : `Монет: ${tx.coinsAmount}`}\n` +
        `🌍 ${tx.lang?.toUpperCase() || "UA"}\n` +
        `💻 RCON: <code>${tx.rconCommand}</code>\n` +
        `🕐 ${new Date(tx.createdAt).toLocaleString("ru-RU")}`,
      parse_mode: "HTML",
      reply_markup: adminTransactionKeyboard(txId),
    });
  }
}

// ============================================================
//  Admin: all transactions
// ============================================================
async function showAllTransactions(chatId, msgId) {
  const dbData = loadData();
  const all = Object.entries(dbData.transactions).slice(-15).reverse();

  if (all.length === 0) {
    return bot.editMessageText("📋 Нет транзакций.", {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }

  let text = `📜 <b>Последние транзакции:</b>\n${DIVIDER}\n\n`;
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
async function approveTransaction(chatId, msgId, txId) {
  const dbData = loadData();
  const tx = dbData.transactions[txId];
  if (!tx || tx.status !== "pending") {
    return bot.editMessageCaption("⚠️ Транзакция не найдена или уже обработана.", { chat_id: chatId, message_id: msgId });
  }
  try {
    const result = await rconExec(tx.rconCommand);
    tx.status = "approved";
    saveData(dbData);

    bot.editMessageCaption(
      `✅ <b>Подтверждено</b>\n🆔 <code>${txId}</code>\n👤 ${tx.nickname}\nRCON: <code>${result || "OK"}</code>`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML" }
    );

    const isRu = tx.lang === "ru";
    bot.sendMessage(tx.chatId,
      isRu
        ? `🎉 <b>Донат выдан!</b>\n\n${tx.type === "rank" ? `Ранг <b>${tx.rankId}</b>` : `<b>${tx.coinsAmount} монет</b>`} выдан игроку <code>${tx.nickname}</code>.\n\nСпасибо за поддержку сервера! 🙏`
        : `🎉 <b>Донат отримано!</b>\n\n${tx.type === "rank" ? `Ранг <b>${tx.rankId}</b>` : `<b>${tx.coinsAmount} монет</b>`} видано гравцю <code>${tx.nickname}</code>.\n\nДякуємо за підтримку! 🙏`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    bot.sendMessage(chatId, `❌ RCON ошибка: ${e.message}\n\nПопробуйте выполнить команду вручную:\n<code>${tx.rconCommand}</code>`, { parse_mode: "HTML" });
  }
}

async function rejectTransaction(chatId, msgId, txId) {
  const dbData = loadData();
  const tx = dbData.transactions[txId];
  if (!tx || tx.status !== "pending") return;
  tx.status = "rejected";
  saveData(dbData);

  bot.editMessageCaption(`❌ <b>Отклонено</b>\n🆔 <code>${txId}</code>`, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
  });

  const isRu = tx.lang === "ru";
  bot.sendMessage(tx.chatId,
    isRu
      ? `😔 Ваш донат был отклонён.\nОбратитесь в поддержку: ${CONFIG.ADMIN_PROFILE_LINK}`
      : `😔 Ваш донат було відхилено.\nЗверніться до підтримки: ${CONFIG.ADMIN_PROFILE_LINK}`
  );
}

// ============================================================
//  Admin: support tickets
// ============================================================
async function showSupportTickets(chatId, msgId) {
  const dbData = loadData();
  const tickets = Object.entries(dbData.supportTickets).filter(([, t]) => t.status === "open");

  if (tickets.length === 0) {
    return bot.editMessageText("💬 Нет открытых тикетов.", {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
    });
  }

  bot.editMessageText(`💬 <b>Открытые тикеты: ${tickets.length}</b>`, {
    chat_id: chatId, message_id: msgId, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "admin_back" }]] },
  });

  for (const [ticketId, ticket] of tickets) {
    await bot.sendMessage(chatId,
      `🆘 <b>Тикет</b> <code>${ticketId}</code>\n` +
      `👤 @${ticket.username} | 🌍 ${ticket.lang?.toUpperCase()}\n` +
      `🕐 ${new Date(ticket.createdAt).toLocaleString("ru-RU")}\n\n` +
      `💬 ${ticket.message}`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "↩️ Ответить", callback_data: `admin_reply_ticket_${ticketId}` }]] },
      }
    );
  }
}

// ============================================================
//  Admin: stats
// ============================================================
function showStats(chatId, msgId) {
  const dbData = loadData();
  const txs = Object.values(dbData.transactions);
  const approved = txs.filter(t => t.status === "approved").length;
  const pending = txs.filter(t => t.status === "pending").length;
  const rejected = txs.filter(t => t.status === "rejected").length;
  const tickets = Object.values(dbData.supportTickets).length;
  const promos = Object.keys(dbData.promos).length;

  const rankCounts = {};
  txs.filter(t => t.type === "rank" && t.status === "approved").forEach(t => {
    rankCounts[t.rankId] = (rankCounts[t.rankId] || 0) + 1;
  });
  const topRanks = Object.entries(rankCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([r, c]) => `  ${RANKS[r]?.label || r}: ${c}x`).join("\n") || "  —";

  bot.editMessageText(
    `📊 <b>Статистика</b>\n${DIVIDER}\n\n` +
    `📦 Всего транзакций: <b>${txs.length}</b>\n` +
    `✅ Выдано: <b>${approved}</b>\n` +
    `⏳ Pending: <b>${pending}</b>\n` +
    `❌ Отклонено: <b>${rejected}</b>\n\n` +
    `💬 Тикетов: <b>${tickets}</b>\n` +
    `🎟 Промокодов: <b>${promos}</b>\n\n` +
    `🏆 <b>Топ ранги:</b>\n${topRanks}`,
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
  const dbData = loadData();
  const promos = Object.entries(dbData.promos);
  let text = `🎟 <b>Промокоды:</b>\n${DIVIDER}\n\n`;
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
  const dbData = loadData();
  delete dbData.promos[code];
  saveData(dbData);
  showPromos(chatId, msgId);
}

function startCreatePromo(chatId) {
  const sess = getSession(chatId);
  sess.adminStep = "promo_code";
  bot.sendMessage(chatId, "✏️ Введите <b>код промокода</b> (A-Z, 0-9, _):", { parse_mode: "HTML" });
}

function handleAdminPromoInput(chatId, text, sess) {
  if (sess.adminStep === "promo_code") {
    if (!/^[A-Z0-9_]{2,20}$/i.test(text)) return bot.sendMessage(chatId, "❌ Неверный формат. A-Z, 0-9, _");
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
      `✏️ Ограничить для ранга? (${Object.keys(RANKS).join(", ")}) или нажмите кнопку:`,
      { reply_markup: { inline_keyboard: [[{ text: "🚫 Без ограничения", callback_data: "promo_restrict_none" }]] } }
    );
  }
  if (sess.adminStep === "promo_restriction") {
    const restriction = text.toLowerCase() === "none" ? null : text.toLowerCase();
    if (restriction && !RANKS[restriction]) return bot.sendMessage(chatId, `❌ Неверный ранг. Доступные: ${Object.keys(RANKS).join(", ")}`);
    saveNewPromo(chatId, sess, restriction);
  }
}

function saveNewPromo(chatId, sess, restriction) {
  const dbData = loadData();
  dbData.promos[sess.newPromoCode] = {
    discount: sess.newPromoDiscount,
    limit: sess.newPromoLimit,
    uses: 0,
    itemRestriction: restriction,
  };
  saveData(dbData);
  sess.adminStep = null;
  bot.sendMessage(chatId,
    `✅ Промокод <code>${sess.newPromoCode}</code> создан!\n${sess.newPromoDiscount}% | Лимит: ${sess.newPromoLimit} | Ограничение: ${restriction || "нет"}`,
    { parse_mode: "HTML" }
  );
}

// ============================================================
//  Admin: RCON console
// ============================================================
function startRconInput(chatId, msgId) {
  const sess = getSession(chatId);
  sess.adminStep = "rcon_command";
  bot.editMessageText(
    `🖥 <b>RCON консоль</b>\n${DIVIDER}\n\n` +
    `⚠️ Вводите команды <b>без слеша</b>!\n` +
    `Пример: <code>lp user Steve parent set vip</code>\n\n` +
    `Введите команду:`,
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
