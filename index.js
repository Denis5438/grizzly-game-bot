/////////////////////////////////////////////////////////////
require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const Mongoose = require('mongoose');
const { InlineKeyboard, InlineKeyboardButton } = require('telegraf');
const fs = require('fs');
const ytdl = require('ytdl-core');
const util = require('util');
const axios = require('axios');
const { createCanvas, loadImage, registerFont } = require('canvas');
// Регистрация шрифта для Canvas 1 раз при старте
try {
  const fontPath = './CirceRounded-Regular4.ttf';
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Futura' });
  }
} catch (fontErr) {
  console.error('Предупреждение: шрифт не удалось загрузить:', fontErr.message);
}

// 🎨 Celya / Celestiana модули для генерации графики, игр и развлечений
const {
  generateMarriageCertificate,
  generateUltrasoundCard,
  generateQuoteCard,
  generateDemotivator,
  applyPhotoFilter
} = require('./src/canvasGenerators');

const {
  parseBetAmount,
  formatNumber,
  createDeck,
  calculateHandScore,
  formatHand,
  activeBlackjacks,
  getBlackjackKeyboard,
  activeTicTacToe,
  checkTicTacToeWinner,
  getTicTacToeKeyboard
} = require('./src/celyaGames');

const {
  ZODIAC_SIGNS,
  getDailyHoroscope,
  getMagicBallAnswer,
  getProbability,
  getHelpMainMenu,
  getHelpCategoryContent
} = require('./src/celyaEntertainment');

Mongoose.set('strictQuery', true);

// ⚡ Загрузка токенов из окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: BOT_TOKEN не найден в файле .env!');
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: MONGODB_URI не найден в файле .env!');
  process.exit(1);
}

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  console.error('Ошибка при обработке события ' + (ctx?.updateType || 'unknown') + ':', err);
});

// ⚡ ОПТИМИЗАЦИЯ: Middleware для кэширования пользователя в контексте
bot.use(async (ctx, next) => {
  try {
    if (ctx.from && ctx.from.id) {
      const telegramId = ctx.from.id;
      let user = await User.findOne({ telegramId });
      
      // Если пользователя нет - создаем (с защитой от race condition E11000)
      if (!user) {
        try {
          user = new User({
            telegramId: telegramId,
            nickname: ctx.from.first_name || `Игрок ${telegramId}`,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
            admin: 0,
            ban: false,
            cookies: 0,
            bankCookies: 0,
            lastBonusTime: new Date(0),
            registrationDate: new Date(),
            lastTransferTime: new Date(),
            isRegistered: false,
            userRequestInfo: {
              requests: 10,
              lastRequestTime: null,
              limit: 10,
              referralCode: telegramId.toString(),
              invitedUsers: [],
              gptcoin: 5
            }
          });
          await user.save();
        } catch (createErr) {
          // Если произошла гонка параллельных запросов и запись уже создана (E11000)
          if (createErr.code === 11000) {
            user = await User.findOne({ telegramId });
          } else {
            throw createErr;
          }
        }
      } else {
        // Обновляем данные профиля если изменились
        let needUpdate = false;
        if (user.firstName !== ctx.from.first_name) {
          user.firstName = ctx.from.first_name;
          needUpdate = true;
        }
        if (user.lastName !== ctx.from.last_name) {
          user.lastName = ctx.from.last_name;
          needUpdate = true;
        }
        if (user.username !== ctx.from.username) {
          user.username = ctx.from.username;
          needUpdate = true;
        }
        if (user.userRequestInfo && !user.userRequestInfo.referralCode) {
          user.userRequestInfo.referralCode = telegramId.toString();
          needUpdate = true;
        }
        if (needUpdate) {
          await user.save();
        }
      }
      
      // Сохраняем пользователя в контексте для быстрого доступа
      ctx.state.user = user;
    }
  } catch (err) {
    console.error('Error in user caching middleware:', err);
  }
  return next();
});

// Define the User schema
const UserSchema = new Mongoose.Schema({
  telegramId: { type: Number, unique: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String },
  nickname: { type: String },
  admin: { type: Number, default: 0 },
  ban: { type: Boolean, default: false },
  vip: { type: Number, default: 0 },
  vipExpirationDate: { type: Date, default: null },
  cookies: { type: Number, default: 0 },
  bankCookies: { type: Number, default: 0 },
  coconuts: { type: Number, default: 0 },
  donuts: { type: Number, default: 0 },
  lastBonusTime: { type: Date, default: 0 },
  transfersToday: { type: Number, default: 0 },
  lastTransferTime: Date,
  registrationDate: { type: Date, default: Date.now },
  isRegistered: { type: Boolean, default: false },
  userRequestInfo: {
    requests: { type: Number, default: 10 },
    lastRequestTime: { type: Date, default: null },
    limit: { type: Number, default: 10 },
    referralCode: { type: String },
    invitedUsers: [{ type: Number }],
    gptcoin: { type: Number, default: 5 }
  },
  partner: { type: Number, default: null },
  gender: { type: String, enum: ['м', 'ж', null], default: null }
});

// ⚡ ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ПОИСКА И ТОПОВ
UserSchema.index({ username: 1 });
UserSchema.index({ cookies: -1 });

// Create the User model
const User = Mongoose.model('User', UserSchema);


//функция
function sp(int) {
  let str = int.toString();
  let result = '';
  while (str.length > 3) {
    result = '.' + str.slice(-3) + result;
    str = str.slice(0, -3);
  }
  result = str + result;
  return result;
}

function rn(int, fixed) {
  if (int === null) return null;
  if (int === 0) return '0';
  fixed = (!fixed || fixed < 0) ? 0 : fixed;
  let b = (int).toPrecision(2).split('e'),
    k = b.length === 1 ? 0 : Math.floor(Math.min(b[1].slice(1), 14) / 3),
    c = k < 1 ? int.toFixed(0 + fixed) : (int / Math.pow(10, k * 3)).toFixed(1 + fixed),
    d = c < 0 ? c : Math.abs(c),
    e = d + ['', ' тыс.', ' млн.', ' млрд.', ' трлн.'][k];

  e = e.replace(/e/g, '');
  e = e.replace(/\+/g, '');
  e = e.replace(/Infinity/g, 'Бесконечно.');

  return e;
}

function gi(int) {
  let str = int.toString();
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += `${str[i]}&#8419;`;
  }
  return result;
}

function decl(n, titles) {
  return titles[(n % 10 === 1 && n % 100 !== 11) ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
}

function random(x, y) {
  return Math.floor(Math.random() * (y - x + 1)) + x;
}

function pick(array) {
  return array[random(0, array.length - 1)];
}

const utils = { sp, rn, gi, decl, random, pick };

//функции 
function shuffleArray(array) {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = random(0, i);
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

bot.start(async (ctx) => {
/*  const referralCode = ctx.message.text.split(' ')[1];

  if (referralCode) {
    // Пользователь присоединился по реферальной ссылке, обработайте этот случай
    const referrer = await User.findOne({ 'userRequestInfo.referralCode': referralCode, telegramId: { $ne: ctx.from.id } });

    if (referrer) {
      // Проверяем, что пользователь не нажимает на свою собственную ссылку
      console.log('Referrer:', referrer);
      // Пользователь, который пригласил, найден
      // Обработайте этот случай, например, увеличьте счетчик gptcoin у пригласившего и приглашенного пользователя
      referrer.userRequestInfo.gptcoin++;

      // Увеличиваем счетчик gptcoin у приглашенного пользователя
      const invitedUser = await User.findOne({ telegramId: ctx.from.id });

      if (invitedUser && !invitedUser.isRegistered && referrer.telegramId !== invitedUser.telegramId) {
        // Проверяем, что пользователь еще не зарегистрирован и не является пригласившим
        invitedUser.userRequestInfo.gptcoin++;
        invitedUser.isRegistered = true; // Помечаем пользователя как зарегистрированного
        await invitedUser.save();

        // Проверяем, что invitedUsers существует и является массивом
        if (!referrer.invitedUsers || !Array.isArray(referrer.invitedUsers)) {
          // Если нет, инициализируем его пустым массивом
          referrer.invitedUsers = [];
        }

        // Добавляем нового пользователя в массив invitedUsers у пригласившего пользователя
        referrer.invitedUsers.push(ctx.from.id);
        await referrer.save();
        // Отправляем уведомление об успешном приглашении обоим пользователям
        const referrerName = referrer.nickname || 'Анонимный пользователь';
        const invitedUserName = invitedUser.nickname || 'Анонимный пользователь';

        const referrerMessage = `${referrerName}, вы пригласили ${invitedUserName} по вашей ссылке! Вы оба получаете +1 GPTCoin 🚀`;
        const invitedUserMessage = `${invitedUserName}, вы были приглашены пользователем ${referrerName}! Вы оба получаете +1 GPTCoin 🚀`;

        await ctx.telegram.sendMessage(referrer.telegramId, referrerMessage, { parse_mode: 'Markdown' });
        await ctx.telegram.sendMessage(invitedUser.telegramId, invitedUserMessage, { parse_mode: 'Markdown' });
      }
    }
  }*/

  // Добавьте код, который выполняется при обычном входе пользователя без реферальной ссылки
  await ctx.reply('Привет! Я тестовая версия бота. Чтобы узнать мои команды, прочитайте информацию в канале. - @grizzlybotnews');
});

bot.hears(/^\.(аз команды|аз помощь)/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\nВсе команды а так же инструкции по всем механика ты найдешь тут: https://telegra.ph/Razdel-Kazino-04-08
      `, { parse_mode: 'Markdown' });
});


bot.hears(/^\.(аз профиль|аз я)/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }

  const daysRegistered = Math.round((Date.now() - user.registrationDate) / (1000 * 60 * 60 * 24));
  const formattedRegistrationDate = user.registrationDate.toLocaleString('ru-RU', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');

  const balanceMessage = `[${user.nickname}](tg://user?id=${ctx.from.id}),
   🍪 • Печенек: ${utils.sp(user.cookies)}
   🏦 • Печенек в банке: ${utils.sp(user.bankCookies)}
   📅 • Регистрация: ${formattedRegistrationDate} (${daysRegistered} дн)
   `;

  ctx.reply(balanceMessage, { parse_mode: 'Markdown' });
});

bot.hears(/^\.ник(?:\s(.*))?$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }
  const nickname = ctx.match[1];
  if (!nickname) {
    user.nickname = ctx.from.first_name;
    await user.save();
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🗑 • Ваш никнейм был удалён, теперь я буду обращаться к вам по имени в профиле.`, { parse_mode: 'Markdown' });
  }
  user.nickname = nickname;
  await user.save();
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n✅ • Ваш никнейм был обновлен`, { parse_mode: 'Markdown' });
});

bot.hears(/^\.аз банк$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🏦 • В банке: ${utils.rn(user.bankCookies)}\n💡 • Для снятия/пополнения введите: .аз банк с/п <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз банк ([сСпП]) ([^]+|вс[её])?$/i, async (ctx) => {
  try {
    const user = ctx.state.user || await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Вы не зарегистрированы в боте.');

    const operation = ctx.match[1].toLowerCase();
    let rawAmount = ctx.match[2];

    if (!rawAmount || !rawAmount.trim()) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Для снятия/пополнения введите: .аз банк с/п <сумма>`, { parse_mode: 'Markdown' });
    }

    let amount;
    if (/^вс[её]?$/i.test(rawAmount.trim())) {
      const fresh = await User.findOne({ telegramId: ctx.from.id });
      amount = operation === 'с' ? fresh?.bankCookies : fresh?.cookies;
    } else {
      let cleaned = rawAmount.replace(/(\.|\,|к|k|м|m)/ig, (match) => {
        const replacements = {
          '.': '',
          ',': '',
          'к': '000',
          'k': '000',
          'м': '000000',
          'm': '000000'
        };
        return replacements[match.toLowerCase()] || match;
      });
      amount = parseInt(cleaned, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Для снятия/пополнения введите: .аз банк с/п <сумма>`, { parse_mode: 'Markdown' });
    }

    const reply = (message) => ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n${message}`, { parse_mode: 'Markdown' });

    if (operation === 'с') {
      const updatedUser = await User.findOneAndUpdate(
        { telegramId: ctx.from.id, bankCookies: { $gte: amount } },
        { $inc: { bankCookies: -amount, cookies: amount } },
        { new: true }
      );
      if (!updatedUser) {
        const freshUser = await User.findOne({ telegramId: ctx.from.id });
        return reply(`👺 • У вас недостаточно средств!\n🏦 В банке: ${utils.sp(freshUser?.bankCookies || 0)}`);
      }
      return reply(`✅ Вы сняли ${utils.sp(amount)} с банковского счета\n🏦 В банке: ${utils.sp(updatedUser.bankCookies)}\n🍪 Баланс: ${utils.sp(updatedUser.cookies)}`);
    } else if (operation === 'п') {
      const updatedUser = await User.findOneAndUpdate(
        { telegramId: ctx.from.id, cookies: { $gte: amount } },
        { $inc: { cookies: -amount, bankCookies: amount } },
        { new: true }
      );
      if (!updatedUser) {
        const freshUser = await User.findOne({ telegramId: ctx.from.id });
        return reply(`👺 • У вас недостаточно средств!\n🍪 Баланс: ${utils.sp(freshUser?.cookies || 0)}`);
      }
      return reply(`✅ Вы пополнили банковский счет на ${utils.sp(amount)}\n🏦 В банке: ${utils.sp(updatedUser.bankCookies)}\n🍪 Баланс: ${utils.sp(updatedUser.cookies)}`);
    }
  } catch (error) {
    console.error("Ошибка в .аз банк:", error);
  }
});

bot.hears(/^\.аз перевод$/i, async (ctx) => {
  const user = ctx.state.user || await User.findOne({ telegramId: ctx.from.id });
  return ctx.reply(`[${user ? user.nickname : 'Игрок'}](tg://user?id=${ctx.from.id}),\n🍪 • Используйте .аз перевод <участник> <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз перевод\s*(.+)? ([^]+|вс[её])?$/i, async (ctx) => {
  try {
    const user = ctx.state.user || await User.findOne({ telegramId: ctx.from.id });

    if (!user) {
      return ctx.reply('Вы не зарегистрированы в боте');
    }

    let rawCookies = ctx.match[2];
    if (!rawCookies || !rawCookies.trim()) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🍪 • Используйте .аз перевод <участник> <сумма>`, { parse_mode: 'Markdown' });
    }

    let cookiesToTransfer;
    if (/^вс[её]?$/i.test(rawCookies.trim())) {
      const freshUser = await User.findOne({ telegramId: user.telegramId });
      cookiesToTransfer = freshUser ? freshUser.bankCookies : 0;
    } else {
      let cleaned = rawCookies.replace(/(\.|\,|к|k|м|m)/ig, match => {
        const replacements = {
          '.': '',
          ',': '',
          'к': '000',
          'k': '000',
          'м': '000000',
          'm': '000000',
        };
        return replacements[match.toLowerCase()] || match;
      });
      cookiesToTransfer = parseInt(cleaned, 10);
    }

    if (isNaN(cookiesToTransfer) || cookiesToTransfer < 50000) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Недостаточно средств на банковском счету или минимальная сумма для перевода составляет 50.000`, { parse_mode: 'Markdown' });
    }

    const recipientUsername = ctx.message.text.match(/@\w+/)?.[0]?.slice(1);
    const recipientUser = recipientUsername ? await User.findOne({ username: new RegExp('^' + recipientUsername + '$', 'i') }) : await User.findOne({ telegramId: ctx.message.reply_to_message?.from?.id });

    if (!recipientUser || !recipientUser.telegramId) {
      return ctx.reply('Пользователь, которому вы хотите перевести, не зарегистрирован в боте.');
    }

    if (recipientUser.username === user.username || recipientUser.telegramId === user.telegramId) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Невозможно перевести печеньки самому себе`, { parse_mode: 'Markdown' });
    }

    const transferLimit = 3;
    const commissionPercentage = 0.05;
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const commission = Math.ceil(cookiesToTransfer * commissionPercentage);
    const transferAmount = cookiesToTransfer - commission;

    // ⚡ Атомарная проверка лимита переводов и баланса
    // Попытка 1: Начало нового 24-часового периода (первый перевод за сутки)
    let updatedSender = await User.findOneAndUpdate(
      {
        telegramId: user.telegramId,
        bankCookies: { $gte: cookiesToTransfer },
        $or: [
          { lastTransferTime: { $exists: false } },
          { lastTransferTime: null },
          { lastTransferTime: { $lt: cutoffDate } }
        ]
      },
      {
        $inc: { bankCookies: -cookiesToTransfer },
        $set: { transfersToday: 1, lastTransferTime: now }
      },
      { new: true }
    );

    // Попытка 2: В рамках текущих 24 часов (лимит строго < transferLimit)
    if (!updatedSender) {
      updatedSender = await User.findOneAndUpdate(
        {
          telegramId: user.telegramId,
          bankCookies: { $gte: cookiesToTransfer },
          transfersToday: { $lt: transferLimit },
          lastTransferTime: { $gte: cutoffDate }
        },
        {
          $inc: { bankCookies: -cookiesToTransfer, transfersToday: 1 },
          $set: { lastTransferTime: now }
        },
        { new: true }
      );
    }

    if (!updatedSender) {
      const current = await User.findOne({ telegramId: user.telegramId });
      if ((current?.bankCookies || 0) < cookiesToTransfer) {
        return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n👺 • У вас недостаточно средств! Баланс: ${utils.sp(current?.bankCookies || 0)}`);
      }
      const lastTime = current?.lastTransferTime ? new Date(current.lastTransferTime).getTime() : 0;
      const remainingMs = Math.max(0, (lastTime + 24 * 60 * 60 * 1000) - now.getTime());
      const remainingTime = new Date(remainingMs);
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Вы достигли максимального количества переводов (${transferLimit}/день), ограничение будет снято через ${remainingTime.getUTCHours() > 0 ? `${remainingTime.getUTCHours()}ч. ` : ''}${remainingTime.getUTCMinutes()}м. ${remainingTime.getUTCSeconds()}с.`);
    }

    try {
      await User.findOneAndUpdate(
        { telegramId: recipientUser.telegramId },
        { $inc: { bankCookies: transferAmount } }
      );
    } catch (creditErr) {
      // Откат списания у отправителя в случае сбоя
      await User.findOneAndUpdate(
        { telegramId: user.telegramId },
        { $inc: { bankCookies: cookiesToTransfer, transfersToday: -1 } }
      );
      return ctx.reply('❌ Ошибка при зачислении средств получателю. Перевод отменен, средства возвращены на ваш счет.');
    }

    const MAX_RECIPIENT_NAME_LENGTH = 14;
    let rawRecipientName = (recipientUser.firstName || recipientUser.nickname || 'Игрок').replace(/[\[\]]/g, '');
    let recipientName = rawRecipientName.length > MAX_RECIPIENT_NAME_LENGTH
      ? rawRecipientName.substring(0, MAX_RECIPIENT_NAME_LENGTH - 3) + '...'
      : rawRecipientName;
    const senderNick = (user.nickname || user.firstName || 'Игрок').replace(/[\[\]]/g, '');
    const transfersLeft = Math.max(0, transferLimit - updatedSender.transfersToday);
    const transferMessage = `[${senderNick}](tg://user?id=${ctx.from.id}),\n🔄 • Перевод на сумму ${utils.sp(transferAmount)} выполнен. Получатель: [${recipientName}](tg://user?id=${recipientUser.telegramId})\n💰 • Комиссия банка (${commissionPercentage * 100}%): ${utils.sp(commission)}\n🗄 • Переводов осталось: ${transfersLeft}`;

    ctx.reply(transferMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Ошибка в .аз перевод:", error);
  }
});


bot.hears(/^\.аз слот\s?$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз слот <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз слот\s?([^]+|вс[её])?$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }

  const replacements = {
    '.': '',
    ',': '',
    'к': '000',
    'k': '000',
    'м': '000000',
    'm': '000000',
  };

  let amount = ctx.match[1];
  amount = amount.replace(/(\.|\,|к|k|м|m)/ig, (match) => replacements[match] || match);

  if (/^вс[её]?$/.test(amount)) {
    amount = user.cookies;
  }

  if (isNaN(amount) || amount < 5) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз слот <сумма>`, { parse_mode: 'Markdown' });
  }

  if (user.cookies < amount) {
    const cookiesDiff = amount - user.cookies;
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${cookiesDiff} печенек!\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  user.cookies -= amount;
  const emojis = ['🍔', '🍋', '🎩', '🍒', '🍪', '💰', '🔔', '🚀', '🍇'];
  const combination = [emojis, emojis, emojis].map((item) => item[Math.floor(Math.random() * item.length)]);

  const win = combination[0] === combination[1] && combination[1] === combination[2];
  user.cookies += win ? amount * 2 : 0;
  await user.save();

  const message = `[${user.nickname}](tg://user?id=${ctx.from.id}),\n🐉 Казино « Seven Dragons • 🐉\n${win ? '➕' : '➖'} • Вы ${win ? 'выиграли' : 'проиграли'}: ${amount} печенек.\n🎰 • Ваша комбинация: ${combination.join('|')}\n🍪 • Печенек: ${utils.sp(user.cookies)}`;
  return ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.hears(/^\.аз кости\s?$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз кости <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз кости\s?([^]+|вс[её])?$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя

  // замена ключевых слов на количество печенек у пользователя
  if (!user) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Вы не зарегистрирован в боте.`, { parse_mode: 'Markdown' });
  }

  let bet = ctx.match[1] || '';
  const betReplacements = {
    '.': '',
    ',': '',
    'к': '000',
    'k': '000',
    'м': '000000',
    'm': '000000',
  };
  bet = bet.replace(/(\.|\,|к|k|м|m)/ig, (match) => betReplacements[match.toLowerCase()]);


  if (/^вс[её]?$/.test(bet)) {
    bet = user.cookies;
  } else {
    bet = +bet;
  }

  if (!bet || (isNaN(bet) && bet.toLowerCase() !== 'всё' && bet.toLowerCase() !== 'все')) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз кости <сумма>`, { parse_mode: 'Markdown' });
  }

  if (bet > user.cookies) {
    const cookiesDiff = bet - user.cookies;
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${utils.sp(cookiesDiff)} печенек!\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  if (bet < 5) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка от 5 печенек.`, { parse_mode: 'Markdown' });
  }

  const botValue = Math.floor(Math.random() * 11) + 1;
  const userValue = Math.floor(Math.random() * 11) + 1;

  let resultMessage = `[${user.nickname}](tg://user?id=${ctx.from.id}),\n🎲 • У вас выпало: ${userValue}\n🤖 • У бота выпало: ${botValue}\n`;

  if (userValue > botValue) {
    const winAmount = bet;
    user.cookies += winAmount;
    resultMessage += `➕ • Вы получаете: ${utils.sp(winAmount)} печенек.`;
  } else if (userValue < botValue) {
    const loseAmount = bet;
    user.cookies -= loseAmount;
    resultMessage += `➖ • Вы теряете: ${utils.sp(loseAmount)} печенек.`;
  } else {
    resultMessage += `➗ • Игра завершилась в ничью.`;
  }

  await user.save();
  const balanceMessage = `🍪 • Печенек: ${utils.sp(user.cookies)}`;
  ctx.reply(resultMessage + '\n' + balanceMessage, { parse_mode: 'Markdown' });
});



/////////////////////////////////////////////////////////////////////
bot.hears(/^\.аз стакан\s?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз стакан <№ от 1 до 3> <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз стакан\s?(\d)\s?([^]+|вс[её])?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  let bet = ctx.match[2] || '';
  const glassNum = Number(ctx.match[1]);

  if (!user) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Вы не зарегистрирован в боте.`, { parse_mode: 'Markdown' });
  }

  const betMultiplier = { '.': '', ',': '', 'к': '000', 'k': '000', 'м': '000000', 'm': '000000' };
  bet = bet.replace(/(\.|\,|к|k|м|m)/ig, (match) => betMultiplier[match.toLowerCase()] || match);

  if (/^вс[её]?$/.test(bet)) {
    bet = user.cookies;
  } else {
    bet = parseInt(bet, 10);
  }

  if (glassNum < 1 || glassNum > 3 || !bet) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз стакан <№ от 1 до 3> <сумма>`, { parse_mode: 'Markdown' });
  }

  if (bet < 5) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка от 5 печенек.`, { parse_mode: 'Markdown' });
  }

  if (bet > user.cookies) {
    const cookiesDiff = bet - user.cookies;
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${utils.sp(cookiesDiff)} печенек!\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  const glasses = ['🎾', '🥛', '🥛'];
  //const shuffledGlasses = shuffleArray(glasses);
  const shuffledGlasses = glasses.sort(() => Math.random() - 0.5);



  const guessedCorrectly = shuffledGlasses[glassNum - 1] === '🎾';

  if (guessedCorrectly) {
    const winAmount = Math.floor(bet * 1.5);
    user.cookies += winAmount;
    await user.save();

    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n ⚗️ • ${shuffledGlasses.join(' ')}\n➕ • Вы получаете ${utils.sp(winAmount)} печенек. (x1.5)\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  } else {
    user.cookies -= bet;
    await user.save();

    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n ⚗️ • ${shuffledGlasses.join(' ')}\n➖ • Вы теряете ${utils.sp(bet)} печенек.\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }
});

bot.hears(/^\.аз акции\s?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз акции <вверх/вниз&gt <ставка>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз акции (вверх|вниз)\s?([^]+|вс[её])?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }

  if (!ctx.match[1] || !['вверх', 'вниз'].includes(ctx.match[1])) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз акции <вверх/вниз&gt <ставка>`, { parse_mode: 'Markdown' });
  }

  if (!ctx.match[2] || /^вс[её]?$/.test(ctx.match[2])) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз акции <вверх/вниз&gt <ставка>`, { parse_mode: 'Markdown' });
  }

  let [action, amount] = ctx.match.slice(1);
  const multipliers = {
    '.': '',
    ',': '',
    'к': '000',
    'k': '000',
    'м': '000000',
    'm': '000000',
  };
  amount = amount.replace(/(\.|\,|k|m)/ig, (match) => multipliers[match.toLowerCase()] || match);

  if (/^вс[её]?$/.test(amount)) {
    amount = user.cookies;
  }


  if (amount < 5) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка от 5 печенек.`, { parse_mode: 'Markdown' });
  }

  if (user.cookies < amount) {
    let cookiesDiff = amount - user.cookies;
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${utils.sp(cookiesDiff)} печенек!\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  let multiplier = action === 'вверх' ? 1 : -1;
  let win = Math.random() >= 0.5;

  if (win) {
    user.cookies += amount * (1 + multiplier * Math.random());
    ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n⤴ • Вы угадали! Акции ${action === 'вверх' ? 'подорожали' : 'поднялись'} на ${Math.round(Math.random() * 100)} печенек.\n➕ • Вы получаете: ${utils.sp(amount)} печенек.\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  } else {
    user.cookies -= amount;
    ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n⤵ • Вы не угадали! Акции ${action === 'вверх' ? 'подешевели' : 'опустились'} на ${Math.round(Math.random() * 100)} печенек.\n➖ • Вы теряете ${utils.sp(amount)} печенек.\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  await user.save();
});


//монетка 


bot.hears(/^\.аз монетка\s?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз монетка <о/р> <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз монетка\s+(о|р)\s?([^]+|вс[её])?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }

  let [_, side, amount] = ctx.match;
  let bet = amount;

  const betRegex = /(\.|\,|к|k|м|m)/ig;
  const betReplacer = (match) => {
    switch (match.toLowerCase()) {
      case '.':
      case ',':
        return '';
      case 'к':
      case 'k':
        return '000';
      case 'м':
      case 'm':
        return '000000';
      default:
        return match;
    }
  };

  bet = bet.replace(betRegex, betReplacer);

  if (/^вс[её]?$/.test(bet)) {
    bet = user.cookies;
  } else {
    bet = parseInt(bet);
  }

  if (side !== 'о' && side !== 'р') {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Неверный выбор стороны монетки. Пожалуйста, выберите 'о' для орла или 'р' для решки.`, { parse_mode: 'Markdown' });
  }

  if (isNaN(bet)) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Неверная ставка. Пожалуйста, введите число.`, { parse_mode: 'Markdown' });
  }


  if (bet < 5) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка от 5 печенек.`, { parse_mode: 'Markdown' });
  }

  if (user.cookies < bet) {
    const cookiesDiff = bet - user.cookies;
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${utils.sp(cookiesDiff)} печенек!\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  const random = Math.floor(Math.random() * 2);
  const result = (random === 0) ? 'Орёл' : 'Решка';
  const isWin = (side === 'о' && random === 0) || (side === 'р' && random === 1);

  let emoticon = '';
  if (isWin) {
    user.cookies += bet;
    emoticon = (side === 'о') ? '🦅' : '🐿';
    ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n${emoticon} • На монетке выпала: ${result}\n➕ • Вы получаете ${utils.sp(bet)} печенек.\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  } else {
    user.cookies -= bet;
    emoticon = (side === 'о') ? '🐿' : '🦅';
    ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n${emoticon} • На монетке выпал: ${result}\n➖ • Вы теряете ${utils.sp(bet)} печенек.\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  await user.save();
});


//рулетка 

bot.hears(/^\.аз рулетка\s?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз рулетка <цвет> <ставка>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз рулетка ([ч|к|з])\s?([^]+|вс[её])?$/i, async (ctx) => {
  try {
    const user = await User.findOne({ telegramId: ctx.from.id });

    if (!user) {
      return ctx.reply('Вы не зарегистрирован в боте');
    }

    let [, color, bet] = ctx.match;
    if (color) color = color.replace(/\|/g, '').toLowerCase();

    const colors = {
      'ч': 'чёрное',
      'к': 'красное',
      'з': 'зелёное',
    };

    if (!colors[color]) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Вы ввели неверный цвет, доступные цвета: ч, к, з`, { parse_mode: 'Markdown' });
    }

    if (!bet || !bet.trim()) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте .аз рулетка <цвет> <ставка>`, { parse_mode: 'Markdown' });
    }

    const betReplacer = {
      '.': '',
      ',': '',
      'к': '000',
      'k': '000',
      'м': '000000',
      'm': '000000',
    };

    bet = bet.replace(/([.,кkмm])/gi, match => betReplacer[match.toLowerCase()] || match);
    bet = /^вс[её]?$/i.test(bet.trim()) ? user.cookies : parseInt(bet, 10);

    if (isNaN(bet) || bet < 5) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка от 5 печенек.`, { parse_mode: 'Markdown' });
    }

    const rouletteResults = ['ч', 'ч', 'ч', 'ч', 'ч', 'к', 'к', 'к', 'к', 'к', 'з'];
    const result = rouletteResults[Math.floor(Math.random() * rouletteResults.length)];
    const resultColor = colors[result];
    const isWin = (color === result);
    const betMultiplier = isWin ? (result === 'з' ? 11 : 2) : 0;
    const cookieDelta = isWin ? (result === 'з' ? bet * 11 : bet * 2) : -bet;

    // ⚡ Атомарная операция с проверкой баланса для предотвращения race condition
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: ctx.from.id, cookies: { $gte: bet } },
      { $inc: { cookies: cookieDelta } },
      { new: true }
    );

    if (!updatedUser) {
      const freshUser = await User.findOne({ telegramId: ctx.from.id });
      const currentCookies = freshUser?.cookies || 0;
      const cookiesDiff = bet - currentCookies;
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${utils.sp(cookiesDiff)} печенек!\n🍪 • Печенек: ${utils.sp(currentCookies)}`, { parse_mode: 'Markdown' });
    }

    const emoji = (result === 'ч') ? '🖤' : (result === 'к') ? '❤️' : '💚';
    const resultMessage = isWin ? '➕ • Вы получаете' : '➖ • Вы теряете';
    const betMessage = isWin ? bet * betMultiplier : bet;

    ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n${emoji} • На рулетке выпало: ${resultColor}\n${resultMessage}: ${utils.sp(betMessage)} печенек\n🍪 • Печенек: ${utils.sp(updatedUser.cookies)}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка в .аз рулетка:', error);
  }
});

//команда для проверку пинга

const os = require('os');

const stat = util.promisify(fs.stat);

const allocatedMemory = 512 * 1024 * 1024; // 512MB

bot.hears(/^\.(пинг|ping)/i, async (ctx) => {
  const start = Date.now();
  const msg = await ctx.reply('🏓 Pong!');
  const end = Date.now();
  const timeReceived = end - start;
  const timeSent = Math.abs(end - (msg.date * 1000));
  const time = new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
  const uptime = process.uptime();
  const used = process.memoryUsage().rss;
  const total = os.totalmem();
  const cpuPercent = await getCpuUsage();

  const usedMemoryMB = (used / 1048576).toFixed(2);
  const usedMemoryPercentage = ((used / allocatedMemory) * 100).toFixed(2);

  const allocatedMemoryMB = (allocatedMemory / 1048576).toFixed(2);
  const allocatedMemoryPercentage = ((used / allocatedMemory) * 100).toFixed(2);

  const replyText = `📥 • Получение: ${timeReceived.toFixed(0)} ms\n📤 • Отправка: ${timeSent} ms\n⏰ • Время: ${time} (МСК)\n💾 • Оперативка: ${usedMemoryMB}MB/${allocatedMemoryMB}MB (${usedMemoryPercentage}%)\n🤖 • ${formatUptime(uptime)}\n🖥 • CPU: ${cpuPercent}%`;

  ctx.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, replyText).catch((error) => {
    console.error('Error while editing the message:', error);
  });
});

// Функция для получения процента использования CPU
async function getCpuUsage() {
  return new Promise((resolve) => {
    const cpuStat = require('cpu-stat');
    cpuStat.usagePercent((err, percent) => {
      if (err) {
        console.error('Error while getting CPU usage:', err);
        resolve('N/A');
      } else {
        resolve(percent.toFixed(2));
      }
    });
  });
}

// Функция для форматирования времени работы бота
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${days}д. ${hours}ч. ${minutes}м. ${seconds}с.`;
}


// Canvas imported at top

function countLines(text) {
  return text.split('\n').length;
}

