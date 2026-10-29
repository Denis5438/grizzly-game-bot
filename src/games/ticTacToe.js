'use strict';

const { Markup } = require('telegraf');

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

const NUM_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

const CHALLENGE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const TURN_TIMEOUT_MS = 90 * 1000;          // 90 seconds

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class TicTacToeGame {
  constructor(id, playerX, playerO, chatId, messageId = null) {
    this.id = id;
    this.playerX = playerX; // { id, name, username }
    this.playerO = playerO; // { id, name, username }
    this.chatId = chatId;
    this.messageId = messageId;

    // board: 9 cells (indices 0..8), each 'X', 'O', or null
    this.board = Array(9).fill(null);

    // currentTurn: 'X' or 'O'
    this.currentTurn = 'X';

    // winner: null, 'X', 'O', 'D' (draw)
    this.winner = null;
    this.winningLine = null; // e.g. [0, 1, 2]

    // surrender / timeout tracking
    this.surrenderedBy = null;
    this.timedOutBy = null;

    // stats & timers
    this.movesCount = 0;
    this.startedAt = Date.now();
    this.lastMoveAt = Date.now();
    this.turnTimer = null;
  }

  // Alias getter for backward compatibility
  get cells() {
    return this.board;
  }

  static checkWinner(board) {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every(cell => cell !== null)) {
      return 'D';
    }
    return null;
  }

  // Backward compatibility alias for global/sector winner checking
  static checkSectorWinner(board) {
    return TicTacToeGame.checkWinner(board);
  }

  static checkGlobalWinner(board) {
    return TicTacToeGame.checkWinner(board);
  }

  static getWinningLine(board) {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return [a, b, c];
      }
    }
    return null;
  }

  isValidMove(cellIdx, playerSymbol) {
    if (this.winner) {
      return { valid: false, reason: 'Игра уже завершена.' };
    }
    if (this.currentTurn !== playerSymbol) {
      return { valid: false, reason: 'Сейчас не ваш ход.' };
    }
    if (cellIdx < 0 || cellIdx > 8 || isNaN(cellIdx)) {
      return { valid: false, reason: 'Некорректная клетка.' };
    }
    if (this.board[cellIdx] !== null) {
      return { valid: false, reason: 'Эта клетка уже занята!' };
    }
    return { valid: true };
  }

  makeMove(cellIdx, playerSymbol) {
    const check = this.isValidMove(cellIdx, playerSymbol);
    if (!check.valid) return check;

    this.board[cellIdx] = playerSymbol;
    this.lastMoveAt = Date.now();
    this.movesCount++;

    const winner = TicTacToeGame.checkWinner(this.board);
    if (winner) {
      this.winner = winner;
      this.winningLine = TicTacToeGame.getWinningLine(this.board);
      return { valid: true, gameOver: true, winner: this.winner, line: this.winningLine };
    }

    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
    return { valid: true, gameOver: false, nextTurn: this.currentTurn };
  }
}

// Memory stores
const challenges = new Map();           // challengeId -> challenge
const activeGames = new Map();          // gameId -> game
const finishedGames = new Map();        // gameId -> game (bounded history)
const userActiveGame = new Map();       // userId -> gameId
const userPendingChallenge = new Map();  // userId -> challengeId
const messageToGame = new Map();        // messageId -> gameId (bounded message mapping)

const MAX_FINISHED_GAMES = 500;
const MAX_MESSAGE_MAP = 1000;

function rememberFinishedGame(game) {
  if (!game || !game.id) return;
  finishedGames.set(game.id, game);
  if (finishedGames.size > MAX_FINISHED_GAMES) {
    const oldestKey = finishedGames.keys().next().value;
    finishedGames.delete(oldestKey);
  }
}

function rememberMessageGame(messageId, gameId) {
  if (!messageId || !gameId) return;
  messageToGame.set(messageId, gameId);
  if (messageToGame.size > MAX_MESSAGE_MAP) {
    const oldestKey = messageToGame.keys().next().value;
    messageToGame.delete(oldestKey);
  }
}

/**
 * Render Rich Message Buttons (Telegram Bot API 10.3+)
 * Formats custom HTML tags <tg-button-row> and <tg-button>
 */
