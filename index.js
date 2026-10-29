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
const { initTicTacToe } = require('./src/games/ticTacToe');
// Регистрация шрифта для Canvas 1 раз при старте
try {
  const fontPath = './CirceRounded-Regular4.ttf';
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Futura' });
  }
} catch (fontErr) {
  console.error('Предупреждение: шрифт не удалось загрузить:', fontErr.message);
}


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

});

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

// ⚡ Инициализация игры «Крестики-Нолики 3х3» (Telegram 10.3+ Rich Buttons)
initTicTacToe(bot, { User, utils });

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
    const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
    const operation = ctx.match[1].toLowerCase();
    let amount = ctx.match[2];

    if (/^вс[её]?$/.test(amount)) {
      if (operation === 'с') {
        amount = user.bankCookies;
      } else if (operation === 'п') {
        amount = user.cookies;
      }
    } else {
      amount = amount.replace(/(\.|\,|к|k|м|m)/ig, (match) => {
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
    }

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n💡 • Для снятия/пополнения введите: .аз банк с/п <сумма>`, { parse_mode: 'Markdown' });
    }

    amount = parseInt(amount);
    const reply = (message) => ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n${message}`, { parse_mode: 'Markdown' });

    if (operation === 'с') {
      if (user.bankCookies < amount) {
        return reply(`👺 • У вас недостатачно средств!\n🏦 В банке: ${utils.sp(user.bankCookies)}`);
      }
      user.bankCookies -= amount;
      user.cookies += amount;
    } else if (operation === 'п') {
      if (user.cookies < amount) {
        return reply(`👺 • У вас недостатачно средств!\n🍪 Баланс: ${utils.sp(user.cookies)}`);
      }
      user.bankCookies += amount;
      user.cookies -= amount;
    }

    await user.save();
    reply(`✅ ${operation === 'с' ? 'Вы сняли' : 'Вы пополнили'} ${utils.sp(amount)} ${operation === 'с' ? 'с банковского счета' : 'банковский счет на'}\n🏦 В банке: ${utils.sp(user.bankCookies)}\n🍪 Баланс: ${utils.sp(user.cookies)}`);
  } catch (error) {
    console.log("Ошибка:", error);
  }
});