bot.hears(/^\.цитата\s*([\s\S]*)?/i, async (ctx) => {
  try {
    let user = await User.findOne({ telegramId: ctx.from.id });
    let quoteText = '';
    let authorUser = ctx.from;

    if (ctx.message.reply_to_message) {
      authorUser = ctx.message.reply_to_message.from || ctx.from;
      quoteText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || ctx.match[1];
    } else {
      quoteText = ctx.match[1];
    }

    if (!quoteText || typeof quoteText !== 'string' || !quoteText.trim()) {
      return ctx.reply('❌ Укажите текст для цитаты или используйте команду в ответ на сообщение!');
    }

    let authorName = authorUser.first_name || authorUser.username || 'Пользователь';
    // Проверим, есть ли автор в базе User
    const dbAuthor = await User.findOne({ telegramId: authorUser.id });
    if (dbAuthor?.nickname) {
      authorName = dbAuthor.nickname;
    }

    let avatarUrl = null;
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(authorUser.id, 0, 1);
      if (photos && photos.total_count > 0) {
        const link = await ctx.telegram.getFileLink(photos.photos[0][photos.photos[0].length - 1].file_id);
        avatarUrl = link.href || link;
      }
    } catch (e) {
      // Игнорируем сетевые ошибки получения аватара - будет красивый fallback-градиент
    }

    const now = new Date();
    const timeOptions = { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' };
    const timestamp = new Intl.DateTimeFormat('ru-RU', timeOptions).format(now);

    const quoteBuffer = await generateQuoteCard({
      text: quoteText.trim(),
      authorName,
      authorAvatarUrl: avatarUrl,
      timestamp
    });

    return ctx.replyWithPhoto({ source: quoteBuffer });
  } catch (error) {
    console.error('Ошибка в .цитата:', error);
    ctx.reply('❌ Ошибка при создании цитаты.');
  }
});


/*
bot.hears(/^\.сдб\s*(.+)?/i, async (ctx) => {
const user = await User.findOne({ telegramId: ctx.from.id });

const replyName = ctx.message.reply_to_message?.from.first_name || user.firstName;

registerFont("./Circe Rounded Alt Extra Bold/Circe Rounded Alt Extra Bold.ttf", { family: 'Futura' })

const canvasHeight = 1811;
const canvas = createCanvas(2560, canvasHeight);
const ctx2d = canvas.getContext('2d');

const imgLink = 'https://cdn.glitch.global/99a45add-1a89-40b6-b929-74f2b26500fb/photo_2023-06-05_23-25-08.png?v=1685999344324';
const img = await loadImage(imgLink);
ctx2d.drawImage(img, 0, 0, 2560, canvasHeight);

const noAvatar = 'https://okeygeek.ru/wp-content/uploads/2020/03/no_avatar.png';
const userId = ctx.message.reply_to_message?.from?.id || ctx.message.from.id;
const userProfilePhotos = await ctx.telegram.getUserProfilePhotos(userId);

if (userProfilePhotos.total_count > 0) {
    const avatarLink = await ctx.telegram.getFileLink(userProfilePhotos.photos[0][userProfilePhotos.photos[0].length-1]);
    const href = avatarLink.href;
    if (href) {
        try {
            const avatar = await loadImage(href);
            const radius = 110;
            ctx2d.save();
            ctx2d.beginPath();
            ctx2d.arc(radius + canvas.width/2.3 + 7, radius +canvas.height/3.3 + 1, radius, 0, Math.PI * 2, true);
            ctx2d.closePath();
            ctx2d.clip();
            ctx2d.drawImage(avatar, canvas.width/2.3 + 7, canvas.height/3.3 + 1, 230, 230);
            ctx2d.restore();
        } catch (err) {
            console.error('Failed to load avatar image:', err.message);
        }
      }
    } else {
        console.warn('No avatar image found for user');

        const defaultAvatar = await loadImage(noAvatar);
        const radius = 110;
        ctx2d.save();
        ctx2d.beginPath();
        ctx2d.arc(radius + canvas.width/2.3 + 7, radius +canvas.height/3.3 + 1, radius, 0, Math.PI * 2, true);
        ctx2d.closePath();
        ctx2d.clip();
        ctx2d.drawImage(defaultAvatar, canvas.width/2.3 + 7, canvas.height/3.3 + 1, 230, 230);
        ctx2d.restore();
    }

    ctx2d.font = '50px "Futura"';
    ctx2d.fillStyle = 'white';
    ctx2d.fillStyle = 'black'; // Устанавливаем черный цвет
    ctx2d.textAlign = 'center';
    ctx2d.fillText(`${replyName}`, canvas.width/2.1 + 10, canvas.height/2.1);

    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate()}.${currentDate.getMonth() + 1}.${currentDate.getFullYear()}`;
    // Форматирование времени в формате Московского времени
    const options = { timeZone: 'Europe/Moscow', hour: 'numeric', minute: 'numeric', hour12: false };
    const formatter = new Intl.DateTimeFormat('default', options);
    const formattedTime = formatter.format(currentDate);


    ctx2d.font = 'bold 50px "Futura"';
    ctx2d.fillStyle = 'black'; // Устанавливаем черный цвет
    ctx2d.fillText(`${formattedDate} ${formattedTime}`, canvas.width/2.9 + 10, canvasHeight/1.2 + 25);

    const image = canvas.toBuffer('image/png');
    await ctx.replyWithPhoto({ source: image }, { caption: `Воть` });
}); */

bot.hears(/^\.сдб\s*(@\w+)?$/i, async (ctx) => {
  try {
    const mentionedUsername = ctx.match[1];
    let userProfilePhotos, userId, replyName;
    const user = await User.findOne({ telegramId: ctx.from.id });

  if (ctx.message.reply_to_message) {
    userId = ctx.message.reply_to_message.from.id;
    replyName = ctx.message.reply_to_message.from.first_name;
    userProfilePhotos = await ctx.telegram.getUserProfilePhotos(userId);
  } else if (mentionedUsername) {
    const username = mentionedUsername.substring(1);
    const user = await User.findOne({ username });

    if (!user) {
      await ctx.reply('🏮 • Не удалось найти пользователя. Проверьте правильность указанного имени пользователя или ответьте на сообщение пользователя.');
      return;
    }

    userId = user.telegramId;
    replyName = user.firstName;
    userProfilePhotos = await ctx.telegram.getUserProfilePhotos(user.telegramId);
  } else {
    await ctx.reply('🏮 • Не удалось найти пользователя. Пожалуйста, используйте упоминание пользователя, например: @admin, или ответьте на сообщение пользователя.');
    return;
  }

  // Font registered at startup

  const canvasHeight = 1811;
  const canvas = createCanvas(2560, canvasHeight);
  const ctx2d = canvas.getContext('2d');

  const imgLink = 'https://cdn.glitch.global/99a45add-1a89-40b6-b929-74f2b26500fb/photo_2023-06-05_23-25-08.png?v=1685999344324';
  const img = await loadImage(imgLink);
  ctx2d.drawImage(img, 0, 0, 2560, canvasHeight);

  const noAvatar = 'https://okeygeek.ru/wp-content/uploads/2020/03/no_avatar.png';

  if (userProfilePhotos.total_count > 0) {
    const avatarLink = await ctx.telegram.getFileLink(userProfilePhotos.photos[0][userProfilePhotos.photos[0].length - 1]);
    const href = avatarLink.href;
    if (href) {
      try {
        const avatar = await loadImage(href);
        const radius = 110;
        ctx2d.save();
        ctx2d.beginPath();
        ctx2d.arc(radius + canvas.width / 2.3 + 7, radius + canvas.height / 3.3 + 1, radius, 0, Math.PI * 2, true);
        ctx2d.closePath();
        ctx2d.clip();
        ctx2d.drawImage(avatar, canvas.width / 2.3 + 7, canvas.height / 3.3 + 1, 230, 230);
        ctx2d.restore();
      } catch (err) {
        console.error('Failed to load avatar image:', err.message);
      }
    }
  } else {
    console.warn('No avatar image found for user');

    const defaultAvatar = await loadImage(noAvatar);
    const radius = 110;
    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.arc(radius + canvas.width / 2.3 + 7, radius + canvas.height / 3.3 + 1, radius, 0, Math.PI * 2, true);
    ctx2d.closePath();
    ctx2d.clip();
    ctx2d.drawImage(defaultAvatar, canvas.width / 2.3 + 7, canvas.height / 3.3 + 1, 230, 230);
    ctx2d.restore();
  }

  ctx2d.font = '50px "Futura"';
  ctx2d.fillStyle = 'black';
  ctx2d.textAlign = 'center';
  ctx2d.fillText(`${replyName}`, canvas.width / 2.1 + 10, canvas.height / 2.1);

  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  // Функция для добавления нуля перед числом, если оно меньше 10
  const addLeadingZero = (number) => {
    return number < 10 ? `0${number}` : number.toString();
  };

  const formattedDate = `${addLeadingZero(day)}.${addLeadingZero(month)}.${year}`;

  const options = { timeZone: 'Europe/Moscow', hour: 'numeric', minute: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat(undefined, options);
  const formattedTime = formatter.format(currentDate);

  ctx2d.font = '50px "Futura"';
  ctx2d.fillText(`${formattedDate} ${formattedTime}`, canvas.width / 2.9 + 10, canvasHeight / 1.2 + 25);


  const image = canvas.toBuffer('image/png');
  const caption = `[${user.nickname}](tg://user?id=${user.id}),\nВоть`;
  await ctx.replyWithPhoto({ source: image }, { caption, parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Ошибка в .сдб:", error);
  }
});

// ==========================================
// ИНТЕГРАЦИЯ GOOGLE GEMINI AI (.gpt / .ai)
// ==========================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Определение схемы и модели диалогов
const dialoggptSchema = new Mongoose.Schema({
  userId: { type: String, required: true, index: true },
  messages: Array,
  createdAt: { type: Date, default: Date.now }
});

// ⚡ TTL-индекс для автоматической очистки старых диалогов через 7 дней (604800 сек)
dialoggptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const Dialoggpt = Mongoose.model('Dialoggpt', dialoggptSchema);

// Функция обращения к Google Gemini API
async function askGemini(prompt, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
  }

  // Преобразуем историю диалога в формат Gemini
  const contents = [];
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg && msg.role && msg.content) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(msg.content) }]
        });
      }
    }
  }

  // Добавляем текущий запрос пользователя
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;

  const response = await axios.post(url, {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  const candidate = response.data?.candidates?.[0];
  const replyText = candidate?.content?.parts?.[0]?.text;
  if (!replyText) {
    throw new Error('Не удалось получить ответ от Gemini API');
  }
  return replyText;
}

// Справка по командам нейросети
bot.hears(/^\.(gpt|ai|гемини)\s?$/i, async (ctx) => {
  const message = '💡 • Пример команды: `.gpt привет` или `.ai расскажи факт`\n🤖 Бот работает на базе **Google Gemini 1.5 Flash**!\n🗑 Для сброса контекста: `.new`';
  return ctx.reply(message, { parse_mode: 'Markdown' });
});

// Сброс контекста диалога
bot.hears(/^\.new\s?$/i, async (ctx) => {
  const userId = ctx.from.id;
  try {
    await Dialoggpt.deleteMany({ userId: String(userId) });
    await ctx.reply('🧹 Диалог сброшен. Теперь вы можете начать новый разговор с Gemini.');
  } catch (e) {
    console.error('Ошибка сброса диалога:', e.message);
    await ctx.reply('При очистке диалога произошла ошибка. Пожалуйста, повторите попытку позже.');
  }
});

const MAX_MESSAGE_LENGTH = 4000;

function calculateTimeUntilReset(lastRequestTime, currentTime) {
  const nextDay = new Date(lastRequestTime);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  const timeUntilReset = new Date(nextDay - currentTime);
  const hours = timeUntilReset.getUTCHours();
  const minutes = timeUntilReset.getUTCMinutes();
  const seconds = timeUntilReset.getUTCSeconds();

  return `${hours} ч. ${minutes} м. ${seconds} с.`;
}

// Обработка текстовых запросов к Gemini
bot.hears(/^\.(gpt|ai|гемини)\s([\s\S]*)$/mi, async (ctx) => {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });
  const currentTime = Date.now();
  const minTimeBetweenRequests = 5 * 1000; // 5 секунд

  if (!user) {
    return ctx.reply('Вы не зарегистрированы в боте.');
  }

  if (user.userRequestInfo.lastRequestTime) {
    const timeSinceLastRequest = currentTime - user.userRequestInfo.lastRequestTime;
    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const remainingTime = Math.ceil((minTimeBetweenRequests - timeSinceLastRequest) / 1000);
      return ctx.reply(`⏳ Пожалуйста, подождите ещё ${remainingTime} сек. перед следующим запросом.`);
    }
  }

  const waitMessage = await ctx.reply('⌛️ Gemini думает над ответом...');

  try {
    const message = ctx.match[2];

    if (user.userRequestInfo.gptcoin <= 0) {
      const timeUntilReset = calculateTimeUntilReset(user.userRequestInfo.lastRequestTime, currentTime);
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMessage.message_id);
      return ctx.reply(`Вы исчерпали свои GPTCoin. Сброс лимита через: ${timeUntilReset}.`);
    }

    user.userRequestInfo.gptcoin--;
    user.userRequestInfo.lastRequestTime = currentTime;
    await user.save();

    await processMessage(ctx, waitMessage, userId, message);
  } catch (e) {
    console.error('Ошибка в обработчике GPT:', e.message);
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMessage.message_id);
    } catch (_) {}
    await ctx.reply('Произошла ошибка при обработке запроса.');
  }
});

async function processMessage(ctx, waitMessage, userId, message) {
  const dialog = await Dialoggpt.findOne({ userId: String(userId) });
  let messageHistory = dialog && Array.isArray(dialog.messages) ? dialog.messages : [];

  try {
    const answer = await askGemini(message, messageHistory);

    // Сохраняем диалог (до 20 сообщений в контексте)
    if (dialog) {
      if (dialog.messages.length >= 20) {
        dialog.messages.shift();
        dialog.messages.shift();
      }
      dialog.messages.push({ role: 'user', content: message });
      dialog.messages.push({ role: 'assistant', content: answer });
      await dialog.save();
    } else {
      const newDialog = new Dialoggpt({
        userId: String(userId),
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: answer }
        ]
      });
      await newDialog.save();
    }

    let user = await User.findOne({ telegramId: ctx.from.id });
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🗑 Сбросить диалог', callback_data: `cancel:${ctx.from.id}` }
        ]
      ]
    };

    const gptcoins = user?.userRequestInfo?.gptcoin ?? 0;
    const userNick = user?.nickname || 'Пользователь';

    // Форматируем ответ безопасно
    const messageText = `[${userNick}](tg://user?id=${ctx.from.id}),\n<b>👤 Вопрос:</b> ${message}\n\n<b>🤖 Ответ (Gemini):</b>\n${answer}\n\n📤 <b>Осталось:</b> ${gptcoins} GptCoin.`;

    await ctx.telegram.deleteMessage(ctx.chat.id, waitMessage.message_id);
    await ctx.reply(messageText, { parse_mode: 'HTML', reply_markup: inlineKeyboard });
  } catch (error) {
    console.error('Ошибка вызова Gemini:', error.response?.data || error.message);
    let errMsg = 'При генерации ответа через Gemini произошла ошибка.';
    const apiError = error.response?.data?.error?.message;
    if (apiError) {
      errMsg += `\n⚠️ Причина: ${apiError}`;
    }
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMessage.message_id);
    } catch (_) {}
    await ctx.reply(errMsg);
  }
}

bot.action(/^cancel:(\d+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const message_id = ctx.update.callback_query.message.message_id;
  const userIdFromCallback = parseInt(ctx.match[1], 10);

  // Проверяем, что владелец запроса совпадает с userId
  const dialog = await Dialoggpt.findOne({ userId: userId });

  if (dialog) {
    if (userId === userIdFromCallback) {
      dialog.messages.pop(); // Удаляем последний ответ
      dialog.messages.pop(); // Удаляем последний вопрос пользователя
      await dialog.save();

      // Отправляем сообщение об отмене запроса
      const user1 = await User.findOne({ telegramId: userId });
      const cancelMessage = `[${user1.nickname}](tg://user?id=${userId}),\nВаш запрос был отменен.`;

      // Используем метод editMessageText для редактирования сообщения
      await ctx.telegram.editMessageText(ctx.chat.id, message_id, null, cancelMessage, {
        parse_mode: 'Markdown'
      });
    } else {
      // Если владелец запроса не совпадает с userId, отправляем уведомление об ошибке
      const errorMessage = 'Вы не можете отменить этот запрос, так как он не ваш.';
      await ctx.answerCbQuery(errorMessage);
    }
  } else {
    // Если владелец запроса не совпадает с userId, отправляем уведомление об ошибке
    const errorMessage = 'У вас нет активный диалог с GPT.';
    await ctx.answerCbQuery(errorMessage);
  }
});


function splitTextIntoChunks(text, chunkSize) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);
    startIndex = endIndex;
  }

  return chunks;
}


/*function splitTextIntoChunks(text, chunkSize) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);
    startIndex = endIndex;
  }

  return chunks;
}*/


// Схема и модель для бонусов
const bonusSchema = new Mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  bonusUsed: { type: Boolean, default: false }
});

const Bonus = Mongoose.model('Bonus', bonusSchema);

// Обработка команды ".g бонус"
bot.hears(/^\.g бонус\s?$/i, async (ctx) => {
  try {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const bonusRecord = await Bonus.findOne({ telegramId: ctx.from.id });

    if (bonusRecord) {
      if (bonusRecord.bonusUsed) {
        return ctx.reply("Вы уже использовали бонус. Вы можете получить бонус только 1 раз.");
      } else {
        // Выдаем бонус
        user.userRequestInfo.gptcoin += 1000;

        // Обновляем флаг использования бонуса
        bonusRecord.bonusUsed = true;

        // Сохраняем обновленные данные в базе данных
        await user.save();
        await bonusRecord.save();

        return ctx.reply(`Вы получили бонус 1000 GptCoin. Вы можете получить бонус только 1 раз.`, { parse_mode: 'Markdown' });
      }
    } else {
      // Создаем запись в коллекции Bonus, если пользователя нет в базе
      const newBonusRecord = new Bonus({ telegramId: ctx.from.id, bonusUsed: true });
      await newBonusRecord.save();

      // Выдаем бонус
      user.userRequestInfo.gptcoin += 1000;

      // Сохраняем обновленные данные пользователя
      await user.save();

      return ctx.reply("Вы получили бонус 1000 GptCoin. Вы можете получить бонус только 1 раз.", { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error(`Ошибка: ${error.message}`);
    return ctx.reply("Произошла ошибка при выдаче бонуса");
  }
});


// Запускаем генерацию промокода каждые 10 минут
// Define variables outside the interval scope
/*
let num1, num2, answer;

// Function to generate random equation and answer
function generateEquation() {
    num1 = Math.floor(Math.random() * (9999 - 1111 + 1) + 1111);
    num2 = Math.floor(Math.random() * (9999 - 1111 + 1) + 1111);
    answer = num1 + num2;
}

// Initial generation of equation and answer
generateEquation();

setInterval(() => {
    bot.telegram.sendMessage('@chatgrizzlygame', 'Генерация промокода...');

    // Generate a new equation and answer every 10 minutes
    generateEquation();

    // Wait 1 minute before sending the question
    setTimeout(() => {
        bot.telegram.sendMessage('@chatgrizzlygame', ` ${num1} + ${num2}=?\n\n🍀 • Введите ответ в формате .викторина [ответ]`);
    }, 60000);
}, 600000); // Use 600000 (10 minutes) instead of 3600000 (1 hour) 

// Handle user responses
bot.hears(/^.викторина (\d+)$/i, async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        return ctx.reply('Вы не зарегистрированы в боте');
    }

    let userAnswer = parseInt(ctx.match[1]);
    if (userAnswer === answer) {
        let prize = Math.round(0.00001 * user.cookies);
        user.cookies += prize;
        await user.save();
        ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),
        🍀 • Вы верно ответили на вопрос!
        🍪 • На Ваш баланс было зачислено ${prize} печенек`, { parse_mode: 'Markdown' });
    } else {
        ctx.reply('Неправильный ответ!');
    }
}); 
*/

bot.hears(/^[.!\/]?аз бонус\s*$/i, async (ctx) => {
  try {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // ⚡ Атомарная проверка кулдауна и начисление бонуса
    const updatedUser = await User.findOneAndUpdate(
      {
        telegramId: ctx.from.id,
        $or: [
          { lastBonusTime: { $exists: false } },
          { lastBonusTime: null },
          { lastBonusTime: { $lte: cutoffDate } }
        ]
      },
      {
        $inc: { cookies: 50000 },
        $set: { lastBonusTime: new Date() }
      },
      { new: true }
    );

    if (!updatedUser) {
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        return ctx.reply('Вы не зарегистрированы в боте.');
      }
      const lastBonusMs = user.lastBonusTime ? new Date(user.lastBonusTime).getTime() : 0;
      const timeLeftMs = Math.max(0, (lastBonusMs + 24 * 60 * 60 * 1000) - Date.now());
      const timeLeft = new Date(timeLeftMs);
      const safeNick = (user.nickname || user.firstName || 'Игрок').replace(/[\[\]]/g, '');
      return ctx.reply(`[${safeNick}](tg://user?id=${ctx.from.id}),\n🎁 • Следующий бонус будет доступен через ${timeLeft.getUTCHours() > 0 ? `${timeLeft.getUTCHours()}ч.` : ''}${timeLeft.getUTCMinutes()}м.${timeLeft.getUTCSeconds()}с.`, { parse_mode: 'Markdown' });
    }

    const safeNick = (updatedUser.nickname || updatedUser.firstName || 'Игрок').replace(/[\[\]]/g, '');
    ctx.reply(`[${safeNick}](tg://user?id=${ctx.from.id}),\n🎁 • Вы получили бонус в размере 50.000\n🍪 • Баланс: ${utils.sp(updatedUser.cookies)}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Ошибка в .аз бонус:", error);
  }
});

bot.hears('.аз топ', async (ctx) => {
  try {
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
      return ctx.reply('Вы не зарегистрирован в боте');
    }
    // Получаем список пользователей по убыванию печенек (с ограничением до 10)
    const users = await User.find().sort('-cookies').limit(10);

    // Формируем ответное сообщение
    let message = '💰 Топ 10 богатых игроков:\n';
    users.forEach((user, index) => {
      let nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) + '' : user.nickname;
      message += `${index + 1}. [${nickname}](tg://user?id=${user.telegramId}) 🍪 ${utils.rn(user.cookies)} \n`;
    });

    // Отправляем сообщение пользователю
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error("Ошибка при получении топа игроков:", err);
    ctx.reply('Произошла ошибка при получении топа игроков');
  }
});


//рп команды

bot.on('text', async (ctx, next) => {
  try {
    const { text } = ctx.message;
  const reply = ctx.message.reply_to_message;
  const commands = {
    "поцеловать": {
      name: "поцеловать",
      response: "поцеловал(а)",
      emoji: "😘",
    },
    "обнять": {
      name: "обнять",
      response: "обнял(а)",
      emoji: "🤗",
    },
    "засосать": {
      name: "засосать",
      response: "засосал(а)",
      emoji: "💋",
    },
    "ударить": {
      name: "ударить",
      response: "ударила(а)",
      emoji: "👊",
    },
    "изнасиловать": {
      name: "изнасиловать",
      response: "жёстко изнасиловал(а) в сладкие дырочки",
      emoji: "👉👌",
    },
    "отсосать": {
      name: "отсосать",
      response: "отсосал(а) у",
      emoji: "😗",
    },
    "отлизать": {
      name: "отлизать",
      response: "отлизал(а) у",
      emoji: "👅",
    },
    "кусь": {
      name: "кусь",
      response: "укусил(а)",
      emoji: "💢",
    },
    "хрусь": {
      name: "хрусь",
      response: "похрустел(а) костяшками",
      emoji: "🦴",
    },
    "пнуть": {
      name: "пнуть",
      response: "пнул(а) поджопника",
      emoji: "👞",
    },
    "пощекотать": {
      name: "пощекотать",
      response: "пощекотал(а)",
      emoji: "🙌",
    },
    "залезть": {
      name: "залезть",
      response: "залез(ла) в трусики к",
      emoji: "👙",
    },
    "сесть": {
      name: "сесть",
      response: "сел(а) на лицо",
      emoji: "😈",
    },
    "лап": {
      name: "лап",
      response: "полапал(а)",
      response2: "за интимные места",
      emoji: "🫴",
    },
    "отдаться": {
      name: "отдаться",
      response: "отдался(ась)",
      emoji: "💝",
    },
    "покормить": {
      name: "покормить",
      response: "покормил(a)",
      emoji: "🍕",
    },
    "погладить": {
      name: "погладить",
      response: "погладил(a)",
      emoji: "👋",
    },
    "шлеп": {
      name: "шлеп",
      response: "отшлепал(а)",
      response2: "за попку",
      emoji: "✋",
    }
  }

  const lines = text.trim().split('\n');
  const command = Object.values(commands).find(cmd => lines[0].toLowerCase().startsWith(cmd.name));
  if (!command) return next();

  const { name, response, response2, emoji } = command;
  const targetMessage = lines.length > 1 ? lines[1] : '';

  const mentionRegex = /@\w+/g;
  const mentions = text.match(mentionRegex);

  if (mentions && mentions.length > 0) {
    // Обрабатываем каждое упоминание
    for (const mention of mentions) {
      const username = mention.substring(1); // Удаляем "@" из имени пользователя
      // Далее вы можете найти пользователя по его username и использовать его идентификатор в обработчике команды
      const mentionedUser = await User.findOne({ username });
      if (mentionedUser) {
        // Проверка, является ли отправитель команды создателем команды
        const user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) { return ctx.reply('Вы не зарегистрированы в боте'); }
        if (!mentionedUser) { return ctx.reply('Пользователь не зарегистрирован в боте'); }
        let nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) + '' : user.nickname;
        let nickname2 = mentionedUser.nickname.length > 14 ? mentionedUser.nickname.substring(0, 14) + '' : mentionedUser.nickname;

        let responseMessage = `${emoji} | [${nickname}](tg://user?id=${user.telegramId}) ${response} [${nickname2}](tg://user?id=${mentionedUser.telegramId}) ${response2 ? `${response2}` : ''}`;
        if (targetMessage) responseMessage += `\n💬 С репликой: « ${targetMessage} »`;
        ctx.reply(responseMessage, {
          parse_mode: 'Markdown',
          reply_to_message_id: ctx.message.message_id
        });
      }
    }
  }

  if (reply) {
    const { from, message_id } = reply;
    const user = await User.findOne({ telegramId: ctx.from.id });
    const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
    if (!user) { return ctx.reply('Вы не зарегистрированы в боте'); }
    if (!user2) { return ctx.reply(`${ctx.message.reply_to_message.from.first_name} не зарегистрирован в боте`); }
    let nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) + '' : user.nickname;
    let nickname2 = user2.nickname.length > 14 ? user2.nickname.substring(0, 14) + '' : user2.nickname;

    let responseMessage = `${emoji} | [${nickname}](tg://user?id=${user.telegramId}) ${response} [${nickname2}](tg://user?id=${ctx.message.reply_to_message.from.id}) ${response2 ? `${response2}` : ''}`;
    if (targetMessage) responseMessage += `\n💬 С репликой: « ${targetMessage} »`;
    ctx.reply(responseMessage, {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } else if (!mentions && !reply) {
    // ctx.reply(`Чтобы использовать эту команду, пожалуйста, ответьте на сообщение пользователя или укажите @username, на которого вы хотите использовать ${name}`);
    return;
  }
  } catch (error) {
    console.error("Ошибка в обработчике встроенных RP команд:", error);
  }
});

//создание рп команды

// Создание схемы для хранения команд
const RpCommandSchema = new Mongoose.Schema({
  creatorId: { type: Number, required: true },
  name: { type: String, required: true },
  response: { type: String, required: true },
  response2: { type: String },
  emoji: { type: String }
});

// ⚡ Индексы для быстрого поиска команд
RpCommandSchema.index({ creatorId: 1, name: 1 });
RpCommandSchema.index({ name: 1 });

// Модель команды
const RpCommand = Mongoose.model('RpCommand', RpCommandSchema);

// ⚡ Кэш RP-команд в Map в оперативной памяти (ликвидация сканирования базы на каждое сообщение)
let rpCommandsMap = null; // Map<Number, Array<RpCommand>> по creatorId
let rpCommandsCache = null; // Все команды

async function getCachedRpCommands() {
  if (rpCommandsMap !== null) {
    return rpCommandsCache;
  }
  const commands = await RpCommand.find({}).lean();
  const map = new Map();
  for (const cmd of commands) {
    const list = map.get(cmd.creatorId) || [];
    list.push(cmd);
    map.set(cmd.creatorId, list);
  }
  rpCommandsCache = commands;
  rpCommandsMap = map;
  return rpCommandsCache;
}

function getRpCommandsByCreator(creatorId) {
  if (!rpCommandsMap) return [];
  return rpCommandsMap.get(creatorId) || [];
}

function invalidateRpCommandsCache() {
  rpCommandsMap = null;
  rpCommandsCache = null;
}

// Обработчик текстовых сообщений
bot.on('text', async (ctx, next) => {
  try {
    const { text } = ctx.message;
    const reply = ctx.message.reply_to_message;
    const user = ctx.state.user || await User.findOne({ telegramId: ctx.from.id });

    // ⚡ Инициализация кэша команд (при необходимости)
    await getCachedRpCommands();

    const lines = text.trim().split('\n');
  const command = lines[0].toLowerCase();

  if (command.startsWith('.срп')) {

    // Создание рп-команды
    const match = command.match(/\.срп\s+(.+?)\s*\/\s*([^\/\s]*)\s*\/\s*(.*)/i);

    // Проверка наличия всех необходимых параметров
    if (!match || match.length < 4) {
      ctx.reply('✖️ Используйте .срп <команда> / <смайлик> / <текст>');
      return;
    }

    const [, name, emoji, response] = match;

    // Проверка наличия команды с таким же именем
    const existingCommand = await RpCommand.findOne({ creatorId: ctx.from.id, name: name.trim() });
    if (existingCommand) {
      ctx.reply('✖️ У вас уже есть такая рп комманда, выберите другую комманду');
      return;
    }

    // Проверка наличия %a и %s в тексте команды
    if (!/%a/.test(response) || !/%s/.test(response)) {
      ctx.reply(`✖️ Вы не указали положение имён в тексте!
      %a - Ваше имя
      %s - Имя к кому применяется

      \\n - для переноса строки(не обязательно)

      Пример: .срп кусь/👹/ %a укусил(а) %s в сладкую шейку`);
      return;
    }
    const existingCommands = ['поцеловать', 'обнять', 'засосать', 'ударить', 'изнасиловать', 'отсосать', 'отлизать', 'кусь', 'хрусь', 'пнуть', 'пощекотать', 'залезть', 'сесть', 'лап', 'отдаться', 'покормить', 'погладить', 'шлеп'];
    if (existingCommands.includes(name.toLowerCase())) {
      ctx.reply('✖️ Такая команда уже существует в боте, пожалуйста используйте другую.');
      return;
    }

    // Создание новой команды
    const newCommand = new RpCommand({
      creatorId: ctx.from.id,
      name: name.trim(),
      emoji: emoji.trim(),
      response: response.trim().replace(/\\n/g, '\n')
    });

    // Сохранение команды в базе данных
    await newCommand.save();
    invalidateRpCommandsCache();

    ctx.reply(`✅ Новая рп-комманда добавлена`);
  } else if (command === '.мрп') {
    // Показ списка созданных рп-команд
    const userCommands = getRpCommandsByCreator(ctx.from.id);
    if (userCommands.length === 0) {
      ctx.reply('✖️ Вы ещё не создавали рп-команд');
      return;
    }

    let commandList = '⚪️ Список ваших рп-команд:\n';
    userCommands.forEach((cmd, index) => {
      const { name, response, emoji } = cmd;
      const formattedResponse = response.replace('%a', '{user}').replace('%s', '{target}');
      commandList += `${index + 1}. ${name} ➝ ${emoji} | ${formattedResponse}\n`;
    });

    ctx.reply(commandList);
  } else if (command.startsWith('.урп')) {
    // Удаление рп-команды
    const match = command.match(/\.урп\s+(.+)/i);
    // Проверка наличия всех необходимых параметров
    if (!match || match.length < 1) {
      ctx.reply('✖️ Используй .урп <рп-команда> для удаления рп команды');
      return;
    }
    const [, name] = match;

    // Поиск команды в базе данных
    const userCommand = await RpCommand.findOne({ creatorId: ctx.from.id, name: name.trim() });

    if (!userCommand) {
      ctx.reply('✖️ У вас нет такой рп-команды, для просмотра своих рп-команд введите .мрп');
      return;
    }

    // Удаление команды из базы данных
    await RpCommand.deleteOne({ _id: userCommand._id });
    invalidateRpCommandsCache();

    ctx.reply(`✅ Рп команда успешно удалена.`);

  } else {

    // Обработка других текстовых сообщений
    if (!user) return next();
    // ⚡ O(1) поиск только среди команд создателя текущей команды
    const userCommands = getRpCommandsByCreator(user.telegramId);
    const cmd = userCommands.find(cmd => command.startsWith(cmd.name.toLowerCase()));
    if (!cmd) return next();

    const { name, response, response2, emoji } = cmd;
    const targetMessage = lines.length > 1 ? lines[1] : '';

    const mentionRegex = /@\w+/g;
    const mentions = text.match(mentionRegex);

    const getSafeNick = (u) => ((u?.nickname || u?.firstName || 'Пользователь') + '').replace(/[\[\]]/g, '');

    if (mentions && mentions.length > 0) {
      // Обрабатываем каждое упоминание
      for (const mention of mentions) {
        const username = mention.substring(1); // Удаляем "@" из имени пользователя
        const mentionedUser = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (mentionedUser) {
          const rawNick1 = getSafeNick(user);
          const rawNick2 = getSafeNick(mentionedUser);
          let nickname = rawNick1.length > 14 ? rawNick1.substring(0, 14) : rawNick1;
          let nickname2 = rawNick2.length > 14 ? rawNick2.substring(0, 14) : rawNick2;
          let formattedResponse = response
            .replace(/%a/g, `[${nickname}](tg://user?id=${user.telegramId})`)
            .replace(/%s/g, `[${nickname2}](tg://user?id=${mentionedUser.telegramId})`);

          let responseMessage = `${emoji} | ${formattedResponse} ${response2 ? `${response2}` : ''}`;
          if (targetMessage) responseMessage += `\n💬 С репликой: « ${targetMessage} »`;
          ctx.reply(responseMessage, {
            parse_mode: 'Markdown',
            reply_to_message_id: ctx.message.message_id
          });
        }
      }
    }

    if (reply) {
      const { from, message_id } = reply;

      const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
      if (!user2) {
        ctx.reply(`${ctx.message.reply_to_message.from.first_name || 'Пользователь'} не зарегистрирован в боте`);
        return;
      }

      const rawNick1 = getSafeNick(user);
      const rawNick2 = getSafeNick(user2);
      let nickname = rawNick1.length > 14 ? rawNick1.substring(0, 14) : rawNick1;
      let nickname2 = rawNick2.length > 14 ? rawNick2.substring(0, 14) : rawNick2;

      let formattedResponse = response
        .replace(/%a/g, `[${nickname}](tg://user?id=${user.telegramId})`)
        .replace(/%s/g, `[${nickname2}](tg://user?id=${ctx.message.reply_to_message.from.id})`);

      let responseMessage = `${emoji} | ${formattedResponse} ${response2 ? `${response2}` : ''}`;
      if (targetMessage) responseMessage += `\n💬 С репликой: « ${targetMessage} »`;
      ctx.reply(responseMessage, {
        parse_mode: 'Markdown',
        reply_to_message_id: message_id
      });
    } else if (!mentions && !reply) {
      return;
    }
  }
  } catch (error) {
    console.error("Ошибка в обработчике кастомных RP команд:", error);
  }
});


// Команда резервного копирования удалена в целях безопасности
//команды мут/бан
bot.hears(/\.ban (\d+) (час|минут|минуты|минута)$/i, async (ctx) => {
  try {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.from) {
      return ctx.reply('❌ Ответьте на сообщение пользователя, которого хотите заблокировать.');
    }
    const user = await User.findOne({ telegramId: ctx.from.id });
    const targetId = ctx.message.reply_to_message.from.id;
    const user2 = await User.findOne({ telegramId: targetId });
    const targetNickname = ((user2?.nickname || ctx.message.reply_to_message.from.first_name || 'Пользователь') + '').replace(/[\[\]]/g, '');
    const time = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const chatId = ctx.message.chat.id;
    const until = new Date();
    const chatLink = `https://t.me/${ctx.chat.username}`;

    const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
    if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
      ctx.reply('Вы не являетесь модератором чата.');
      return;
    }

    const targetMember = await bot.telegram.getChatMember(chatId, targetId);
    if (['administrator', 'creator'].includes(targetMember.status)) {
      ctx.reply('Вы не можете заблокировать другого модератора.');
      return;
    }

    if (unit === 'час') {
      until.setHours(until.getHours() + time);
    } else if (unit === 'минута' || unit === 'минуты' || unit === 'минут') {
      until.setMinutes(until.getMinutes() + time);
    }

    await bot.telegram.kickChatMember(chatId, targetId, {
      until_date: until.getTime() / 1000
    });

    setTimeout(() => {
      bot.telegram.unbanChatMember(chatId, targetId).catch(() => {});
      bot.telegram.sendMessage(targetId, 'Ваш бан в чате закончился. Вы можете вернуться в чат <a href="' + chatLink + '">' + ctx.chat.title + '</a>.', { parse_mode: 'HTML' }).catch(() => {});
    }, until.getTime() - Date.now());

    bot.telegram.sendMessage(targetId, `[${targetNickname}](tg://user?id=${targetId}) вас заблокировали на ${time} ${unit}.`, { parse_mode: 'Markdown' }).catch(() => {});
    ctx.reply(`Пользователь [${targetNickname}](tg://user?id=${targetId}) заблокирован на ${time} ${unit}.`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Ошибка в .ban:", error);
  }
});