function renderRichButtons(game) {
  let rows = '';

  for (let r = 0; r < 3; r++) {
    rows += '<tg-button-row align="center">\n';
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = game.board[idx];
      let style = 'primary';
      let text = NUM_EMOJIS[idx];

      if (cell === 'X') {
        style = 'danger';
        text = '❌';
      } else if (cell === 'O') {
        style = 'success';
        text = '⭕';
      }

      rows += `  <tg-button type="callback_data" style="${style}" data="ttt_m_${idx}">${text}</tg-button>\n`;
    }
    rows += '</tg-button-row>\n';
  }

  // Surrender button only shown while game is active
  if (!game.winner) {
    rows += '<tg-button-row align="center">\n';
    rows += `  <tg-button type="callback_data" style="danger" data="ttt_sur">🏳️ Сдаться</tg-button>\n`;
    rows += '</tg-button-row>';
  }

  return rows.trim();
}

/**
 * Render complete game message HTML including status header and rich button tags
 */
function renderGameMessage(game) {
  let header = '🎮 <b>Крестики-Нолики 3×3</b>\n\n';

  if (!game.winner) {
    const activePlayer = game.currentTurn === 'X' ? game.playerX : game.playerO;
    header += `🎯 <b>Ход:</b> ${escapeHtml(activePlayer.name)} (${game.currentTurn === 'X' ? '❌' : '⭕'})\n`;
    header += `⏱️ <i>Время на ход: 90 сек</i>\n\n`;
  } else if (game.surrenderedBy) {
    const surrenderingPlayer = game.surrenderedBy === 'X' ? game.playerX : game.playerO;
    const winningPlayer = game.winner === 'X' ? game.playerX : game.playerO;
    header += `🏳️ <b>${escapeHtml(surrenderingPlayer.name)} сдался!</b>\n`;
    header += `🏆 <b>ПОБЕДА:</b> ${escapeHtml(winningPlayer.name)} (${game.winner === 'X' ? '❌' : '⭕'})!\n\n`;
  } else if (game.timedOutBy) {
    const winningPlayer = game.winner === 'X' ? game.playerX : game.playerO;
    header += `⌛ <b>Время на ход истекло (90 сек)!</b>\n`;
    header += `🏆 <b>ПОБЕДА:</b> ${escapeHtml(winningPlayer.name)} (${game.winner === 'X' ? '❌' : '⭕'})!\n\n`;
  } else if (game.winner === 'D') {
    header += `🤝 <b>Ничья!</b> Все 9 клеток заполнены.\n`;
    header += `Боевая ничья между ${escapeHtml(game.playerX.name)} и ${escapeHtml(game.playerO.name)}!\n\n`;
  } else {
    const winningPlayer = game.winner === 'X' ? game.playerX : game.playerO;
    header += `🏆 <b>ПОБЕДА:</b> ${escapeHtml(winningPlayer.name)} (${game.winner === 'X' ? '❌' : '⭕'})!\n`;
    if (game.winningLine && Array.isArray(game.winningLine)) {
      const lineEmojis = game.winningLine.map(idx => NUM_EMOJIS[idx]).join(' ');
      header += `✨ <b>Победная линия:</b> ${lineEmojis}\n`;
    }
    header += `🎉 Поздравляем победителя!\n\n`;
  }

  return header.trim();
}

/**
 * Telegraf Inline Keyboard fallback for 100% compatibility across all Telegram clients
 */
function buildGameKeyboard(game) {
  const keyboard = [];

  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = game.board[idx];
      let text = NUM_EMOJIS[idx];
      if (cell === 'X') text = '❌';
      else if (cell === 'O') text = '⭕';
      row.push(Markup.button.callback(text, `ttt_m_${idx}`));
    }
    keyboard.push(row);
  }

  if (!game.winner) {
    keyboard.push([
      Markup.button.callback('🏳️ Сдаться', 'ttt_sur')
    ]);
  }

  return keyboard;
}

/**
 * Challenge message text with Rich Message Buttons
 */