bot.hears(/^\.аз перевод$/i, async (ctx) => {
  const user = ctx.state.user; // ⚡ Используем кэшированного пользователя
  return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🍪 • Используйте .аз перевод <участник> <сумма>`, { parse_mode: 'Markdown' });
});
bot.hears(/^\.аз перевод\s*(.+)? ([^]+|вс[её])?$/i, async (ctx) => {
  try {
    const user = ctx.state.user; // ⚡ Используем кэшированного пользователя

    if (!user) {
      return ctx.reply('Вы не зарегистрирован в боте');
    }

    const recipientUsername = ctx.message.text.match(/@\w+/)?.[0]?.slice(1);
    let cookiesToTransfer = ctx.match[2];

    cookiesToTransfer = cookiesToTransfer.replace(/(\.|\,|к|k|м|m)/ig, match => {
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

    if (/^вс[её]?$/.test(cookiesToTransfer)) {
      cookiesToTransfer = user.bankCookies;
    }

    if (!cookiesToTransfer) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🍪 • Используйте .аз перевод <участник> <сумма>`, { parse_mode: 'Markdown' });
    }

    const transferLimit = 3;
    const commissionPercentage = 0.05;
    const recipientUser = recipientUsername ? await User.findOne({ username: recipientUsername }) : await User.findOne({ telegramId: ctx.message.reply_to_message?.from.id });


    const now = new Date();
    if (!user.lastTransferTime || !(user.lastTransferTime instanceof Date) || now.getTime() - user.lastTransferTime.getTime() > 24 * 60 * 60 * 1000) {
      user.transfersToday = 0;
    }

    if (!recipientUser || !recipientUser.telegramId) {
      return ctx.reply('Пользователь, которого вы хотите перевести, не зарегистрирован в боте.');
    }

    if (user.transfersToday >= transferLimit) {
      const remainingTime = new Date(user.lastTransferTime.getTime() + 24 * 60 * 60 * 1000 - now.getTime());
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Вы достигли максимального количества переводов, ограничение будет снято через ${remainingTime.getUTCHours() > 0 ? `${remainingTime.getUTCHours()}ч. ` : ''}${remainingTime.getUTCMinutes()}м. ${remainingTime.getUTCSeconds()}с.`);
    }

    if (recipientUser.username === user.username || recipientUser.telegramId === user.telegramId) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Невозможно перевести печеньки самому себе`, { parse_mode: 'Markdown' });
    }

    if (user.bankCookies < 0 || cookiesToTransfer < 50000) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Недостаточно средств на банковском счету или минимальная сумма для перевода составляет 50.000`, { parse_mode: 'Markdown' });
    }

    const commission = Math.ceil(cookiesToTransfer * commissionPercentage);
    const transferAmount = cookiesToTransfer - commission;

    if (user.bankCookies < cookiesToTransfer) {
      return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n👺 • У вас недостаточно средств! Баланс: ${utils.sp(user.bankCookies)}`);
    }

    user.bankCookies -= cookiesToTransfer;
    recipientUser.bankCookies += transferAmount;

    user.transfersToday++;
    user.lastTransferTime = new Date();

    await user.save();
    await recipientUser.save();

    const MAX_RECIPIENT_NAME_LENGTH = 14;

    let recipientName = recipientUser.firstName;
    if (recipientName.length > MAX_RECIPIENT_NAME_LENGTH) {
      recipientName = recipientName.substring(0, MAX_RECIPIENT_NAME_LENGTH - 3) + '';
    }
    const transfersLeft = transferLimit - user.transfersToday;
    const transferMessage = `[${user.nickname}](tg://user?id=${ctx.from.id}),\n🔄 • Перевод на сумму ${utils.sp(transferAmount)} выполнен. Получатель: [${recipientName}](tg://user?id=${recipientUser.telegramId})\n💰 • Комиссия банка (${commissionPercentage * 100}%): ${utils.sp(commission)}\n🗄 • Переводов осталось: ${transfersLeft}`;

    ctx.reply(transferMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.log("Ошибка:", error);
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
  const user = await User.findOne({ telegramId: ctx.from.id });

  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }

  let [, color, bet] = ctx.match;
  const colors = {
    'ч': 'чёрное',
    'к': 'красное',
    'з': 'зелёное',
  };

  const betReplacer = {
    '.': '',
    ',': '',
    'к': '000',
    'k': '000',
    'м': '000000',
    'm': '000000',
  };

  bet = bet.replace(/[.,кKмM]/g, match => betReplacer[match] || match);

  bet = /^вс[её]?$/.test(bet) ? user.cookies : parseInt(bet);

  if (!colors[color]) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Вы ввели неверный цвет, доступные цвета: ч, к, з`, { parse_mode: 'Markdown' });
  }

  if (bet < 5) {
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • Минимальная ставка от 5 печенек.`, { parse_mode: 'Markdown' });
  }

  if (user.cookies < bet) {
    const cookiesDiff = bet - user.cookies;
    return ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n❌ • У вас не хватает ${utils.sp(cookiesDiff)} печенек!\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
  }

  const rouletteResults = ['ч', 'ч', 'ч', 'ч', 'ч', 'к', 'к', 'к', 'к', 'к', 'з'];
  const result = rouletteResults[Math.floor(Math.random() * rouletteResults.length)];
  const resultColor = colors[result];
  // Правильная логика расчета выигрыша
  if (color === result) {
    if (result === 'з') {
      user.cookies += +bet * 11; // Зеленый дает x11
    } else {
      user.cookies += +bet * 2; // Красный/черный дает x2
    }
  } else {
    user.cookies -= +bet; // Проигрыш
  }
  await user.save();

  const emoji = (result === 'ч') ? '🖤' : (result === 'к') ? '❤️' : '💚';
  const resultMessage = (betMultiplier === 2) ? '➕ • Вы получаете' : '➖ • Вы теряете';
  const betMessage = (betMultiplier === 2) ? bet * 2 : bet;

  ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n${emoji} • На рулетке выпало: ${resultColor}\n${resultMessage}: ${utils.sp(betMessage)} печенек\n🍪 • Печенек: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
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
  let user = await User.findOne({ telegramId: ctx.from.id });
  let quoteText;
  if (ctx.message.reply_to_message) {
    if (ctx.message.reply_to_message.text) {
      quoteText = ctx.message.reply_to_message.text;
    } else {
      await ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}), цитируемое сообщение не содержит текста.`, { parse_mode: 'Markdown' });
      return;
    }
  } else {
    quoteText = ctx.match[1];
  }
  if (!quoteText || typeof quoteText !== 'string' || !quoteText.trim()) {
    return ctx.reply(`[${user ? user.nickname : 'Пользователь'}](tg://user?id=${ctx.from.id}), укажите текст для цитаты или ответьте на текстовое сообщение.`, { parse_mode: 'Markdown' });
  }
  if (quoteText.length > 500) {
    await ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n✖️ Ваш текст не влезает простите, максимальное кол-во символов - 500`, { parse_mode: 'Markdown' });
    return;
  }
  if (countLines(quoteText) > 18) {
    await ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n✖️ • Простите, ваш текст не вмещается на картинку(`, { parse_mode: 'Markdown' });
    return;
  }
  quoteText = quoteText.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|\uD83D[\uDC00-\uDE4F]/g, '');
  // проверяет проверяет длину текста 
  let maxLineLength = 24; // Максимальное количество символов на строке
  let lines = [];
  let currentLine = '';
  while (quoteText.length > 0) {
    let line = quoteText.slice(0, maxLineLength);

    // Проверка наличия переноса строки
    let lineBreakIndex = line.indexOf('\n');
    if (lineBreakIndex !== -1) {
      line = line.slice(0, lineBreakIndex + 1); // Включаем символ переноса строки
      quoteText = quoteText.slice(lineBreakIndex + 1);
    } else if (quoteText.length > maxLineLength) {
      let lastSpaceIndex = line.lastIndexOf(' ');
      if (lastSpaceIndex !== -1) {
        line = line.slice(0, lastSpaceIndex);
        quoteText = quoteText.slice(lastSpaceIndex + 1);
      } else {
        quoteText = quoteText.slice(maxLineLength);
      }
    } else {
      quoteText = '';
    }
    lines.push(line);
  }
  // =====>
  // Font registered at startup
  let lineHeight = 30; // высота строки текста
  let textHeight = lineHeight * lines.length;
  let canvasHeight = Math.max(textHeight, 400); // минимальная высота canvas 400px
  const canvas = createCanvas(700, 400);
  const ctx2d = canvas.getContext('2d');
  // =====>
  const imgLink = 'https://cdn.glitch.global/8b2b500c-82ab-48a0-9e7a-54fcda63ec51/1674556857_bogatyr-club-p-fon-na-rabochii-stol-s-tsitatami-fon-4.jpg';
  const img = await loadImage(imgLink);
  ctx2d.drawImage(img, 0, 0, 700, canvasHeight);
  // =====> для получение авы телеграмма
  // Если нету фото, то добавляем стандартную аву
  const noAvatar = 'https://okeygeek.ru/wp-content/uploads/2020/03/no_avatar.png';
  const userId = ctx.message.reply_to_message?.from?.id || ctx.message.from.id;
  const userProfilePhotos = await ctx.telegram.getUserProfilePhotos(userId);

  if (userProfilePhotos.total_count > 0) {
    const avatarLink = await ctx.telegram.getFileLink(userProfilePhotos.photos[0][userProfilePhotos.photos[0].length - 1]);
    const href = avatarLink.href;
    if (href) {
      try {
        const avatar = await loadImage(href);
        const radius = 100;
        ctx2d.save();
        ctx2d.beginPath();
        ctx2d.arc(radius + canvas.width / 30, radius + canvas.height / 3.9, radius, 0, Math.PI * 2, true);
        ctx2d.closePath();
        ctx2d.clip();
        ctx2d.drawImage(avatar, canvas.width / 30, canvas.height / 3.9, 200, 200);
        ctx2d.restore();
      } catch (err) {
        console.error('Failed to load avatar image:', err.message);
      }
    }
  } else {
    console.warn('No avatar image found for user');

    // Draw the default avatar image
    const defaultAvatar = await loadImage(noAvatar);
    const radius = 100;
    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.arc(radius + canvas.width / 30, radius + canvas.height / 3.9, radius, 0, Math.PI * 2, true);
    ctx2d.closePath();
    ctx2d.clip();
    ctx2d.drawImage(defaultAvatar, canvas.width / 30, canvas.height / 3.9, 200, 200);
    ctx2d.restore();
  }
  // =====>
  const currentDate = new Date();
  const formattedDate = `${currentDate.getDate()}.${currentDate.getMonth() + 1}.${currentDate.getFullYear()}`;
  // Форматирование времени в формате Московского времени
  const options = { timeZone: 'Europe/Moscow', hour: 'numeric', minute: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat('default', options);
  const formattedTime = formatter.format(currentDate);

  ctx2d.font = '16px "Futura"';
  ctx2d.fillStyle = 'white';
  ctx2d.textAlign = 'left';
  let replyName = ctx.message.reply_to_message ? ctx.message.reply_to_message.from.first_name : user.firstName;
  ctx2d.fillText(`© ${replyName}`, canvas.width / 30, canvas.height / 1.2);
  ctx2d.font = '20px "Futura"';
  ctx2d.fillText(`@ ${formattedDate}`, canvas.width / 30, canvas.height / 1.1);
  // =====>
  ctx2d.font = '25px "Futura"';
  ctx2d.fillStyle = 'white';
  ctx2d.textAlign = 'center';
  let startY = canvasHeight / 2 - textHeight / 2 + lineHeight / 2;
  lines.forEach(line => {
    ctx2d.fillText(`${line}`, canvas.width / 1.6, startY);
    startY += lineHeight;
  });

  // =====>
  const image = canvas.toBuffer('image/png');
  const caption = `[${user.nickname}](tg://user?id=${ctx.from.id}),\nВоть`;
  await ctx.replyWithPhoto({ source: image }, { caption, parse_mode: 'Markdown' });

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
}).catch(error => console.log("Error:", error));