bot.hears(/\.unban$/i, async (ctx) => {
  try {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.from) {
      return ctx.reply('❌ Ответьте на сообщение пользователя, которого хотите разблокировать.');
    }
    const user = await User.findOne({ telegramId: ctx.from.id });
    const targetId = ctx.message.reply_to_message.from.id;
    const user2 = await User.findOne({ telegramId: targetId });
    const targetNickname = ((user2?.nickname || ctx.message.reply_to_message.from.first_name || 'Пользователь') + '').replace(/[\[\]]/g, '');
    const chatId = ctx.message.chat.id;

    const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
    if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
      ctx.reply('Вы не являетесь модератором чата.');
      return;
    }

    const targetMember = await bot.telegram.getChatMember(chatId, targetId);
    if (['administrator', 'creator'].includes(targetMember.status)) {
      ctx.reply('Вы не можете заблокировать другого модератора.');
      return;
    }

    const isBanned = targetMember.status === 'kicked';
    if (!isBanned) {
      ctx.reply('Пользователь не в бане.');
      return;
    }

    await bot.telegram.unbanChatMember(chatId, targetId);
    const chatLink = `https://t.me/${ctx.chat.username}`;
    ctx.reply(`Пользователю [${targetNickname}](tg://user?id=${targetId}) разблокирован доступ в этом чате.`, { parse_mode: 'Markdown' });

    bot.telegram.sendMessage(targetId, 'Ваш бан в чате закончился. Вы можете вернуться в чат <a href="' + chatLink + '">' + ctx.chat.title + '</a>.', { parse_mode: 'HTML' }).catch(() => {});
  } catch (error) {
    console.error("Ошибка в .unban:", error);
  }
});

bot.hears(/\.mute (\d+) (час|минут|минуты|минута|день|дня|дней)$/i, async (ctx) => {
  try {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.from) {
      return ctx.reply('❌ Ответьте на сообщение пользователя, которого хотите замутить.');
    }
    const user = await User.findOne({ telegramId: ctx.from.id });
    const targetId = ctx.message.reply_to_message.from.id;
    const user2 = await User.findOne({ telegramId: targetId });
    const targetNickname = ((user2?.nickname || ctx.message.reply_to_message.from.first_name || 'Пользователь') + '').replace(/[\[\]]/g, '');
    const time = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const chatId = ctx.message.chat.id;
    const until = new Date();

    const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
    if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
      ctx.reply('Вы не являетесь модератором чата.');
      return;
    }

    const targetMember = await bot.telegram.getChatMember(chatId, targetId);
    if (['administrator', 'creator'].includes(targetMember.status)) {
      ctx.reply('Вы не можете замутить другого модератора.');
      return;
    }

    if (unit === 'час') {
      until.setHours(until.getHours() + time);
    } else if (unit === 'минута' || unit === 'минуты' || unit === 'минут') {
      until.setMinutes(until.getMinutes() + time);
    } else if (unit === 'день' || unit === 'дня' || unit === 'дней') {
      until.setDate(until.getDate() + time);
    }

    await bot.telegram.restrictChatMember(chatId, targetId, {
      until_date: until.getTime() / 1000,
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false
    });

    ctx.reply(`Пользователь [${targetNickname}](tg://user?id=${targetId}) замучен на ${time} ${unit}.`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Ошибка в .mute:", error);
  }
});

bot.hears(/^\.unmute$/i, async (ctx) => {
  try {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.from) {
      return ctx.reply('❌ Ответьте на сообщение пользователя, которого хотите размутить.');
    }
    const user = await User.findOne({ telegramId: ctx.from.id });
    const targetId = ctx.message.reply_to_message.from.id;
    const user2 = await User.findOne({ telegramId: targetId });
    const targetNickname = ((user2?.nickname || ctx.message.reply_to_message.from.first_name || 'Пользователь') + '').replace(/[\[\]]/g, '');
    const chatId = ctx.message.chat.id;

    const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
    if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
      ctx.reply('Вы не являетесь модератором чата.');
      return;
    }

    const targetMember = await bot.telegram.getChatMember(chatId, targetId);
    if (['administrator', 'creator'].includes(targetMember.status)) {
      ctx.reply('Вы не можете замутить другого модератора.');
      return;
    }

    await bot.telegram.restrictChatMember(chatId, targetId, {
      until_date: 0,
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });

    ctx.reply(`Пользователь [${targetNickname}](tg://user?id=${targetId}) размучен.`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Ошибка в .unmute:", error);
  }
});
// конец команды

const requestSchema = new Mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  videoLink: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'pending', index: true } // добавляем поле статуса запроса
});

// ⚡ ОПТИМИЗАЦИЯ: Индекс для быстрого поиска pending запросов
requestSchema.index({ userId: 1, status: 1 });

const Request = Mongoose.model('Requests', requestSchema);

bot.hears(/\.yt\s*(.*)$/i, async (ctx) => {
  const videoLink = ctx.message.text.slice(4).trim(); // получаем ссылку на видео из сообщения
  const videoId = ytdl.getVideoID(videoLink); // используем модуль ytdl для извлечения идентификатора видео
  const shortsRegex = /^(https:\/\/)?(www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]+(\?[^?]+)?$/i;
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'Отменить', callback_data: `cancelyt:${ctx.from.id}`, }
      ]
    ]
  };
  if (!shortsRegex.test(videoLink)) {
    await ctx.reply('Ссылка не на короткое видео YouTube.');
    return;
  }
  try {
    const existingRequest = await Request.findOne({ userId: ctx.from.id, status: 'pending' }); // проверяем, есть ли уже запрос от этого пользователя в ожидании
    if (existingRequest) {
      const requestsCount = await Request.countDocuments({ status: 'pending' }); // считаем количество запросов в очереди
      await ctx.reply(`Ваш запрос уже добавлен в очередь. В ожидании: ${requestsCount} запросов.`, { reply_markup: inlineKeyboard });
      return;
    }
    const request = new Request({ userId: ctx.from.id, videoLink: videoId }); // use the extracted video ID
    await request.save(); // сохраняем запрос в базу данных
    const requestsCount = await Request.countDocuments({ status: 'pending' }); // считаем количество запросов в очереди
    await ctx.reply(`Ваш запрос добавлен в очередь. В ожидании: ${requestsCount} запросов.`, { reply_markup: inlineKeyboard });
  } catch (err) {
    console.error(err);
    await ctx.reply('Ошибка.');
  }
});

bot.action(/^cancelyt:(\d+)$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const message_id = ctx.update?.callback_query?.message?.message_id;
    const userIdFromCallback = parseInt(ctx.match[1], 10);

    // Проверяем, что владелец запроса совпадает с userId
    const request = await Request.findOne({ userId: userId });

    if (request) {
      if (userId === userIdFromCallback) {
        // Удаление запроса из базы данных
        await Request.deleteOne({ userId: userId });

        // Отправляем сообщение об отмене запроса
        const user1 = await User.findOne({ telegramId: userId });
        const userName = user1?.nickname || ctx.from.first_name || 'Пользователь';
        const cancelMessage = `[${userName}](tg://user?id=${userId}),\nВаш запрос был отменен.`;

        // Используем метод editMessageText для редактирования сообщения
        if (message_id && ctx.chat) {
          await ctx.telegram.editMessageText(ctx.chat.id, message_id, null, cancelMessage, {
            parse_mode: 'Markdown'
          });
        }
      } else {
        // Если владелец запроса не совпадает с userId, отправляем уведомление об ошибке
        const errorMessage = 'Вы не можете отменить этот запрос, так как он не ваш.';
        await ctx.answerCbQuery(errorMessage);
      }
    } else {
      // Если запрос не найден, отправляем уведомление об ошибке
      const errorMessage = 'У вас нет активных запросов для отмены.';
      await ctx.answerCbQuery(errorMessage);
    }
  } catch (cancelErr) {
    console.error('Ошибка при отмене запроса cancelyt:', cancelErr.message);
  }
});


let isUploading = false;
const userRequests = {}; // добавляем объект для хранения количества запросов от одного и того же пользователя

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

function safeDeleteFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`Ошибка при удалении ${filePath}:`, e.message);
    }
  }
}

async function processNextRequest() {
  if (isUploading) return;
  if (Mongoose.connection.readyState !== 1) return;

  let currentRequest = null;
  const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const videoPath = `video_${uniqueId}.mp4`;
  const audioPath = `audio_${uniqueId}.mp4`;
  const mergedPath = `merged_${uniqueId}.mp4`;

  try {
    const request = await Request.findOne({ status: 'pending' }).sort({ createdAt: 'asc' });
    if (!request) return;

    currentRequest = request;
    const { videoLink, userId } = request;

    if (userRequests[userId]) {
      try {
        await bot.telegram.sendMessage(userId, 'Вы уже отправили запрос, пожалуйста, подождите, пока он будет выполнен.');
      } catch (e) {}
      await Request.findByIdAndUpdate(request._id, { status: 'rejected' });
      return;
    }

    userRequests[userId] = true;
    isUploading = true;

    const videoInfo = await ytdl.getInfo(videoLink);
    const videoFormats = videoInfo.formats.filter(format => format.container === 'mp4' && format.qualityLabel && format.height <= 1080);
    videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
    const videoFormat = videoFormats[0] || ytdl.chooseFormat(videoInfo.formats, { quality: 'highestvideo' });
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, { filter: 'audioonly' }) || ytdl.chooseFormat(videoInfo.formats, { filter: format => format.audioBitrate });

    if (!videoFormat || !videoFormat.url || !audioFormat || !audioFormat.url) {
      throw new Error('Не удалось найти подходящий формат видео или аудио.');
    }

    if (videoFormat.contentLength && Number(videoFormat.contentLength) > 1000000000) {
      await bot.telegram.sendMessage(userId, 'Ваш запрос был удален, так как видео слишком большое.');
      await Request.findByIdAndDelete(request._id);
      return;
    }

    // Загружаем видео и аудио файлы параллельно
    await Promise.all([
      downloadFile(videoFormat.url, videoPath),
      downloadFile(audioFormat.url, audioPath)
    ]);

    // Объединяем видео и аудио с помощью ffmpeg
    await mergeFiles(videoPath, audioPath, mergedPath);

    // Отправляем объединенное видео в Telegram
    await bot.telegram.sendMessage(userId, 'Начинаю загрузку видео...');
    const videoCaption = `Название видео: ${videoInfo.videoDetails?.title || 'Видео'}\nАвтор: ${videoInfo.videoDetails?.author?.name || 'YouTube'}`;
    const videoStream = fs.createReadStream(mergedPath);
    await bot.telegram.sendVideo(userId, { source: videoStream }, { caption: videoCaption });

    await bot.telegram.sendMessage(userId, 'Видео загружено успешно!');
    await Request.findByIdAndDelete(request._id);
  } catch (err) {
    console.error('Ошибка при обработке YouTube запроса:', err.message || err);

    if (currentRequest) {
      if (currentRequest.userId) {
        try {
          await bot.telegram.sendMessage(
            currentRequest.userId,
            '[ОШИБКА] Не удалось обработать видео. Возможные причины: видео защищено, слишком большое или недоступно.'
          );
        } catch (msgErr) {
          console.error('Ошибка отправки уведомления об ошибке:', msgErr.message);
        }
      }
      try {
        await Request.findByIdAndDelete(currentRequest._id);
      } catch (dbErr) {
        console.error('Ошибка удаления запроса из базы данных:', dbErr.message);
      }
    }
  } finally {
    if (currentRequest && currentRequest.userId) {
      userRequests[currentRequest.userId] = false;
    }
    isUploading = false;
    safeDeleteFile(videoPath);
    safeDeleteFile(audioPath);
    safeDeleteFile(mergedPath);
  }
}

async function downloadFile(url, filePath) {
  const response = await axios.get(url, { responseType: 'stream', timeout: 60000 });
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
}

async function mergeFiles(videoPath, audioPath, mergedPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions('-c:v', 'copy')
      .outputOptions('-c:a', 'aac')
      .outputOptions('-strict', '-2')
      .outputOptions('-movflags', '+faststart')
      .output(mergedPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

setInterval(processNextRequest, 5000);




//конвертор гс в аудио и аудио в гс
const { exec } = require('child_process');
bot.on('message', async (ctx, next) => {
  // Проверяем, что сообщение было отправлено в личные сообщения боту
  if (ctx.message?.chat?.type === 'private') {
    // Проверяем, что полученное сообщение является голосовым сообщением
    if (ctx.message.voice) {
      const voiceMessage = ctx.message.voice;
      const fileLink = await ctx.telegram.getFileLink(voiceMessage.file_id);
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const voiceFile = path.join(os.tmpdir(), `grizzly_voice_${uniqueId}.ogg`);
      const mp3File = path.join(os.tmpdir(), `grizzly_conv_${uniqueId}.mp3`);

      try {
        await downloadFile(fileLink.href || fileLink.toString(), voiceFile);

        await new Promise((resolve, reject) => {
          ffmpeg(voiceFile)
            .toFormat('mp3')
            .save(mp3File)
            .on('end', resolve)
            .on('error', reject);
        });

        await ctx.replyWithAudio({ source: fs.createReadStream(mp3File) }, { caption: 'audio by grizzly' });
      } catch (error) {
        console.error(`Ошибка при конвертации голосового сообщения: ${error.message || error}`);
      } finally {
        safeDeleteFile(voiceFile);
        safeDeleteFile(mp3File);
      }
    } else if (ctx.message.audio) {
      const audioMessage = ctx.message.audio;
      const fileLink = await ctx.telegram.getFileLink(audioMessage.file_id);
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const audioFile = path.join(os.tmpdir(), `grizzly_audio_${uniqueId}.wav`);
      const oggFile = path.join(os.tmpdir(), `grizzly_conv_${uniqueId}.ogg`);

      try {
        await downloadFile(fileLink.href || fileLink.toString(), audioFile);

        await new Promise((resolve, reject) => {
          ffmpeg(audioFile)
            .toFormat('ogg')
            .save(oggFile)
            .on('end', resolve)
            .on('error', reject);
        });

        await ctx.replyWithVoice({ source: fs.createReadStream(oggFile) }, { caption: 'voice by grizzly' });
      } catch (error) {
        console.error(`Ошибка при конвертации аудиофайла: ${error.message || error}`);
        ctx.reply(`Ошибка при конвертации аудиофайла: ${error.message || error}`);
      } finally {
        safeDeleteFile(audioFile);
        safeDeleteFile(oggFile);
      }
    }
  }
  next();
});

//donate GPT
/*bot.hears(/^\.donate\s?$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  const referralLink = `https://t.me/grizzly_zapasbot?start=${user.userRequestInfo.referralCode}`;

  const donateMessage = `[${user.nickname}](tg://user?id=${ctx.from.id}),
🤲 **Донат:**
- *GPTCoin:* ${user.userRequestInfo.gptcoin}
- *Число пригласивших людей:* ${user.userRequestInfo.invitedUsers.length}
- *Реферальная ссылка:* [Ссылка](${referralLink})
- *Валюта:* 1 друг = 1GptCoin

💸 Поддержите проект, пригласив друзей!`;

  return ctx.replyWithMarkdown(donateMessage);
});

//admincommands 
bot.hears(/^\.setgptlimit\s*(\S+)? (\d+)$/, async (ctx) => {
  const mentionedUsername = ctx.match[1]; // Имя пользователя или упоминание (@username)
  const newLimit = parseInt(ctx.match[2]); // Новое значение limit
  const user = await User.findOne({ telegramId: ctx.from.id });

  // Проверка, что пользователь с ролью admin и у него достаточно прав
  if (user.admin < 5) {
    await ctx.reply('У вас недостаточно прав для выполнения этой команды.');
    return;
  }

  // Получение информации о пользователе, чьи данные нужно изменить (по имени или упоминанию)
  let userId, replyName, mentionedUser;

  if (mentionedUsername) {
    const username = mentionedUsername.substring(1); // Убираем символ "@" из упоминания
    mentionedUser = await User.findOne({ username });

    if (!mentionedUser) {
      await ctx.reply('Не удалось найти пользователя. Проверьте правильность указанного имени пользователя или ответьте на сообщение пользователя.');
      return;
    }

    userId = mentionedUser.telegramId;
    replyName = mentionedUser.firstName;
  } else if (ctx.message.reply_to_message) {
    userId = ctx.message.reply_to_message.from.id;
    replyName = ctx.message.reply_to_message.from.first_name;

    // В данном случае мы не проверяем упоминание, так как это ответ на сообщение
    mentionedUser = await User.findOne({ telegramId: userId });
  } else {
    await ctx.reply('Не удалось найти пользователя. Пожалуйста, используйте упоминание пользователя, например: @username, или ответьте на сообщение пользователя.');
    return;
  }

  // Обновление limit у найденного пользователя и сохранение
  if (mentionedUser) {
    mentionedUser.userRequestInfo.gptcoin = newLimit;
    await mentionedUser.save();

    await ctx.reply(`У пользователя ${replyName} ([${mentionedUser.nickname}](tg://user?id=${userId})) установлен новый limit: ${newLimit}.`, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply('Не удалось обновить limit пользователя.');
  }
});*/
// генерация картинки

//gpt

bot.command('gpt', async (ctx) => {
    // Извлекаем текст команды без /gpt
    const text = ctx.message.text.replace('/gpt', '').trim();

    let token = 'act-1';
    let model = 'gpt-4';
    let messages = [{role:'user',content: text}];
    let temperature = 0.8;
    let n = 1;
    let stream = true;
    let stop = null;

    axios.post('http://5.42.75.19:3000/v1/chat/completions', {
      model,
      messages,
      temperature,
      stream,
      stop
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    })
    .then(response => {
      ctx.reply(response.data.message);
    })
    .catch(error => {
      console.error(error);
    });
});

/*
//рп команды с фоткой 
const commands = {
  "поцеловать": {
    name: ".ф поцеловать",
    response: "поцеловал(а)",
    apiEndpoint: "kiss" // для получения изображения
  },
  "обнять": {
    name: ".ф обнять",
    response: "обнял(а)",
    apiEndpoint: "hug" // для получения изображения
  },
  // Другие команды без изображений
  "кусь": {
    name: ".ф кусь",
    response: "укусил(а)",
    apiEndpoint: "bite" // для получения изображения
  },
  "пнуть": {
    name: ".ф пнуть",
    response: "пнул(а) поджопника",
    apiEndpoint: "kick" // для получения изображения
  },
  // Добавьте другие команды по необходимости
};

// Функция для получения изображения с waifu.pics
async function getAnimeImage(action) {
  const response = await axios.get(`https://api.waifu.pics/sfw/${action}`);
  return response.data.url;
}

bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const reply = ctx.message.reply_to_message;
  const lines = text.trim().split('\n');
  const command = Object.values(commands).find(cmd => lines[0].toLowerCase().startsWith(cmd.name));

  if (!command) return next(); // если команды нет, передаем управление следующему middleware

  const { name, response, apiEndpoint } = command;
  const targetMessage = lines.length > 1 ? lines[1] : '';

  const mentionRegex = /@\w+/g;
  const mentions = text.match(mentionRegex);

  if (mentions && mentions.length > 0) {
    for (const mention of mentions) {
      const username = mention.substring(1);
      const mentionedUser = await User.findOne({ username });
      if (!mentionedUser) {
        return ctx.reply(`${username} не зарегистрирован в боте`);
      }

      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) return ctx.reply(`Вы не зарегистрирован в боте`);

      const nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) : user.nickname;
      const nickname2 = mentionedUser.nickname.length > 14 ? mentionedUser.nickname.substring(0, 14) : mentionedUser.nickname;

      let responseMessage = `<a href="tg://user?id=${user.telegramId}">${nickname}</a> ${response} <a href="tg://user?id=${mentionedUser.telegramId}">${nickname2}</a>`;
      if (targetMessage) responseMessage += `\n💬 С репликой: « ${targetMessage} »`;

      if (apiEndpoint) {
        const imageUrl = await getAnimeImage(apiEndpoint);
        await ctx.replyWithHTML(`${responseMessage}<a href="${imageUrl}">.</a>`);
      } else {
        await ctx.replyWithHTML(responseMessage);
      }
    }
  } else if (reply) {
    const { from, message_id } = reply;
    const user = await User.findOne({ telegramId: ctx.from.id });
    const user2 = await User.findOne({ telegramId: from.id });
    if (!user) return ctx.reply(`Вы не зарегистрирован в боте`);
    if (!user2) return ctx.reply(`${from.first_name} не зарегистрирован в боте`);

    const nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) : user.nickname;
    const nickname2 = user2.nickname.length > 14 ? user2.nickname.substring(0, 14) : user2.nickname;

    let responseMessage = `<a href="tg://user?id=${user.telegramId}">${nickname}</a> ${response} <a href="tg://user?id=${from.id}">${nickname2}</a>`;
    if (targetMessage) responseMessage += `\n💬 С репликой: « ${targetMessage} »`;

    if (apiEndpoint) {
      const imageUrl = await getAnimeImage(apiEndpoint);
      await ctx.replyWithHTML(`${responseMessage}<a href="${imageUrl}">.</a>`);
    } else {
      await ctx.replyWithHTML(responseMessage);
    }
  } else {
    return next(); // передаем управление следующему обработчику, если не было реплики или упомянутого пользователя
  }
});

*/

// Функция для получения изображения с waifu.pics
async function getAnimeImage(action) {
  const response = await axios.get(`https://api.waifu.pics/sfw/${action}`);
  return response.data.url;
}


// Список команд
const commands = {
  "поцеловать": { name: ".отн поцеловать", response: "поцеловал(а) свою половинку", apiEndpoint: "kiss" },
  "обнять": { name: ".отн обнять", response: "обнял(а) свою половинку", apiEndpoint: "hug" },
  "кусь": { name: ".отн кусь", response: "укусил(а) свою половинку", apiEndpoint: "bite" },
  "пнуть": { name: ".отн пнуть", response: "пнул(а) свою половинку", apiEndpoint: "kick" },
};

bot.on("text", async (ctx, next) => {
  const text = ctx.message.text ? ctx.message.text.trim() : '';
  const command = Object.values(commands).find((cmd) => text.startsWith(cmd.name));
  if (!command) return next(); // Если команда не найдена, передаём управление дальше

  const userId = Number(ctx.from.id);
  const user = await User.findOne({ telegramId: userId });
  if (!user) return ctx.reply("❌ Ваш профиль не найден.");

  // Находим брак
  const marriage = await Marriage.findOne({
    $or: [{ userId: userId }, { partnerId: userId }],
    status: 'accepted'
  });

  if (!marriage) {
    return ctx.reply('❌ Вы не состоите в отношениях.');
  }

  // Получаем ссылки на никнеймы с кликабельными ссылками
  const partnerId = getPartnerId(marriage, userId);
  const userNickname = await getNicknameByTelegramId(userId);
  const partnerNickname = await getNicknameByTelegramId(partnerId);

  const responseMessage = `${userNickname} ${command.response} ${partnerNickname}`;

  // Если у команды есть API для изображений, добавляем картинку
  if (command.apiEndpoint) {
    try {
      const imageUrl = await getAnimeImage(command.apiEndpoint);
      await ctx.replyWithHTML(`${responseMessage}<a href="${imageUrl}">.</a>`);
    } catch (e) {
      await ctx.replyWithHTML(responseMessage);
    }
  } else {
    await ctx.replyWithHTML(responseMessage);
  }
});




// для запросов 

// Для запросов
let pendingRequests = new Map();

// Улучшенная схема для браков
const marriageSchema = new Mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  partnerId: { type: Number, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'divorced'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date, default: null },
  divorcedAt: { type: Date, default: null },
  // Дата свадьбы
  weddingDate: { type: Date, default: null },
  weddingGuests: [{ type: Number }], // ID гостей на свадьбе
  weddingGiftsTotal: { type: Number, default: 0 }, // Общая сумма подарков на свадьбе
  // Статистика отношений
  giftsSent: { type: Number, default: 0 },
  giftsReceived: { type: Number, default: 0 },
  totalGiftValue: { type: Number, default: 0 },
  // Совместный банк
  jointBank: { type: Number, default: 0 },
  jointBankHistory: [{
    userId: Number,
    action: String, // 'deposit' или 'withdraw'
    amount: Number,
    date: { type: Date, default: Date.now }
  }],
  // Рейтинг, искры, опыт и уровень (до 30 уровней)
  relationshipScore: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  sparks: { type: Number, default: 100 },
  // Совместный дом пары
  house: {
    type: { type: String, default: 'Шалаш' },
    level: { type: Number, default: 1 },
    comfort: { type: Number, default: 10 },
    safeCookies: { type: Number, default: 0 }
  },
  // Коллекция романтических подарков
  giftsList: [{
    name: String,
    icon: String,
    fromId: Number,
    date: { type: Date, default: Date.now }
  }],
  // Беременность
  pregnancy: {
    isPregnant: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    babyGender: { type: String, default: null },
    motherId: { type: Number, default: null }
  },
  // Дети
  children: [{
    name: String,
    gender: String,
    birthDate: { type: Date, default: Date.now },
    intellect: { type: Number, default: 50 },
    happiness: { type: Number, default: 80 },
    health: { type: Number, default: 100 },
    discipline: { type: Number, default: 50 },
    creativity: { type: Number, default: 50 },
    lastCare: { type: Date, default: Date.now }
  }],
  // Питомцы пары
  pets: [{
    name: String,
    type: { type: String, default: 'Котик' },
    rarity: { type: String, default: 'Обычный' },
    level: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    hunger: { type: Number, default: 100 },
    happiness: { type: Number, default: 100 },
    lastFed: { type: Date, default: Date.now }
  }],
  // Кулдауны действий партнеров
  actionCooldowns: {
    type: Map,
    of: Date,
    default: {}
  },
  // Премиум-статус отношений
  isPremium: { type: Boolean, default: false },
  premiumUntil: { type: Date, default: null },
  isPremiumRelations: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },
  // Совместные достижения
  achievements: [{ type: String }],
  // Последняя активность
  lastActivity: { type: Date, default: Date.now },
  // Годовщины
  lastAnniversaryNotification: { type: Date, default: null }
});

// ⚡ ОПТИМИЗАЦИЯ: Индексы для быстрого поиска
marriageSchema.index({ userId: 1, status: 1 }); // Для поиска браков конкретного пользователя по статусу
marriageSchema.index({ partnerId: 1, status: 1 }); // Для поиска браков партнера по статусу
marriageSchema.index({ userId: 1, partnerId: 1 }); // Комбинированный индекс
marriageSchema.index({ status: 1 }); // Для поиска по статусу
marriageSchema.index({ status: 1, relationshipScore: -1 }); // Индекс для лидерборда пар

const Marriage = Mongoose.model('Marriage', marriageSchema);

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getPartnerId(marriage, userId) {
  if (!marriage) return null;
  return Number(marriage.userId) === Number(userId) ? Number(marriage.partnerId) : Number(marriage.userId);
}

// Функция для получения nickname по telegramId с кликабельной ссылкой
async function getNicknameByTelegramId(telegramId) {
  const user = await User.findOne({ telegramId });
  if (user && user.nickname) {
    return `<a href="tg://user?id=${telegramId}">${escapeHtml(user.nickname)}</a>`;
  } else {
    return `<a href="tg://user?id=${telegramId}">User${telegramId}</a>`;
  }
}

// =============================================================
// КОНСТАНТЫ И КАТАЛОГИ СИСТЕМЫ ОТНОШЕНИЙ CELYA / GRIZZLY
// =============================================================

const RELATION_LEVEL_THRESHOLDS = [
  { level: 1, sparks: 0, title: 'Зарождение интереса' },
  { level: 2, sparks: 1000, title: 'Первые искры' },
  { level: 3, sparks: 2000, title: 'Взаимное притяжение' },
  { level: 4, sparks: 3000, title: 'Глубокое узнавание' },
  { level: 5, sparks: 6000, title: 'Первая близость' },
  { level: 6, sparks: 10000, title: 'Романтическое увлечение' },
  { level: 7, sparks: 22000, title: 'Прочная связь' },
  { level: 8, sparks: 34000, title: 'Гармония и понимание' },
  { level: 9, sparks: 40000, title: 'Совместное будущее' },
  { level: 10, sparks: 55000, title: 'Безусловная любовь' },
  { level: 11, sparks: 70000, title: 'Слияние сердец' },
  { level: 12, sparks: 100000, title: 'Духовная связь' },
  { level: 13, sparks: 150000, title: 'Полное доверие' },
  { level: 14, sparks: 230000, title: 'Неразрывная близость' },
  { level: 15, sparks: 340000, title: 'Гармоничная связь' },
  { level: 16, sparks: 560000, title: 'Абсолютное единство' },
  { level: 17, sparks: 790000, title: 'Вечная преданность' },
  { level: 18, sparks: 1100000, title: 'Бесконечная любовь' },
  { level: 19, sparks: 3000000, title: 'Неразделимое целое' },
  { level: 20, sparks: 5000000, title: 'Идеальная гармония' },
  { level: 21, sparks: 9000000, title: 'Космическое единение' },
  { level: 22, sparks: 15000000, title: 'Родственные души' },
  { level: 23, sparks: 22000000, title: 'Мистическая связь' },
  { level: 24, sparks: 35000000, title: 'Вселенская гармония' },
  { level: 25, sparks: 47000000, title: 'Нерушимый союз' },
  { level: 26, sparks: 70000000, title: 'Божественное слияние' },
  { level: 27, sparks: 90000000, title: 'Трансцендентная близость' },
  { level: 28, sparks: 120000000, title: 'Вечное пламя' },
  { level: 29, sparks: 350000000, title: 'Безграничное единство' },
  { level: 30, sparks: 1500000000, title: 'Легендарная любовь' }
];

function getCoupleLevel(marriage) {
  if (!marriage) return 1;
  const sparks = marriage.sparks || 0;
  let lvlFromSparks = 1;
  for (let i = RELATION_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (sparks >= RELATION_LEVEL_THRESHOLDS[i].sparks) {
      lvlFromSparks = RELATION_LEVEL_THRESHOLDS[i].level;
      break;
    }
  }
  return Math.min(30, Math.max(marriage.level || 1, lvlFromSparks));
}