function buildChallengeMessage(sender, target, challengeId = 'ID') {
  let targetDisplay = escapeHtml(target.name || '');
  if (target.username) {
    targetDisplay = targetDisplay ? `${targetDisplay} (@${escapeHtml(target.username)})` : `@${escapeHtml(target.username)}`;
  }
  return (
    `⚔️ <b>Вызов на битву в Крестики-Нолики!</b>\n` +
    `👤 <b>Игрок 1:</b> ${escapeHtml(sender.name)} (❌)\n` +
    `🎯 <b>Соперник:</b> ${targetDisplay} (⭕)\n\n` +
    `⏳ <i>Ожидание подтверждения: 2 минуты</i>`
  );
}

/**
 * Telegraf Inline Keyboard fallback for challenge
 */
function buildChallengeKeyboard(challengeId) {
  return [
    [
      Markup.button.callback('⚔️ Принять вызов', `ttt_acc_${challengeId}`),
      Markup.button.callback('❌ Отклонить', `ttt_dec_${challengeId}`)
    ]
  ];
}

function cleanUpChallenge(challengeId) {
  const challenge = challenges.get(challengeId);
  if (challenge) {
    if (challenge.timer) {
      clearTimeout(challenge.timer);
      challenge.timer = null;
    }
    userPendingChallenge.delete(challenge.sender.id);
    userPendingChallenge.delete(challenge.target.id);
    challenges.delete(challengeId);
  }
}

function cleanUpGame(gameId) {
  const game = activeGames.get(gameId);
  if (game) {
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }
    userActiveGame.delete(game.playerX.id);
    userActiveGame.delete(game.playerO.id);
    activeGames.delete(gameId);

    // Retain in finished games history so subsequent clicks display 'Game over'
    rememberFinishedGame(game);
    if (game.messageId) {
      rememberMessageGame(game.messageId, game.id);
    }
  }
}

function resetTurnTimer(bot, game) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
  game.turnTimer = setTimeout(() => {
    handleTurnTimeout(bot, game.id);
  }, TURN_TIMEOUT_MS);
  if (typeof game.turnTimer?.unref === 'function') {
    game.turnTimer.unref();
  }
}

function handleTurnTimeout(bot, gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.winner) return;

  const timedOutSymbol = game.currentTurn;
  const winningSymbol = timedOutSymbol === 'X' ? 'O' : 'X';

  game.winner = winningSymbol;
  game.timedOutBy = timedOutSymbol;

  cleanUpGame(game.id);

  const text = renderGameMessage(game);
  const keyboard = buildGameKeyboard(game);

  if (game.chatId && game.messageId && bot?.telegram?.editMessageText) {
    bot.telegram.editMessageText(game.chatId, game.messageId, undefined, text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    }).catch(err => {
      if (!err.description?.includes('message is not modified')) {
        console.error('Error on turn timeout edit:', err.message);
      }
    });
  }
}

function handleChallengeTimeout(bot, challengeId) {
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  cleanUpChallenge(challengeId);

  const timeoutText = (
    `⏳ <b>Время ожидания ответа на вызов истекло (2 минуты).</b>\n` +
    `Битва между <b>${escapeHtml(challenge.sender.name)}</b> и <b>${escapeHtml(challenge.target.name)}</b> отменена.`
  );

  if (challenge.chatId && challenge.messageId && bot?.telegram?.editMessageText) {
    bot.telegram.editMessageText(challenge.chatId, challenge.messageId, undefined, timeoutText, {
      parse_mode: 'HTML'
    }).catch(() => {});
  }
}