// ==========================================
// ИНТЕГРАЦИЯ GOOGLE GEMINI AI (.gpt / .ai)
// ==========================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Определение схемы и модели диалогов
const dialoggptSchema = new Mongoose.Schema({
  userId: { type: String, required: true, index: true },
  messages: Array,
});

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

bot.hears('.аз бонус', async (ctx) => {
  const currentTime = Date.now();
  let user = await User.findOne({ telegramId: ctx.from.id });

  if (!user) {
    // Обработка ошибки, если пользователь не найден
    ctx.reply('Вы не зарегистрирован в боте.');
    return;
  }

  // Проверка времени до следующего бонуса
  if (user.lastBonusTime.getTime() + 24 * 60 * 60 * 1000 > currentTime) {
    const timeLeft = new Date(user.lastBonusTime.getTime() + 24 * 60 * 60 * 1000 - currentTime);
    ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🎁 • Следующий бонус будет доступен через ${timeLeft.getUTCHours() > 0 ? `${timeLeft.getUTCHours()}ч.` : ''}${timeLeft.getUTCMinutes()}м.${timeLeft.getUTCSeconds()}с.`, { parse_mode: 'Markdown' });

    // Сохранение обновленной даты последнего бонуса
    await User.updateOne({ telegramId: ctx.from.id }, { lastBonusTime: user.lastBonusTime });
    return;
  }
  // Выдача бонуса
  user.cookies += 50000;
  user.lastBonusTime = currentTime;
  await user.save();
  ctx.reply(`[${user.nickname}](tg://user?id=${ctx.from.id}),\n🎁 • Вы получили бонус в размере 50.000\n🍪 • Баланс: ${utils.sp(user.cookies)}`, { parse_mode: 'Markdown' });
}).catch(error => console.log("Ошибка:", error));

bot.hears('.аз топ', async (ctx) => {
  let user = await User.findOne({ telegramId: ctx.from.id });
  if (!user) {
    return ctx.reply('Вы не зарегистрирован в боте');
  }
  try {
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
    console.error(err);
    ctx.reply('Произошла ошибка при получении топа игроков');
  }
}).catch(error => console.log("Ошибка:", error));


//рп команды

bot.on('text', async (ctx, next) => {
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
}).catch(error => console.log(error));

//создание рп команды

// Создание схемы для хранения команд
const RpCommandSchema = new Mongoose.Schema({
  creatorId: { type: Number, required: true },
  name: { type: String, required: true },
  response: { type: String, required: true },
  response2: { type: String },
  emoji: { type: String }
});

// Модель команды
const RpCommand = Mongoose.model('RpCommand', RpCommandSchema);


// Обработчик текстовых сообщений
bot.on('text', async (ctx, next) => {
  const { text } = ctx.message;
  const reply = ctx.message.reply_to_message;
  const user = await User.findOne({ telegramId: ctx.from.id });

  // Получение списка команд из базы данных
  const commands = await RpCommand.find({});


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

    ctx.reply(`✅ Новая рп-комманда добавлена`);
  } else if (command === '.мрп') {
    // Показ списка созданных рп-команд
    const userCommands = commands.filter(cmd => cmd.creatorId === ctx.from.id);
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

    ctx.reply(`✅ Рп команда успешно удалена.`);

  } else {

    // Обработка других текстовых сообщений
    const cmd = commands.find(cmd => command.startsWith(cmd.name.toLowerCase()) && cmd.creatorId === user.telegramId);
    if (!cmd) return next();

    const { name, response, response2, emoji } = cmd;
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

          let nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) + '' : user.nickname;
          let nickname2 = mentionedUser.nickname.length > 14 ? mentionedUser.nickname.substring(0, 14) + '' : mentionedUser.nickname;
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

      // Проверка, является ли отправитель команды создателем команды
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        ctx.reply(`Вы не зарегистрированы в боте`);
        return;
      }

      const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
      if (!user2) {
        ctx.reply(`${ctx.message.reply_to_message.from.first_name} не зарегистрирован в боте`);
        return;
      }

      let nickname = user.nickname.length > 14 ? user.nickname.substring(0, 14) + '' : user.nickname;
      let nickname2 = user2.nickname.length > 14 ? user2.nickname.substring(0, 14) + '' : user2.nickname;

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
      //ctx.reply(`Чтобы использовать эту команду, пожалуйста, ответьте на сообщение пользователя или укажите @username, на которого вы хотите использовать ${name}`);
      return;
    }
  }
}).catch(error => console.log(error));