function formatActionCooldown(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) {
    return `${totalMin}м`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}ч. ${m}м` : `${h}ч`;
}

const RELATION_ACTIONS = [
  { level: 1, id: 'комплимент', label: 'Сделать комплимент', aliases: ['сделать комплимент', 'комплимент'], sparks: 15, exp: 20, cd: 5 * 60 * 1000, emoji: '💬', msg: 'сделал(а) нежный комплимент' },
  { level: 2, id: 'завтрак', label: 'Сделать завтрак', aliases: ['сделать завтрак', 'приготовить завтрак', 'завтрак'], sparks: 35, exp: 40, cd: 8 * 60 * 1000, emoji: '🥞', msg: 'приготовил(а) вкусный завтрак в постель для' },
  { level: 3, id: 'цветы', label: 'Подарить цветы', aliases: ['подарить цветы', 'цветы'], sparks: 60, exp: 60, cd: 11 * 60 * 1000, emoji: '💐', msg: 'подарил(а) шикарный букет цветов для' },
  { level: 4, id: 'фильм', label: 'Посмотреть фильм', aliases: ['посмотреть фильм', 'посмотреть кино', 'фильм', 'кино'], sparks: 80, exp: 80, cd: 15 * 60 * 1000, emoji: '🎬', msg: 'устроил(а) уютный просмотр фильма с' },
  { level: 5, id: 'массаж', label: 'Сделать массаж', aliases: ['сделать массаж', 'массаж'], sparks: 120, exp: 110, cd: 20 * 60 * 1000, emoji: '💆', msg: 'сделал(а) расслабляющий массаж для' },
  { level: 6, id: 'романтика', label: 'Романтический ужин', aliases: ['романтический ужин', 'устроить романтический ужин', 'устроить ужин', 'ужин', 'романтика'], sparks: 170, exp: 150, cd: 30 * 60 * 1000, emoji: '🕯️', msg: 'устроил(а) незабываемый романтический ужин при свечах для' },
  { level: 7, id: 'подарок', label: 'Сделать подарок', aliases: ['сделать подарок', 'подарок'], sparks: 230, exp: 200, cd: 38 * 60 * 1000, emoji: '🎁', msg: 'преподнёс(преподнесла) неожиданный трогательный подарок для' },
  { level: 8, id: 'поездка', label: 'Туристическая поездка', aliases: ['туристическая поездка', 'поездка', 'поехать в поездку'], sparks: 300, exp: 250, cd: 45 * 60 * 1000, emoji: '✈️', msg: 'отправился(лась) в захватывающую туристическую поездку с' },
  { level: 9, id: 'астрономия', label: 'Вечер астрономии', aliases: ['вечер астрономии', 'астрономия'], sparks: 400, exp: 320, cd: 60 * 60 * 1000, emoji: '🔭', msg: 'провёл(провела) волшебный вечер астрономии под звёздами с' },
  { level: 10, id: 'воспоминания', label: 'Приятные воспоминания', aliases: ['приятные воспоминания', 'воспоминания'], sparks: 500, exp: 400, cd: 80 * 60 * 1000, emoji: '💭', msg: 'погрузился(лась) в тёплые приятные воспоминания вместе с' },
  { level: 11, id: 'фотосессия', label: 'Совместная фотосессия', aliases: ['совместная фотосессия', 'сделать фотосессию', 'фотосессия'], sparks: 700, exp: 500, cd: 90 * 60 * 1000, emoji: '📸', msg: 'провёл(провела) памятную совместную фотосессию с' },
  { level: 12, id: 'традиция', label: 'Создать традицию', aliases: ['создать традицию', 'традиция'], sparks: 900, exp: 600, cd: 100 * 60 * 1000, emoji: '🕯️', msg: 'создал(а) новую прекрасную семейную традицию вместе с' },
  { level: 13, id: 'проект', label: 'Совместный проект', aliases: ['совместный проект', 'проект'], sparks: 1100, exp: 700, cd: 110 * 60 * 1000, emoji: '🎨', msg: 'запустил(а) совместный творческий проект с' },
  { level: 14, id: 'родословная', label: 'Исследовать родословную', aliases: ['исследовать родословную', 'родословная'], sparks: 1400, exp: 850, cd: 120 * 60 * 1000, emoji: '📜', msg: 'исследовал(а) семейную родословную вместе с' },
  { level: 15, id: 'будущее', label: 'Спланировать будущее', aliases: ['спланировать будущее', 'планировать будущее', 'будущее'], sparks: 1700, exp: 1000, cd: 130 * 60 * 1000, emoji: '🗺️', msg: 'вдохновенно спланировал(а) счастливое общее будущее с' },
  { level: 16, id: 'желание', label: 'Исполнить желание', aliases: ['исполнить желание', 'желание'], sparks: 2100, exp: 1200, cd: 140 * 60 * 1000, emoji: '🌠', msg: 'исполнил(а) заветное сокровенное желание' },
  { level: 17, id: 'годовщина_акт', label: 'Годовщина отношений', aliases: ['годовщина отношений'], sparks: 2500, exp: 1400, cd: 150 * 60 * 1000, emoji: '🎉', msg: 'пылко отпраздновал(а) очередную годовщину отношений с' },
  { level: 18, id: 'жилище', label: 'Обустроить жилище', aliases: ['обустроить жилище', 'обустроить дом', 'жилище'], sparks: 3000, exp: 1650, cd: 160 * 60 * 1000, emoji: '🏡', msg: 'с любовью обустроил(а) уютное семейное жилище для' },
  { level: 19, id: 'единение', label: 'Духовное единение', aliases: ['духовное единение', 'единение'], sparks: 3500, exp: 1900, cd: 170 * 60 * 1000, emoji: '🕊️', msg: 'достиг(ла) глубокого духовного единения с' },
  { level: 20, id: 'отдых', label: 'Уединенный отдых', aliases: ['уединенный отдых', 'отдых'], sparks: 4000, exp: 2200, cd: 180 * 60 * 1000, emoji: '🏝️', msg: 'устроил(а) уединенный романтический отдых от всего мира с' },
  { level: 21, id: 'клятва', label: 'Написать клятву', aliases: ['написать клятву', 'клятва', 'дать клятву'], sparks: 4800, exp: 2500, cd: 200 * 60 * 1000, emoji: '💍', msg: 'написал(а) искреннюю клятву вечной верности для' },
  { level: 22, id: 'талисман', label: 'Создать талисман', aliases: ['создать талисман', 'талисман'], sparks: 5600, exp: 2900, cd: 220 * 60 * 1000, emoji: '🧿', msg: 'создал(а) магический талисман вечной любви для' },
  { level: 23, id: 'песня', label: 'Написать песню', aliases: ['написать песню', 'песня', 'спеть песню'], sparks: 6500, exp: 3300, cd: 240 * 60 * 1000, emoji: '🎵', msg: 'написал(а) трогательную песню о любви для' },
  { level: 24, id: 'сад', label: 'Вырастить сад', aliases: ['вырастить сад', 'сад'], sparks: 7500, exp: 3800, cd: 260 * 60 * 1000, emoji: '🌸', msg: 'посадил(а) и вырастил(а) цветущий сад любви вместе с' },
  { level: 25, id: 'танцевальный_вечер', label: 'Танцевальный вечер', aliases: ['танцевальный вечер', 'вечер танцев', 'танец'], sparks: 8500, exp: 4300, cd: 280 * 60 * 1000, emoji: '💃', msg: 'закружил(а) в упоительном танцевальном вечере' },
  { level: 26, id: 'совет', label: 'Семейный совет', aliases: ['семейный совет', 'совет'], sparks: 10000, exp: 5000, cd: 300 * 60 * 1000, emoji: '👑', msg: 'собрал(а) мудрый и тёплый семейный совет с' },
  { level: 27, id: 'звезда', label: 'Назвать звезду', aliases: ['назвать звезду', 'звезда'], sparks: 11500, exp: 5800, cd: 320 * 60 * 1000, emoji: '⭐', msg: 'назвал(а) сияющую звезду на небе в честь' },
  { level: 28, id: 'книга', label: 'Написать книгу', aliases: ['написать книгу', 'книга'], sparks: 13000, exp: 6600, cd: 340 * 60 * 1000, emoji: '📖', msg: 'написал(а) романтическую книгу о великой любви к' },
  { level: 29, id: 'праздник', label: 'Организовать праздник', aliases: ['организовать праздник', 'праздник'], sparks: 15000, exp: 7500, cd: 360 * 60 * 1000, emoji: '🎆', msg: 'организовал(а) грандиозный праздник в честь' },
  { level: 30, id: 'вечная_любовь', label: 'Вечная любовь', aliases: ['вечная любовь', 'любовь', 'вечность'], sparks: 18000, exp: 9000, cd: 400 * 60 * 1000, emoji: '💖', msg: 'скрепил(а) узы вечной и нерушимой любви с' }
];

const PREMIUM_RELATION_ACTIONS = [
  { level: 1, id: 'аура_эмпатии', isPremium: true, label: 'Аура эмпатии', aliases: ['аура эмпатии', 'аура'], sparks: 50, exp: 80, cd: 5 * 60 * 1000, emoji: '🔮', msg: 'создал(а) глубокую ментальную связь и окутал(а) Аурой эмпатии' },
  { level: 2, id: 'нейронная_связь', isPremium: true, label: 'Нейронная связь', aliases: ['нейронная связь', 'нейросеть'], sparks: 100, exp: 150, cd: 8 * 60 * 1000, emoji: '🧠', msg: 'установил(а) нейронную связь, позволяющую испытывать эмоции друг друга, с' },
  { level: 3, id: 'параллельный_мир', isPremium: true, label: 'Параллельный мир', aliases: ['параллельный мир', 'мир'], sparks: 200, exp: 250, cd: 11 * 60 * 1000, emoji: '🌌', msg: 'перенёс(перенесла) в персональное измерение любви в Параллельном мире' },
  { level: 4, id: 'днк_любовь', isPremium: true, label: 'Днк любовь', aliases: ['днк любовь', 'днк'], sparks: 300, exp: 350, cd: 15 * 60 * 1000, emoji: '🧬', msg: 'закодировал(а) формулу бесконечной любви в ДНК вместе с' },
  { level: 5, id: 'квантовое_слияние', isPremium: true, label: 'Квантовое слияние', aliases: ['квантовое слияние', 'квант'], sparks: 400, exp: 450, cd: 20 * 60 * 1000, emoji: '⚛️', msg: 'осуществил(а) квантовое слияние душ с' },
  { level: 6, id: 'голограмма_чувств', isPremium: true, label: 'Голограмма чувств', aliases: ['голограмма чувств', 'голограмма'], sparks: 500, exp: 550, cd: 30 * 60 * 1000, emoji: '📽️', msg: 'спроецировал(а) сияющую голограмму искренних чувств для' },
  { level: 7, id: 'антигравитационный_танец', isPremium: true, label: 'Антигравитационный танец', aliases: ['антигравитационный танец', 'антигравитация'], sparks: 600, exp: 650, cd: 38 * 60 * 1000, emoji: '🪐', msg: 'закружил(а) в невесомости в антигравитационном танце' },
  { level: 8, id: 'хроносинхронизация', isPremium: true, label: 'Хроносинхронизация', aliases: ['хроносинхронизация', 'хроно'], sparks: 825, exp: 800, cd: 45 * 60 * 1000, emoji: '⏳', msg: 'синхронизировал(а) течение времени сердец в Хроносинхронизации с' },
  { level: 9, id: 'космическая_медитация', isPremium: true, label: 'Космическая медитация', aliases: ['космическая медитация', 'медитация'], sparks: 1050, exp: 1000, cd: 60 * 60 * 1000, emoji: '🧘', msg: 'погрузился(лась) в космическую медитацию гармонии вместе с' },
  { level: 10, id: 'мультивселенская_симуляция', isPremium: true, label: 'Мультивселенская симуляция', aliases: ['мультивселенская симуляция', 'симуляция'], sparks: 1600, exp: 1300, cd: 80 * 60 * 1000, emoji: '🌀', msg: 'создал(а) мультивселенскую симуляцию счастья для' },
  { level: 11, id: 'телепатическое_послание', isPremium: true, label: 'Телепатическое послание', aliases: ['телепатическое послание', 'телепатия'], sparks: 2500, exp: 1800, cd: 90 * 60 * 1000, emoji: '📡', msg: 'передал(а) нежнейшее телепатическое послание прямо в сердце' },
  { level: 12, id: 'энергетический_резонанс', isPremium: true, label: 'Энергетический резонанс', aliases: ['энергетический резонанс', 'резонанс'], sparks: 2800, exp: 2000, cd: 100 * 60 * 1000, emoji: '⚡', msg: 'вошёл(вошла) в мощнейший энергетический резонанс любви с' },
  { level: 13, id: 'биолюминесцентное_слияние', isPremium: true, label: 'Биолюминесцентное слияние', aliases: ['биолюминесцентное слияние', 'биолюминесценция'], sparks: 3300, exp: 2300, cd: 110 * 60 * 1000, emoji: '✨', msg: 'озарил(а) пространство биолюминесцентным сиянием любви с' },
  { level: 14, id: 'психосоматический_симбиоз', isPremium: true, label: 'Психосоматический симбиоз', aliases: ['психосоматический симбиоз', 'симбиоз'], sparks: 3800, exp: 2600, cd: 120 * 60 * 1000, emoji: '🧬', msg: 'достиг(ла) абсолютного психосоматического симбиоза с' },
  { level: 15, id: 'метаморфоза_среды', isPremium: true, label: 'Метаморфоза среды', aliases: ['метаморфоза среды', 'метаморфоза'], sparks: 4200, exp: 2900, cd: 130 * 60 * 1000, emoji: '🌐', msg: 'преобразил(а) саму ткань реальности в Метаморфозе среды вокруг' },
  { level: 16, id: 'трансцендентальное_переживание', isPremium: true, label: 'Трансцендентальное переживание', aliases: ['трансцендентальное переживание', 'трансцендентность'], sparks: 4600, exp: 3200, cd: 140 * 60 * 1000, emoji: '🔮', msg: 'испытал(а) высшее трансцендентальное переживание единения с' },
  { level: 17, id: 'астральное_путешествие', isPremium: true, label: 'Астральное путешествие', aliases: ['астральное путешествие', 'астрал'], sparks: 5100, exp: 3500, cd: 150 * 60 * 1000, emoji: '🌌', msg: 'отправился(лась) в захватывающее астральное путешествие рука об руку с' },
  { level: 18, id: 'нексус_сознаний', isPremium: true, label: 'Нексус сознаний', aliases: ['нексус сознаний', 'нексус'], sparks: 5700, exp: 3900, cd: 160 * 60 * 1000, emoji: '💠', msg: 'объединил(а) разумы в неделимый Нексус сознаний с' },
  { level: 19, id: 'сингулярность_чувств', isPremium: true, label: 'Сингулярность чувств', aliases: ['сингулярность чувств', 'сингулярность'], sparks: 6100, exp: 4200, cd: 170 * 60 * 1000, emoji: '💫', msg: 'сконцентрировал(а) всю мощь чувств в Сингулярности любви с' },
  { level: 20, id: 'квантовая_запутанность', isPremium: true, label: 'Вечная квантовая запутанность', aliases: ['вечная квантовая запутанность', 'квантовая запутанность'], sparks: 6809, exp: 4600, cd: 180 * 60 * 1000, emoji: '🔗', msg: 'навечно связал(а) квантовой запутанностью судьбу с' },
  { level: 21, id: 'сверхновая_связь', isPremium: true, label: 'Сверхновая связь', aliases: ['сверхновая связь', 'сверхновая'], sparks: 8171, exp: 5300, cd: 200 * 60 * 1000, emoji: '💥', msg: 'зажёг(зажгла) ослепительную Сверхновую связь любви с' },
  { level: 22, id: 'темпоральное_святилище', isPremium: true, label: 'Темпоральное святилище', aliases: ['темпоральное святилище', 'святилище'], sparks: 9806, exp: 6200, cd: 220 * 60 * 1000, emoji: '🏛️', msg: 'возвёл(возвела) несокрушимое Темпоральное святилище для' },
  { level: 23, id: 'резонансная_камера', isPremium: true, label: 'Межпространственная резонансная камера', aliases: ['межпространственная резонансная камера', 'резонансная камера'], sparks: 11767, exp: 7200, cd: 240 * 60 * 1000, emoji: '🛸', msg: 'активировал(а) Межпространственную резонансную камеру чувств с' },
  { level: 24, id: 'алхимия_душ', isPremium: true, label: 'Алхимия душ', aliases: ['алхимия душ', 'алхимия'], sparks: 14120, exp: 8400, cd: 260 * 60 * 1000, emoji: '🧪', msg: 'совершил(а) великое таинство Алхимии душ с' },
  { level: 25, id: 'абсолютная_гармония', isPremium: true, label: 'Абсолютная гармония', aliases: ['абсолютная гармония', 'гармония'], sparks: 16944, exp: 9800, cd: 280 * 60 * 1000, emoji: '☯️', msg: 'достиг(ла) вершины Абсолютной гармонии Вселенной с' },
  { level: 26, id: 'итерация_любви', isPremium: true, label: 'Бесконечная итерация любви', aliases: ['бесконечная итерация любви', 'итерация любви'], sparks: 20332, exp: 11500, cd: 300 * 60 * 1000, emoji: '♾️', msg: 'запустил(а) Бесконечную итерацию любви сквозь эпохи с' },
  { level: 27, id: 'квинтэссенция_бытия', isPremium: true, label: 'Квинтэссенция бытия', aliases: ['квинтэссенция бытия', 'квинтэссенция'], sparks: 24398, exp: 13500, cd: 320 * 60 * 1000, emoji: '🌟', msg: 'раскрыл(а) сокровенную Квинтэссенцию бытия вместе с' },
  { level: 28, id: 'панкосмическое_сознание', isPremium: true, label: 'Панкосмическое сознание', aliases: ['панкосмическое сознание'], sparks: 29278, exp: 15800, cd: 340 * 60 * 1000, emoji: '🪐', msg: 'расширил(а) любовь до Панкосмического сознания Вселенной с' },
  { level: 29, id: 'омега_точка', isPremium: true, label: 'Омега-точка слияния', aliases: ['омега-точка слияния', 'омега точка', 'омега'], sparks: 35134, exp: 18500, cd: 360 * 60 * 1000, emoji: '🔱', msg: 'достиг(ла) финальной Омега-точки слияния миров с' },
  { level: 30, id: 'божественная_унификация', isPremium: true, label: 'Божественная унификация', aliases: ['божественная унификация', 'унификация'], sparks: 42161, exp: 22000, cd: 400 * 60 * 1000, emoji: '👑', msg: 'слился(лась) воедино в высшей Божественной унификации с' }
];

const BED_ACTION = {
  level: 1,
  id: 'постель',
  label: 'Уединиться в постели',
  aliases: ['постель', 'кекс', 'секс', 'пошалить', 'уединиться в постели', 'уединиться'],
  sparks: 250,
  exp: 220,
  cd: 35 * 60 * 1000,
  emoji: '🔥',
  msg: 'страстно уединился(лась) в постели с',
  canConceive: true
};

const ALL_RELATION_ACTIONS = [...RELATION_ACTIONS, ...PREMIUM_RELATION_ACTIONS, BED_ACTION];

function isCouplePremium(marriage) {
  if (!marriage) return false;
  const now = new Date();
  if (marriage.isPremiumRelations && (!marriage.premiumExpiresAt || new Date(marriage.premiumExpiresAt) > now)) {
    return true;
  }
  if (marriage.isPremium && (!marriage.premiumUntil || new Date(marriage.premiumUntil) > now)) {
    return true;
  }
  return false;
}

function getActionCooldown(marriage, userId, actionId) {
  if (!marriage || !marriage.actionCooldowns) return null;
  const key = `${userId}_${actionId}`;
  let val = null;
  if (typeof marriage.actionCooldowns.get === 'function') {
    val = marriage.actionCooldowns.get(key);
  } else {
    val = marriage.actionCooldowns[key];
  }
  return val ? new Date(val) : null;
}

function setActionCooldown(marriage, userId, actionId, durationMs) {
  if (!marriage.actionCooldowns) marriage.actionCooldowns = new Map();
  const key = `${userId}_${actionId}`;
  const expiry = new Date(Date.now() + durationMs);
  if (typeof marriage.actionCooldowns.set === 'function') {
    marriage.actionCooldowns.set(key, expiry);
  } else {
    marriage.actionCooldowns[key] = expiry;
  }
}

function findRelationAction(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.toLowerCase().replace(/^[.!\/]?отн\s+/i, '').trim();
  if (!raw) return null;

  // 1. Прямое совпадение по id, label или aliases
  for (const act of ALL_RELATION_ACTIONS) {
    if (act.id === raw || act.label.toLowerCase() === raw) return act;
    if (act.aliases && act.aliases.some(a => a.toLowerCase() === raw)) return act;
  }

  // 2. Без служебных префиксов («сделать», «подарить», «устроить» и т.д.)
  const stripped = raw.replace(/^(сделать|подарить|устроить|приготовить|организовать|поехать в|отправиться в|провести|создать|написать|вырастить|пойти на|посмотреть)\s+/i, '').trim();
  if (stripped && stripped !== raw) {
    for (const act of ALL_RELATION_ACTIONS) {
      if (act.id === stripped || act.label.toLowerCase() === stripped) return act;
      if (act.aliases && act.aliases.some(a => a.toLowerCase() === stripped)) return act;
    }
  }

  // 3. Совпадение по началу фразы (например: «сделать завтрак любимой», «подарить цветы половинке»)
  for (const act of ALL_RELATION_ACTIONS) {
    if (raw.startsWith(act.label.toLowerCase())) return act;
    if (act.aliases && act.aliases.some(a => raw.startsWith(a.toLowerCase()))) return act;
    if (stripped && stripped !== raw) {
      if (stripped.startsWith(act.label.toLowerCase())) return act;
      if (act.aliases && act.aliases.some(a => stripped.startsWith(a.toLowerCase()))) return act;
    }
  }

  return null;
}

async function formatRelationActionsMessage(marriage, expanded = false, callerId = null) {
  const caller = callerId ? Number(callerId) : Number(marriage.userId);
  const partner = getPartnerId(marriage, caller);
  const callerNick = await getNicknameByTelegramId(caller);
  const partnerNick = await getNicknameByTelegramId(partner);

  const coupleLevel = getCoupleLevel(marriage);

  let msg = `${partnerNick}\n${callerNick},\n🔄 <b>Обычные действия</b>\n<blockquote>`;

  const regularList = expanded ? RELATION_ACTIONS : RELATION_ACTIONS.slice(0, 3);
  const totalRegular = RELATION_ACTIONS.length;

  regularList.forEach((act, idx) => {
    const isUnlocked = coupleLevel >= act.level;
    const badge = isUnlocked ? '✅' : '🔒';
    const cdText = formatActionCooldown(act.cd);
    const hasMore = !expanded && idx === regularList.length - 1 && totalRegular > regularList.length;
    msg += `[${act.level}] ${badge} • «${act.label}» | 🔥 +${act.sparks}|${cdText}${hasMore ? ' ⌵' : ''}\n`;
  });
  msg += `</blockquote>\n`;

  msg += `<i>💎 Доступно только с премиум-статусом</i>\n<blockquote>`;

  const premList = expanded ? PREMIUM_RELATION_ACTIONS : PREMIUM_RELATION_ACTIONS.slice(0, 3);
  const totalPrem = PREMIUM_RELATION_ACTIONS.length;

  premList.forEach((act, idx) => {
    const hasMore = !expanded && idx === premList.length - 1 && totalPrem > premList.length;
    if (expanded) {
      const cdText = formatActionCooldown(act.cd);
      msg += `[${act.level}] 💎 • «${act.label}» | 🔥 +${act.sparks}|${cdText}\n`;
    } else {
      msg += `[${act.level}] 💎 • ${act.label}${hasMore ? ' ⌵' : ''}\n`;
    }
  });
  msg += `</blockquote>\n`;

  msg += `🔥 • Пример действия: <b>.отн сделать завтрак</b>\n\n`;

  if (isCouplePremium(marriage)) {
    msg += `💎 • <b>Премиум-отношения активны!</b> (Кулдауны -35%, искры +20%)`;
  } else {
    msg += `💎 • Получите премиум-отношения для доступа к уникальным действиям!`;
  }

  return msg;
}

function getRelationActionsKeyboard(expanded = false) {
  const toggleBtn = expanded
    ? Markup.button.callback('Свернуть ⌃', 'rel_actions_collapse')
    : Markup.button.callback('Развернуть ⌵', 'rel_actions_expand');

  return Markup.inlineKeyboard([
    [Markup.button.callback('💎 Купить премиум отношения', 'rel_buy_premium')],
    [toggleBtn]
  ]);
}

const RELATION_HOUSES = [
  { level: 1, name: 'Шалаш в лесу', comfort: 10, upgradeCost: 300, icon: '⛺' },
  { level: 2, name: 'Уютная Студия', comfort: 30, upgradeCost: 1000, icon: '🏢' },
  { level: 3, name: 'Просторная Квартира', comfort: 70, upgradeCost: 3000, icon: '🏡' },
  { level: 4, name: 'Загородный Коттедж', comfort: 150, upgradeCost: 8000, icon: '🏠' },
  { level: 5, name: 'Пентхаус в Небоскрёбе', comfort: 350, upgradeCost: 20000, icon: '🏙️' },
  { level: 6, name: 'Королевская Вилла Grizzly', comfort: 800, upgradeCost: 50000, icon: '🏰' }
];

const GIFTS_CATALOG = [
  { id: 1, name: 'Шоколадка "Алёнка"', price: 500, sparks: 20, icon: '🍫' },
  { id: 2, name: 'Букет из 101 розы', price: 2500, sparks: 100, icon: '🌹' },
  { id: 3, name: 'Плюшевый мишка Grizzly', price: 10000, sparks: 400, icon: '🧸' },
  { id: 4, name: 'Золотое кольцо с сапфиром', price: 50000, sparks: 2000, icon: '💍' },
  { id: 5, name: 'Бриллиантовое колье', price: 150000, sparks: 6000, icon: '💎' },
  { id: 6, name: 'Спорткар для двоих', price: 500000, sparks: 20000, icon: '🏎️' }
];

const PET_EGGS = {
  'обычное': { price: 500, pool: [{ type: 'Котик', icon: '🐱', rarity: 'Обычный' }, { type: 'Щенок', icon: '🐶', rarity: 'Обычный' }] },
  'редкое': { price: 1500, pool: [{ type: 'Лисёнок', icon: '🦊', rarity: 'Редкий' }, { type: 'Енот', icon: '🦝', rarity: 'Редкий' }, { type: 'Пандочка', icon: '🐼', rarity: 'Редкий' }] },
  'легендарное': { price: 5000, pool: [{ type: 'Медвежонок Grizzly', icon: '🐻', rarity: 'Легендарный' }, { type: 'Дракончик', icon: '🐲', rarity: 'Легендарный' }, { type: 'Феникс', icon: '🔥', rarity: 'Легендарный' }] }
};

function generateProgressBar(current, max, size = 10) {
  const percent = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.round(percent * size);
  const empty = size - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function checkAndDeliverBaby(marriage) {
  if (marriage?.pregnancy?.isPregnant && marriage.pregnancy.dueAt && new Date() >= new Date(marriage.pregnancy.dueAt)) {
    const gender = marriage.pregnancy.babyGender || (Math.random() > 0.5 ? 'м' : 'ж');
    const defaultName = gender === 'м' ? 'Сыночек' : 'Доченька';
    if (!marriage.children) marriage.children = [];
    marriage.children.push({
      name: defaultName,
      gender: gender,
      birthDate: new Date(),
      intellect: 50,
      happiness: 85,
      health: 100,
      discipline: 50,
      creativity: 50,
      lastCare: new Date()
    });
    marriage.pregnancy.isPregnant = false;
    marriage.pregnancy.startedAt = null;
    marriage.pregnancy.dueAt = null;
    return true;
  }
  return false;
}

// === 👤 Установка пола (.мойпол м/ж) ===
bot.hears(/^\.мойпол(?:\s+(м|ж))?$/i, async (ctx) => {
  try {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('❌ Вы не зарегистрированы в боте. Используйте /start');

    const input = ctx.match[1]?.toLowerCase();
    if (!input) {
      const current = user.gender === 'м' ? 'Мужской (♂️)' : user.gender === 'ж' ? 'Женский (♀️)' : 'Не указан';
      return ctx.reply(`👤 <b>Ваш текущий пол:</b> ${current}\n\n💡 <i>Чтобы изменить пол, напишите:</i>\n<code>.мойпол м</code> — мужской (♂️)\n<code>.мойпол ж</code> — женский (♀️)`, { parse_mode: 'HTML' });
    }

    user.gender = input;
    await user.save();
    return ctx.reply(`✅ Ваш пол успешно установлен: <b>${input === 'м' ? 'Мужской (♂️)' : 'Женский (♀️)'}</b>!`, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('Ошибка в .мойпол:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 📌 Запрос на отношения (.отн запрос) ===
bot.hears(/^\.отн запрос(?:\s+(@\w+))?$/i, async (ctx) => {
  try {
    let targetId = null;

    if (ctx.match[1]) {
      const username = ctx.match[1].slice(1);
      const targetUser = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
      if (!targetUser) {
        return ctx.reply('❌ Пользователь с таким @username не найден в базе бота.');
      }
      targetId = targetUser.telegramId;
    } else if (ctx.message.reply_to_message) {
      targetId = ctx.message.reply_to_message.from.id;
    } else {
      return ctx.reply('❌ Используйте команду ответом на сообщение пользователя или укажите: <code>.отн запрос @username</code>', { parse_mode: 'HTML' });
    }

    const senderId = ctx.from.id;

    // Проверка, если пользователь пытается предложить отношения самому себе
    if (senderId === targetId) {
      return ctx.reply('❌ Вы не можете предложить отношения самому себе.');
    }

    // Проверяем, что оба пользователя зарегистрированы
    const sender = await User.findOne({ telegramId: senderId });
    const target = await User.findOne({ telegramId: targetId });
    
    if (!sender) {
      return ctx.reply('❌ Вы не зарегистрированы в боте. Используйте /start');
    }
    
    if (!target) {
      return ctx.reply('❌ Этот пользователь не зарегистрирован в боте.');
    }

    // Проверка на наличие активного запроса на отношения
    if (pendingRequests.has(targetId)) {
      const existingReq = pendingRequests.get(targetId);
      const existingRequesterId = typeof existingReq === 'object' ? existingReq.senderId : existingReq;
      const existingRequesterNickname = await getNicknameByTelegramId(existingRequesterId);
      return ctx.reply(`❌ У ${existingRequesterNickname} уже есть активный запрос к этому пользователю.`);
    }

    // Проверка, есть ли у отправителя уже отправленный активный запрос
    for (const [, req] of pendingRequests.entries()) {
      const sId = typeof req === 'object' ? req.senderId : req;
      if (Number(sId) === Number(senderId)) {
        return ctx.reply('❌ У вас уже есть активный отправленный запрос на отношения. Дождитесь ответа или истечения времени.');
      }
    }

    // ⚡ ОПТИМИЗАЦИЯ: Параллельная проверка браков отправителя и получателя
    const [senderMarriage, targetMarriage] = await Promise.all([
      Marriage.findOne({
        $or: [{ userId: senderId }, { partnerId: senderId }],
        status: 'accepted'
      }),
      Marriage.findOne({
        $or: [{ userId: targetId }, { partnerId: targetId }],
        status: 'accepted'
      })
    ]);

    // Если отправитель уже состоит в браке
    if (senderMarriage) {
      const partnerId = getPartnerId(senderMarriage, senderId);
      const partner = await User.findOne({ telegramId: partnerId });
      const partnerNickname = partner?.nickname || `User${partnerId}`;
      return ctx.reply(`❌ Вы уже состоите в браке с ${partnerNickname}.`, { parse_mode: 'HTML' });
    }

    // Если получатель уже состоит в браке
    if (targetMarriage) {
      const partnerId = getPartnerId(targetMarriage, targetId);
      const partner = await User.findOne({ telegramId: partnerId });
      const partnerNickname = partner?.nickname || `User${partnerId}`;
      return ctx.reply(`❌ Этот пользователь уже состоит в браке с ${partnerNickname}.`, { parse_mode: 'HTML' });
    }

    // Создаем запрос в базе данных
    const marriageRequest = new Marriage({
      userId: senderId,
      partnerId: targetId,
      status: 'pending'
    });
    await marriageRequest.save();

    // ⚡ ОПТИМИЗАЦИЯ: Параллельная загрузка пользователей для никнеймов
    const [senderUser, targetUser] = await Promise.all([
      User.findOne({ telegramId: senderId }),
      User.findOne({ telegramId: targetId })
    ]);
    
    const senderNickname = senderUser?.nickname || `User${senderId}`;
    const targetNickname = targetUser?.nickname || `User${targetId}`;

    const message = await ctx.reply(
      `<a href="tg://user?id=${senderId}">${escapeHtml(senderNickname)}</a>\n` +
      `<a href="tg://user?id=${targetId}">${escapeHtml(targetNickname)}</a>,\n` +
      `💖 • ${escapeHtml(targetNickname)} минуточку внимания! ${escapeHtml(senderNickname)} предлагает вступить в отношения.\n` +
      `🕒 • Запрос будет действителен в течение 2 минут.\n` +
      `💭 • Принять решение .отн да / .отн нет`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('Да', `accept_${targetId}_${senderId}`),
          Markup.button.callback('Нет', `decline_${targetId}_${senderId}`)
        ]])
      }
    );

    // Таймер для аннулирования запроса после 2 минут
    const reqTimer = setTimeout(async () => {
      const current = pendingRequests.get(targetId);
      const curReqId = typeof current === 'object' ? current.requestId?.toString() : null;
      if (curReqId === marriageRequest._id.toString() || current === senderId) {
        pendingRequests.delete(targetId);
        await Marriage.deleteOne({ _id: marriageRequest._id }).catch(() => {});
        ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, '⏳ Время вышло! Запрос аннулирован.').catch(() => {});
      }
    }, 120000); // 2 минуты

    pendingRequests.set(targetId, { senderId, requestId: marriageRequest._id, timer: reqTimer, timerId: reqTimer });

  } catch (error) {
    console.error('Ошибка в команде запроса на отношения:', error);
    ctx.reply('❌ Произошла ошибка при отправке запроса.');
  }
});

// Функция завершения вступления в отношения с генерацией свидетельства о браке на Canvas
async function completeMarriageAcceptance(ctx, marriageRequest, senderId, targetId, isButton = false) {
  marriageRequest.status = 'accepted';
  marriageRequest.acceptedAt = new Date();
  marriageRequest.lastActivity = new Date();
  marriageRequest.sparks = 100;
  marriageRequest.level = 1;
  marriageRequest.exp = 0;
  marriageRequest.house = { type: 'Шалаш в лесу', level: 1, comfort: 10, safeCookies: 0 };
  await marriageRequest.save();

  const [senderUser, targetUser] = await Promise.all([
    User.findOne({ telegramId: senderId }),
    User.findOne({ telegramId: targetId })
  ]);

  if (senderUser) {
    senderUser.partner = targetId;
    senderUser.cookies = (senderUser.cookies || 0) + 100;
    await senderUser.save();
  }
  if (targetUser) {
    targetUser.partner = senderId;
    targetUser.cookies = (targetUser.cookies || 0) + 100;
    await targetUser.save();
  }

  const senderNick = senderUser?.nickname || `User${senderId}`;
  const targetNick = targetUser?.nickname || `User${targetId}`;

  // Получаем аватары для свидетельства
  let p1Avatar = null;
  let p2Avatar = null;
  try {
    const p1Photos = await ctx.telegram.getUserProfilePhotos(senderId, 0, 1);
    if (p1Photos?.total_count > 0) {
      const link = await ctx.telegram.getFileLink(p1Photos.photos[0][p1Photos.photos[0].length - 1].file_id);
      p1Avatar = link.href || link;
    }
  } catch (e) {}

  try {
    const p2Photos = await ctx.telegram.getUserProfilePhotos(targetId, 0, 1);
    if (p2Photos?.total_count > 0) {
      const link = await ctx.telegram.getFileLink(p2Photos.photos[0][p2Photos.photos[0].length - 1].file_id);
      p2Avatar = link.href || link;
    }
  } catch (e) {}

  const certDateStr = new Date().toLocaleDateString('ru-RU');
  let certBuffer = null;
  try {
    certBuffer = await generateMarriageCertificate({
      partner1Nick: senderNick,
      partner2Nick: targetNick,
      dateStr: certDateStr,
      partner1Avatar: p1Avatar,
      partner2Avatar: p2Avatar
    });
  } catch (canvasErr) {
    console.error('Ошибка создания свидетельства о браке:', canvasErr);
  }

  const certCaption =
    '📒 • Дорогие молодые! От всего сердца поздравляю Вас с вступлением в законные отношения и ' +
    'образованием семьи! Любовь – самое прекрасное чувство в человеческой жизни. Пусть Ваша любовь будет ' +
    'такой же долгой, как Ваша жизнь! Живите в любви, счастье и радости, пусть у Вас будут здоровые детки ' +
    'и бесконечное тепло в доме!';

  if (isButton) {
    await ctx.editMessageText(
      `💖 <a href="tg://user?id=${targetId}">${escapeHtml(targetNick)}</a> принял(а) предложение <a href="tg://user?id=${senderId}">${escapeHtml(senderNick)}</a>!\n\n🎉 Поздравляем с началом законных отношений!\n🔥 Вашей паре начислено 100 стартовых искр!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  } else {
    await ctx.reply(
      `💖 <a href="tg://user?id=${targetId}">${escapeHtml(targetNick)}</a> принял(а) предложение <a href="tg://user?id=${senderId}">${escapeHtml(senderNick)}</a>!\n\n🎉 Поздравляем с началом законных отношений!\n🔥 Вашей паре начислено 100 стартовых искр!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  if (certBuffer) {
    await ctx.replyWithPhoto({ source: certBuffer }, { caption: certCaption, parse_mode: 'HTML' }).catch(async (pErr) => {
      console.error('Ошибка отправки свидетельства фото:', pErr);
      await ctx.reply(certCaption, { parse_mode: 'HTML' });
    });
  } else {
    await ctx.reply(certCaption, { parse_mode: 'HTML' });
  }

  ctx.telegram.sendMessage(
    senderId,
    `💖 <a href="tg://user?id=${targetId}">${escapeHtml(targetNick)}</a> согласился(лась) на ваши отношения! Поздравляем! 🎉\n🔥 Вашей паре начислено 100 стартовых искр!`,
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

// === ✅ Принятие запроса (Кнопка) ===
bot.action(/^accept_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const targetId = Number(ctx.match[1]); // Тот, кто должен принять
    const senderId = Number(ctx.match[2]); // Тот, кто отправил запрос

    // Проверяем, что запрос принимает именно тот, кому он был отправлен
    if (ctx.from.id !== targetId) {
      return ctx.answerCbQuery('❌ Это не ваш запрос.', { show_alert: true });
    }

    // Проверяем, активен ли запрос
    if (!pendingRequests.has(targetId)) {
      return ctx.editMessageText('⏳ Запрос уже недействителен.');
    }

    // Находим запрос в базе данных
    const marriageRequest = await Marriage.findOne({
      userId: senderId,
      partnerId: targetId,
      status: 'pending'
    });

    if (!marriageRequest) {
      return ctx.editMessageText('⏳ Запрос уже недействителен.');
    }

    // Удаляем из pending requests и очищаем таймер
    const existingReq = pendingRequests.get(targetId);
    if (existingReq && (existingReq.timerId || existingReq.timer)) clearTimeout(existingReq.timerId || existingReq.timer);
    pendingRequests.delete(targetId);

    // Завершаем принятие с генерацией свидетельства
    await completeMarriageAcceptance(ctx, marriageRequest, senderId, targetId, true);

  } catch (error) {
    console.error('Ошибка при принятии запроса:', error);
    ctx.answerCbQuery('❌ Произошла ошибка при принятии запроса.', { show_alert: true });
  }
});

// === ❌ Отклонение запроса (Кнопка) ===
bot.action(/^decline_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const targetId = Number(ctx.match[1]);
    const senderId = Number(ctx.match[2]);

    // Проверяем, что отклоняет именно тот, кому отправили запрос
    if (ctx.from.id !== targetId) {
      return ctx.answerCbQuery('❌ Это не ваш запрос.', { show_alert: true });
    }

    // Проверяем, активен ли запрос
    if (!pendingRequests.has(targetId)) {
      return ctx.editMessageText('⏳ Запрос уже недействителен.');
    }

    // Находим запрос в базе данных и удаляем его
    const marriageRequest = await Marriage.findOne({
      userId: senderId,
      partnerId: targetId,
      status: 'pending'
    });

    if (marriageRequest) {
      marriageRequest.status = 'divorced';
      marriageRequest.divorcedAt = new Date();
      await marriageRequest.save();
    }

    const existingReq = pendingRequests.get(targetId);
    if (existingReq && (existingReq.timerId || existingReq.timer)) clearTimeout(existingReq.timerId || existingReq.timer);
    pendingRequests.delete(targetId);
    
    const targetNickname = await getNicknameByTelegramId(targetId);
    const senderNickname = await getNicknameByTelegramId(senderId);
    
    ctx.editMessageText(`❌ ${targetNickname} отклонил(а) запрос от ${senderNickname}.`, { parse_mode: 'HTML' });
    
    // Уведомляем отправителя об отклонении
    ctx.telegram.sendMessage(
      senderId, 
      `💔 Ваше предложение было отклонено ${targetNickname}.`, 
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при отклонении запроса:', error);
    ctx.editMessageText('❌ Произошла ошибка при обработке запроса.');
  }
});

// === 📌 Текстовое подтверждение запроса на отношения (.отн да / .отн нет) ===
bot.hears(/^\.отн (да|нет)$/i, async (ctx) => {
  try {
    const targetId = ctx.from.id;
    const answer = ctx.match[1].toLowerCase();

    if (!pendingRequests.has(targetId)) {
      return ctx.reply('❌ У вас нет активных запросов на отношения.');
    }

    const reqData = pendingRequests.get(targetId);
    const senderId = typeof reqData === 'object' ? reqData.senderId : reqData;
    if (reqData && (reqData.timerId || reqData.timer)) clearTimeout(reqData.timerId || reqData.timer);
    pendingRequests.delete(targetId);

    const marriageRequest = await Marriage.findOne({
      userId: senderId,
      partnerId: targetId,
      status: 'pending'
    });

    if (!marriageRequest) {
      return ctx.reply('⏳ Запрос уже недействителен.');
    }

    const [senderUser, targetUser] = await Promise.all([
      User.findOne({ telegramId: senderId }),
      User.findOne({ telegramId: targetId })
    ]);

    const senderNick = senderUser?.nickname || `User${senderId}`;
    const targetNick = targetUser?.nickname || `User${targetId}`;

    if (answer === 'да') {
      await completeMarriageAcceptance(ctx, marriageRequest, senderId, targetId, false);
    } else {
      marriageRequest.status = 'divorced';
      marriageRequest.divorcedAt = new Date();
      await marriageRequest.save();

      ctx.reply(`💔 <a href="tg://user?id=${targetId}">${escapeHtml(targetNick)}</a> отклонил(а) предложение <a href="tg://user?id=${senderId}">${escapeHtml(senderNick)}</a>.`, { parse_mode: 'HTML' });
      ctx.telegram.sendMessage(senderId, `💔 Ваше предложение было отклонено.`, { parse_mode: 'HTML' }).catch(() => {});
    }
  } catch (err) {
    console.error('Ошибка в .отн да/нет:', err);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 📌 Расторжение брака (.отн развод) ===
bot.hears(/^\.отн развод/, async (ctx) => {
  try {
    const userId = ctx.from.id;

    // Проверяем, есть ли у пользователя активный брак
    const marriage = await Marriage.findOne({ 
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });

    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }

    const partnerId = getPartnerId(marriage, userId);

    // Обновляем статус брака на "разведен"
    marriage.status = 'divorced';
    marriage.divorcedAt = new Date();
    await marriage.save();

    // Убираем партнеров из профилей пользователей
    const user = await User.findOne({ telegramId: userId });
    const partner = await User.findOne({ telegramId: partnerId });
    
    if (user) {
      user.partner = null;
      await user.save();
    }
    
    if (partner) {
      partner.partner = null;
      await partner.save();
    }

    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);

    // Уведомляем о расторжении брака
    ctx.reply(`💔 Брак с ${partnerNickname} был расторгнут.\n\n😢 Отношения закончились...`, { parse_mode: 'HTML' });

    // Уведомляем партнера о расторжении брака
    ctx.telegram.sendMessage(
      partnerId,
      `💔 ${userNickname} расторгнул(а) ваши отношения.\n\n😢 Отношения закончились...`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

  } catch (error) {
    console.error('Ошибка при расторжении брака:', error);
    ctx.reply('❌ Произошла ошибка при расторжении брака.');
  }
});

// === 📌 Профиль отношений (.отн я / .отн статус / .отн профиль) ===
bot.hears(/^\.отн (я|статус|профиль)$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });

    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.\n💡 Чтобы предложить отношения: <code>.отн запрос @username</code>', { parse_mode: 'HTML' });
    }

    // Проверяем рождение ребенка, если подошел срок
    const babyBorn = checkAndDeliverBaby(marriage);

    marriage.sparks = marriage.sparks ?? 100;
    marriage.level = marriage.level ?? 1;
    marriage.exp = marriage.exp ?? 0;
    if (!marriage.house || !marriage.house.type) {
      marriage.house = { type: 'Шалаш в лесу', level: 1, comfort: 10, safeCookies: 0 };
    }
    await marriage.save();

    const partnerId = getPartnerId(marriage, userId);
    const [userDoc, partnerDoc] = await Promise.all([
      User.findOne({ telegramId: userId }),
      User.findOne({ telegramId: partnerId })
    ]);

    const userNick = userDoc?.nickname || `User${userId}`;
    const partnerNick = partnerDoc?.nickname || `User${partnerId}`;
    const userGender = userDoc?.gender === 'ж' ? '♀️' : userDoc?.gender === 'м' ? '♂️' : '❓';
    const partnerGender = partnerDoc?.gender === 'ж' ? '♀️' : partnerDoc?.gender === 'м' ? '♂️' : '❓';

    const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
    const daysTogether = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
    const maxExp = marriage.level * 250;
    const pBar = generateProgressBar(marriage.exp, maxExp, 10);
    const kidsCount = marriage.children?.length || 0;
    const petsCount = marriage.pets?.length || 0;
    const giftsCount = marriage.giftsList?.length || 0;

    let pregText = '';
    if (marriage.pregnancy?.isPregnant) {
      const leftHours = Math.max(0, Math.ceil((new Date(marriage.pregnancy.dueAt).getTime() - Date.now()) / (1000 * 60 * 60)));
      pregText = `\n🤰 <b>Ожидание малыша:</b> роды через ~${leftHours} ч. (.узи)`;
    }

    const babyNotice = babyBorn ? '\n🎉 <b>Радостная весть:</b> У вас родился малыш! Загляните в меню: <code>.рб</code>\n' : '';

    const profileText = `
💖 <b>ПРОФИЛЬ ВАШЕЙ ПАРЫ</b>
${babyNotice}
💑 <b>Пара:</b> <a href="tg://user?id=${userId}">${userNick}</a> (${userGender}) ❤️ <a href="tg://user?id=${partnerId}">${partnerNick}</a> (${partnerGender})
💍 <b>Свидетельство:</b> №${marriage._id.toString().slice(-6).toUpperCase()}
⏳ <b>Вместе:</b> ${daysTogether} дн. (с ${new Date(startDate).toLocaleDateString('ru-RU')})

⭐ <b>Уровень отношений:</b> ${marriage.level}/30 [${pBar}]
✨ <b>Опыт:</b> ${marriage.exp} / ${maxExp} XP
🔥 <b>Баланс искр:</b> ${utils.sp(marriage.sparks)} искр

🏠 <b>Дом:</b> ${marriage.house.type} (Уют: ${marriage.house.comfort})
💰 <b>Сейф в доме:</b> ${utils.sp(marriage.house.safeCookies || 0)} 🍪
👶 <b>Детей в семье:</b> ${kidsCount}${pregText}
🐾 <b>Питомцев:</b> ${petsCount}
🎁 <b>Подарков в коллекции:</b> ${giftsCount} шт.
💎 <b>Премиум-пара:</b> ${marriage.isPremium ? 'Да (активен 👑)' : 'Нет'}

💡 <i>Действия: .отн действия | Дом: .отн дом | Дети: .рб | Питомцы: .отн пт</i>
`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✨ Действия', 'rel_menu_actions'), Markup.button.callback('🏠 Дом пары', 'rel_menu_house')],
      [Markup.button.callback('👶 Дети (.рб)', 'rel_menu_kids'), Markup.button.callback('🐾 Питомцы', 'rel_menu_pets')],
      [Markup.button.callback('🎁 Подарки', 'rel_menu_gifts'), Markup.button.callback('🔥 Баланс искр', 'rel_menu_sparks')]
    ]);

    return ctx.reply(profileText, { parse_mode: 'HTML', ...keyboard });
  } catch (error) {
    console.error('Ошибка при получении профиля отношений:', error);
    ctx.reply('❌ Произошла ошибка при получении профиля отношений.');
  }
});

// === 🎭 Выполнение действия отношений (функция) ===
async function executeRelationAction(ctx, act) {
  const userId = Number(ctx.from.id);
  const marriage = await Marriage.findOne({
    $or: [{ userId }, { partnerId: userId }],
    status: 'accepted'
  });
  if (!marriage) {
    return ctx.reply('❌ Вы не состоите в отношениях.\n💡 Чтобы предложить отношения: <code>.отн запрос @username</code>', { parse_mode: 'HTML' });
  }

  // 1. Проверка премиум-действия
  const isPrem = isCouplePremium(marriage);
  if (act.isPremium && !isPrem) {
    return ctx.reply(
      `💎 Действие «<b>${act.label}</b>» доступно только для пар с премиум-статусом отношений!\n\n` +
      `💡 <i>Получите премиум-отношения для доступа к уникальным действиям:</i> <code>.отн премиум</code>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💎 Купить премиум отношения', 'rel_buy_premium')]
        ])
      }
    );
  }

  // 2. Проверка уровня пары
  const coupleLevel = getCoupleLevel(marriage);
  if (coupleLevel < act.level) {
    return ctx.reply(`🔒 Действие «<b>${act.label}</b>» откроется на <b>${act.level}</b> уровне отношений! (Ваш текущий уровень: <b>${coupleLevel}</b>)`, { parse_mode: 'HTML' });
  }

  // 3. Проверка индивидуального кулдауна на это действие
  const cdDate = getActionCooldown(marriage, userId, act.id);
  if (cdDate && new Date() < cdDate) {
    const callerNick = await getNicknameByTelegramId(userId);
    const leftSec = Math.ceil((cdDate.getTime() - Date.now()) / 1000);
    const m = Math.floor(leftSec / 60);
    const s = leftSec % 60;
    const timeStr = m > 0 ? `${m}м. ${s}с` : `${s}с`;
    return ctx.reply(`${callerNick},\n⏳ • Действие «<b>${act.label}</b>» на перезарядке! Следующие действия будут доступны через <b>${timeStr}</b>.`, { parse_mode: 'HTML' });
  }

  // 4. Применение отката (для премиум-пар откат на 35% быстрее, как на celya.ru)
  const cooldownDuration = isPrem ? Math.round(act.cd * 0.65) : act.cd;
  setActionCooldown(marriage, userId, act.id, cooldownDuration);
  marriage.markModified('actionCooldowns');

  // 5. Начисление искр и опыта (премиум +20% искр)
  const sparksEarned = isPrem ? Math.round(act.sparks * 1.2) : act.sparks;
  marriage.sparks = (marriage.sparks || 0) + sparksEarned;
  marriage.exp = (marriage.exp || 0) + act.exp;
  marriage.lastActivity = new Date();

  // 6. Проверка уровня отношений
  let levelUpNotice = '';
  const oldLevel = marriage.level || 1;
  const newLevel = getCoupleLevel(marriage);
  marriage.level = newLevel;
  if (newLevel > oldLevel) {
    const lvlInfo = RELATION_LEVEL_THRESHOLDS.find(t => t.level === newLevel);
    levelUpNotice = `\n\n🎉 <b>LEVEL UP!</b> Уровень вашей пары повышен до <b>${newLevel}/30</b> («${lvlInfo?.title || ''}»)!`;
  }

  // 7. Проверка зачатия для интимных действий
  let conceptionNotice = '';
  if (act.canConceive && (!marriage.pregnancy || !marriage.pregnancy.isPregnant)) {
    if (Math.random() < 0.35) {
      if (!marriage.pregnancy) marriage.pregnancy = {};
      marriage.pregnancy.isPregnant = true;
      marriage.pregnancy.startedAt = new Date();
      marriage.pregnancy.dueAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      marriage.pregnancy.babyGender = Math.random() > 0.5 ? 'м' : 'ж';
      marriage.pregnancy.motherId = userId;
      conceptionNotice = `\n\n🤰 <b>Чудо любви!</b> Кажется, эта страстная ночь принесла плоды... Тест показал две полоски! 👶 Используйте <code>.узи</code>, чтобы узнать подробности!`;
    }
  }

  await marriage.save();

  // 8. Кликабельные никнеймы обоих партнеров и оформление по стандарту celya.ru
  const partnerId = getPartnerId(marriage, userId);
  const userNick = await getNicknameByTelegramId(userId);
  const partnerNick = await getNicknameByTelegramId(partnerId);
  const cdFormatted = formatActionCooldown(cooldownDuration);

  const replyMsg = `${partnerNick}\n${userNick},\n${act.emoji} • ${userNick} ${act.msg} своей половинке ${partnerNick}\n🔥 • Искры +${sparksEarned}\n🕙 • Следующие действия будут доступны через ${cdFormatted}${levelUpNotice}${conceptionNotice}`;

  return ctx.reply(replyMsg, { parse_mode: 'HTML' });
}