async function acceptChallenge(bot, ctx, challengeId, userId) {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { ok: false, message: '❌ Вызов не найден или время ожидания истекло.' };
  }

  if (challenge.target.id !== userId) {
    return { ok: false, message: '❌ Этот вызов адресован не вам!' };
  }

  if (userActiveGame.has(challenge.sender.id)) {
    cleanUpChallenge(challengeId);
    return { ok: false, message: `❌ Игрок ${escapeHtml(challenge.sender.name)} уже в другой игре.` };
  }
  if (userActiveGame.has(challenge.target.id)) {
    cleanUpChallenge(challengeId);
    return { ok: false, message: `❌ Вы уже находитесь в другой игре.` };
  }

  cleanUpChallenge(challengeId);

  const gameId = Math.random().toString(36).substring(2, 9);
  const initialMessageId = ctx.callbackQuery?.message?.message_id || challenge.messageId;
  const game = new TicTacToeGame(gameId, challenge.sender, challenge.target, challenge.chatId, initialMessageId);

  activeGames.set(gameId, game);
  userActiveGame.set(challenge.sender.id, gameId);
  userActiveGame.set(challenge.target.id, gameId);
  if (initialMessageId) {
    messageToGame.set(initialMessageId, gameId);
  }

  resetTurnTimer(bot, game);

  const text = renderGameMessage(game);
  const keyboard = buildGameKeyboard(game);

  if (ctx.callbackQuery && ctx.editMessageText) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
      if (ctx.callbackQuery.message?.message_id) {
        game.messageId = ctx.callbackQuery.message.message_id;
        messageToGame.set(game.messageId, game.id);
      }
    } catch (err) {
      console.error('Error editing challenge to game board:', err.message);
    }
  } else if (challenge.chatId && challenge.messageId && bot?.telegram?.editMessageText) {
    try {
      await bot.telegram.editMessageText(challenge.chatId, challenge.messageId, undefined, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    } catch (err) {
      console.error('Error editing message from command accept:', err.message);
    }
  }

  return { ok: true, game };
}

async function declineChallenge(bot, ctx, challengeId, userId) {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { ok: false, message: '❌ Вызов не найден или уже отменён.' };
  }

  if (challenge.sender.id !== userId && challenge.target.id !== userId) {
    return { ok: false, message: '❌ Вы не можете отклонить этот вызов!' };
  }

  cleanUpChallenge(challengeId);

  const decliner = userId === challenge.sender.id ? challenge.sender : challenge.target;
  const declineText = `❌ Вызов отклонён игроком <b>${escapeHtml(decliner.name)}</b>.`;

  if (challenge.chatId && challenge.messageId) {
    try {
      if (ctx.callbackQuery && ctx.editMessageText) {
        await ctx.editMessageText(declineText, { parse_mode: 'HTML' });
      } else if (bot?.telegram?.editMessageText) {
        await bot.telegram.editMessageText(challenge.chatId, challenge.messageId, undefined, declineText, {
          parse_mode: 'HTML'
        });
      }
    } catch (err) {
      // Ignored if already edited
    }
  }

  return { ok: true };
}

async function handleSurrender(bot, ctx, explicitGameId, userId) {
  let game = null;
  const msgId = ctx?.callbackQuery?.message?.message_id;

  if (explicitGameId) {
    game = activeGames.get(explicitGameId) || finishedGames.get(explicitGameId);
  } else if (msgId && messageToGame.has(msgId)) {
    const targetGameId = messageToGame.get(msgId);
    game = activeGames.get(targetGameId) || finishedGames.get(targetGameId);
  } else if (!msgId && userId) {
    const userGameId = userActiveGame.get(userId);
    if (userGameId) game = activeGames.get(userGameId);
  } else if (msgId && userId) {
    const userGameId = userActiveGame.get(userId);
    if (userGameId) {
      const candidate = activeGames.get(userGameId);
      if (candidate && (!candidate.messageId || candidate.messageId === msgId)) {
        game = candidate;
      }
    }
  }

  if (!game) {
    return { ok: false, message: '❌ Игра не найдена или уже завершена.' };
  }

  if (game.winner) {
    return { ok: false, message: 'Игра уже завершена.' };
  }

  const isPlayerX = userId === game.playerX.id;
  const isPlayerO = userId === game.playerO.id;
  if (!isPlayerX && !isPlayerO) {
    return { ok: false, message: '❌ Вы не участвуете в этой игре!' };
  }

  const callerSymbol = isPlayerX ? 'X' : 'O';
  const winnerSymbol = callerSymbol === 'X' ? 'O' : 'X';
  game.winner = winnerSymbol;
  game.surrenderedBy = callerSymbol;

  cleanUpGame(game.id);

  const text = renderGameMessage(game);
  const keyboard = buildGameKeyboard(game);

  try {
    if (ctx.callbackQuery && ctx.editMessageText) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    } else if (game.chatId && game.messageId && bot?.telegram?.editMessageText) {
      await bot.telegram.editMessageText(game.chatId, game.messageId, undefined, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    }
  } catch (err) {
    if (!err.description?.includes('message is not modified') && !err.message?.includes('message is not modified')) {
      console.error('Error on surrender edit:', err.message);
    }
  }

  return { ok: true, game };
}