// Команда резервного копирования удалена в целях безопасности
//команды мут/бан
bot.hears(/\.ban (\d+) (час|минут|минуты|минута)$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
  const time = parseInt(ctx.match[1]);
  const unit = ctx.match[2];
  const chatId = ctx.message.chat.id;
  const userId = ctx.message.reply_to_message.from.id;
  const until = new Date();
  const chatLink = `https://t.me/${ctx.chat.username}`;

  const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
  if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
    ctx.reply('Вы не являетесь модератором чата.');
    return;
  }

  const targetMember = await bot.telegram.getChatMember(chatId, userId);
  if (['administrator', 'creator'].includes(targetMember.status)) {
    ctx.reply('Вы не можете заблокировать другого модератора.');
    return;
  }


  if (unit === 'час') {
    until.setHours(until.getHours() + time);
  } else if (unit === 'минута' || unit === 'минуты' || unit === 'минут') {
    until.setMinutes(until.getMinutes() + time);
  }

  bot.telegram.kickChatMember(chatId, userId, {
    until_date: until.getTime() / 1000
  });

  setTimeout(() => {
    bot.telegram.unbanChatMember(chatId, userId);
    bot.telegram.sendMessage(userId, 'Ваш бан в чате закончился. Вы можете вернуться в чат <a href="' + chatLink + '">' + ctx.chat.title + '</a>.', { parse_mode: 'HTML' }, { parse_mode: 'Markdown' });
  }, until.getTime() - Date.now());

  bot.telegram.sendMessage(userId, `[${user2.nickname}](tg://user?id=${ctx.message.reply_to_message.from.id}) вас заблокировали на ${time} ${unit}.`, { parse_mode: 'Markdown' });
  ctx.reply(`Пользователь [${user2.nickname}](tg://user?id=${ctx.message.reply_to_message.from.id}) заблокирован на ${time} ${unit}.`, { parse_mode: 'Markdown' });
}).catch(error => console.log(error));

bot.hears(/\.unban$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
  const chatId = ctx.message.chat.id;
  const userId = ctx.message.reply_to_message.from.id;
  const chatName = ctx.message.chat.title;

  const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
  if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
    ctx.reply('Вы не являетесь модератором чата.');
    return;
  }

  const targetMember = await bot.telegram.getChatMember(chatId, userId);
  if (['administrator', 'creator'].includes(targetMember.status)) {
    ctx.reply('Вы не можете заблокировать другого модератора.');
    return;
  }

  const isBanned = targetMember.status === 'kicked';
  if (!isBanned) {
    ctx.reply('Пользователь не в бане.');
    return;
  }

  bot.telegram.unbanChatMember(chatId, userId);
  const chatLink = `https://t.me/${ctx.chat.username}`;
  ctx.reply(`Пользователю [${user2.nickname}](tg://user?id=${ctx.message.reply_to_message.from.id}) разблокирую в этом чате.`, { parse_mode: 'Markdown' });

  // Отправляем сообщение пользователю в ЛС
  bot.telegram.sendMessage(userId, 'Ваш бан в чате закончился. Вы можете вернуться в чат <a href="' + chatLink + '">' + ctx.chat.title + '</a>.', { parse_mode: 'HTML' }, { parse_mode: 'Markdown' });

}).catch(error => console.log(error));

bot.hears(/\.mute (\d+) (час|минут|минуты|минута|день|дня|дней)$/i, async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
  const time = parseInt(ctx.match[1]);
  const unit = ctx.match[2];
  const chatId = ctx.message.chat.id;
  const userId = ctx.message.reply_to_message.from.id;
  const until = new Date();

  const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
  if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
    ctx.reply('Вы не являетесь модератором чата.');
    return;
  }

  const targetMember = await bot.telegram.getChatMember(chatId, userId);
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

  bot.telegram.restrictChatMember(chatId, userId, {
    until_date: until.getTime() / 1000,
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false
  });

  ctx.reply(`Пользователь [${user2.nickname}](tg://user?id=${ctx.message.reply_to_message.from.id}) замучен на ${time} ${unit}.`, { parse_mode: 'Markdown' });
}).catch(error => console.log(error));