// === ✨ Отображение списка действий отношений (render-функция) ===
async function renderRelationActions(ctx, expanded = false, edit = false) {
  const userId = ctx.from.id;
  const marriage = await Marriage.findOne({
    $or: [{ userId }, { partnerId: userId }],
    status: 'accepted'
  });
  if (!marriage) {
    if (edit) {
      return ctx.editMessageText('❌ Вы не состоите в отношениях.\n💡 Чтобы предложить отношения: <code>.отн запрос @username</code>', { parse_mode: 'HTML' }).catch(() => {});
    }
    return ctx.reply('❌ Вы не состоите в отношениях.\n💡 Чтобы предложить отношения: <code>.отн запрос @username</code>', { parse_mode: 'HTML' });
  }

  const text = await formatRelationActionsMessage(marriage, expanded, userId);
  const keyboard = getRelationActionsKeyboard(expanded);

  if (edit) {
    return ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard }).catch((e) => {
      if (!e.message.includes('message is not modified')) console.error(e);
    });
  }
  return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
}

// === ✨ Список действий отношений (.отн действия) ===
bot.hears(/^[.!\/]?отн действия$/i, async (ctx) => {
  try {
    return await renderRelationActions(ctx, false, false);
  } catch (e) {
    console.error('Ошибка в .отн действия:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🔘 Интерактивное переключение: Развернуть / Свернуть список действий ===
bot.action('rel_actions_expand', async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    return await renderRelationActions(ctx, true, true);
  } catch (e) {
    console.error('Ошибка в rel_actions_expand:', e.message);
  }
});

bot.action('rel_actions_collapse', async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    return await renderRelationActions(ctx, false, true);
  } catch (e) {
    console.error('Ошибка в rel_actions_collapse:', e.message);
  }
});

// === 💎 Меню покупки премиум-отношений (кнопка) ===
bot.action('rel_buy_premium', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) {
      return ctx.answerCbQuery('❌ Вы не состоите в отношениях.', { show_alert: true });
    }
    await ctx.answerCbQuery().catch(() => {});

    const user = await User.findOne({ telegramId: userId });
    const userCookies = user?.cookies || 0;
    const isPrem = isCouplePremium(marriage);
    let statusText = '❌ Не активен';
    if (isPrem) {
      if (marriage.premiumExpiresAt) {
        statusText = `✅ Активен до ${new Date(marriage.premiumExpiresAt).toLocaleDateString('ru-RU')}`;
      } else {
        statusText = '👑 Активен навсегда';
      }
    }

    const premText = `💎 <b>ПРЕМИУМ-СТАТУС ОТНОШЕНИЙ</b> 💎\n\n` +
      `<b>Текущий статус пары:</b> ${statusText}\n` +
      `💰 <b>Ваш баланс печенек:</b> ${utils.sp(userCookies)} 🍪\n\n` +
      `✨ <b>Преимущества премиум-отношений:</b>\n` +
      `• 🔮 Доступ ко всем эксклюзивным премиум-действиям: «Аура эмпатии», «Нейронная связь», «Параллельный мир» и др.\n` +
      `• ⚡ Ускоренная перезарядка: кулдаун ВСЕХ действий снижен на 30%!\n` +
      `• 🔥 Бонус искр: +20% ко всем получаемым искрам!\n` +
      `• 👑 Специальный статус и значок пары в профиле\n\n` +
      `🛍️ <b>Выберите тариф подписки:</b>`;

    const premKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💎 7 дней — 5.000 🍪', 'rel_buy_prem_7')],
      [Markup.button.callback('💎 30 дней — 15.000 🍪', 'rel_buy_prem_30')],
      [Markup.button.callback('👑 Навсегда — 50.000 🍪', 'rel_buy_prem_perm')],
      [Markup.button.callback('◀️ Назад к действиям', 'rel_back_to_actions')]
    ]);

    await ctx.reply(premText, { parse_mode: 'HTML', ...premKeyboard });
  } catch (e) {
    console.error('Ошибка в rel_buy_premium:', e);
  }
});

// Возврат к действиям
bot.action('rel_back_to_actions', async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    return await renderRelationActions(ctx, false, false);
  } catch (e) {
    console.error('Ошибка в rel_back_to_actions:', e);
  }
});

// Обработка покупки тарифов премиума
bot.action(/^rel_buy_prem_(7|30|perm)$/, async (ctx) => {
  try {
    const plan = ctx.match[1];
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) {
      return ctx.answerCbQuery('❌ Вы не состоите в отношениях.', { show_alert: true });
    }

    const prices = { '7': 5000, '30': 15000, 'perm': 50000 };
    const cost = prices[plan];

    // ⚡ Атомарное списание печенек за премиум с компенсацией
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: userId, cookies: { $gte: cost } },
      { $inc: { cookies: -cost } },
      { new: true }
    );
    if (!updatedUser) {
      return ctx.answerCbQuery(`❌ Недостаточно печенек! Требуется: ${utils.sp(cost)} 🍪`, { show_alert: true });
    }

    const now = Date.now();
    let currentExp = marriage.premiumExpiresAt && new Date(marriage.premiumExpiresAt) > new Date()
      ? new Date(marriage.premiumExpiresAt).getTime()
      : now;

    let newExp;
    let periodText;
    if (plan === '7') {
      newExp = new Date(currentExp + 7 * 24 * 60 * 60 * 1000);
      periodText = '7 дней';
    } else if (plan === '30') {
      newExp = new Date(currentExp + 30 * 24 * 60 * 60 * 1000);
      periodText = '30 дней';
    } else {
      newExp = new Date(now + 100 * 365 * 24 * 60 * 60 * 1000);
      periodText = 'навсегда';
    }

    try {
      await Marriage.findOneAndUpdate(
        { _id: marriage._id },
        {
          $set: {
            isPremium: true,
            isPremiumRelations: true,
            premiumUntil: newExp,
            premiumExpiresAt: newExp,
            lastActivity: new Date()
          }
        }
      );
    } catch (mErr) {
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: cost } }
      );
      throw mErr;
    }

    await ctx.answerCbQuery('🎉 Премиум-отношения успешно активированы!', { show_alert: true });

    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);

    await ctx.reply(
      `🎉 <b>ПОЗДРАВЛЯЕМ С ПРЕМИУМ-СТАТУСОМ!</b> 💎\n\n` +
      `👑 ${userNickname} активировал(а) Премиум-отношения для вашей пары на <b>${periodText}</b>!\n\n` +
      `⚡ Кулдауны действий снижены на 30%\n🔥 Получаемые искры увеличены на 20%\n✨ Открыт доступ ко всем премиум-действиям (<code>.отн действия</code>)!`,
      { parse_mode: 'HTML' }
    );

    ctx.telegram.sendMessage(
      partnerId,
      `🎉 <b>Премиум-отношения активированы!</b> 💎\n\nВаша вторая половинка приобрела Премиум-статус отношений для вашей пары на <b>${periodText}</b>! 👑`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

  } catch (e) {
    console.error('Ошибка покупки премиума отношений:', e);
    ctx.answerCbQuery('❌ Ошибка при оформлении премиума.', { show_alert: true });
  }
});