async function resolveTargetUser(ctx, User) {
  // 1. Check text_mention entity first (Telegram embeds user object for mentions)
  if (ctx.message?.entities) {
    const textMention = ctx.message.entities.find(e => e.type === 'text_mention' && e.user);
    if (textMention) {
      const u = textMention.user;
      let name = u.first_name || `Игрок ${u.id}`;
      if (User) {
        try {
          const dbUser = await User.findOne({ telegramId: u.id });
          if (dbUser?.nickname) name = dbUser.nickname;
        } catch (e) {}
      }
      return { id: u.id, name, username: u.username || null, is_bot: !!u.is_bot };
    }
  }

  // 2. Check explicit argument in text
  const text = (ctx.message?.text || '').trim();
  let arg = null;
  const matchCall = text.match(/^\.кн\s+вызов(?:\s+(.+))?$/i);
  if (matchCall && matchCall[1]) {
    arg = matchCall[1].trim();
  } else {
    const matchDirect = text.match(/^\.кн\s+@?([a-zA-Z0-9_]+)$/i);
    if (matchDirect) {
      const sub = matchDirect[1].toLowerCase();
      if (!['да', 'принять', 'нет', 'отклонить', 'сдаться', 'стоп', 'помощь', 'правила', 'help', 'вызов'].includes(sub)) {
        arg = matchDirect[1].trim();
      }
    }
  }

  // 3. If explicit argument provided, resolve by username or ID
  if (arg) {
    if (arg.startsWith('@') || isNaN(Number(arg))) {
      const cleanUsername = arg.replace(/^@/, '');
      if (User) {
        try {
          const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const dbUser = await User.findOne({ username: new RegExp(`^${escaped}$`, 'i') });
          if (dbUser) {
            return {
              id: dbUser.telegramId,
              name: dbUser.nickname || dbUser.firstName || cleanUsername,
              username: dbUser.username,
              is_bot: false
            };
          }
        } catch (e) {}
      }
      return { notFound: true, query: arg };
    }

    const numericId = parseInt(arg, 10);
    if (!isNaN(numericId)) {
      let name = `Игрок ${numericId}`;
      let username = null;
      if (User) {
        try {
          const dbUser = await User.findOne({ telegramId: numericId });
          if (dbUser) {
            name = dbUser.nickname || dbUser.firstName || name;
            username = dbUser.username || null;
          }
        } catch (e) {}
      }
      return {
        id: numericId,
        name,
        username,
        is_bot: false
      };
    }
  }

  // 4. Fallback to reply to message
  if (ctx.message?.reply_to_message?.from) {
    const from = ctx.message.reply_to_message.from;
    let name = from.first_name || `Игрок ${from.id}`;
    if (User) {
      try {
        const dbUser = await User.findOne({ telegramId: from.id });
        if (dbUser?.nickname) name = dbUser.nickname;
      } catch (e) {}
    }
    return {
      id: from.id,
      name,
      username: from.username || null,
      is_bot: !!from.is_bot
    };
  }

  return null;
}

const HELP_TEXT = (
  `🎮 <b>«Крестики-Нолики 3×3»</b>\n\n` +
  `<b>Правила игры:</b>\n` +
  `1️⃣ Классическое поле 3х3 (9 клеток).\n` +
  `2️⃣ Игроки ходят по очереди: первый ставит ❌, второй ставит ⭕.\n` +
  `3️⃣ Каждое нажатие мгновенно обновляет игровое поле прямо в сообщении.\n` +
  `4️⃣ Соберите 3 в ряд (по горизонтали, вертикали или диагонали), чтобы победить!\n` +
  `5️⃣ Если все 9 клеток заполнены, а победителя нет — объявляется ничья.\n` +
  `6️⃣ Время на ход — 90 секунд.\n\n` +
  `<b>Команды:</b>\n` +
  `• <code>.кн вызов &lt;участник&gt;</code> — вызвать игрока (ответом на сообщение, по @username или по ID)\n` +
  `• <code>.кн да</code> — принять входящий вызов\n` +
  `• <code>.кн нет</code> — отклонить входящий вызов\n` +
  `• <code>.кн сдаться</code> — сдаться в текущей игре\n` +
  `• <code>.кн помощь</code> — показать эту справку`
);