bot.hears('.unmute', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  const user2 = await User.findOne({ telegramId: ctx.message.reply_to_message.from.id });
  const chatId = ctx.message.chat.id;
  const userId = ctx.message.reply_to_message.from.id;

  const chatMember = await bot.telegram.getChatMember(chatId, ctx.from.id);
  if (!chatMember || !['administrator', 'creator'].includes(chatMember.status)) {
    ctx.reply('Вы не являетесь модератором чата.');
    return;
  }

  const targetMember = await bot.telegram.getChatMember(chatId, userId);
  if (['administrator', 'creator'].includes(targetMember.status)) {
    ctx.reply('Вы не можете замутить другого модератора.');
    return;
  }


  bot.telegram.restrictChatMember(chatId, userId, {
    until_date: 0,
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true
  });


  ctx.reply(`Пользователь [${user2.nickname}](tg://user?id=${ctx.message.reply_to_message.from.id}) размучен.`, { parse_mode: 'Markdown' });

}).catch(error => console.log(error));
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
}).catch(error => console.log(error));

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
  if (ctx.message.chat.type === 'private') {
    // Проверяем, что полученное сообщение является голосовым сообщением
    if (ctx.message.voice) {
      const voiceMessage = ctx.message.voice;

      // Получаем информацию о голосовом сообщении
      const fileLink = await ctx.telegram.getFileLink(voiceMessage.file_id);

      // Скачиваем голосовое сообщение на сервер
      const voiceFile = 'voice.ogg';
      const response = await axios({
        url: fileLink,
        method: 'GET',
        responseType: 'stream',
      });
      response.data.pipe(fs.createWriteStream(voiceFile));

      // Конвертируем голосовое сообщение в mp3
      const mp3File = 'converted.mp3';
      ffmpeg(voiceFile)
        .toFormat('mp3')
        .save(mp3File)
        .on('end', () => {
          // Отправляем конвертированную музыку пользователю
          ctx.replyWithAudio({ source: fs.createReadStream(mp3File) }, { caption: 'audio by grizzly' })
            .then(() => {
              // Удаляем временные файлы
              fs.unlink(voiceFile, (err) => {
                if (err) {
                  console.error(`Ошибка при удалении временного файла: ${err}`);
                }
              });
              fs.unlink(mp3File, (err) => {
                if (err) {
                  console.error(`Ошибка при удалении временного файла: ${err}`);
                }
              });
            })
            .catch((err) => {
              console.error(`Ошибка при отправке музыки: ${err}`);
            });
        })
        .on('error', (error) => {
          console.error(`Ошибка при конвертации голосового сообщения: ${error}`);
        });
    } else if (ctx.message.audio) {
      const audioMessage = ctx.message.audio;

      // Получаем информацию об аудиофайле
      const fileLink = await ctx.telegram.getFileLink(audioMessage.file_id);

      // Скачиваем аудиофайл на сервер
      const audioFile = 'audio.WAV';
      const response = await axios({
        url: fileLink,
        method: 'GET',
        responseType: 'stream',
      });
      response.data.pipe(fs.createWriteStream(audioFile));

      // Конвертируем аудиофайл в ogg
      const oggFile = 'converted.ogg';
      ffmpeg(audioFile)
        .toFormat('ogg')
        .save(oggFile)
        .on('end', () => {
          // Отправляем конвертированное голосовое сообщение пользователю
          ctx.replyWithVoice({ source: fs.createReadStream(oggFile) }, { caption: 'voice by grizzly' })
            .then(() => {
              // Удаляем временные файлы
              fs.unlink(audioFile, (err) => {
                if (err) {
                  console.error(`Ошибка при удалении временного файла: ${err}`);
                  ctx.reply(`Ошибка при удалении временного файла: ${err}`);
                }
              });
              fs.unlink(oggFile, (err) => {
                if (err) {
                  console.error(`Ошибка при удалении временного файла: ${err}`);
                  ctx.reply(`Ошибка при удалении временного файла: ${err}`);
                }
              });
            })
            .catch((err) => {
              console.error(`Ошибка при отправке голосового сообщения: ${err}`);
              ctx.reply(`Ошибка при отправке голосового сообщения: ${err}`);
            });
        })
        .on('error', (error) => {
          console.error(`Ошибка при конвертации аудиофайла: ${error}`);
          ctx.reply(`Ошибка при конвертации аудиофайла: ${error}`);
        });
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
  const text = ctx.message.text.trim();
  const command = Object.values(commands).find((cmd) => text.startsWith(cmd.name));
  if (!command) return next(); // Если команда не найдена, передаём управление дальше

  const userId = ctx.from.id.toString();
  const user = await User.findOne({ telegramId: userId });
  if (!user) return ctx.reply("❌ Ваш профиль не найден.");

  // Находим брак
  const marriage = await Marriage.findOne({
    $or: [{ userId: userId }, { partnerId: userId }]
  });

  if (!marriage) {
    return ctx.reply('❌ Вы не состоите в отношениях.');
  }

  // Получаем ссылки на никнеймы с кликабельными ссылками
  const userNickname = await getNicknameByTelegramId(marriage.userId);
  const partnerNickname = await getNicknameByTelegramId(marriage.partnerId);

  let responseMessage;

  // Условие для определения, чей ник показывать
  if (marriage.userId === userId) {
    responseMessage = `${userNickname} ${command.response} ${partnerNickname}`;
  } else {
    responseMessage = `${partnerNickname} ${command.response} ${userNickname}`;
  }

  // Если у команды есть API для изображений, добавляем картинку
  if (command.apiEndpoint) {
    const imageUrl = await getAnimeImage(command.apiEndpoint);
    await ctx.replyWithHTML(`${responseMessage}<a href="${imageUrl}">.</a>`);
  } else {
    await ctx.replyWithHTML(responseMessage);
  }

  next(); // Передаём управление следующему обработчику
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
  // Рейтинг и уровень
  relationshipScore: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
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

const Marriage = Mongoose.model('Marriage', marriageSchema);

// Функция для получения nickname по telegramId с кликабельной ссылкой
async function getNicknameByTelegramId(telegramId) {
  const user = await User.findOne({ telegramId });
  if (user && user.nickname) {
    return `<a href="tg://user?id=${telegramId}">${user.nickname}</a>`;
  } else {
    return `<a href="tg://user?id=${telegramId}">User${telegramId}</a>`;
  }
}

// === 📌 Запрос на отношения (.отн запрос) ===
bot.hears(/^\.отн запрос$/, async (ctx) => {
  try {
    if (!ctx.message.reply_to_message) {
      return ctx.reply('❌ Используйте .отн запрос в ответ на сообщение пользователя.');
    }

    const senderId = ctx.from.id;
    const targetId = ctx.message.reply_to_message.from.id;

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
      const existingRequesterId = pendingRequests.get(targetId);
      const existingRequesterNickname = await getNicknameByTelegramId(existingRequesterId);
      return ctx.reply(`❌ У ${existingRequesterNickname} уже есть активный запрос к этому пользователю.`);
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
      const partnerId = senderMarriage.userId === senderId ? senderMarriage.partnerId : senderMarriage.userId;
      const partner = await User.findOne({ telegramId: partnerId });
      const partnerNickname = partner?.nickname || `User${partnerId}`;
      return ctx.reply(`❌ Вы уже состоите в браке с ${partnerNickname}.`, { parse_mode: 'HTML' });
    }

    // Если получатель уже состоит в браке
    if (targetMarriage) {
      const partnerId = targetMarriage.userId === targetId ? targetMarriage.partnerId : targetMarriage.userId;
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

    // Добавление запроса в список ожидающих
    pendingRequests.set(targetId, senderId);

    // ⚡ ОПТИМИЗАЦИЯ: Параллельная загрузка пользователей для никнеймов
    const [senderUser, targetUser] = await Promise.all([
      User.findOne({ telegramId: senderId }),
      User.findOne({ telegramId: targetId })
    ]);
    
    const senderNickname = senderUser?.nickname || `User${senderId}`;
    const targetNickname = targetUser?.nickname || `User${targetId}`;

    const message = await ctx.reply(
      `💖 • ${targetNickname}, внимание! ${senderNickname} предлагает вступить в отношения.\n⚡ Запрос будет действителен <b>2 минуты</b>.\n\n💡 После принятия вы сможете:\n• Дарить подарки друг другу\n• Получать бонусы за совместную активность\n• Участвовать в совместных играх`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('✅ Принять', `accept_${targetId}_${senderId}`),
          Markup.button.callback('❌ Отклонить', `decline_${targetId}_${senderId}`)
        ]])
      }
    );

    // Таймер для аннулирования запроса после 2 минут
    setTimeout(async () => {
      if (pendingRequests.has(targetId)) {
        pendingRequests.delete(targetId);
        // Удаляем запрос из базы данных
        await Marriage.deleteOne({ _id: marriageRequest._id });
        ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, '⏳ Время вышло! Запрос аннулирован.');
      }
    }, 120000); // 2 минуты

  } catch (error) {
    console.error('Ошибка в команде запроса на отношения:', error);
    ctx.reply('❌ Произошла ошибка при отправке запроса.');
  }
});




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

    // Удаляем из pending requests
    pendingRequests.delete(targetId);

    // Обновляем статус брака
    marriageRequest.status = 'accepted';
    marriageRequest.acceptedAt = new Date();
    marriageRequest.lastActivity = new Date();
    await marriageRequest.save();

    // Получаем пользователей из базы
    const sender = await User.findOne({ telegramId: senderId });
    const target = await User.findOne({ telegramId: targetId });

    if (!sender || !target) {
      return ctx.editMessageText('❌ Один из пользователей не найден.');
    }

    // Устанавливаем партнеров в базе данных
    sender.partner = targetId;
    target.partner = senderId;
    await sender.save();
    await target.save();

    const senderNickname = await getNicknameByTelegramId(senderId);
    const targetNickname = await getNicknameByTelegramId(targetId);

    // Уведомляем о принятии запроса
    ctx.editMessageText(
      `💖 ${targetNickname} принял(а) предложение ${senderNickname}!\n\n🎉 Поздравляем с началом отношений!\n\n💡 Теперь вы можете:\n• Дарить подарки: .отн подарок &lt;сумма&gt;\n• Смотреть статистику: .отн статистика\n• Получать бонусы за совместную активность!`, 
      { parse_mode: 'HTML' }
    );

    // Уведомляем отправителя запроса
    ctx.telegram.sendMessage(
      senderId, 
      `💖 Ваше предложение принято! Теперь вы в отношениях с ${targetNickname}.\n\n💡 Используйте .отн помощь для просмотра доступных команд.`, 
      { parse_mode: 'HTML' }
    ).catch(() => {});

    // Даем бонус за вступление в отношения
    sender.cookies += 100;
    target.cookies += 100;
    await sender.save();
    await target.save();

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

    pendingRequests.delete(targetId);
    
    const targetNickname = await getNicknameByTelegramId(targetId);
    const senderNickname = await getNicknameByTelegramId(senderId);
    
    ctx.editMessageText(`❌ ${targetNickname} отклонил(а) запрос от ${senderNickname}.`, { parse_mode: 'HTML' });
    
    // Уведомляем отправителя об отклонении
    ctx.telegram.sendMessage(
      senderId, 
      `💔 Ваше предложение было отклонено ${targetNickname}.`, 
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Ошибка при отклонении запроса:', error);
    ctx.editMessageText('❌ Произошла ошибка при обработке запроса.');
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

    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;

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

// === 📌 Профиль отношений (.отн профиль) ===
bot.hears(/^\.отн профиль$/, async (ctx) => {
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

    // Обновляем рейтинг и уровень
    marriage.relationshipScore = calculateRelationshipScore(marriage);
    marriage.level = calculateRelationshipLevel(marriage.relationshipScore);
    
    // Проверяем достижения
    await checkAndAddAchievements(marriage);
    await marriage.save();

    // Получаем ссылки на никнеймы с кликабельными ссылками
    const userNickname = await getNicknameByTelegramId(marriage.userId);
    const partnerNickname = await getNicknameByTelegramId(marriage.partnerId);

    // Вычисляем длительность отношений
    const relationshipDuration = Math.floor((Date.now() - marriage.acceptedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Информация о свадьбе
    const weddingInfo = marriage.weddingDate 
      ? `\n💍 <b>Свадьба:</b> ${marriage.weddingDate.toLocaleDateString('ru-RU')}\n🎁 <b>Подарков на свадьбе:</b> ${marriage.weddingGiftsTotal} печенек`
      : '\n💍 <b>Свадьба:</b> Еще не проведена (используйте .отн свадьба)';

    // Условие для вывода информации о пользователе в зависимости от того, кто пишет команду
    if (userId != marriage.partnerId) {
      return ctx.reply(`
💖 <b>Ваш профиль отношений</b>

👤 <b>Ваш ник:</b> ${userNickname}
👫 <b>Партнёр:</b> ${partnerNickname}
📅 <b>Дата начала:</b> ${marriage.acceptedAt.toLocaleDateString('ru-RU')}
⏰ <b>Длительность:</b> ${relationshipDuration} дней${weddingInfo}

📊 <b>Рейтинг:</b> ${marriage.relationshipScore}
⭐ <b>Уровень отношений:</b> ${marriage.level}/10

🏦 <b>Совместный банк:</b> ${marriage.jointBank} печенек

🎁 <b>Подарки:</b>
• Отправлено: ${marriage.giftsSent}
• Получено: ${marriage.giftsReceived}
• Общая стоимость: ${marriage.totalGiftValue} печенек

🏆 <b>Достижения (${marriage.achievements.length}):</b>
${marriage.achievements.length > 0 ? marriage.achievements.map(ach => `• ${ach}`).join('\n') : '• Пока нет достижений'}

💡 <i>Используйте .отн помощь для просмотра всех команд</i>
      `, { parse_mode: 'HTML' });
    } else {
      return ctx.reply(`
💖 <b>Ваш профиль отношений</b>

👤 <b>Ваш ник:</b> ${partnerNickname}
👫 <b>Партнёр:</b> ${userNickname}
📅 <b>Дата начала:</b> ${marriage.acceptedAt.toLocaleDateString('ru-RU')}
⏰ <b>Длительность:</b> ${relationshipDuration} дней${weddingInfo}

📊 <b>Рейтинг:</b> ${marriage.relationshipScore}
⭐ <b>Уровень отношений:</b> ${marriage.level}/10

🏦 <b>Совместный банк:</b> ${marriage.jointBank} печенек

🎁 <b>Подарки:</b>
• Отправлено: ${marriage.giftsReceived}
• Получено: ${marriage.giftsSent}
• Общая стоимость: ${marriage.totalGiftValue} печенек

🏆 <b>Достижения (${marriage.achievements.length}):</b>
${marriage.achievements.length > 0 ? marriage.achievements.map(ach => `• ${ach}`).join('\n') : '• Пока нет достижений'}

💡 <i>Используйте .отн помощь для просмотра всех команд</i>
      `, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('Ошибка при получении профиля отношений:', error);
    ctx.reply('❌ Произошла ошибка при получении профиля отношений.');
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
      const relationshipDuration = Math.floor((Date.now() - marriage.acceptedAt.getTime()) / (1000 * 60 * 60 * 24));
      
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
    
    if (user.cookies < giftAmount) {
      return ctx.reply(`❌ У вас недостаточно печенек. Нужно: ${giftAmount}, есть: ${user.cookies}`);
    }
    
    // Находим активный брак
    const marriage = await Marriage.findOne({
      $or: [{ userId: userId }, { partnerId: userId }],
      status: 'accepted'
    });
    
    if (!marriage) {
      return ctx.reply('❌ Вы не состоите в отношениях.');
    }
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
    
    // ⚡ ОПТИМИЗАЦИЯ: Загружаем партнера одним запросом
    const partner = await User.findOne({ telegramId: partnerId });
    
    if (!partner) {
      return ctx.reply('❌ Партнер не найден.');
    }
    
    // Переводим подарок
    user.cookies -= giftAmount;
    partner.cookies += giftAmount;
    
    // Обновляем статистику брака
    if (marriage.userId === userId) {
      marriage.giftsSent += 1;
      marriage.giftsReceived += 1;
    } else {
      marriage.giftsReceived += 1;
      marriage.giftsSent += 1;
    }
    marriage.totalGiftValue += giftAmount;
    marriage.lastActivity = new Date();
    
    // ⚡ ОПТИМИЗАЦИЯ: Сохраняем все параллельно
    await Promise.all([
      user.save(),
      partner.save(),
      marriage.save()
    ]);
    
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
    const userNickname = await getNicknameByTelegramId(userId);
    const partnerNickname = await getNicknameByTelegramId(partnerId);
    
    // Вычисляем длительность отношений
    const relationshipDuration = Math.floor((Date.now() - marriage.acceptedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    const statsText = `
💖 <b>Статистика отношений</b>

👫 <b>Пара:</b> ${userNickname} ❤️ ${partnerNickname}

📅 <b>Дата начала:</b> ${marriage.acceptedAt.toLocaleDateString('ru-RU')}
⏰ <b>Длительность:</b> ${relationshipDuration} дней

🎁 <b>Подарки:</b>
• Отправлено: ${marriage.giftsSent}
• Получено: ${marriage.giftsReceived}
• Общая стоимость: ${marriage.totalGiftValue} печенек

🏆 <b>Достижения:</b>
${marriage.achievements.length > 0 ? marriage.achievements.map(ach => `• ${ach}`).join('\n') : '• Пока нет достижений'}

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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
  const daysTogether = Math.floor((Date.now() - marriage.acceptedAt.getTime()) / (1000 * 60 * 60 * 24));
  const giftScore = marriage.totalGiftValue / 100;
  const achievementScore = marriage.achievements.length * 500;
  const bankScore = marriage.jointBank / 10;
  
  return Math.floor(daysTogether * 10 + giftScore + achievementScore + bankScore);
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
  const daysTogether = Math.floor((Date.now() - marriage.acceptedAt.getTime()) / (1000 * 60 * 60 * 24));
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    if (guestId === marriage.userId || guestId === marriage.partnerId) {
      return ctx.answerCbQuery('❌ Вы не можете дарить подарки сами себе!', { show_alert: true });
    }
    
    // Проверяем, не дарил ли уже этот гость
    if (marriage.weddingGuests.includes(guestId)) {
      return ctx.answerCbQuery('❌ Вы уже подарили подарок молодоженам!', { show_alert: true });
    }
    
    const guest = await User.findOne({ telegramId: guestId });
    if (!guest) {
      return ctx.answerCbQuery('❌ Пользователь не найден.', { show_alert: true });
    }
    
    if (guest.cookies < giftAmount) {
      return ctx.answerCbQuery(`❌ У вас недостаточно печенек. Нужно: ${giftAmount}`, { show_alert: true });
    }
    
    // Переводим подарок
    guest.cookies -= giftAmount;
    await guest.save();
    
    // Добавляем подарок в общий банк пары
    marriage.jointBank += giftAmount;
    marriage.weddingGiftsTotal += giftAmount;
    marriage.weddingGuests.push(guestId);
    await marriage.save();
    
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return ctx.reply('❌ Пользователь не найден.');
    }
    
    if (user.cookies < amount) {
      return ctx.reply(`❌ У вас недостаточно печенек. Нужно: ${amount}, есть: ${user.cookies}`);
    }
    
    // Переводим средства
    user.cookies -= amount;
    marriage.jointBank += amount;
    
    // Записываем операцию в историю
    marriage.jointBankHistory.push({
      userId: userId,
      action: 'deposit',
      amount: amount,
      date: new Date()
    });
    
    marriage.lastActivity = new Date();
    
    await user.save();
    await marriage.save();
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
    const userNickname = await getNicknameByTelegramId(userId);
    
    ctx.reply(
      `✅ Вы внесли ${amount} печенек в совместный банк!\n\n💰 Баланс банка: ${marriage.jointBank} печенек`,
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    const requesterId = parseInt(ctx.match[2]);
    const amount = parseInt(ctx.match[3]);
    const confirmerId = ctx.from.id;
    
    const marriage = await Marriage.findById(marriageId);
    if (!marriage || marriage.status !== 'accepted') {
      return ctx.answerCbQuery('❌ Брак не найден.', { show_alert: true });
    }
    
    // Проверяем, что подтверждает именно партнер
    const partnerId = marriage.userId === requesterId ? marriage.partnerId : marriage.userId;
    if (confirmerId !== partnerId) {
      return ctx.answerCbQuery('❌ Это не ваш запрос.', { show_alert: true });
    }
    
    if (marriage.jointBank < amount) {
      return ctx.answerCbQuery('❌ Недостаточно средств в банке.', { show_alert: true });
    }
    
    const requester = await User.findOne({ telegramId: requesterId });
    if (!requester) {
      return ctx.answerCbQuery('❌ Пользователь не найден.', { show_alert: true });
    }
    
    // Переводим средства
    marriage.jointBank -= amount;
    requester.cookies += amount;
    
    // Записываем операцию в историю
    marriage.jointBankHistory.push({
      userId: requesterId,
      action: 'withdraw',
      amount: amount,
      date: new Date()
    });
    
    marriage.lastActivity = new Date();
    
    await requester.save();
    await marriage.save();
    
    const requesterNickname = await getNicknameByTelegramId(requesterId);
    
    ctx.answerCbQuery('✅ Снятие средств подтверждено!', { show_alert: true });
    ctx.editMessageText(
      `✅ Вы подтвердили снятие ${amount} печенек.\n\n🏦 Баланс банка: ${marriage.jointBank} печенек`,
      { parse_mode: 'HTML' }
    );
    
    // Уведомляем того, кто запросил
    ctx.telegram.sendMessage(
      requesterId,
      `✅ ${requesterNickname} одобрил(а) снятие средств!\n\n💰 Вы получили ${amount} печенек\n🏦 Баланс банка: ${marriage.jointBank} печенек`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
  } catch (error) {
    console.error('Ошибка при подтверждении снятия:', error);
    ctx.answerCbQuery('❌ Произошла ошибка.', { show_alert: true });
  }
});

// === 📌 Обработчик отклонения снятия средств ===
bot.action(/^bank_withdraw_reject_(.+)_(\d+)_(\d+)$/, async (ctx) => {
  try {
    const marriageId = ctx.match[1];
    const requesterId = parseInt(ctx.match[2]);
    const amount = parseInt(ctx.match[3]);
    const confirmerId = ctx.from.id;
    
    const marriage = await Marriage.findById(marriageId);
    if (!marriage || marriage.status !== 'accepted') {
      return ctx.answerCbQuery('❌ Брак не найден.', { show_alert: true });
    }
    
    // Проверяем, что отклоняет именно партнер
    const partnerId = marriage.userId === requesterId ? marriage.partnerId : marriage.userId;
    if (confirmerId !== partnerId) {
      return ctx.answerCbQuery('❌ Это не ваш запрос.', { show_alert: true });
    }
    
    const confirmerNickname = await getNicknameByTelegramId(confirmerId);
    
    ctx.answerCbQuery('❌ Запрос отклонен.', { show_alert: true });
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
    ctx.answerCbQuery('❌ Произошла ошибка.', { show_alert: true });
  }
});

// === 📌 Топ пар (.отн топ) ===
bot.hears(/^\.отн топ$/, async (ctx) => {
  try {
    const marriages = await Marriage.find({ status: 'accepted' });
    
    if (marriages.length === 0) {
      return ctx.reply('💔 Пока нет активных браков.');
    }
    
    // Обновляем рейтинги всех пар
    for (const marriage of marriages) {
      marriage.relationshipScore = calculateRelationshipScore(marriage);
      marriage.level = calculateRelationshipLevel(marriage.relationshipScore);
      await marriage.save();
    }
    
    // Сортируем по рейтингу
    marriages.sort((a, b) => b.relationshipScore - a.relationshipScore);
    
    let topText = '🏆 <b>ТОП-10 ПАР</b> 🏆\n\n';
    
    const topMarriages = marriages.slice(0, 10);
    for (let i = 0; i < topMarriages.length; i++) {
      const marriage = topMarriages[i];
      const user1 = await getNicknameByTelegramId(marriage.userId);
      const user2 = await getNicknameByTelegramId(marriage.partnerId);
      const daysTogether = Math.floor((Date.now() - marriage.acceptedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      
      topText += `${medal} ${user1} ❤️ ${user2}\n`;
      topText += `   📊 Рейтинг: ${marriage.relationshipScore} | ⭐ Уровень: ${marriage.level}\n`;
      topText += `   📅 Дней вместе: ${daysTogether}\n`;
      topText += `   🏦 Совместный банк: ${marriage.jointBank} 🍪\n\n`;
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
    
    const startDate = marriage.acceptedAt;
    const now = new Date();
    const daysTogether = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    
    // Вычисляем следующую годовщину
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + Math.ceil((now - startDate) / (1000 * 60 * 60 * 24 * 30)));
    
    const daysToNextAnniversary = Math.ceil((nextMonth - now) / (1000 * 60 * 60 * 24));
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
    
    const partnerId = marriage.userId === userId ? marriage.partnerId : marriage.userId;
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