// === 💎 Текстовая команда .отн премиум ===
bot.hears(/^\.отн премиум(?:\s+(?:купить\s+)?(7|30|навсегда))?$/i, async (ctx) => {
  try {
    const plan = ctx.match[1]?.toLowerCase();
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    if (!plan) {
      // Показать меню с кнопками
      const user = await User.findOne({ telegramId: userId });
      const userCookies = user?.cookies || 0;
      const isPrem = isCouplePremium(marriage);
      let statusText = '❌ Не активен';
      if (isPrem) {
        if (marriage.premiumExpiresAt) {
          statusText = `✅ Активен до ${new Date(marriage.premiumExpiresAt).toLocaleDateString('ru-RU')}`;
        } else {
          statusText = '👑 Активен навсегда';
        }
      }

      const premText = `💎 <b>ПРЕМИУМ-СТАТУС ОТНОШЕНИЙ</b> 💎\n\n` +
        `<b>Текущий статус пары:</b> ${statusText}\n` +
        `💰 <b>Ваш баланс печенек:</b> ${utils.sp(userCookies)} 🍪\n\n` +
        `✨ <b>Преимущества премиум-отношений:</b>\n` +
        `• 🔮 Эксклюзивные действия: «Аура эмпатии», «Нейронная связь», «Параллельный мир» и др.\n` +
        `• ⚡ Кулдаун всех действий снижен на 30%!\n` +
        `• 🔥 +20% ко всем получаемым искрам!\n\n` +
        `🛍️ <i>Для покупки напишите:</i>\n` +
        `<code>.отн премиум купить 7</code> (5.000 🍪)\n` +
        `<code>.отн премиум купить 30</code> (15.000 🍪)\n` +
        `<code>.отн премиум купить навсегда</code> (50.000 🍪)`;

      const premKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💎 7 дней — 5.000 🍪', 'rel_buy_prem_7')],
        [Markup.button.callback('💎 30 дней — 15.000 🍪', 'rel_buy_prem_30')],
        [Markup.button.callback('👑 Навсегда — 50.000 🍪', 'rel_buy_prem_perm')],
        [Markup.button.callback('◀️ Назад к действиям', 'rel_back_to_actions')]
      ]);

      return ctx.reply(premText, { parse_mode: 'HTML', ...premKeyboard });
    }

    const key = plan === 'навсегда' ? 'perm' : plan;
    const prices = { '7': 5000, '30': 15000, 'perm': 50000 };
    const cost = prices[key];
    if (!cost) return ctx.reply('❌ Неверный тариф. Доступно: <code>7</code>, <code>30</code>, <code>навсегда</code>');

    const user = await User.findOne({ telegramId: userId });
    if (!user || (user.cookies || 0) < cost) {
      return ctx.reply(`❌ Недостаточно печенек! Требуется: <b>${utils.sp(cost)}</b> 🍪, у вас: <b>${utils.sp(user?.cookies || 0)}</b> 🍪`, { parse_mode: 'HTML' });
    }

    user.cookies -= cost;
    const now = Date.now();
    let currentExp = marriage.premiumExpiresAt && new Date(marriage.premiumExpiresAt) > new Date()
      ? new Date(marriage.premiumExpiresAt).getTime()
      : now;

    let newExp;
    let periodText;
    if (key === '7') {
      newExp = new Date(currentExp + 7 * 24 * 60 * 60 * 1000);
      periodText = '7 дней';
    } else if (key === '30') {
      newExp = new Date(currentExp + 30 * 24 * 60 * 60 * 1000);
      periodText = '30 дней';
    } else {
      newExp = new Date(now + 100 * 365 * 24 * 60 * 60 * 1000);
      periodText = 'навсегда';
    }

    marriage.isPremium = true;
    marriage.isPremiumRelations = true;
    marriage.premiumUntil = newExp;
    marriage.premiumExpiresAt = newExp;

    await Promise.all([user.save(), marriage.save()]);

    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);

    await ctx.reply(
      `🎉 <b>ПОЗДРАВЛЯЕМ С ПРЕМИУМ-СТАТУСОМ!</b> 💎\n\n` +
      `👑 ${userNickname} активировал(а) Премиум-отношения для вашей пары на <b>${periodText}</b>!\n\n` +
      `⚡ Кулдауны действий снижены на 30%\n🔥 Получаемые искры увеличены на 20%\n✨ Открыт доступ ко всем премиум-действиям (<code>.отн действия</code>)!`,
      { parse_mode: 'HTML' }
    );

    ctx.telegram.sendMessage(
      partnerId,
      `🎉 <b>Премиум-отношения активированы!</b> 💎\n\nВаша вторая половинка приобрела Премиум-статус отношений для вашей пары на <b>${periodText}</b>! 👑`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

  } catch (e) {
    console.error('Ошибка в .отн премиум:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🎭 Динамическое выполнение действий отношений (.отн <действие>) ===
bot.hears(/^[.!\/]?отн\s+(.+)$/i, async (ctx, next) => {
  try {
    const rawAction = ctx.match[1].trim();

    // 1. Покупка подарка: .отн подарить <номер>
    if (/^подарить\s+\d+$/i.test(rawAction)) {
      return next();
    }

    // 2. Исключаем системные команды раздела отношений
    const systemKeywords = [
      'запрос', 'да', 'нет', 'развод', 'я', 'статус', 'профиль',
      'действия', 'дом', 'искры', 'подарки', 'пт', 'брак', 'помощь',
      'свадьба', 'банк', 'премиум', 'прем', 'топ', 'годовщина',
      'статистика', 'стата', 'задания', 'обида', 'документ', 'список'
    ];
    const firstWord = rawAction.split(/\s+/)[0].toLowerCase();
    if (systemKeywords.includes(firstWord)) {
      return next();
    }

    const act = findRelationAction(rawAction);
    if (!act) {
      return next();
    }

    return await executeRelationAction(ctx, act);
  } catch (e) {
    console.error('Ошибка в обработчике действия .отн:', e);
    ctx.reply('❌ Произошла ошибка при выполнении действия.');
  }
});

// Отдельная команда .постель / .секс / .кекс как шорткат
bot.hears(/^[.!\/]?(постель|секс|кекс)$/i, async (ctx) => {
  const act = ALL_RELATION_ACTIONS.find(a => a.id === 'постель');
  if (act) return executeRelationAction(ctx, act);
});

// === 🔥 Искры отношений (.отн искры / .отн искры купить <кол-во>) ===
bot.hears(/^\.отн искры(?:\s+купить\s+(\d+))?$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    const buyAmount = ctx.match[1] ? parseInt(ctx.match[1], 10) : null;

    if (!buyAmount) {
      marriage.sparks = marriage.sparks ?? 100;
      return ctx.reply(`
┏ 🔥 <b>МАГАЗИН И БАЛАНС ИСКР</b> 🔥 ┓

💰 <b>Текущий баланс искр пары:</b> ${utils.sp(marriage.sparks)} 🔥
⭐ <b>Уровень отношений:</b> ${marriage.level}/30

💡 <b>Курс обмена:</b> 1 искра = 10 печенек 🍪
Для покупки искр напишите:
<code>.отн искры купить &lt;количество&gt;</code>
<i>(например: <code>.отн искры купить 100</code> обойдется в 1.000 печенек)</i>
`, { parse_mode: 'HTML' });
    }

    if (buyAmount < 1 || buyAmount > 100000) {
      return ctx.reply('❌ Укажите количество от 1 до 100.000 искр.');
    }

    const cost = buyAmount * 10;
    // ⚡ Атомарное списание печенек с проверкой баланса
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: userId, cookies: { $gte: cost } },
      { $inc: { cookies: -cost } },
      { new: true }
    );
    if (!updatedUser) {
      const freshUser = await User.findOne({ telegramId: userId });
      return ctx.reply(`❌ У вас недостаточно печенек. Нужно: <b>${utils.sp(cost)}</b> 🍪, у вас: <b>${utils.sp(freshUser?.cookies || 0)}</b> 🍪`, { parse_mode: 'HTML' });
    }

    let updatedMarriage;
    try {
      updatedMarriage = await Marriage.findOneAndUpdate(
        { _id: marriage._id },
        { $inc: { sparks: buyAmount } },
        { new: true }
      );
    } catch (mErr) {
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: cost } }
      );
      throw mErr;
    }

    return ctx.reply(`✅ Вы успешно обменяли <b>${utils.sp(cost)}</b> 🍪 на <b>+${utils.sp(buyAmount)}</b> 🔥 искр!\n🔥 Баланс искр пары: <b>${utils.sp(updatedMarriage?.sparks || 0)}</b>`, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('Ошибка в .отн искры:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🏠 Дом пары (.отн дом / .отн дом улучшить / .отн дом сейф ...) ===
bot.hears(/^\.отн дом(?:\s+(улучшить|сейф(?:\s+(положить|снять)\s+(\d+))?))?$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    if (!marriage.house || !marriage.house.type) {
      marriage.house = { type: 'Шалаш в лесу', level: 1, comfort: 10, safeCookies: 0 };
    }

    const sub = ctx.match[1]?.toLowerCase();

    // 1. Улучшение дома
    if (sub === 'улучшить') {
      const currentLvl = marriage.house.level || 1;
      const currentHouse = RELATION_HOUSES.find(h => h.level === currentLvl);
      const nextHouse = RELATION_HOUSES.find(h => h.level === currentLvl + 1);

      if (!nextHouse) {
        return ctx.reply('🏰 Ваш дом уже достиг максимального королевского уровня!');
      }

      // ⚡ Атомарное списание искр и улучшение уровня дома
      const updatedMarriage = await Marriage.findOneAndUpdate(
        { _id: marriage._id, sparks: { $gte: currentHouse.upgradeCost }, 'house.level': currentLvl },
        {
          $inc: { sparks: -currentHouse.upgradeCost },
          $set: {
            'house.level': nextHouse.level,
            'house.type': nextHouse.name,
            'house.comfort': nextHouse.comfort
          }
        },
        { new: true }
      );

      if (!updatedMarriage) {
        const freshMarriage = await Marriage.findById(marriage._id);
        const currentSparks = freshMarriage?.sparks || 0;
        if (currentSparks < currentHouse.upgradeCost) {
          return ctx.reply(`❌ Для улучшения дома требуется <b>${utils.sp(currentHouse.upgradeCost)}</b> 🔥 искр.\nУ вас в наличии: <b>${utils.sp(currentSparks)}</b> 🔥.\n💡 Купите искры: <code>.отн искры купить</code>`, { parse_mode: 'HTML' });
        }
        return ctx.reply('❌ Не удалось улучшить дом или он уже был улучшен.');
      }

      return ctx.reply(`🎉 <b>Поздравляем с новосельем!</b>\n${nextHouse.icon} Теперь ваше жилье: <b>${nextHouse.name}</b>!\n✨ Уровень уюта вырос до: <b>${nextHouse.comfort}</b>`, { parse_mode: 'HTML' });
    }

    // 2. Сейф в доме
    if (sub && sub.startsWith('сейф')) {
      const parts = ctx.message.text.split(/\s+/);
      const action = parts[3]?.toLowerCase();
      const amount = parseInt(parts[4], 10);

      if (!action || isNaN(amount) || amount <= 0) {
        return ctx.reply(`
💰 <b>Семейный сейф в доме:</b> ${utils.sp(marriage.house.safeCookies || 0)} 🍪

💡 <i>Команды сейфа:</i>
<code>.отн дом сейф положить &lt;сумма&gt;</code>
<code>.отн дом сейф снять &lt;сумма&gt;</code>
`, { parse_mode: 'HTML' });
      }

      const user = await User.findOne({ telegramId: userId });

      if (action === 'положить') {
        const updatedUser = await User.findOneAndUpdate(
          { telegramId: userId, cookies: { $gte: amount } },
          { $inc: { cookies: -amount } },
          { new: true }
        );
        if (!updatedUser) {
          const freshUser = await User.findOne({ telegramId: userId });
          return ctx.reply(`❌ У вас недостаточно печенек на руках. Баланс: ${utils.sp(freshUser?.cookies || 0)} 🍪`);
        }
        let updatedMarriage;
        try {
          updatedMarriage = await Marriage.findOneAndUpdate(
            { _id: marriage._id },
            { $inc: { 'house.safeCookies': amount } },
            { new: true }
          );
        } catch (mErr) {
          await User.findOneAndUpdate(
            { telegramId: userId },
            { $inc: { cookies: amount } }
          );
          throw mErr;
        }
        return ctx.reply(`✅ Вы положили <b>${utils.sp(amount)}</b> 🍪 в семейный сейф!\n💰 Баланс сейфа: <b>${utils.sp(updatedMarriage?.house?.safeCookies || 0)}</b> 🍪`, { parse_mode: 'HTML' });
      } else if (action === 'снять') {
        const updatedMarriage = await Marriage.findOneAndUpdate(
          { _id: marriage._id, 'house.safeCookies': { $gte: amount } },
          { $inc: { 'house.safeCookies': -amount } },
          { new: true }
        );
        if (!updatedMarriage) {
          const freshMarriage = await Marriage.findById(marriage._id);
          return ctx.reply(`❌ В сейфе недостаточно печенек. Баланс сейфа: ${utils.sp(freshMarriage?.house?.safeCookies || 0)} 🍪`);
        }
        try {
          await User.findOneAndUpdate(
            { telegramId: userId },
            { $inc: { cookies: amount } }
          );
        } catch (uErr) {
          await Marriage.findOneAndUpdate(
            { _id: marriage._id },
            { $inc: { 'house.safeCookies': amount } }
          );
          throw uErr;
        }
        return ctx.reply(`✅ Вы забрали <b>${utils.sp(amount)}</b> 🍪 из семейного сейфа!\n💰 Баланс сейфа: <b>${utils.sp(updatedMarriage?.house?.safeCookies || 0)}</b> 🍪`, { parse_mode: 'HTML' });
      }
    }

    // 3. Просмотр дома
    const currentLvl = marriage.house.level || 1;
    const currentHouse = RELATION_HOUSES.find(h => h.level === currentLvl) || RELATION_HOUSES[0];
    const nextHouse = RELATION_HOUSES.find(h => h.level === currentLvl + 1);

    const upgradeText = nextHouse
      ? `\n⬆️ <b>Следующее жилье:</b> ${nextHouse.icon} ${nextHouse.name} (Стоимость: ${utils.sp(currentHouse.upgradeCost)} 🔥)\n💡 <i>Для улучшения введите:</i> <code>.отн дом улучшить</code>`
      : '\n👑 <i>У вас максимальное жилье!</i>';

    return ctx.reply(`
${currentHouse.icon} <b>ОБЩИЙ ДОМ ПАРЫ</b>

🏡 <b>Тип жилья:</b> ${marriage.house.type} (${currentLvl}/6 ур.)
✨ <b>Уровень уюта:</b> ${marriage.house.comfort}
💰 <b>Семейный сейф:</b> ${utils.sp(marriage.house.safeCookies || 0)} 🍪
${upgradeText}

💡 <i>Команды сейфа: .отн дом сейф положить/снять &lt;сумма&gt;</i>
`, { parse_mode: 'HTML' });

  } catch (e) {
    console.error('Ошибка в .отн дом:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🎁 Магазин подарков (.отн подарки) ===
bot.hears(/^\.отн подарки$/i, async (ctx) => {
  try {
    let text = '🎁 <b>РОМАНТИЧЕСКИЙ МАГАЗИН ПОДАРКОВ</b> 🎁\n\n';
    text += 'Порадуйте любимого человека подарком в профиль пары:\n\n';
    for (const g of GIFTS_CATALOG) {
      text += `[${g.id}] ${g.icon} • <b>${g.name}</b>\n`;
      text += `     💰 Цена: ${utils.sp(g.price)} 🍪 | 🔥 Даёт: +${utils.sp(g.sparks)} искр\n`;
    }
    text += '\n💡 <i>Чтобы подарить, напишите:</i>\n<code>.отн подарить &lt;номер 1-6&gt;</code> (например: <code>.отн подарить 2</code>)';
    return ctx.reply(text, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('Ошибка в .отн подарки:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 💝 Подарить романтический подарок (.отн подарить <id>) ===
bot.hears(/^\.отн подарить\s+(\d+)$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const giftId = parseInt(ctx.match[1], 10);
    const gift = GIFTS_CATALOG.find(g => g.id === giftId);
    if (!gift) return ctx.reply('❌ Неверный номер подарка. Посмотрите список: <code>.отн подарки</code>', { parse_mode: 'HTML' });

    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    // ⚡ Атомарное списание печенек за подарок с компенсацией
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: userId, cookies: { $gte: gift.price } },
      { $inc: { cookies: -gift.price } },
      { new: true }
    );
    if (!updatedUser) {
      const freshUser = await User.findOne({ telegramId: userId });
      return ctx.reply(`❌ У вас не хватает печенек. Подарок стоит: <b>${utils.sp(gift.price)}</b> 🍪, у вас: <b>${utils.sp(freshUser?.cookies || 0)}</b> 🍪`, { parse_mode: 'HTML' });
    }

    const partnerId = getPartnerId(marriage, userId);
    const partner = await User.findOne({ telegramId: partnerId });

    try {
      await Marriage.findOneAndUpdate(
        { _id: marriage._id },
        {
          $inc: { sparks: gift.sparks, totalGiftValue: gift.price },
          $push: {
            giftsList: {
              name: gift.name,
              icon: gift.icon,
              fromId: userId,
              date: new Date()
            }
          },
          $set: { lastActivity: new Date() }
        }
      );
    } catch (mErr) {
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: gift.price } }
      );
      throw mErr;
    }

    const userNick = user.nickname || `User${userId}`;
    const partnerNick = partner?.nickname || `User${partnerId}`;

    return ctx.reply(`
💝 <b>РОМАНТИЧЕСКИЙ ПОДАРОК!</b>

${gift.icon} <a href="tg://user?id=${userId}">${userNick}</a> преподносит восхитительный подарок для <a href="tg://user?id=${partnerId}">${partnerNick}</a>!
🎁 Подарок: <b>${gift.name}</b>
🔥 Начислено паре: <b>+${utils.sp(gift.sparks)}</b> искр!
`, { parse_mode: 'HTML' });

  } catch (e) {
    console.error('Ошибка в .отн подарить:', e);
    ctx.reply('❌ Произошла ошибка при отправке подарка.');
  }
});

// === 🤰 Беременность и УЗИ (.узи) ===
bot.hears(/^\.(узи|беременность)$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    // Проверяем роды
    const babyBorn = checkAndDeliverBaby(marriage);
    if (babyBorn) {
      await marriage.save();
      return ctx.reply('🎉 <b>Поздравляем!</b> Пока вы шли на УЗИ, время подошло — у вас родился малыш! Загляните в меню: <code>.рб</code>', { parse_mode: 'HTML' });
    }

    if (!marriage.pregnancy || !marriage.pregnancy.isPregnant) {
      return ctx.reply('🤰 Ваша пара сейчас не ждет ребенка.\n💡 Чтобы зачать малыша, уединитесь в постели: <code>.постель</code>', { parse_mode: 'HTML' });
    }

    const dueTime = new Date(marriage.pregnancy.dueAt).getTime();
    const nowMs = Date.now();
    const leftMs = Math.max(0, dueTime - nowMs);
    const leftHours = Math.floor(leftMs / (1000 * 60 * 60));
    const leftMinutes = Math.floor((leftMs % (1000 * 60 * 60)) / (1000 * 60));

    // Расчет срока в неделях (от 4 до 40 недель в зависимости от прогресса срока)
    const startedMs = marriage.pregnancy.startedAt ? new Date(marriage.pregnancy.startedAt).getTime() : (dueTime - 12 * 60 * 60 * 1000);
    const totalDuration = Math.max(1, dueTime - startedMs);
    const progress = Math.min(1, Math.max(0, (nowMs - startedMs) / totalDuration));
    const passedWeeks = Math.min(40, Math.max(4, Math.floor(4 + progress * 36)));

    // Определение пола: на ранних сроках (<12 нед.) пол малыша — секрет
    let genderText = 'Секрет 🙈 (рано определять)';
    if (passedWeeks >= 12) {
      genderText = marriage.pregnancy.babyGender === 'м' ? 'Мальчик 👦' : 'Девочка 👧';
    }
    const heartbeatBpm = 148 + Math.floor(Math.random() * 14);

    const partnerId = getPartnerId(marriage, userId);
    const [u1, u2] = await Promise.all([
      User.findOne({ telegramId: userId }),
      User.findOne({ telegramId: partnerId })
    ]);
    const motherNick = (marriage.pregnancy.motherId === userId ? u1?.nickname : u2?.nickname) || u1?.nickname || 'Мама';
    const fatherNick = (marriage.pregnancy.motherId === userId ? u2?.nickname : u1?.nickname) || u2?.nickname || 'Папа';

    let uziBuffer = null;
    try {
      uziBuffer = await generateUltrasoundCard({
        weeks: passedWeeks,
        heartbeat: heartbeatBpm,
        genderText,
        motherNick,
        fatherNick,
        leftHours
      });
    } catch (err) {
      console.error('Ошибка создания карточки УЗИ:', err);
    }

    const caption =
      `🏥 <b>РЕЗУЛЬТАТЫ УЗИ ОБСЛЕДОВАНИЯ</b>\n\n` +
      `🤰 <b>Срок беременности:</b> ~${passedWeeks} нед.\n` +
      `💓 <b>Сердцебиение (ЧСС):</b> ${heartbeatBpm} уд/мин (Норма)\n` +
      `👶 <b>Пол будущего малыша:</b> <b>${genderText}</b>\n` +
      `⏳ <b>До родов осталось:</b> ~${leftHours} ч. ${leftMinutes} мин.\n\n` +
      `✨ <i>Берегите маму и малыша! Когда малыш родится, вы сможете заботиться о нем через команду .рб</i>`;

    if (uziBuffer) {
      return ctx.replyWithPhoto({ source: uziBuffer }, { caption, parse_mode: 'HTML' });
    } else {
      return ctx.reply(caption, { parse_mode: 'HTML' });
    }

  } catch (e) {
    console.error('Ошибка в .узи:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 👶 Дети и воспитание (.рб) ===
bot.hears(/^\.рб(?:\s+(покормить|поиграть|имя)(?:\s+(\d+))?(?:\s+(.+))?)?$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    checkAndDeliverBaby(marriage);

    if (!marriage.children || marriage.children.length === 0) {
      return ctx.reply('👶 В вашей семье пока нет детей.\n💡 Чтобы зачать ребенка, используйте <code>.постель</code> и пройдите <code>.узи</code>!', { parse_mode: 'HTML' });
    }

    const sub = ctx.match[1]?.toLowerCase();
    const childIndex = ctx.match[2] ? parseInt(ctx.match[2], 10) - 1 : 0;
    const child = marriage.children[childIndex] || marriage.children[0];

    // 1. Покормить ребенка
    if (sub === 'покормить') {
      child.health = Math.min(100, (child.health || 80) + 15);
      child.happiness = Math.min(100, (child.happiness || 80) + 10);
      child.lastCare = new Date();
      await marriage.save();
      return ctx.reply(`🍼 Вы покормили малыша <b>${child.name}</b> вкусной кашей!\n❤️ Здоровье: ${child.health}/100 | 😊 Счастье: ${child.happiness}/100`, { parse_mode: 'HTML' });
    }

    // 2. Поиграть с ребенком
    if (sub === 'поиграть') {
      child.happiness = Math.min(100, (child.happiness || 80) + 20);
      child.intellect = Math.min(100, (child.intellect || 50) + 5);
      child.lastCare = new Date();
      await marriage.save();
      return ctx.reply(`🧸 Вы весело поиграли в кубики с <b>${child.name}</b>!\n😊 Счастье: ${child.happiness}/100 | 🧠 Интеллект: ${child.intellect}/100`, { parse_mode: 'HTML' });
    }

    // 3. Переименовать ребенка
    if (sub === 'имя') {
      const newName = ctx.match[3]?.trim();
      if (!newName || newName.length < 2 || newName.length > 20) {
        return ctx.reply('❌ Укажите имя от 2 до 20 символов: <code>.рб имя [номер] [Новое Имя]</code>', { parse_mode: 'HTML' });
      }
      child.name = newName;
      await marriage.save();
      return ctx.reply(`✅ Вы дали малышу новое прекрасное имя: <b>${newName}</b>!`, { parse_mode: 'HTML' });
    }

    // 4. Меню детей
    let listText = '👶 <b>ДЕТИ В ВАШЕЙ СЕМЬЕ:</b>\n\n';
    marriage.children.forEach((c, idx) => {
      const genderIcon = c.gender === 'м' ? '👦' : '👧';
      const ageDays = Math.max(1, Math.floor((Date.now() - new Date(c.birthDate).getTime()) / (1000 * 60 * 60 * 24)));
      listText += `[${idx + 1}] ${genderIcon} <b>${c.name}</b> (Возраст: ${ageDays} дн.)\n`;
      listText += `     ❤️ Здоровье: ${c.health || 100}/100 [${generateProgressBar(c.health || 100, 100, 8)}]\n`;
      listText += `     😊 Счастье: ${c.happiness || 80}/100 [${generateProgressBar(c.happiness || 80, 100, 8)}]\n`;
      listText += `     🧠 Интеллект: ${c.intellect || 50}/100 [${generateProgressBar(c.intellect || 50, 100, 8)}]\n\n`;
    });

    listText += `💡 <i>Команды заботы:</i>\n<code>.рб покормить [номер]</code>\n<code>.рб поиграть [номер]</code>\n<code>.рб имя [номер] [Новое Имя]</code>`;

    return ctx.reply(listText, { parse_mode: 'HTML' });

  } catch (e) {
    console.error('Ошибка в .рб:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🐾 Питомцы пары (.отн пт) ===
bot.hears(/^\.отн пт(?:\s+(яйцо(?:\s+(обычное|редкое|легендарное))?|покормить|поиграть)(?:\s+(\d+))?)?$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) return ctx.reply('❌ Вы не состоите в отношениях.');

    const sub = ctx.match[1]?.toLowerCase();

    // 1. Покупка яйца питомца
    if (sub && sub.startsWith('яйцо')) {
      const eggType = ctx.match[2]?.toLowerCase() || 'обычное';
      const eggInfo = PET_EGGS[eggType];
      if (!eggInfo) {
        return ctx.reply('❌ Доступные типы яиц: <code>обычное</code>, <code>редкое</code>, <code>легендарное</code>.\nПример: <code>.отн пт яйцо обычное</code>', { parse_mode: 'HTML' });
      }

      if ((marriage.pets?.length || 0) >= 5) {
        return ctx.reply('❌ В вашей семье уже максимальное количество питомцев (5/5).');
      }

      const randomPet = eggInfo.pool[Math.floor(Math.random() * eggInfo.pool.length)];
      const newPet = {
        name: randomPet.type,
        type: randomPet.type,
        rarity: randomPet.rarity,
        level: 1,
        exp: 0,
        hunger: 100,
        happiness: 100,
        lastFed: new Date()
      };

      // ⚡ Атомарная покупка яйца с проверкой лимита и искр
      const updatedMarriage = await Marriage.findOneAndUpdate(
        { _id: marriage._id, sparks: { $gte: eggInfo.price }, 'pets.4': { $exists: false } },
        {
          $inc: { sparks: -eggInfo.price },
          $push: { pets: newPet }
        },
        { new: true }
      );

      if (!updatedMarriage) {
        const freshMarriage = await Marriage.findById(marriage._id);
        if ((freshMarriage?.sparks || 0) < eggInfo.price) {
          return ctx.reply(`❌ Для покупки этого яйца нужно <b>${utils.sp(eggInfo.price)}</b> 🔥 искр. У вас: <b>${utils.sp(freshMarriage?.sparks || 0)}</b> 🔥.\n💡 Купите искры: <code>.отн искры купить</code>`, { parse_mode: 'HTML' });
        }
        return ctx.reply('❌ В вашей семье уже максимальное количество питомцев (5/5).');
      }

      return ctx.reply(`
🥚 <b>ТРЕСК В ИНКУБАТОРЕ...</b> 🐣

🎉 Из ${eggType}го яйца только что вылупился <b>${randomPet.icon} ${randomPet.type}</b>!
🌟 Редкость: <b>${randomPet.rarity}</b>
🐾 Поздравляем с новым членом семьи! Заботьтесь о нем через <code>.отн пт</code>
`, { parse_mode: 'HTML' });
    }

    // 2. Покормить питомца
    if (sub === 'покормить') {
      const pIndex = ctx.match[3] ? parseInt(ctx.match[3], 10) - 1 : 0;
      const pet = marriage.pets?.[pIndex] || marriage.pets?.[0];
      if (!pet) return ctx.reply('❌ У вас пока нет питомцев. Купите яйцо: <code>.отн пт яйцо обычное</code>', { parse_mode: 'HTML' });

      pet.hunger = Math.min(100, (pet.hunger || 80) + 30);
      pet.happiness = Math.min(100, (pet.happiness || 80) + 15);
      pet.exp = (pet.exp || 0) + 25;
      if (pet.exp >= pet.level * 100) {
        pet.level += 1;
        pet.exp = 0;
      }
      pet.lastFed = new Date();
      await marriage.save();
      return ctx.reply(`🍖 Вы вкусно покормили питомца <b>${pet.name}</b>!\nСытость: ${pet.hunger}/100 | Уровень: ${pet.level}`, { parse_mode: 'HTML' });
    }

    // 3. Поиграть с питомцем
    if (sub === 'поиграть') {
      const pIndex = ctx.match[3] ? parseInt(ctx.match[3], 10) - 1 : 0;
      const pet = marriage.pets?.[pIndex] || marriage.pets?.[0];
      if (!pet) return ctx.reply('❌ У вас пока нет питомцев. Купите яйцо: <code>.отн пт яйцо обычное</code>', { parse_mode: 'HTML' });

      pet.happiness = Math.min(100, (pet.happiness || 80) + 30);
      pet.hunger = Math.max(0, (pet.hunger || 100) - 15);
      pet.exp = (pet.exp || 0) + 35;
      if (pet.exp >= pet.level * 100) {
        pet.level += 1;
        pet.exp = 0;
      }
      await marriage.save();
      return ctx.reply(`🎾 Вы весело поиграли с питомцем <b>${pet.name}</b>!\nСчастье: ${pet.happiness}/100 | Уровень: ${pet.level}`, { parse_mode: 'HTML' });
    }

    // 4. Меню питомцев
    if (!marriage.pets || marriage.pets.length === 0) {
      return ctx.reply(`
🐾 <b>МЕНЮ ПИТОМЦЕВ ПАРЫ</b>

<i>У вашей пары пока нет питомцев. Приобретите яйцо в инкубаторе:</i>

🥚 <b>Обычное яйцо:</b> 500 🔥 (Котик, Щенок)
🔮 <b>Редкое яйцо:</b> 1.500 🔥 (Лисёнок, Енот, Панда)
👑 <b>Легендарное яйцо:</b> 5.000 🔥 (Медвежонок Grizzly, Дракон, Феникс)

💡 <i>Для покупки напишите:</i>
<code>.отн пт яйцо обычное</code>
<code>.отн пт яйцо редкое</code>
<code>.отн пт яйцо легендарное</code>
`, { parse_mode: 'HTML' });
    }

    let pText = '🐾 <b>ПИТОМЦЫ ВАШЕЙ ПАРЫ:</b>\n\n';
    marriage.pets.forEach((pet, i) => {
      pText += `[${i + 1}] <b>${pet.name}</b> (${pet.rarity}) — Ур. ${pet.level}\n`;
      pText += `     🍖 Сытость: ${pet.hunger || 100}/100 [${generateProgressBar(pet.hunger || 100, 100, 8)}]\n`;
      pText += `     🎾 Счастье: ${pet.happiness || 100}/100 [${generateProgressBar(pet.happiness || 100, 100, 8)}]\n\n`;
    });

    pText += `💡 <i>Команды заботы:</i>\n<code>.отн пт покормить [номер]</code>\n<code>.отн пт поиграть [номер]</code>\n<code>.отн пт яйцо &lt;тип&gt;</code> — купить новое яйцо`;

    return ctx.reply(pText, { parse_mode: 'HTML' });

  } catch (e) {
    console.error('Ошибка в .отн пт:', e);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🔘 Callback-кнопки меню отношений ===
bot.action(/^rel_menu_(actions|house|kids|pets|gifts|sparks)$/, async (ctx) => {
  try {
    const action = ctx.match[1];
    await ctx.answerCbQuery().catch(() => {});
    const userId = ctx.from.id;
    const marriage = await Marriage.findOne({
      $or: [{ userId }, { partnerId: userId }],
      status: 'accepted'
    });
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.\n💡 Чтобы предложить отношения: <code>.отн запрос @username</code>', { parse_mode: 'HTML' });
    }

    if (action === 'actions') {
      return renderRelationActions(ctx, false, false);
    } else if (action === 'house') {
      if (!marriage.house || !marriage.house.type) {
        marriage.house = { type: 'Шалаш в лесу', level: 1, comfort: 10, safeCookies: 0 };
      }
      const currentLvl = marriage.house.level || 1;
      const currentHouse = RELATION_HOUSES.find(h => h.level === currentLvl) || RELATION_HOUSES[0];
      const nextHouse = RELATION_HOUSES.find(h => h.level === currentLvl + 1);
      const upgradeText = nextHouse
        ? `\n⬆️ <b>Следующее жилье:</b> ${nextHouse.icon} ${nextHouse.name} (Стоимость: ${utils.sp(currentHouse.upgradeCost)} 🔥)\n💡 <i>Для улучшения введите:</i> <code>.отн дом улучшить</code>`
        : '\n👑 <i>У вас максимальное жилье!</i>';

      return ctx.reply(`
${currentHouse.icon} <b>ОБЩИЙ ДОМ ПАРЫ</b>

🏡 <b>Тип жилья:</b> ${marriage.house.type} (${currentLvl}/6 ур.)
✨ <b>Уровень уюта:</b> ${marriage.house.comfort}
💰 <b>Семейный сейф:</b> ${utils.sp(marriage.house.safeCookies || 0)} 🍪
${upgradeText}

💡 <i>Команды сейфа: .отн дом сейф положить/снять &lt;сумма&gt;</i>
`, { parse_mode: 'HTML' });
    } else if (action === 'kids') {
      checkAndDeliverBaby(marriage);
      if (!marriage.children || marriage.children.length === 0) {
        return ctx.reply('👶 В вашей семье пока нет детей.\n💡 Чтобы зачать ребенка, используйте <code>.постель</code> и пройдите <code>.узи</code>!', { parse_mode: 'HTML' });
      }

      let listText = '👶 <b>ДЕТИ В ВАШЕЙ СЕМЬЕ:</b>\n\n';
      marriage.children.forEach((c, idx) => {
        const genderIcon = c.gender === 'м' ? '👦' : '👧';
        const ageDays = Math.max(1, Math.floor((Date.now() - new Date(c.birthDate).getTime()) / (1000 * 60 * 60 * 24)));
        listText += `[${idx + 1}] ${genderIcon} <b>${c.name}</b> (Возраст: ${ageDays} дн.)\n`;
        listText += `     ❤️ Здоровье: ${c.health || 100}/100 [${generateProgressBar(c.health || 100, 100, 8)}]\n`;
        listText += `     😊 Счастье: ${c.happiness || 80}/100 [${generateProgressBar(c.happiness || 80, 100, 8)}]\n`;
        listText += `     🧠 Интеллект: ${c.intellect || 50}/100 [${generateProgressBar(c.intellect || 50, 100, 8)}]\n\n`;
      });
      listText += `💡 <i>Команды заботы:</i>\n<code>.рб покормить [номер]</code>\n<code>.рб поиграть [номер]</code>\n<code>.рб имя [номер] [Новое Имя]</code>`;
      return ctx.reply(listText, { parse_mode: 'HTML' });
    } else if (action === 'pets') {
      if (!marriage.pets || marriage.pets.length === 0) {
        return ctx.reply(`
🐾 <b>МЕНЮ ПИТОМЦЕВ ПАРЫ</b>

<i>У вашей пары пока нет питомцев. Приобретите яйцо в инкубаторе:</i>

🥚 <b>Обычное яйцо:</b> 500 🔥 (Котик, Щенок)
🔮 <b>Редкое яйцо:</b> 1.500 🔥 (Лисёнок, Енот, Панда)
👑 <b>Легендарное яйцо:</b> 5.000 🔥 (Медвежонок Grizzly, Дракон, Феникс)

💡 <i>Для покупки напишите:</i>
<code>.отн пт яйцо обычное</code>
<code>.отн пт яйцо редкое</code>
<code>.отн пт яйцо легендарное</code>
`, { parse_mode: 'HTML' });
      }

      let pText = '🐾 <b>ПИТОМЦЫ ВАШЕЙ ПАРЫ:</b>\n\n';
      marriage.pets.forEach((pet, i) => {
        pText += `[${i + 1}] <b>${pet.name}</b> (${pet.rarity}) — Ур. ${pet.level}\n`;
        pText += `     🍖 Сытость: ${pet.hunger || 100}/100 [${generateProgressBar(pet.hunger || 100, 100, 8)}]\n`;
        pText += `     🎾 Счастье: ${pet.happiness || 100}/100 [${generateProgressBar(pet.happiness || 100, 100, 8)}]\n\n`;
      });
      pText += `💡 <i>Команды заботы:</i>\n<code>.отн пт покормить [номер]</code>\n<code>.отн пт поиграть [номер]</code>\n<code>.отн пт яйцо &lt;тип&gt;</code> — купить новое яйцо`;
      return ctx.reply(pText, { parse_mode: 'HTML' });
    } else if (action === 'gifts') {
      let text = '🎁 <b>РОМАНТИЧЕСКИЙ МАГАЗИН ПОДАРКОВ</b> 🎁\n\nПорадуйте любимого человека подарком в профиль пары:\n\n';
      for (const g of GIFTS_CATALOG) {
        text += `[${g.id}] ${g.icon} • <b>${g.name}</b>\n`;
        text += `     💰 Цена: ${utils.sp(g.price)} 🍪 | 🔥 Даёт: +${utils.sp(g.sparks)} искр\n`;
      }
      text += '\n💡 <i>Чтобы подарить, напишите:</i>\n<code>.отн подарить &lt;номер 1-6&gt;</code> (например: <code>.отн подарить 2</code>)';
      return ctx.reply(text, { parse_mode: 'HTML' });
    } else if (action === 'sparks') {
      marriage.sparks = marriage.sparks ?? 100;
      return ctx.reply(`
┏ 🔥 <b>МАГАЗИН И БАЛАНС ИСКР</b> 🔥 ┓

💰 <b>Текущий баланс искр пары:</b> ${utils.sp(marriage.sparks)} 🔥
⭐ <b>Уровень отношений:</b> ${marriage.level}/30

💡 <b>Курс обмена:</b> 1 искра = 10 печенек 🍪
Для покупки искр напишите:
<code>.отн искры купить &lt;количество&gt;</code>
<i>(например: <code>.отн искры купить 100</code> обойдется в 1.000 печенек)</i>
`, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('Ошибка в rel_menu action:', e.message);
  }
});

// === 📌 Команда для просмотра браков (.отн брак) ===
bot.hears(/^\.отн брак$/, async (ctx) => {
  try {
    const marriages = await Marriage.find({ status: 'accepted' });
    if (marriages.length === 0) {
      return ctx.reply('💔 Пока никто не состоит в браке.');
    }
    
    let response = '💞 <b>Список активных браков:</b>\n\n';
    for (const marriage of marriages) {
      const user1 = await getNicknameByTelegramId(marriage.userId);
      const user2 = await getNicknameByTelegramId(marriage.partnerId);
      
      // Вычисляем длительность отношений
      const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
      const relationshipDuration = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
      
      response += `💍 ${user1} ❤️ ${user2}\n`;
      response += `📅 ${relationshipDuration} дней вместе\n\n`;
    }
    
    response += `💡 <i>Всего активных браков: ${marriages.length}</i>`;
    
    ctx.reply(response, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Ошибка при получении списка браков:', error);
    ctx.reply('❌ Произошла ошибка при получении списка браков.');
  }
});

// === 📌 Помощь по отношениям (.отн помощь) ===
bot.hears(/^\.отн помощь$/, async (ctx) => {
  const helpText = `
💖 <b>Система отношений - Помощь</b>

<b>Основные команды:</b>
• <code>.отн запрос</code> - Предложить отношения (ответ на сообщение)
• <code>.отн профиль</code> - Ваш профиль отношений
• <code>.отн статистика</code> - Статистика ваших отношений
• <code>.отн развод</code> - Расторгнуть отношения
• <code>.отн брак</code> - Список всех браков
• <code>.отн топ</code> - Топ-10 лучших пар

<b>Романтические команды:</b>
• <code>.отн подарок &lt;сумма&gt;</code> - Подарить печенье партнеру
• <code>.отн поцелуй</code> - Поцеловать партнера
• <code>.отн обнять</code> - Обнять партнера
• <code>.отн свидание</code> - Устроить свидание
• <code>.отн комплимент</code> - Сказать комплимент
• <code>.отн признание</code> - Признаться в любви
• <code>.отн сюрприз</code> - Сделать сюрприз (300 🍪)
• <code>.отн прогулка</code> - Пойти на прогулку

<b>Свадьба и годовщины:</b>
• <code>.отн свадьба</code> - Провести свадебную церемонию
• <code>.отн годовщина</code> - Посмотреть годовщины

<b>Совместный банк:</b>
• <code>.отн банк</code> - Посмотреть баланс
• <code>.отн банк внести &lt;сумма&gt;</code> - Внести средства
• <code>.отн банк снять &lt;сумма&gt;</code> - Снять средства (требуется согласие партнера)

<b>Бонусы и достижения:</b>
• +100 печенек при вступлении в отношения
• Рейтинг и уровень отношений (1-10)
• Специальные достижения для пар
• Подарки от гостей на свадьбе

💡 <i>Развивайте ваши отношения и получайте достижения!</i>
  `;
  
  ctx.reply(helpText, { parse_mode: 'HTML' });
});

// === 📌 Подарок партнеру (.отн подарок) ===
bot.hears(/^\.отн подарок\s+(\d+)$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const giftAmount = parseInt(ctx.match[1]);
    
    if (giftAmount < 1) {
      return ctx.reply('❌ Сумма подарка должна быть больше 0.');
    }
    
    if (giftAmount > 10000) {
      return ctx.reply('❌ Максимальная сумма подарка: 10,000 печенек.');
    }
    
    // ⚡ ОПТИМИЗАЦИЯ: Используем кэшированного пользователя
    const user = ctx.state.user;
    if (!user) {
      return ctx.reply('❌ Пользователь не найден.');
    }
    
    // ⚡ Атомарное списание печенек у дарителя
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: userId, cookies: { $gte: giftAmount } },
      { $inc: { cookies: -giftAmount } },
      { new: true }
    );

    if (!updatedUser) {
      const freshUser = await User.findOne({ telegramId: userId });
      return ctx.reply(`❌ У вас недостаточно печенек. Нужно: ${giftAmount}, есть: ${freshUser?.cookies || 0}`);
    }

    // Находим активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });

    if (!marriage) {
      // Возврат печенек
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: giftAmount } }
      );
      return ctx.reply('❌ Вы не состоите в отношениях.');
    }

    const partnerId = getPartnerId(marriage, userId);

    // ⚡ ОПТИМИЗАЦИЯ: Загружаем партнера одним запросом
    const partner = await User.findOne({ telegramId: partnerId });

    if (!partner) {
      // Возврат печенек
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: giftAmount } }
      );
      return ctx.reply('❌ Партнер не найден.');
    }

    // ⚡ Зачисление подарка партнеру с компенсацией при ошибке
    try {
      await User.findOneAndUpdate(
        { telegramId: partnerId },
        { $inc: { cookies: giftAmount } }
      );
    } catch (creditErr) {
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: giftAmount } }
      );
      throw creditErr;
    }

    // ⚡ Атомарное обновление статистики брака
    await Marriage.findOneAndUpdate(
      { _id: marriage._id },
      {
        $inc: {
          totalGiftValue: giftAmount,
          giftsSent: 1,
          giftsReceived: 1
        },
        $set: { lastActivity: new Date() }
      }
    );
    
    // ⚡ ОПТИМИЗАЦИЯ: Используем nickname напрямую из объектов
    const userNickname = user.nickname ? `<a href="tg://user?id=${userId}">${user.nickname}</a>` : `<a href="tg://user?id=${userId}">User${userId}</a>`;
    const partnerNickname = partner.nickname ? `<a href="tg://user?id=${partnerId}">${partner.nickname}</a>` : `<a href="tg://user?id=${partnerId}">User${partnerId}</a>`;
    
    ctx.reply(
      `🎁 ${userNickname} подарил(а) ${giftAmount} печенек ${partnerNickname}!\n\n💖 Ваши отношения стали крепче!`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `🎁 ${userNickname} подарил(а) вам ${giftAmount} печенек!\n\n💖 Ваши отношения стали крепче!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при отправке подарка:', error);
    ctx.reply('❌ Произошла ошибка при отправке подарка.');
  }
});

// === 📌 Статистика отношений (.отн статистика) ===
bot.hears(/^\.отн статистика$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Находим активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    // Вычисляем длительность отношений
    const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
    const relationshipDuration = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
    const startDateStr = new Date(startDate).toLocaleDateString('ru-RU');
    
    const statsText = `
💖 <b>Статистика отношений</b>

👫 <b>Пара:</b> ${userNickname} ❤️ ${partnerNickname}

📅 <b>Дата начала:</b> ${startDateStr}
⏰ <b>Длительность:</b> ${relationshipDuration} дней

🎁 <b>Подарки:</b>
• Отправлено: ${marriage.giftsSent}
• Получено: ${marriage.giftsReceived}
• Общая стоимость: ${marriage.totalGiftValue} печенек

🏆 <b>Достижения:</b>
${(marriage.achievements || []).length > 0 ? marriage.achievements.map(ach => `• ${ach}`).join('\n') : '• Пока нет достижений'}

💡 <i>Продолжайте дарить подарки и проявлять заботу!</i>
    `;
    
    ctx.reply(statsText, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    ctx.reply('❌ Произошла ошибка при получении статистики.');
  }
});

// === 📌 Поцелуй партнера (.отн поцелуй) ===
bot.hears(/^\.отн поцелуй$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Находим активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const kisses = ['💋', '😘', '🥰', '😍', '💕'];
    const randomKiss = kisses[Math.floor(Math.random() * kisses.length)];
    
    ctx.reply(
      `${randomKiss} ${userNickname} поцеловал(а) ${partnerNickname}!\n\n💖 Ваши отношения стали еще теплее!`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `${randomKiss} ${userNickname} поцеловал(а) вас!\n\n💖 Ваши отношения стали еще теплее!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
    // Обновляем активность
    marriage.lastActivity = new Date();
    await marriage.save();
    
  } catch (error) {
    console.error('Ошибка при поцелуе:', error);
    ctx.reply('❌ Произошла ошибка при поцелуе.');
  }
});