function initTicTacToe(bot, { User } = {}) {
  // Command: .кн вызов <участник> or .кн @username or .кн <numeric_id>
  bot.hears(/^\.кн\s+(?:вызов(?:\s+(.+))?|@([a-zA-Z0-9_]+)|(\d{5,}))$/i, async (ctx) => {
    try {
      const senderUser = ctx.state?.user;
      const sender = {
        id: ctx.from.id,
        name: senderUser?.nickname || ctx.from.first_name || `Игрок ${ctx.from.id}`,
        username: ctx.from.username || null
      };

      const target = await resolveTargetUser(ctx, User);

      if (!target) {
        return ctx.reply(
          `ℹ️ <b>Как вызвать игрока в «Крестики-Нолики»:</b>\n` +
          `• Ответьте на сообщение игрока командой <code>.кн вызов</code>\n` +
          `• Или напишите: <code>.кн вызов @username</code>\n` +
          `• Или укажите Telegram ID: <code>.кн вызов 123456789</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.notFound) {
        return ctx.reply(
          `❌ Пользователь <b>${escapeHtml(target.query)}</b> не найден в базе данных бота.\n💡 <i>Ответьте на его сообщение командой <code>.кн вызов</code> или попросите его написать боту /start</i>`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.id === sender.id) {
        return ctx.reply('❌ Вы не можете бросить вызов самому себе!');
      }

      if (target.is_bot) {
        return ctx.reply('❌ Нельзя играть с ботом!');
      }

      if (userActiveGame.has(sender.id)) {
        return ctx.reply('❌ Вы уже участвуете в игре! Завершите её или сдайтесь (<code>.кн сдаться</code>).', { parse_mode: 'HTML' });
      }

      if (userActiveGame.has(target.id)) {
        return ctx.reply(`❌ Игрок ${escapeHtml(target.name)} сейчас уже участвует в другой игре!`, { parse_mode: 'HTML' });
      }

      if (userPendingChallenge.has(sender.id)) {
        return ctx.reply('❌ У вас уже есть активный вызов! Дождитесь ответа или окончания таймера (2 мин).');
      }

      if (userPendingChallenge.has(target.id)) {
        return ctx.reply(`❌ У игрока ${escapeHtml(target.name)} уже есть ожидающий вызов.`, { parse_mode: 'HTML' });
      }

      const challengeId = Math.random().toString(36).substring(2, 9);
      const challenge = {
        id: challengeId,
        sender,
        target,
        chatId: ctx.chat.id,
        messageId: null,
        createdAt: Date.now(),
        timer: null
      };

      challenges.set(challengeId, challenge);
      userPendingChallenge.set(sender.id, challengeId);
      userPendingChallenge.set(target.id, challengeId);

      const messageText = buildChallengeMessage(sender, target, challengeId);
      const keyboard = buildChallengeKeyboard(challengeId);

      const sent = await ctx.reply(messageText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });

      challenge.messageId = sent.message_id;

      challenge.timer = setTimeout(() => {
        handleChallengeTimeout(bot, challengeId);
      }, CHALLENGE_TIMEOUT_MS);
      if (typeof challenge.timer?.unref === 'function') {
        challenge.timer.unref();
      }

    } catch (err) {
      console.error('Error handling .кн вызов:', err);
      ctx.reply('❌ Произошла ошибка при отправке вызова.');
    }
  });

  // Command: .кн да / .кн принять
  bot.hears(/^\.кн\s+(да|принять)\s*$/i, async (ctx) => {
    try {
      const challengeId = userPendingChallenge.get(ctx.from.id);
      if (!challengeId) {
        return ctx.reply('❌ У вас нет активных входящих вызовов в игру.');
      }

      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.target.id !== ctx.from.id) {
        return ctx.reply('❌ У вас нет входящих вызовов для принятия.');
      }

      const result = await acceptChallenge(bot, ctx, challengeId, ctx.from.id);
      if (!result.ok) {
        return ctx.reply(result.message);
      }
      await ctx.reply('⚔️ Вызов принят! Игра началась.');
    } catch (err) {
      console.error('Error handling .кн да:', err);
      ctx.reply('❌ Произошла ошибка при принятии вызова.');
    }
  });

  // Command: .кн нет / .кн отклонить
  bot.hears(/^\.кн\s+(нет|отклонить)\s*$/i, async (ctx) => {
    try {
      const challengeId = userPendingChallenge.get(ctx.from.id);
      if (!challengeId) {
        return ctx.reply('❌ У вас нет активных вызовов для отклонения.');
      }

      const result = await declineChallenge(bot, ctx, challengeId, ctx.from.id);
      if (!result.ok && result.message) {
        return ctx.reply(result.message);
      }
      await ctx.reply('❌ Вызов отклонён.');
    } catch (err) {
      console.error('Error handling .кн нет:', err);
      ctx.reply('❌ Произошла ошибка при отклонении вызова.');
    }
  });

  // Command: .кн сдаться / .кн стоп
  bot.hears(/^\.кн\s+(сдаться|стоп)\s*$/i, async (ctx) => {
    try {
      const gameId = userActiveGame.get(ctx.from.id);
      if (!gameId) {
        return ctx.reply('❌ Вы сейчас не участвуете ни в одной игре.');
      }

      const result = await handleSurrender(bot, ctx, gameId, ctx.from.id);
      if (!result.ok && result.message) {
        return ctx.reply(result.message);
      }
      await ctx.reply('🏳️ Вы сдались. Игра завершена!');
    } catch (err) {
      console.error('Error handling .кн сдаться:', err);
      ctx.reply('❌ Произошла ошибка при сдаче игры.');
    }
  });

  // Command: .кн помощь / .кн правила / .кн
  bot.hears(/^\.кн(?:\s+(помощь|правила|help))?\s*$/i, async (ctx) => {
    try {
      ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('Error handling .кн помощь:', err);
    }
  });

  // Inline Button: Accept Challenge (ttt_acc_<id> or utt_acc_<id>)
  bot.action(/^(?:ttt|utt)_acc_(.+)$/, async (ctx) => {
    try {
      const challengeId = ctx.match[1];
      const result = await acceptChallenge(bot, ctx, challengeId, ctx.from.id);
      if (!result.ok) {
        return ctx.answerCbQuery(result.message, { show_alert: true });
      }
      await ctx.answerCbQuery('⚔️ Вызов принят! Игра началась.');
    } catch (err) {
      console.error('Error in ttt_acc action:', err);
      ctx.answerCbQuery('Ошибка при принятии вызова.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Decline Challenge (ttt_dec_<id> or utt_dec_<id>)
  bot.action(/^(?:ttt|utt)_dec_(.+)$/, async (ctx) => {
    try {
      const challengeId = ctx.match[1];
      const result = await declineChallenge(bot, ctx, challengeId, ctx.from.id);
      if (!result.ok) {
        return ctx.answerCbQuery(result.message, { show_alert: true });
      }
      await ctx.answerCbQuery('Вызов отклонён.');
    } catch (err) {
      console.error('Error in ttt_dec action:', err);
      ctx.answerCbQuery('Ошибка при отклонении вызова.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Surrender (ttt_sur, ttt_sur_<id>, utt_sur_<id>)
  bot.action(/^(?:ttt|utt)_sur(?:_([a-zA-Z0-9_-]+))?$/, async (ctx) => {
    try {
      const explicitGameId = ctx.match[1];
      const result = await handleSurrender(bot, ctx, explicitGameId, ctx.from.id);
      if (!result.ok) {
        return ctx.answerCbQuery(result.message, { show_alert: true });
      }
      await ctx.answerCbQuery('Вы сдались.');
    } catch (err) {
      console.error('Error in ttt_sur action:', err);
      ctx.answerCbQuery('Ошибка при сдаче.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Cell Click (ttt_m_<cellIdx> or ttt_m_<gameId>_<cellIdx> or utt_c_<gameId>_<sector>_<cell>)
  bot.action(/^(?:ttt|utt)_(?:m|c)_(?:([a-zA-Z0-9_-]+)_)?(\d)(?:_(\d))?$/, async (ctx) => {
    try {
      const explicitGameId = ctx.match[1];
      // If utt_c_format with 2 digits: second digit is cell
      let cellIdx = parseInt(ctx.match[2], 10);
      if (ctx.match[3] !== undefined) {
        cellIdx = parseInt(ctx.match[3], 10);
      }

      let game = null;
      const msgId = ctx.callbackQuery?.message?.message_id;

      if (explicitGameId) {
        game = activeGames.get(explicitGameId) || finishedGames.get(explicitGameId);
      } else if (msgId && messageToGame.has(msgId)) {
        const targetGameId = messageToGame.get(msgId);
        game = activeGames.get(targetGameId) || finishedGames.get(targetGameId);
      } else if (!msgId) {
        const userGameId = userActiveGame.get(ctx.from.id);
        if (userGameId) game = activeGames.get(userGameId);
      } else {
        const userGameId = userActiveGame.get(ctx.from.id);
        if (userGameId) {
          const candidate = activeGames.get(userGameId);
          if (candidate && (!candidate.messageId || candidate.messageId === msgId)) {
            game = candidate;
          }
        }
      }

      if (!game) {
        return ctx.answerCbQuery('❌ Вы не участвуете в этой игре!', { show_alert: true });
      }

      if (game.winner) {
        return ctx.answerCbQuery('Игра уже завершена.', { show_alert: true });
      }

      const isPlayerX = ctx.from.id === game.playerX.id;
      const isPlayerO = ctx.from.id === game.playerO.id;
      if (!isPlayerX && !isPlayerO) {
        return ctx.answerCbQuery('❌ Вы не участвуете в этой игре!', { show_alert: true });
      }

      const callerSymbol = isPlayerX ? 'X' : 'O';
      if (callerSymbol !== game.currentTurn) {
        const activeName = game.currentTurn === 'X' ? game.playerX.name : game.playerO.name;
        return ctx.answerCbQuery(`⏳ Сейчас ход соперника (${activeName})!`, { show_alert: true });
      }

      if (game.board[cellIdx] !== null) {
        return ctx.answerCbQuery('❌ Эта клетка уже занята!', { show_alert: true });
      }

      const moveResult = game.makeMove(cellIdx, callerSymbol);
      if (!moveResult.valid) {
        return ctx.answerCbQuery(moveResult.reason || 'Недопустимый ход!', { show_alert: true });
      }

      await ctx.answerCbQuery();

      if (!moveResult.gameOver) {
        resetTurnTimer(bot, game);
      } else {
        if (game.turnTimer) clearTimeout(game.turnTimer);
        cleanUpGame(game.id);
      }

      const text = renderGameMessage(game);
      const keyboard = buildGameKeyboard(game);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(keyboard)
        });
      } catch (err) {
        if (!err.description?.includes('message is not modified') && !err.message?.includes('message is not modified')) {
          console.error('Error updating board after move:', err.message);
        }
      }
    } catch (err) {
      console.error('Error in cell click action:', err);
      ctx.answerCbQuery('Ошибка при совершении хода.', { show_alert: true }).catch(() => {});
    }
  });

  // Graceful fallback for obsolete buttons if any
  bot.action(/^(?:ttt|utt)_[sv]_.*$/, async (ctx) => {
    ctx.answerCbQuery('Действие более недоступно.', { show_alert: true }).catch(() => {});
  });
}

module.exports = {
  TicTacToeGame,
  UltimateTicTacToeGame: TicTacToeGame,
  WIN_LINES,
  NUM_EMOJIS,
  CHALLENGE_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  escapeHtml,
  renderRichButtons,
  renderGameMessage,
  buildGameKeyboard,
  buildChallengeMessage,
  buildChallengeKeyboard,
  initTicTacToe,
  initUltimateTicTacToe: initTicTacToe,
  challenges,
  activeGames,
  finishedGames,
  rememberFinishedGame,
  rememberMessageGame,
  userActiveGame,
  userPendingChallenge,
  messageToGame,
  cleanUpGame,
  cleanUpChallenge,
  resetTurnTimer,
  handleTurnTimeout,
  handleChallengeTimeout,
  acceptChallenge,
  declineChallenge,
  handleSurrender,
  resolveTargetUser,
  HELP_TEXT
};