// === 📌 Объятие партнера (.отн обнять) ===
bot.hears(/^\.отн обнять$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Находим активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const hugs = ['🤗', '🫂', '💕', '🥰', '😊'];
    const randomHug = hugs[Math.floor(Math.random() * hugs.length)];
    
    ctx.reply(
      `${randomHug} ${userNickname} обнял(а) ${partnerNickname}!\n\n💖 Вам стало теплее от объятий!`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `${randomHug} ${userNickname} обнял(а) вас!\n\n💖 Вам стало теплее от объятий!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
    // Обновляем активность
    marriage.lastActivity = new Date();
    await marriage.save();
    
  } catch (error) {
    console.error('Ошибка при объятии:', error);
    ctx.reply('❌ Произошла ошибка при объятии.');
  }
});

// === 📌 Свидание (.отн свидание) ===
bot.hears(/^\.отн свидание$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Находим активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.');
    }
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return ctx.reply('❌ Пользователь не найден.');
    }
    
    const dateCost = 500;
    if (user.cookies < dateCost) {
      return ctx.reply(`❌ У вас недостаточно печенек для свидания. Нужно: ${dateCost}, есть: ${user.cookies}`);
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const partner = await User.findOne({ telegramId: partnerId });
    
    if (!partner) {
      return ctx.reply('❌ Партнер не найден.');
    }
    
    // Оплачиваем свидание
    user.cookies -= dateCost;
    partner.cookies += 200; // Партнер получает бонус
    
    // Обновляем статистику брака
    marriage.totalGiftValue += dateCost;
    marriage.lastActivity = new Date();
    
    // Добавляем достижение
    if (!marriage.achievements) marriage.achievements = [];
    if (!marriage.achievements.includes('Первое свидание')) {
      marriage.achievements.push('Первое свидание');
    }
    
    await user.save();
    await partner.save();
    await marriage.save();
    
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const datePlaces = [
      'в романтическом ресторане 🍽️',
      'в парке под звездами 🌟',
      'в кинотеатре 🎬',
      'на пляже 🌅',
      'в кафе ☕',
      'в музее 🏛️',
      'на концерте 🎵'
    ];
    
    const randomPlace = datePlaces[Math.floor(Math.random() * datePlaces.length)];
    
    ctx.reply(
      `💕 ${userNickname} устроил(а) романтическое свидание ${partnerNickname} ${randomPlace}!\n\n💰 Стоимость: ${dateCost} печенек\n🎁 Партнер получил бонус: 200 печенек\n\n💖 Ваши отношения стали еще крепче!`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `💕 ${userNickname} устроил(а) вам романтическое свидание ${randomPlace}!\n\n🎁 Вы получили бонус: 200 печенек\n\n💖 Ваши отношения стали еще крепче!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при свидании:', error);
    ctx.reply('❌ Произошла ошибка при организации свидания.');
  }
});

// ============================================
// РАСШИРЕННАЯ СИСТЕМА БРАКОВ - НОВЫЕ ФУНКЦИИ
// ============================================

// Вспомогательная функция для расчета рейтинга отношений
function calculateRelationshipScore(marriage) {
  const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
  const daysTogether = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const giftScore = (marriage.totalGiftValue || 0) / 100;
  const achievementScore = (marriage.achievements?.length || 0) * 500;
  const bankScore = (marriage.jointBank || 0) / 10;
  const sparksScore = (marriage.sparks || 0) / 5;
  const currentLvl = typeof getCoupleLevel === 'function' ? getCoupleLevel(marriage) : (marriage.level || 1);
  const expScore = (marriage.exp || 0) + (currentLvl - 1) * 250;
  
  return Math.floor(daysTogether * 10 + giftScore + achievementScore + bankScore + sparksScore + expScore);
}

// Вспомогательная функция для расчета уровня отношений
function calculateRelationshipLevel(score) {
  if (score < 1000) return 1;
  if (score < 3000) return 2;
  if (score < 6000) return 3;
  if (score < 10000) return 4;
  if (score < 15000) return 5;
  if (score < 25000) return 6;
  if (score < 40000) return 7;
  if (score < 60000) return 8;
  if (score < 100000) return 9;
  return 10;
}

// Функция для проверки и добавления достижений
async function checkAndAddAchievements(marriage) {
  if (!marriage.achievements) marriage.achievements = [];
  const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
  const daysTogether = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
  let newAchievements = [];
  
  if (daysTogether >= 7 && !marriage.achievements.includes('Молодожены')) {
    marriage.achievements.push('Молодожены');
    newAchievements.push('Молодожены');
  }
  
  if (daysTogether >= 30 && !marriage.achievements.includes('Медовый месяц')) {
    marriage.achievements.push('Медовый месяц');
    newAchievements.push('Медовый месяц');
  }
  
  if (daysTogether >= 100 && !marriage.achievements.includes('Неразлучные')) {
    marriage.achievements.push('Неразлучные');
    newAchievements.push('Неразлучные');
  }
  
  if (daysTogether >= 365 && !marriage.achievements.includes('Золотая пара')) {
    marriage.achievements.push('Золотая пара');
    newAchievements.push('Золотая пара');
  }
  
  if (marriage.totalGiftValue >= 10000 && !marriage.achievements.includes('Щедрая пара')) {
    marriage.achievements.push('Щедрая пара');
    newAchievements.push('Щедрая пара');
  }
  
  if (marriage.jointBank >= 50000 && !marriage.achievements.includes('Банкиры любви')) {
    marriage.achievements.push('Банкиры любви');
    newAchievements.push('Банкиры любви');
  }
  
  if (marriage.weddingDate && !marriage.achievements.includes('Официально женаты')) {
    marriage.achievements.push('Официально женаты');
    newAchievements.push('Официально женаты');
  }
  
  return newAchievements;
}

// === 📌 Свадебная церемония (.отн свадьба) ===
bot.hears(/^\.отн свадьба$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке. Сначала отправьте запрос на отношения!');
    }
    
    // Проверяем, была ли уже свадьба
    if (marriage.weddingDate) {
      const weddingDateStr = marriage.weddingDate.toLocaleDateString('ru-RU');
      return ctx.reply(`❌ Вы уже провели свадебную церемонию ${weddingDateStr}!`);
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    // Устанавливаем дату свадьбы
    marriage.weddingDate = new Date();
    marriage.weddingGuests = [];
    marriage.weddingGiftsTotal = 0;
    await marriage.save();
    
    // Создаем объявление о свадьбе с кнопкой для гостей
    const weddingMessage = `
🎊 <b>СВАДЕБНАЯ ЦЕРЕМОНИЯ!</b> 🎊

💍 ${userNickname} и ${partnerNickname} официально вступают в брак!

🎉 Все желающие могут поздравить молодоженов и подарить им подарок!

💝 Нажмите кнопку ниже, чтобы подарить подарок молодоженам
    `;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎁 Подарить 500 печенек', `wedding_gift_${marriage._id}_500`)],
      [Markup.button.callback('💎 Подарить 1000 печенек', `wedding_gift_${marriage._id}_1000`)],
      [Markup.button.callback('👑 Подарить 2000 печенек', `wedding_gift_${marriage._id}_2000`)]
    ]);
    
    await ctx.reply(weddingMessage, { 
      parse_mode: 'HTML',
      ...keyboard
    });
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `🎊 ${userNickname} организовал(а) свадебную церемонию! Вы теперь официально женаты! 💍`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при организации свадьбы:', error);
    ctx.reply('❌ Произошла ошибка при организации свадьбы.');
  }
});

// === 📌 Обработчик подарков на свадьбе ===
bot.action(/^wedding_gift_(.+)_(\d+)$/, async (ctx) => {
  try {
    const marriageId = ctx.match[1];
    const giftAmount = parseInt(ctx.match[2]);
    const guestId = ctx.from.id;
    
    const marriage = await Marriage.findById(marriageId);
    if (!marriage || marriage.status !== 'accepted') {
      return ctx.answerCbQuery('❌ Свадьба не найдена или уже завершена.', { show_alert: true });
    }
    
    // Проверяем, не является ли гость одним из молодоженов
    if (Number(guestId) === Number(marriage.userId) || Number(guestId) === Number(marriage.partnerId)) {
      return ctx.answerCbQuery('❌ Вы не можете дарить подарки сами себе!', { show_alert: true });
    }
    
    // ⚡ Атомарная проверка баланса и списание печенек гостя
    const updatedGuest = await User.findOneAndUpdate(
      { telegramId: guestId, cookies: { $gte: giftAmount } },
      { $inc: { cookies: -giftAmount } },
      { new: true }
    );
    if (!updatedGuest) {
      return ctx.answerCbQuery(`❌ У вас недостаточно печенек. Нужно: ${giftAmount}`, { show_alert: true });
    }
    
    // ⚡ Атомарное добавление в weddingGuests и зачисление в jointBank
    const updatedMarriage = await Marriage.findOneAndUpdate(
      {
        _id: marriageId,
        status: 'accepted',
        weddingGuests: { $ne: guestId }
      },
      {
        $inc: { jointBank: giftAmount, weddingGiftsTotal: giftAmount },
        $push: { weddingGuests: guestId }
      },
      { new: true }
    );

    if (!updatedMarriage) {
      // Возврат печенек если гость уже дарил подарок
      await User.findOneAndUpdate(
        { telegramId: guestId },
        { $inc: { cookies: giftAmount } }
      );
      return ctx.answerCbQuery('❌ Вы уже подарили подарок молодоженам!', { show_alert: true });
    }
    
    const guestNickname = await getNicknameByTelegramId(guestId);
    const user1Nickname = await getNicknameByTelegramId(marriage.userId);
    const user2Nickname = await getNicknameByTelegramId(marriage.partnerId);
    
    ctx.answerCbQuery(`✅ Вы подарили ${giftAmount} печенек молодоженам!`, { show_alert: true });
    
    // Уведомляем молодоженов
    const giftMessage = `🎁 ${guestNickname} подарил(а) вам ${giftAmount} печенек на свадьбу!\n\n💰 Подарок добавлен в ваш совместный банк!`;
    
    ctx.telegram.sendMessage(marriage.userId, giftMessage, { parse_mode: 'HTML' }).catch(() => {});
    ctx.telegram.sendMessage(marriage.partnerId, giftMessage, { parse_mode: 'HTML' }).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при дарении подарка на свадьбе:', error);
    ctx.answerCbQuery('❌ Произошла ошибка.', { show_alert: true });
  }
});

// === 📌 Совместный банк - просмотр (.отн банк) ===
bot.hears(/^\.отн банк$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    // Получаем последние 5 операций
    const recentHistory = marriage.jointBankHistory.slice(-5).reverse();
    let historyText = '';
    
    if (recentHistory.length > 0) {
      historyText = '\n\n📜 <b>Последние операции:</b>\n';
      for (const op of recentHistory) {
        const opUserNick = await getNicknameByTelegramId(op.userId);
        const action = op.action === 'deposit' ? '➕ Внес' : '➖ Снял';
        const date = new Date(op.date).toLocaleDateString('ru-RU');
        historyText += `${action} ${op.amount} 🍪 - ${opUserNick} (${date})\n`;
      }
    }
    
    const bankText = `
🏦 <b>Совместный банк пары</b>

💑 ${userNickname} ❤️ ${partnerNickname}

💰 <b>Баланс:</b> ${marriage.jointBank} печенек

💡 <i>Используйте команды:</i>
• <code>.отн банк внести &lt;сумма&gt;</code> - внести средства
• <code>.отн банк снять &lt;сумма&gt;</code> - снять средства${historyText}
    `;
    
    ctx.reply(bankText, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка при просмотре банка:', error);
    ctx.reply('❌ Произошла ошибка при просмотре банка.');
  }
});

// === 📌 Совместный банк - внести (.отн банк внести) ===
bot.hears(/^\.отн банк внести\s+(\d+)$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const amount = parseInt(ctx.match[1]);
    
    if (amount < 1) {
      return ctx.reply('❌ Сумма должна быть больше 0.');
    }
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    // ⚡ Атомарное списание печенек у пользователя
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: userId, cookies: { $gte: amount } },
      { $inc: { cookies: -amount } },
      { new: true }
    );
    if (!updatedUser) {
      const freshUser = await User.findOne({ telegramId: userId });
      return ctx.reply(`❌ У вас недостаточно печенек. Нужно: ${amount}, есть: ${freshUser?.cookies || 0}`);
    }
    
    // ⚡ Атомарное зачисление в совместный банк пары с историей и компенсацией
    let updatedMarriage;
    try {
      updatedMarriage = await Marriage.findOneAndUpdate(
        { _id: marriage._id },
        {
          $inc: { jointBank: amount },
          $push: {
            jointBankHistory: {
              userId: userId,
              action: 'deposit',
              amount: amount,
              date: new Date()
            }
          },
          $set: { lastActivity: new Date() }
        },
        { new: true }
      );
    } catch (mErr) {
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { cookies: amount } }
      );
      throw mErr;
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    
    ctx.reply(
      `✅ Вы внесли ${amount} печенек в совместный банк!\n\n💰 Баланс банка: ${updatedMarriage?.jointBank || 0} печенек`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `💰 ${userNickname} внес(ла) ${amount} печенек в ваш совместный банк!\n\n🏦 Баланс банка: ${marriage.jointBank} печенек`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при внесении в банк:', error);
    ctx.reply('❌ Произошла ошибка при внесении средств.');
  }
});

// === 📌 Совместный банк - снять (.отн банк снять) ===
bot.hears(/^\.отн банк снять\s+(\d+)$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const amount = parseInt(ctx.match[1]);
    
    if (amount < 1) {
      return ctx.reply('❌ Сумма должна быть больше 0.');
    }
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    if (marriage.jointBank < amount) {
      return ctx.reply(`❌ В совместном банке недостаточно средств. Доступно: ${marriage.jointBank} печенек`);
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    // Создаем запрос на подтверждение от партнера
    const confirmMessage = `
💰 <b>Запрос на снятие средств</b>

${userNickname} хочет снять ${amount} печенек из совместного банка.

🏦 Баланс банка: ${marriage.jointBank} печенек
💸 К снятию: ${amount} печенек
📊 Останется: ${marriage.jointBank - amount} печенек

Вы подтверждаете эту операцию?
    `;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Подтвердить', `bank_withdraw_confirm_${marriage._id}_${userId}_${amount}`),
        Markup.button.callback('❌ Отклонить', `bank_withdraw_reject_${marriage._id}_${userId}_${amount}`)
      ]
    ]);
    
    ctx.reply('⏳ Запрос на снятие средств отправлен партнеру. Ожидайте подтверждения...');
    
    ctx.telegram.sendMessage(partnerId, confirmMessage, {
      parse_mode: 'HTML',
      ...keyboard
    }).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при снятии из банка:', error);
    ctx.reply('❌ Произошла ошибка при снятии средств.');
  }
});

// === 📌 Обработчик подтверждения снятия средств ===
bot.action(/^bank_withdraw_confirm_(.+)_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const marriageId = ctx.match[1];
    const requesterId = parseInt(ctx.match[2], 10);
    const amount = parseInt(ctx.match[3], 10);
    const confirmerId = ctx.from.id;

    // ⚡ Моментальный ответ Telegram и отключение кнопок для защиты от повторных кликов (Replay Protection)
    await ctx.answerCbQuery().catch(() => {});
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    
    const marriage = await Marriage.findById(marriageId);
    if (!marriage || marriage.status !== 'accepted') {
      return ctx.editMessageText('❌ Брак не найден или не активен.', { parse_mode: 'HTML' });
    }
    
    // Проверяем, что подтверждает именно партнер
    const partnerId = getPartnerId(marriage, requesterId);
    if (Number(confirmerId) !== Number(partnerId)) {
      return ctx.editMessageText('❌ Это не ваш запрос.', { parse_mode: 'HTML' });
    }
    
    const requester = await User.findOne({ telegramId: requesterId });
    if (!requester) {
      return ctx.editMessageText('❌ Пользователь не найден.', { parse_mode: 'HTML' });
    }
    
    // ⚡ Атомарное списание из совместного банка брака с проверкой баланса
    const updatedMarriage = await Marriage.findOneAndUpdate(
      {
        _id: marriageId,
        status: 'accepted',
        jointBank: { $gte: amount }
      },
      {
        $inc: { jointBank: -amount },
        $push: {
          jointBankHistory: {
            userId: requesterId,
            action: 'withdraw',
            amount: amount,
            date: new Date()
          }
        },
        $set: { lastActivity: new Date() }
      },
      { new: true }
    );

    if (!updatedMarriage) {
      return ctx.editMessageText('❌ Недостаточно средств в банке или запрос уже был обработан.', { parse_mode: 'HTML' });
    }

    // Начисляем печеньки запросившему пользователю
    await User.findOneAndUpdate(
      { telegramId: requesterId },
      { $inc: { cookies: amount } }
    );
    
    const confirmerNickname = await getNicknameByTelegramId(confirmerId);
    
    ctx.editMessageText(
      `✅ Вы подтвердили снятие ${amount} печенек.\n\n🏦 Баланс банка: ${updatedMarriage.jointBank} печенек`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем того, кто запросил
    ctx.telegram.sendMessage(
      requesterId,
      `✅ ${confirmerNickname} одобрил(а) снятие средств!\n\n💰 Вы получили ${amount} печенек\n🏦 Баланс банка: ${updatedMarriage.jointBank} печенек`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при подтверждении снятия:', error);
    ctx.editMessageText('❌ Произошла ошибка при подтверждении снятия.', { parse_mode: 'HTML' });
  }
});

// === 📌 Обработчик отклонения снятия средств ===
bot.action(/^bank_withdraw_reject_(.+)_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const marriageId = ctx.match[1];
    const requesterId = parseInt(ctx.match[2], 10);
    const amount = parseInt(ctx.match[3], 10);
    const confirmerId = ctx.from.id;

    // ⚡ Моментальный ответ и отключение кнопок
    await ctx.answerCbQuery('❌ Запрос отклонен.', { show_alert: true }).catch(() => {});
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    
    const marriage = await Marriage.findById(marriageId);
    if (!marriage || marriage.status !== 'accepted') {
      return ctx.editMessageText('❌ Брак не найден.', { parse_mode: 'HTML' });
    }
    
    // Проверяем, что отклоняет именно партнер
    const partnerId = getPartnerId(marriage, requesterId);
    if (Number(confirmerId) !== Number(partnerId)) {
      return ctx.editMessageText('❌ Это не ваш запрос.', { parse_mode: 'HTML' });
    }
    
    const confirmerNickname = await getNicknameByTelegramId(confirmerId);
    
    ctx.editMessageText(
      `❌ Вы отклонили запрос на снятие ${amount} печенек.`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем того, кто запросил
    ctx.telegram.sendMessage(
      requesterId,
      `❌ ${confirmerNickname} отклонил(а) ваш запрос на снятие ${amount} печенек из совместного банка.`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при отклонении снятия:', error);
    ctx.editMessageText('❌ Произошла ошибка.', { parse_mode: 'HTML' });
  }
});

// === 📌 Топ пар (.отн топ) ===
bot.hears(/^\.отн топ$/, async (ctx) => {
  try {
    // ⚡ ОПТИМИЗАЦИЯ: Выборка без N+1 последовательных записей в базу
    const marriages = await Marriage.find({ status: 'accepted' }).lean();
    
    if (!marriages || marriages.length === 0) {
      return ctx.reply('💔 Пока нет активных браков.');
    }
    
    // Рассчитываем рейтинг и уровень в памяти (гармонизация с 30-уровневой системой и искрами)
    const scoredMarriages = marriages.map(m => {
      const lvl = typeof getCoupleLevel === 'function' ? getCoupleLevel(m) : (m.level || 1);
      const score = calculateRelationshipScore(m);
      return { ...m, calculatedLevel: lvl, calculatedScore: score };
    });
    
    // Сортируем по вычисленному рейтингу
    scoredMarriages.sort((a, b) => b.calculatedScore - a.calculatedScore);
    
    let topText = '🏆 <b>ТОП-10 ПАР</b> 🏆\n\n';
    
    const topMarriages = scoredMarriages.slice(0, 10);
    for (let i = 0; i < topMarriages.length; i++) {
      const marriage = topMarriages[i];
      const user1 = await getNicknameByTelegramId(marriage.userId);
      const user2 = await getNicknameByTelegramId(marriage.partnerId);
      const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
      const daysTogether = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
      
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      
      topText += `${medal} ${user1} ❤️ ${user2}\n`;
      topText += `   📊 Рейтинг: ${utils.sp(marriage.calculatedScore)} | ⭐ Уровень: ${marriage.calculatedLevel}/30 | 🔥 Искры: ${utils.sp(marriage.sparks || 0)}\n`;
      topText += `   📅 Дней вместе: ${daysTogether}\n`;
      topText += `   🏦 Совместный банк: ${utils.sp(marriage.jointBank || 0)} 🍪\n\n`;
    }
    
    ctx.reply(topText, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка при получении топа пар:', error);
    ctx.reply('❌ Произошла ошибка при получении топа пар.');
  }
});

// === 📌 Годовщина (.отн годовщина) ===
bot.hears(/^\.отн годовщина$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    const startDate = marriage.acceptedAt || marriage.createdAt || new Date();
    const now = new Date();
    const daysTogether = Math.max(0, Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
    
    // Вычисляем следующую годовщину
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + Math.ceil(Math.max(1, (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))));
    
    const daysToNextAnniversary = Math.max(0, Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const anniversaryText = `
💝 <b>Годовщина отношений</b>

💑 ${userNickname} ❤️ ${partnerNickname}

📅 <b>Дата начала:</b> ${startDate.toLocaleDateString('ru-RU')}
⏰ <b>Дней вместе:</b> ${daysTogether}

🎉 <b>Пройденные вехи:</b>
${daysTogether >= 7 ? '✅' : '⏳'} 7 дней - Молодожены
${daysTogether >= 30 ? '✅' : '⏳'} 30 дней - Медовый месяц
${daysTogether >= 100 ? '✅' : '⏳'} 100 дней - Неразлучные
${daysTogether >= 365 ? '✅' : '⏳'} 365 дней - Золотая пара

💡 <i>Продолжайте развивать ваши отношения!</i>
    `;
    
    ctx.reply(anniversaryText, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Ошибка при просмотре годовщины:', error);
    ctx.reply('❌ Произошла ошибка при просмотре годовщины.');
  }
});

// === 📌 Комплимент партнеру (.отн комплимент) ===
bot.hears(/^\.отн комплимент$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const compliments = [
      'Ты самый(ая) лучший(ая)! 💖',
      'С тобой каждый день как праздник! 🎉',
      'Ты делаешь мою жизнь ярче! ✨',
      'Ты моё счастье! 😊',
      'Я так рад(а), что ты со мной! 💕',
      'Ты невероятный(ая)! 🌟',
      'С тобой я чувствую себя особенным(ой)! 💝',
      'Ты моё вдохновение! 🎨',
      'Рядом с тобой я счастлив(а)! 😍',
      'Ты просто чудо! 🦄'
    ];
    
    const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
    
    marriage.lastActivity = new Date();
    marriage.relationshipScore += 10;
    await marriage.save();
    
    ctx.reply(
      `💝 ${userNickname} говорит ${partnerNickname}:\n\n"${randomCompliment}"`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `💝 ${userNickname} сказал(а) вам комплимент:\n\n"${randomCompliment}"\n\n💖 +10 к рейтингу отношений!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при комплименте:', error);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 📌 Признание в любви (.отн признание) ===
bot.hears(/^\.отн признание$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const declarations = [
      'Я люблю тебя больше всего на свете! ❤️',
      'Ты смысл моей жизни! 💖',
      'Моё сердце принадлежит только тебе! 💕',
      'Я не представляю свою жизнь без тебя! 💝',
      'Ты моя единственная любовь! 💗',
      'С каждым днём я люблю тебя всё сильнее! 💓',
      'Ты моя судьба! 💘',
      'Я хочу быть с тобой всегда! 💞'
    ];
    
    const randomDeclaration = declarations[Math.floor(Math.random() * declarations.length)];
    
    marriage.lastActivity = new Date();
    marriage.relationshipScore += 25;
    await marriage.save();
    
    ctx.reply(
      `💖 ${userNickname} признаётся в любви ${partnerNickname}:\n\n"${randomDeclaration}"`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `💖 ${userNickname} признался(лась) вам в любви:\n\n"${randomDeclaration}"\n\n💝 +25 к рейтингу отношений!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при признании:', error);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 📌 Сюрприз для партнера (.отн сюрприз) ===
bot.hears(/^\.отн сюрприз$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return ctx.reply('❌ Пользователь не найден.');
    }
    
    const surpriseCost = 300;
    if (user.cookies < surpriseCost) {
      return ctx.reply(`❌ Недостаточно печенек для сюрприза. Нужно: ${surpriseCost}`);
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const partner = await User.findOne({ telegramId: partnerId });
    
    if (!partner) {
      return ctx.reply('❌ Партнер не найден.');
    }
    
    // Случайный сюрприз
    const surprises = [
      { text: 'букет цветов 💐', bonus: 150 },
      { text: 'коробку конфет 🍫', bonus: 200 },
      { text: 'плюшевого мишку 🧸', bonus: 250 },
      { text: 'романтический ужин 🍽️', bonus: 300 },
      { text: 'билеты в кино 🎬', bonus: 180 },
      { text: 'ювелирное украшение 💎', bonus: 400 }
    ];
    
    const randomSurprise = surprises[Math.floor(Math.random() * surprises.length)];
    
    user.cookies -= surpriseCost;
    partner.cookies += randomSurprise.bonus;
    
    marriage.lastActivity = new Date();
    marriage.relationshipScore += 50;
    marriage.totalGiftValue += surpriseCost;
    
    await user.save();
    await partner.save();
    await marriage.save();
    
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    ctx.reply(
      `🎁 ${userNickname} приготовил(а) сюрприз для ${partnerNickname}!\n\n🎉 Это ${randomSurprise.text}!\n\n💰 Стоимость: ${surpriseCost} печенек\n🎁 Партнер получил: ${randomSurprise.bonus} печенек`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `🎁 ${userNickname} приготовил(а) для вас сюрприз - ${randomSurprise.text}!\n\n💰 Вы получили ${randomSurprise.bonus} печенек!\n\n💖 +50 к рейтингу отношений!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при сюрпризе:', error);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 📌 Прогулка с партнером (.отн прогулка) ===
bot.hears(/^\.отн прогулка$/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в браке.');
    }
    
    const partnerId = getPartnerId(marriage, userId);
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    const walkPlaces = [
      { place: 'в парке 🌳', bonus: 50 },
      { place: 'по набережной 🌊', bonus: 60 },
      { place: 'в ботаническом саду 🌺', bonus: 70 },
      { place: 'по старому городу 🏛️', bonus: 55 },
      { place: 'в лесу 🌲', bonus: 65 },
      { place: 'вдоль реки 🏞️', bonus: 60 }
    ];
    
    const randomWalk = walkPlaces[Math.floor(Math.random() * walkPlaces.length)];
    
    marriage.lastActivity = new Date();
    marriage.relationshipScore += randomWalk.bonus;
    
    // Проверяем и добавляем достижения
    const newAchievements = await checkAndAddAchievements(marriage);
    
    await marriage.save();
    
    let achievementText = '';
    if (newAchievements.length > 0) {
      achievementText = `\n\n🏆 Получено достижение: ${newAchievements.join(', ')}!`;
    }
    
    ctx.reply(
      `🚶 ${userNickname} и ${partnerNickname} отправились на прогулку ${randomWalk.place}!\n\n💖 +${randomWalk.bonus} к рейтингу отношений!${achievementText}`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем партнера
    ctx.telegram.sendMessage(
      partnerId,
      `🚶 ${userNickname} пригласил(а) вас на прогулку ${randomWalk.place}!\n\n💖 +${randomWalk.bonus} к рейтингу отношений!${achievementText}`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при прогулке:', error);
    ctx.reply('❌ Произошла ошибка.');
  }
});

bot.hears('/pingtest', (ctx) => ctx.reply('pong!'));

// =============================================================
// CELYA / CELESTIANA ФУНКЦИОНАЛ: ГРАФИКА, ИГРЫ, РАЗВЛЕЧЕНИЯ
// =============================================================

// Вспомогательная функция обработки демотиватора (поддерживает ответ на фото и фото с подписью)
async function handleDemotivator(ctx, rawText) {
  try {
    const photoArr = ctx.message?.reply_to_message?.photo || ctx.message?.photo;
    if (!photoArr || photoArr.length === 0) {
      return ctx.reply(
        '❌ Отправьте команду в ответ на фотографию или прикрепите фото к сообщению!\n💡 <i>Пример:</i> <code>.демотиватор Жизнь / Она прекрасна</code>',
        { parse_mode: 'HTML' }
      );
    }

    const text = (rawText || '').trim();
    let title = 'ДЕМОТИВАТОР';
    let subtitle = '';

    if (text) {
      const parts = text.split(/\s*[\/\n]\s*/);
      title = parts[0] ? parts[0].trim().toUpperCase() : 'ДЕМОТИВАТОР';
      subtitle = parts[1] ? parts[1].trim() : '';
    }

    const largestPhoto = photoArr[photoArr.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    const photoResponse = await axios.get(fileLink.href || fileLink, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(photoResponse.data);

    const demoBuffer = await generateDemotivator({ imageBuffer, title, subtitle });
    return await ctx.replyWithPhoto({ source: demoBuffer });
  } catch (err) {
    console.error('Ошибка в .демотиватор:', err);
    ctx.reply('❌ Ошибка при генерации демотиватора.');
  }
}

// Вспомогательная функция применения фотофильтра
async function handlePhotoFilter(ctx, filterName) {
  try {
    const photoArr = ctx.message?.reply_to_message?.photo || ctx.message?.photo;
    if (!photoArr || photoArr.length === 0) {
      return ctx.reply(
        `❌ Отправьте команду в ответ на фотографию или прикрепите фото с подписью!\n` +
        `💡 <i>Доступные фильтры:</i> <code>.чб</code>, <code>.негатив</code>, <code>.пиксель</code>, <code>.зерк</code>, <code>.блюр</code>`,
        { parse_mode: 'HTML' }
      );
    }

    const largestPhoto = photoArr[photoArr.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    const photoResponse = await axios.get(fileLink.href || fileLink, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(photoResponse.data);

    const rawFilter = (filterName || '').toLowerCase().trim();
    const filterKey = rawFilter === 'зеркало' ? 'зерк' : rawFilter;
    const filteredBuffer = await applyPhotoFilter(imageBuffer, filterKey);

    return await ctx.replyWithPhoto(
      { source: filteredBuffer },
      { caption: `🎨 Фильтр: <b>${filterName}</b>`, parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Ошибка в фотофильтре:', err);
    ctx.reply('❌ Ошибка при обработке фотографии.');
  }
}

// === 🖼️ Генератор демотиваторов (.демотиватор / .дем) ===
bot.hears(/^[.!\/](?:демотиватор|дем)(?:\s+([\s\S]+))?$/i, async (ctx) => {
  return handleDemotivator(ctx, ctx.match[1]);
});

// === 🎨 Фотофильтры на Canvas (.чб, .негатив, .пиксель, .зерк, .блюр) ===
bot.hears(/^[.!\/](чб|негатив|пиксель|зерк|зеркало|блюр)(?:\s+(.+))?$/i, async (ctx) => {
  return handlePhotoFilter(ctx, ctx.match[1]);
});

// Обработка команд в подписях к прикрепленным фотографиям
bot.on('photo', async (ctx, next) => {
  const cap = ctx.message?.caption;
  if (!cap) return next();

  const demoMatch = cap.match(/^[.!\/](?:демотиватор|дем)(?:\s+([\s\S]+))?$/i);
  if (demoMatch) {
    return handleDemotivator(ctx, demoMatch[1]);
  }

  const filterMatch = cap.match(/^[.!\/](чб|негатив|пиксель|зерк|зеркало|блюр)(?:\s+(.+))?$/i);
  if (filterMatch) {
    return handlePhotoFilter(ctx, filterMatch[1]);
  }

  return next();
});

// === 🎲 Кости 2d6 (.кости <ставка>) ===
bot.hears(/^[.!\/]кости(?:\s+(.+))?$/i, async (ctx) => {
  try {
    const user = ctx.state.user || await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('❌ Вы не зарегистрированы в боте. Напишите /start');

    const rawBet = ctx.match[1];
    if (!rawBet) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Используйте: .кости <сумма>\n🍪 • Ваш баланс: ${formatNumber(user.cookies)}`, { parse_mode: 'Markdown' });
    }

    const bet = parseBetAmount(rawBet, user.cookies);
    if (!bet || bet < 5) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка: 5 печенек.`, { parse_mode: 'Markdown' });
    }

    // Атомарно списываем ставку для защиты от race condition
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: ctx.from.id, cookies: { $gte: bet } },
      { $inc: { cookies: -bet } },
      { new: true }
    );

    if (!updatedUser) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Недостаточно печенек для ставки!\n🍪 • Баланс: ${formatNumber(user.cookies)}`, { parse_mode: 'Markdown' });
    }

    // Бросок 2d6
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const u1 = Math.floor(Math.random() * 6);
    const u2 = Math.floor(Math.random() * 6);
    const userTotal = u1 + u2 + 2;

    const b1 = Math.floor(Math.random() * 6);
    const b2 = Math.floor(Math.random() * 6);
    const botTotal = b1 + b2 + 2;

    let payout = 0;
    let outcome = '';

    if (userTotal > botTotal) {
      payout = bet * 2;
      outcome = `➕ • <b>Вы выиграли:</b> +${formatNumber(bet)} 🍪!`;
    } else if (userTotal < botTotal) {
      payout = 0;
      outcome = `➖ • <b>Вы проиграли:</b> -${formatNumber(bet)} 🍪.`;
    } else {
      payout = bet;
      outcome = `🤝 • <b>Ничья!</b> Ставка ${formatNumber(bet)} 🍪 возвращена.`;
    }

    if (payout > 0) {
      await User.findOneAndUpdate(
        { telegramId: ctx.from.id },
        { $inc: { cookies: payout } }
      );
    }

    const finalUser = await User.findOne({ telegramId: ctx.from.id });
    const msg =
      `<a href="tg://user?id=${ctx.from.id}">${escapeHtml(user.nickname)}</a>,\n` +
      `🎲 <b>Игра в кости (2d6)</b>\n\n` +
      `👤 • Ваши кости: ${diceEmojis[u1]} ${diceEmojis[u2]} (<b>${userTotal}</b>)\n` +
      `🤖 • Кости бота: ${diceEmojis[b1]} ${diceEmojis[b2]} (<b>${botTotal}</b>)\n\n` +
      `${outcome}\n` +
      `🍪 • Баланс: <b>${formatNumber(finalUser?.cookies || 0)}</b>`;

    return ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка в .кости:', err);
    ctx.reply('❌ Произошла ошибка в игре.');
  }
});

// === 🪙 Монетка (.монетка <орел/решка> <ставка>) ===
bot.hears(/^[.!\/]монетка(?:\s+(.+))?$/i, async (ctx) => {
  try {
    const user = ctx.state.user || await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('❌ Вы не зарегистрированы в боте. Напишите /start');

    const rawArgs = ctx.match[1]?.trim();
    if (!rawArgs) {
      return ctx.reply(
        `[${user.nickname}](tg://user?id=${ctx.from.id}),\n` +
        `💡 • Используйте: .монетка <орел/решка> <сумма>\n` +
        `🍪 • Ваш баланс: ${formatNumber(user.cookies)}`,
        { parse_mode: 'Markdown' }
      );
    }

    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply(
        `[${user.nickname}](tg://user?id=${ctx.from.id}),\n` +
        `💡 • Используйте: .монетка <орел/решка> <сумма>\n` +
        `🍪 • Ваш баланс: ${formatNumber(user.cookies)}`,
        { parse_mode: 'Markdown' }
      );
    }

    // Поддержка обоих порядков аргументов: "орел 100" или "100 орел"
    let sideChoice = null;
    let rawBet = null;
    const isSide = (s) => ['о', 'р', 'орел', 'орёл', 'решка'].includes(s.toLowerCase());

    if (isSide(parts[0])) {
      sideChoice = parts[0].toLowerCase();
      rawBet = parts.slice(1).join(' ');
    } else if (isSide(parts[parts.length - 1])) {
      sideChoice = parts[parts.length - 1].toLowerCase();
      rawBet = parts.slice(0, -1).join(' ');
    } else {
      return ctx.reply(
        `[${user.nickname}](tg://user?id=${ctx.from.id}),\n` +
        `❌ • Укажите сторону: «орел» (о) или «решка» (р)!`,
        { parse_mode: 'Markdown' }
      );
    }

    const isEagle = ['о', 'орел', 'орёл'].includes(sideChoice);
    const bet = parseBetAmount(rawBet, user.cookies);
    if (!bet || bet < 5) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка: 5 печенек.`, { parse_mode: 'Markdown' });
    }

    // Атомарно списываем ставку
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: ctx.from.id, cookies: { $gte: bet } },
      { $inc: { cookies: -bet } },
      { new: true }
    );

    if (!updatedUser) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Недостаточно печенек для ставки!\n🍪 • Баланс: ${formatNumber(user.cookies)}`, { parse_mode: 'Markdown' });
    }

    // Бросок монетки: 0 - орел, 1 - решка
    const flip = Math.random() < 0.5 ? 0 : 1;
    const flippedEagle = flip === 0;
    const userWon = (isEagle && flippedEagle) || (!isEagle && !flippedEagle);

    let payout = 0;
    let outcome = '';

    if (userWon) {
      payout = bet * 2;
      outcome = `➕ • <b>Вы угадали и выиграли:</b> +${formatNumber(bet)} 🍪!`;
    } else {
      payout = 0;
      outcome = `➖ • <b>Не повезло:</b> -${formatNumber(bet)} 🍪.`;
    }

    if (payout > 0) {
      await User.findOneAndUpdate(
        { telegramId: ctx.from.id },
        { $inc: { cookies: payout } }
      );
    }

    const finalUser = await User.findOne({ telegramId: ctx.from.id });
    const coinSymbol = flippedEagle ? '🦅 Орёл' : '🪙 Решка';
    const choiceSymbol = isEagle ? '🦅 Орёл' : '🪙 Решка';

    const msg =
      `<a href="tg://user?id=${ctx.from.id}">${escapeHtml(user.nickname)}</a>,\n` +
      `🪙 <b>Бросок монетки</b>\n\n` +
      `🎯 • Ваш выбор: <b>${choiceSymbol}</b>\n` +
      `✨ • Выпало: <b>${coinSymbol}</b>\n\n` +
      `${outcome}\n` +
      `🍪 • Баланс: <b>${formatNumber(finalUser?.cookies || 0)}</b>`;

    return ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка в .монетка:', err);
    ctx.reply('❌ Произошла ошибка в игре.');
  }
});

// === 🃏 Блэкджек 21 (.блэкджек / .бк <ставка>) ===
bot.hears(/^[.!\/](?:блэкджек|бк)(?:\s+(.+))?$/i, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = ctx.state.user || await User.findOne({ telegramId: userId });
    if (!user) return ctx.reply('❌ Вы не зарегистрированы в боте. Напишите /start');

    if (activeBlackjacks.has(userId)) {
      return ctx.reply('⚠️ У вас уже есть активная игра в Блэкджек! Завершите её перед началом новой.');
    }

    const rawBet = ctx.match[1];
    if (!rawBet) {
      return ctx.reply(
        `[${user.nickname}](tg://user?id=${userId}),\n` +
        `💡 • Используйте: .блэкджек <сумма> (или .бк <сумма>)\n` +
        `🍪 • Ваш баланс: ${formatNumber(user.cookies)}`,
        { parse_mode: 'Markdown' }
      );
    }

    const bet = parseBetAmount(rawBet, user.cookies);
    if (!bet || bet < 5) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${userId}),\n❌ • Минимальная ставка: 5 печенек.`, { parse_mode: 'Markdown' });
    }

    // Атомарно списываем ставку
    const updatedUser = await User.findOneAndUpdate(
      { telegramId: userId, cookies: { $gte: bet } },
      { $inc: { cookies: -bet } },
      { new: true }
    );

    if (!updatedUser) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${userId}),\n❌ • Недостаточно печенек для ставки!\n🍪 • Баланс: ${formatNumber(user.cookies)}`, { parse_mode: 'Markdown' });
    }

    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const playerScore = calculateHandScore(playerHand);
    const dealerScore = calculateHandScore(dealerHand);

    // Проверка натурального Блэкджека (21 с раздачи)
    if (playerScore === 21) {
      let outcome = '';
      let payout = 0;
      if (dealerScore === 21) {
        outcome = `🤝 • <b>У обоих Блэкджек!</b> Ничья, ставка ${formatNumber(bet)} 🍪 возвращена.`;
        payout = bet;
      } else {
        const winProfit = Math.floor(bet * 1.5);
        payout = bet + winProfit;
        outcome = `🔥 • <b>НАТУРАЛЬНЫЙ БЛЭКДЖЕК!</b> Выигрыш (3:2): +${formatNumber(winProfit)} 🍪!`;
      }

      if (payout > 0) {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { cookies: payout } });
      }
      const finalUser = await User.findOne({ telegramId: userId });

      const msg =
        `🃏 <b>БЛЭКДЖЕК (21)</b>\n\n` +
        `👤 <b>Ваши карты:</b> ${formatHand(playerHand)}\n` +
        `🤖 <b>Карты дилера:</b> ${formatHand(dealerHand)}\n\n` +
        `${outcome}\n` +
        `🍪 • Баланс: <b>${formatNumber(finalUser?.cookies || 0)}</b>`;

      return ctx.reply(msg, { parse_mode: 'HTML' });
    }

    // Игра продолжается
    const msg =
      `🃏 <b>БЛЭКДЖЕК (21)</b>\n\n` +
      `👤 <b>Ваши карты:</b> ${formatHand(playerHand)}\n` +
      `🤖 <b>Карта дилера:</b> ${formatHand(dealerHand, true)}\n\n` +
      `💰 • Ставка: <b>${formatNumber(bet)}</b> 🍪\n` +
      `👇 Выберите действие:`;

    const sentMsg = await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...getBlackjackKeyboard(userId)
    });

    // Авто-таймаут на 2 минуты
    const timer = setTimeout(async () => {
      if (activeBlackjacks.has(userId)) {
        activeBlackjacks.delete(userId);
        ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, null, '⏳ Время хода вышло! Игра завершена по таймауту.').catch(() => {});
      }
    }, 120000);

    activeBlackjacks.set(userId, {
      bet,
      deck,
      playerHand,
      dealerHand,
      messageId: sentMsg.message_id,
      chatId: ctx.chat.id,
      timer
    });

  } catch (err) {
    console.error('Ошибка в .блэкджек:', err);
    ctx.reply('❌ Ошибка игры в Блэкджек.');
  }
});

// Кнопка [ Взять карту 🃏 ]
bot.action(/^bj_hit_(\d+)$/, async (ctx) => {
  try {
    const targetUserId = Number(ctx.match[1]);
    if (ctx.from.id !== targetUserId) {
      return ctx.answerCbQuery('❌ Это не ваша игра!', { show_alert: true });
    }

    const game = activeBlackjacks.get(targetUserId);
    if (!game) {
      await ctx.answerCbQuery('⏳ Игра уже завершена.', { show_alert: true }).catch(() => {});
      return ctx.editMessageText('⏳ Игра уже завершена.').catch(() => {});
    }

    if (game.busy) {
      return ctx.answerCbQuery().catch(() => {});
    }
    game.busy = true;

    const drawnCard = game.deck.pop();
    if (drawnCard) {
      game.playerHand.push(drawnCard);
    }
    const score = calculateHandScore(game.playerHand);

    if (score > 21) {
      clearTimeout(game.timer);
      activeBlackjacks.delete(targetUserId);

      await ctx.answerCbQuery().catch(() => {});
      const finalUser = await User.findOne({ telegramId: targetUserId });
      const msg =
        `🃏 <b>БЛЭКДЖЕК (21)</b>\n\n` +
        `👤 <b>Ваши карты:</b> ${formatHand(game.playerHand)}\n` +
        `🤖 <b>Карты дилера:</b> ${formatHand(game.dealerHand)}\n\n` +
        `💥 • <b>ПЕРЕБОР (${score})!</b> Вы проиграли ${formatNumber(game.bet)} 🍪.\n` +
        `🍪 • Баланс: <b>${formatNumber(finalUser?.cookies || 0)}</b>`;

      return ctx.editMessageText(msg, { parse_mode: 'HTML' });
    }

    if (score === 21) {
      return executeBlackjackStand(ctx, targetUserId, game);
    }

    const msg =
      `🃏 <b>БЛЭКДЖЕК (21)</b>\n\n` +
      `👤 <b>Ваши карты:</b> ${formatHand(game.playerHand)}\n` +
      `🤖 <b>Карта дилера:</b> ${formatHand(game.dealerHand, true)}\n\n` +
      `💰 • Ставка: <b>${formatNumber(game.bet)}</b> 🍪\n` +
      `👇 Выберите действие:`;

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      ...getBlackjackKeyboard(targetUserId)
    });
    game.busy = false;
    ctx.answerCbQuery().catch(() => {});
  } catch (err) {
    console.error('Ошибка bj_hit:', err);
  }
});

// Кнопка [ Хватит 🛑 ]
bot.action(/^bj_stand_(\d+)$/, async (ctx) => {
  try {
    const targetUserId = Number(ctx.match[1]);
    if (ctx.from.id !== targetUserId) {
      return ctx.answerCbQuery('❌ Это не ваша игра!', { show_alert: true });
    }

    const game = activeBlackjacks.get(targetUserId);
    if (!game) {
      await ctx.answerCbQuery('⏳ Игра уже завершена.', { show_alert: true }).catch(() => {});
      return ctx.editMessageText('⏳ Игра уже завершена.').catch(() => {});
    }

    if (game.busy) {
      return ctx.answerCbQuery().catch(() => {});
    }
    game.busy = true;

    return executeBlackjackStand(ctx, targetUserId, game);
  } catch (err) {
    console.error('Ошибка bj_stand:', err);
  }
});

async function executeBlackjackStand(ctx, userId, game) {
  clearTimeout(game.timer);
  activeBlackjacks.delete(userId);

  while (calculateHandScore(game.dealerHand) < 17) {
    const nextCard = game.deck.pop();
    if (!nextCard) break;
    game.dealerHand.push(nextCard);
  }

  const playerScore = calculateHandScore(game.playerHand);
  const dealerScore = calculateHandScore(game.dealerHand);

  let payout = 0;
  let outcome = '';

  if (dealerScore > 21) {
    payout = game.bet * 2;
    outcome = `🎉 • <b>У дилера перебор (${dealerScore})!</b> Вы выиграли: +${formatNumber(game.bet)} 🍪!`;
  } else if (playerScore > dealerScore) {
    payout = game.bet * 2;
    outcome = `➕ • <b>Вы выиграли!</b> (+${formatNumber(game.bet)} 🍪)`;
  } else if (playerScore < dealerScore) {
    payout = 0;
    outcome = `➖ • <b>Дилер победил:</b> (-${formatNumber(game.bet)} 🍪)`;
  } else {
    payout = game.bet;
    outcome = `🤝 • <b>Ничья (${playerScore} : ${dealerScore})!</b> Ставка ${formatNumber(game.bet)} 🍪 возвращена.`;
  }

  if (payout > 0) {
    await User.findOneAndUpdate({ telegramId: userId }, { $inc: { cookies: payout } });
  }

  const finalUser = await User.findOne({ telegramId: userId });
  const msg =
    `🃏 <b>БЛЭКДЖЕК (21) — РЕЗУЛЬТАТ</b>\n\n` +
    `👤 <b>Ваши карты:</b> ${formatHand(game.playerHand)}\n` +
    `🤖 <b>Карты дилера:</b> ${formatHand(game.dealerHand)}\n\n` +
    `${outcome}\n` +
    `🍪 • Баланс: <b>${formatNumber(finalUser?.cookies || 0)}</b>`;

  await ctx.editMessageText(msg, { parse_mode: 'HTML' });
  ctx.answerCbQuery().catch(() => {});
}

// === ❌⭕ Крестики-Нолики 3х3 (.кн @user) ===
bot.hears(/^[.!\/]кн(?:\s+(@\w+))?$/i, async (ctx) => {
  try {
    let opponentId = null;
    if (ctx.match[1]) {
      const username = ctx.match[1].slice(1);
      const targetUser = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
      if (!targetUser) return ctx.reply('❌ Пользователь с таким @username не найден в базе бота.');
      opponentId = targetUser.telegramId;
    } else if (ctx.message.reply_to_message) {
      opponentId = ctx.message.reply_to_message.from.id;
    } else {
      return ctx.reply('❌ Укажите соперника через ответ на сообщение или <code>.кн @username</code>', { parse_mode: 'HTML' });
    }

    if (opponentId === ctx.from.id) {
      return ctx.reply('❌ Нельзя играть в крестики-нолики с самим собой!');
    }

    const [u1, u2] = await Promise.all([
      User.findOne({ telegramId: ctx.from.id }),
      User.findOne({ telegramId: opponentId })
    ]);

    const p1Nick = u1?.nickname || `Игрок 1`;
    const p2Nick = u2?.nickname || `Игрок 2`;

    const gameId = `${ctx.from.id}-${opponentId}-${Date.now()}`;
    const board = Array(9).fill(null);

    const msg =
      `⚔️ <b>ДУЭЛЬ: КРЕСТИКИ-НОЛИКИ</b>\n\n` +
      `❌ <a href="tg://user?id=${ctx.from.id}">${escapeHtml(p1Nick)}</a> VS ⭕ <a href="tg://user?id=${opponentId}">${escapeHtml(p2Nick)}</a>\n\n` +
      `👉 <b>Первый ход:</b> ❌ <a href="tg://user?id=${ctx.from.id}">${escapeHtml(p1Nick)}</a>`;

    const sent = await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...getTicTacToeKeyboard(gameId, board, false)
    });

    const timer = setTimeout(() => {
      activeTicTacToe.delete(gameId);
    }, 180000);

    activeTicTacToe.set(gameId, {
      playerX: { id: ctx.from.id, nick: p1Nick },
      playerO: { id: opponentId, nick: p2Nick },
      board,
      turn: 'X',
      chatId: ctx.chat.id,
      messageId: sent.message_id,
      timer
    });

  } catch (err) {
    console.error('Ошибка в .кн:', err);
    ctx.reply('❌ Ошибка при запуске крестиков-ноликов.');
  }
});

// Заглушка для занятых или завершенных клеток
bot.action(/^ttt_noop(?:_.*)?$/, async (ctx) => {
  return ctx.answerCbQuery().catch(() => {});
});

bot.action(/^ttt_m_([0-9a-zA-Z-]+)_(\d+)$/, async (ctx) => {
  try {
    const gameId = ctx.match[1];
    const cellIdx = Number(ctx.match[2]);

    const game = activeTicTacToe.get(gameId);
    if (!game) {
      return ctx.answerCbQuery('⏳ Игра уже завершена.', { show_alert: true });
    }

    if (game.busy) {
      return ctx.answerCbQuery().catch(() => {});
    }

    if (ctx.from.id !== game.playerX.id && ctx.from.id !== game.playerO.id) {
      return ctx.answerCbQuery('❌ Вы не участвуете в этой дуэли!', { show_alert: true });
    }

    const currentExpectedId = game.turn === 'X' ? game.playerX.id : game.playerO.id;
    if (ctx.from.id !== currentExpectedId) {
      return ctx.answerCbQuery('❌ Сейчас не ваш ход!', { show_alert: true });
    }

    if (game.board[cellIdx] !== null) {
      return ctx.answerCbQuery('❌ Клетка уже занята!', { show_alert: true });
    }

    game.busy = true;
    game.board[cellIdx] = game.turn;
    const winner = checkTicTacToeWinner(game.board);

    if (winner) {
      clearTimeout(game.timer);
      activeTicTacToe.delete(gameId);

      let resultText = '';
      if (winner === 'draw') {
        resultText = `🤝 <b>Ничья!</b> Никто не уступил в этой схватке!`;
      } else {
        const winPlayer = winner === 'X' ? game.playerX : game.playerO;
        resultText = `🏆 <b>Победа!</b> Игрок ${winner === 'X' ? '❌' : '⭕'} <a href="tg://user?id=${winPlayer.id}">${escapeHtml(winPlayer.nick)}</a> одержал верх!`;
      }

      const msg =
        `⚔️ <b>ДУЭЛЬ: КРЕСТИКИ-НОЛИКИ</b>\n\n` +
        `❌ <a href="tg://user?id=${game.playerX.id}">${escapeHtml(game.playerX.nick)}</a> VS ⭕ <a href="tg://user?id=${game.playerO.id}">${escapeHtml(game.playerO.nick)}</a>\n\n` +
        `${resultText}`;

      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...getTicTacToeKeyboard(gameId, game.board, true)
      });
      return ctx.answerCbQuery().catch(() => {});
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    const nextPlayer = game.turn === 'X' ? game.playerX : game.playerO;
    const nextSign = game.turn === 'X' ? '❌' : '⭕';

    const msg =
      `⚔️ <b>ДУЭЛЬ: КРЕСТИКИ-НОЛИКИ</b>\n\n` +
      `❌ <a href="tg://user?id=${game.playerX.id}">${escapeHtml(game.playerX.nick)}</a> VS ⭕ <a href="tg://user?id=${game.playerO.id}">${escapeHtml(game.playerO.nick)}</a>\n\n` +
      `👉 <b>Ход делает:</b> ${nextSign} <a href="tg://user?id=${nextPlayer.id}">${escapeHtml(nextPlayer.nick)}</a>`;

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      ...getTicTacToeKeyboard(gameId, game.board, false)
    });
    game.busy = false;
    ctx.answerCbQuery().catch(() => {});

  } catch (err) {
    console.error('Ошибка хода в крестики-нолики:', err);
  }
});

// === 🔮 Гороскоп (.гороскоп <знак>) ===
bot.hears(/^[.!\/]гороскоп(?:\s+(\S+))?$/i, async (ctx) => {
  try {
    const rawSign = ctx.match[1];
    if (!rawSign) {
      const signsList = Object.values(ZODIAC_SIGNS).map(s => `${s.emoji} ${s.name}`).join(' • ');
      return ctx.reply(
        `🔮 <b>ГОРОСКОП GRIZZLY • CELYA</b>\n\n` +
        `Укажите ваш знак зодиака:\n` +
        `<code>.гороскоп <знак></code>\n\n` +
        `✨ <b>Знаки:</b>\n${signsList}`,
        { parse_mode: 'HTML' }
      );
    }

    const h = getDailyHoroscope(rawSign);
    if (!h) {
      return ctx.reply('❌ Неизвестный знак зодиака. Доступно: Овен, Телец, Близнецы, Рак, Лев, Дева, Весы, Скорпион, Стрелец, Козерог, Водолей, Рыбы.');
    }

    const msg =
      `✨ <b>АСТРОПРОГНОЗ ДЛЯ ЗНАКА: ${h.emoji} ${h.name.toUpperCase()}</b>\n` +
      `📅 <i>Период: ${h.dates}</i>\n\n` +
      `🌟 <b>Общий настрой:</b>\n${h.phrase}\n\n` +
      `💖 <b>Любовь и чувства:</b>\n${h.love}\n\n` +
      `🍀 <b>Удача дня:</b> ${h.luck}%\n` +
      `🔢 <b>Счастливое число:</b> ${h.luckyNum}\n` +
      `💫 <b>Совместимость сегодня:</b> ${h.compatibleSign}`;

    return ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка в .гороскоп:', err);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// === 🔮 Магический шар (.шар <вопрос>) ===
bot.hears(/^[.!\/]шар(?:\s+([\s\S]+))?$/i, async (ctx) => {
  try {
    const question = ctx.match[1]?.trim();
    if (!question) {
      return ctx.reply('🔮 <i>Задайте вопрос магическому шару:</i>\n<code>.шар Будет ли сегодня хороший день?</code>', { parse_mode: 'HTML' });
    }
    const answer = getMagicBallAnswer();
    return ctx.reply(`🔮 <b>Магический шар отвечает:</b>\n\n<blockquote>«${answer}»</blockquote>`, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка в .шар:', err);
  }
});

// === 🎲 Рандомайзер вероятностей (.инфа <текст>) ===
bot.hears(/^[.!\/]инфа(?:\s+([\s\S]+))?$/i, async (ctx) => {
  try {
    const text = ctx.match[1]?.trim();
    if (!text) {
      return ctx.reply('🎲 <i>Укажите событие для расчета вероятности:</i>\n<code>.инфа меня сегодня поцелуют</code>', { parse_mode: 'HTML' });
    }
    const { percent, comment } = getProbability(text);
    return ctx.reply(`🎲 <b>Вероятность:</b> <b>${percent}%</b>\n💡 <i>${comment}</i>`, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка в .инфа:', err);
  }
});

// === ⚖️ Выбор варианта (.выбери <1> или <2>) ===
bot.hears(/^[.!\/]выбери(?:\s+([\s\S]+))?$/i, async (ctx) => {
  try {
    const text = ctx.match[1]?.trim();
    if (!text) {
      return ctx.reply('⚖️ <i>Пример:</i> <code>.выбери чай или кофе</code>', { parse_mode: 'HTML' });
    }
    const options = text.split(/\s+или\s+|\s*,\s*/i).map(s => s.trim()).filter(Boolean);
    if (options.length < 2) {
      return ctx.reply('❌ Укажите как минимум два варианта через «или»!\n💡 Пример: <code>.выбери кино или прогулка</code>', { parse_mode: 'HTML' });
    }
    const choice = options[Math.floor(Math.random() * options.length)];
    return ctx.reply(`🔮 Звёзды шепчут, что лучший выбор — <b>${escapeHtml(choice)}</b>!`, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка в .выбери:', err);
  }
});

// === 📖 Главное интерактивное меню помощи (.помощь / /help) ===
bot.hears(/^[.!\/](?:помощь|help)$/i, async (ctx) => {
  try {
    const { text, keyboard } = getHelpMainMenu();
    return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  } catch (err) {
    console.error('Ошибка в .помощь:', err);
  }
});

bot.action(/^help_cat_(relations|games|economy|photo|admin|fun)$/, async (ctx) => {
  try {
    const cat = ctx.match[1];
    const { text, keyboard } = getHelpCategoryContent(cat);
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    ctx.answerCbQuery().catch(() => {});
  } catch (err) {
    console.error('Ошибка help_cat:', err);
  }
});

bot.action('help_main', async (ctx) => {
  try {
    const { text, keyboard } = getHelpMainMenu();
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    ctx.answerCbQuery().catch(() => {});
  } catch (err) {
    console.error('Ошибка help_main:', err);
  }
});

  
// =============================================================
// 1. НА ТИВНЫЙ HTTP HEALTH-СЕРВЕР И ЛЕНДИНГ GRIZZLY ДЛЯ RENDER.COM
// =============================================================
const http = require('http');
const path = require('path');
const PORT = process.env.PORT || 3000;

function getDbStatusText(state) {
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
}

let cachedLandingHtml = null;
function getLandingHtml() {
  if (!cachedLandingHtml) {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      try {
        cachedLandingHtml = fs.readFileSync(indexPath, 'utf-8');
      } catch (e) {
        console.error('Ошибка чтения public/index.html:', e.message);
      }
    }
  }
  return cachedLandingHtml;
}

const server = http.createServer((req, res) => {
  const url = req.url ? req.url.split('?')[0] : '/';

  // 1. Быстрый эндпоинт для UptimeRobot / Cron
  if (req.method === 'GET' && url === '/ping') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end('pong');
    return;
  }

  // 2. Детальный статус базы данных и uptime
  if (req.method === 'GET' && url === '/health') {
    const dbState = Mongoose.connection.readyState;
    const isHealthy = dbState === 1;

    const payload = JSON.stringify({
      status: isHealthy ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      database: {
        type: 'MongoDB',
        status: getDbStatusText(dbState),
        readyState: dbState
      },
      timestamp: new Date().toISOString()
    }, null, 2);

    res.writeHead(isHealthy ? 200 : 503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(payload);
    return;
  }

  // 3. Живая статистика для сайта Grizzly
  if (req.method === 'GET' && url === '/api/stats') {
    (async () => {
      try {
        const [usersCount, marriagesCount] = await Promise.all([
          User.countDocuments().catch(() => 1420),
          Marriage.countDocuments({ status: 'accepted' }).catch(() => 86)
        ]);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30'
        });
        res.end(JSON.stringify({
          users: usersCount || 1420,
          marriages: marriagesCount || 86,
          uptime: Math.floor(process.uptime()),
          status: 'online'
        }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ users: 1420, marriages: 86, uptime: Math.floor(process.uptime()), status: 'online' }));
      }
    })();
    return;
  }

  // 4. Главная страница: Официальный портал и база команд Grizzly
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    const html = getLandingHtml();
    if (html) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      });
      res.end(html);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

// =============================================================
// 2. АВТО-ПОВТОР ПРИ 409 CONFLICT (TELEGRAM POLLING)
// =============================================================
async function launchWithRetry(botInstance, maxRetries = 5, delayMs = 4000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Telegram] Попытка запуска бота #${attempt}...`);
      await botInstance.launch();
      console.log('✅ Гризли бот успешно запущен и слушает Telegram!');
      return;
    } catch (err) {
      const isConflict = err.response?.error_code === 409 ||
                         (err.message && err.message.includes('409')) ||
                         (err.description && err.description.includes('Conflict'));

      if (isConflict && attempt < maxRetries) {
        console.warn(`⚠️ [409 Conflict] Предыдущий контейнер на Render ещё держит Telegram сессию. Ожидание ${delayMs / 1000} сек... (Попытка ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`❌ Критическая ошибка запуска бота (попытка ${attempt}/${maxRetries}):`, err);
        throw err;
      }
    }
  }
}

// =============================================================
// 3. GRACEFUL SHUTDOWN (КОРРЕКТНОЕ ЗАВЕРШЕНИЕ)
// =============================================================
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Получен сигнал ${signal}. Завершение работы сервиса...`);

  // 1. Остановка HTTP health-сервера
  if (server && server.listening) {
    server.close(() => {
      console.log('HTTP health-сервер остановлен.');
    });
  }

  // 2. Остановка Telegram бота
  try {
    bot.stop(signal);
    console.log('Telegram бот остановлен.');
  } catch (err) {
    console.error('Ошибка остановки Telegram бота:', err);
  }

  // 3. Закрытие соединения с MongoDB
  try {
    await Mongoose.connection.close(false);
    console.log('Соединение с MongoDB закрыто.');
  } catch (err) {
    console.error('Ошибка закрытия соединения с MongoDB:', err);
  }

  process.exit(0);
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// =============================================================
// 4. СТАРТ ПРИЛОЖЕНИЯ
// =============================================================
async function startApp() {
  // Запуск HTTP-сервера ДО старта бота, чтобы Render мгновенно увидел открытый порт
  server.listen(PORT, () => {
    console.log(`🚀 HTTP Health-сервер запущен на порту ${PORT}`);
  });

  try {
    console.log('Подключение к MongoDB...');
    await Mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.log('✅ Успешное подключение к MongoDB');

    await launchWithRetry(bot, 5, 4000);
  } catch (error) {
    console.error('Критическая ошибка запуска приложения:', error);
    process.exit(1);
  }
}

startApp();
