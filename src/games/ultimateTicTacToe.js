'use strict';

const { Markup } = require('telegraf');

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

const SECTOR_NAMES = [
  'Верх-Лево', 'Верх-Центр', 'Верх-Право',
  'Центр-Лево', 'Центр', 'Центр-Право',
  'Низ-Лево', 'Низ-Центр', 'Низ-Право'
];

const NUM_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class UltimateTicTacToeGame {
  constructor(id, playerX, playerO, chatId, messageId = null) {
    this.id = id;
    this.playerX = playerX; // { id, name, username }
    this.playerO = playerO; // { id, name, username }
    this.chatId = chatId;
    this.messageId = messageId;

    // cells[sectorIdx][cellIdx] -> 'X', 'O', or null
    this.cells = Array.from({ length: 9 }, () => Array(9).fill(null));

    // sectors[sectorIdx] -> 'X', 'O', 'D' (draw), or null
    this.sectors = Array(9).fill(null);

    // activeSector: 0..8, or null (free choice)
    this.activeSector = null; // first move is free choice!

    // viewSector: currently displayed 3x3 sector (0..8)
    this.viewSector = 4; // default to center (Sector 5)

    // viewMode: 'sector' or 'map'
    this.viewMode = 'sector';

    // currentTurn: 'X' or 'O'
    this.currentTurn = 'X';

    // winner: null, 'X', 'O', 'D'
    this.winner = null;

    // surrender / timeout tracking
    this.surrenderedBy = null;
    this.timedOutBy = null;

    // notice from last move
    this.lastNotice = '⚡ <b>Первый ход:</b> свободный выбор! Можете ходить в секторе № 5 или нажать <b>[ 🗺️ Вся карта ]</b> для выбора другого сектора.';

    // turn timeout timer reference
    this.turnTimer = null;
    this.lastMoveAt = Date.now();
  }

  static checkSectorWinner(board) {
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

  static checkGlobalWinner(sectors, cells) {
    for (const [a, b, c] of WIN_LINES) {
      if (sectors[a] && sectors[a] !== 'D' && sectors[a] === sectors[b] && sectors[a] === sectors[c]) {
        return sectors[a];
      }
    }
    const allResolved = sectors.every(s => s !== null);
    if (allResolved) return 'D';

    if (cells) {
      const hasAnyValidMove = sectors.some((status, sIdx) => {
        if (status !== null) return false;
        return cells[sIdx].some(c => c === null);
      });
      if (!hasAnyValidMove) return 'D';
    }

    return null;
  }

  isValidMove(sectorIdx, cellIdx, playerSymbol) {
    if (this.winner) return { valid: false, reason: 'Игра уже завершена.' };
    if (this.currentTurn !== playerSymbol) return { valid: false, reason: 'Сейчас не ваш ход.' };

    if (sectorIdx < 0 || sectorIdx > 8 || cellIdx < 0 || cellIdx > 8) {
      return { valid: false, reason: 'Некорректные координаты хода.' };
    }

    if (this.activeSector !== null && sectorIdx !== this.activeSector) {
      return { valid: false, reason: `Вы должны ходить в секторе № ${this.activeSector + 1}!` };
    }

    if (this.sectors[sectorIdx] !== null) {
      return { valid: false, reason: 'Этот сектор уже завершён!' };
    }

    if (this.cells[sectorIdx][cellIdx] !== null) {
      return { valid: false, reason: 'Эта клетка уже занята!' };
    }

    return { valid: true };
  }

  makeMove(sectorIdx, cellIdx, playerSymbol) {
    const check = this.isValidMove(sectorIdx, cellIdx, playerSymbol);
    if (!check.valid) return check;

    this.cells[sectorIdx][cellIdx] = playerSymbol;
    this.lastMoveAt = Date.now();
    let notice = '';

    const currentPlayer = playerSymbol === 'X' ? this.playerX : this.playerO;

    // Check if sector is won/drawn
    const sectorStatus = UltimateTicTacToeGame.checkSectorWinner(this.cells[sectorIdx]);
    if (sectorStatus) {
      this.sectors[sectorIdx] = sectorStatus;
      if (sectorStatus === 'D') {
        notice = `🤝 <b>Сектор № ${sectorIdx + 1} завершился ничьей!</b>`;
      } else {
        notice = `🎉 <b>${escapeHtml(currentPlayer.name)} (${playerSymbol}) захватывает сектор № ${sectorIdx + 1}!</b>`;
      }
    }

    // Check if global game is won/drawn
    const globalStatus = UltimateTicTacToeGame.checkGlobalWinner(this.sectors, this.cells);
    if (globalStatus) {
      this.winner = globalStatus;
      this.activeSector = null;
      this.lastNotice = notice;
      return { valid: true, gameOver: true, winner: globalStatus };
    }

    // Determine next active sector
    const nextCandidate = cellIdx;
    const isCandidatePlayable = (
      this.sectors[nextCandidate] === null &&
      this.cells[nextCandidate].some(c => c === null)
    );

    if (isCandidatePlayable) {
      this.activeSector = nextCandidate;
      this.viewSector = nextCandidate;
      this.viewMode = 'sector';
      const dirNotice = `📍 Следующий ход направлен в сектор № ${nextCandidate + 1} (${SECTOR_NAMES[nextCandidate]}).`;
      notice = notice ? `${notice}\n${dirNotice}` : dirNotice;
    } else {
      this.activeSector = null;
      this.viewMode = 'map';
      const freeNotice = `⚡ Сектор № ${nextCandidate + 1} завершён/заполнен! Свободный выбор сектора.`;
      notice = notice ? `${notice}\n${freeNotice}` : freeNotice;
    }

    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
    this.lastNotice = notice;

    return { valid: true, gameOver: false, activeSector: this.activeSector };
  }
}

function renderGlobalGrid(sectors, activeSector) {
  const symbols = sectors.map((sec, idx) => {
    if (sec === 'X') return '❌';
    if (sec === 'O') return '⭕';
    if (sec === 'D') return '⬛';
    if (activeSector === idx) return '🎯';
    return NUM_EMOJIS[idx];
  });

  return (
    '┌───┬───┬───┐\n' +
    `│ ${symbols[0]} │ ${symbols[1]} │ ${symbols[2]} │\n` +
    '├───┼───┼───┤\n' +
    `│ ${symbols[3]} │ ${symbols[4]} │ ${symbols[5]} │\n` +
    '├───┼───┼───┤\n' +
    `│ ${symbols[6]} │ ${symbols[7]} │ ${symbols[8]} │\n` +
    '└───┴───┴───┘'
  );
}

function renderGameMessage(game) {
  const playerXMention = `❌ <a href="tg://user?id=${game.playerX.id}">${escapeHtml(game.playerX.name)}</a>`;
  const playerOMention = `⭕ <a href="tg://user?id=${game.playerO.id}">${escapeHtml(game.playerO.name)}</a>`;
  const activePlayer = game.currentTurn === 'X' ? game.playerX : game.playerO;
  const currentSymbol = game.currentTurn === 'X' ? '❌' : '⭕';

  if (game.winner) {
    if (game.winner === 'D') {
      return (
        `🤝 <b>НИЧЬЯ В «СУПЕР КРЕСТИКИ-НОЛИКИ»!</b>\n\n` +
        `${playerXMention} сыграл(а) вничью с ${playerOMention}!\n` +
        `Все сектора разыграны, но победитель не выявлен. Достойная битва!\n\n` +
        `🗺️ <b>Финальная карта:</b>\n` +
        `<pre>${renderGlobalGrid(game.sectors, null)}</pre>`
      );
    } else {
      const winnerPlayer = game.winner === 'X' ? game.playerX : game.playerO;
      const loserPlayer = game.winner === 'X' ? game.playerO : game.playerX;
      const winnerSymbol = game.winner === 'X' ? '❌' : '⭕';
      let reasonText = 'Собрана линия из 3 захваченных секторов на глобальном поле!';
      if (game.surrenderedBy) {
        reasonText = `Игрок <a href="tg://user?id=${game.surrenderedBy}">${escapeHtml(loserPlayer.name)}</a> сдался!`;
      } else if (game.timedOutBy) {
        reasonText = `У игрока <a href="tg://user?id=${game.timedOutBy}">${escapeHtml(loserPlayer.name)}</a> истекло время на ход (120 сек)!`;
      }

      return (
        `🏆 <b>ПОБЕДА В «СУПЕР КРЕСТИКИ-НОЛИКИ»!</b>\n\n` +
        `👑 <b>Победитель:</b> <a href="tg://user?id=${winnerPlayer.id}">${escapeHtml(winnerPlayer.name)}</a> (${winnerSymbol})\n` +
        `💔 <b>Проигравший:</b> <a href="tg://user?id=${loserPlayer.id}">${escapeHtml(loserPlayer.name)}</a>\n\n` +
        `🎉 ${reasonText}\n\n` +
        `🗺️ <b>Финальная карта:</b>\n` +
        `<pre>${renderGlobalGrid(game.sectors, null)}</pre>`
      );
    }
  }

  let text = `🎮 <b>«Супер Крестики-Нолики»</b>\n`;
  text += `${playerXMention} <i>vs</i> ${playerOMention}\n\n`;

  if (game.lastNotice) {
    text += `${game.lastNotice}\n\n`;
  }

  text += `🎯 <b>Ход:</b> <a href="tg://user?id=${activePlayer.id}">${escapeHtml(activePlayer.name)}</a> (${currentSymbol})\n`;
  text += `⏱ <b>Время на ход:</b> 120 сек.\n`;

  if (game.activeSector === null) {
    text += `📍 <b>Сектор:</b> ⚡ <i>Свободный выбор (любой сектор)!</i>\n\n`;
  } else {
    text += `📍 <b>Сектор:</b> № ${game.activeSector + 1} (${SECTOR_NAMES[game.activeSector]})\n\n`;
  }

  text += `🗺️ <b>Глобальное поле 3х3:</b>\n`;
  text += `<pre>${renderGlobalGrid(game.sectors, game.activeSector)}</pre>\n`;

  if (game.viewMode === 'map') {
    text += `💡 <i>Режим карты: выберите сектор на кнопках ниже.</i>`;
  } else {
    if (game.activeSector !== null && game.viewSector !== game.activeSector) {
      text += `💡 <i>Просмотр сектора № ${game.viewSector + 1} (${SECTOR_NAMES[game.viewSector]}).</i>\n` +
              `⚠️ <i>Ход возможен только в секторе № ${game.activeSector + 1}! Нажмите [ 🎯 Текущий сектор ] для возврата.</i>`;
    } else {
      text += `💡 <i>Выберите клетку на поле сектора № ${game.viewSector + 1} (${SECTOR_NAMES[game.viewSector]}):</i>`;
    }
  }

  return text;
}

function buildGameKeyboard(game) {
  if (game.winner) {
    return [];
  }

  const keyboard = [];

  if (game.viewMode === 'sector') {
    // 3x3 cells of game.viewSector
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 3; c++) {
        const cellIdx = r * 3 + c;
        const val = game.cells[game.viewSector][cellIdx];
        let label = '⬜';
        if (val === 'X') label = '❌';
        else if (val === 'O') label = '⭕';
        row.push(Markup.button.callback(label, `utt_c_${game.id}_${game.viewSector}_${cellIdx}`));
      }
      keyboard.push(row);
    }

    // Navigation row: [ 🎯 Текущий сектор ] (if inspecting), [ 🗺️ Вся карта ], [ 🏳️ Сдаться ]
    const navRow = [];
    if (game.activeSector !== null && game.viewSector !== game.activeSector) {
      navRow.push(Markup.button.callback('🎯 Текущий сектор', `utt_v_${game.id}_sec`));
    }
    navRow.push(Markup.button.callback('🗺️ Вся карта', `utt_v_${game.id}_map`));
    navRow.push(Markup.button.callback('🏳️ Сдаться', `utt_sur_${game.id}`));
    keyboard.push(navRow);
  } else {
    // 3x3 sector buttons
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 3; c++) {
        const sIdx = r * 3 + c;
        const status = game.sectors[sIdx];
        let sym = '▫️';
        if (status === 'X') sym = '❌';
        else if (status === 'O') sym = '⭕';
        else if (status === 'D') sym = '⬛';
        else if (game.activeSector === sIdx) sym = '🎯';
        row.push(Markup.button.callback(`${NUM_EMOJIS[sIdx]} ${sym}`, `utt_s_${game.id}_${sIdx}`));
      }
      keyboard.push(row);
    }

    const navRow = [];
    navRow.push(Markup.button.callback('🎯 Текущий сектор', `utt_v_${game.id}_sec`));
    navRow.push(Markup.button.callback('🏳️ Сдаться', `utt_sur_${game.id}`));
    keyboard.push(navRow);
  }

  return keyboard;
}

function buildChallengeMessage(sender, target) {
  return (
    `⚔️ <b>Вызов на битву в «Супер Крестики-Нолики»!</b>\n\n` +
    `❌ <b>Игрок 1:</b> <a href="tg://user?id=${sender.id}">${escapeHtml(sender.name)}</a>\n` +
    `⭕ <b>Игрок 2:</b> <a href="tg://user?id=${target.id}">${escapeHtml(target.name)}</a>\n\n` +
    `⏳ На ответ есть <b>2 минуты</b>.\n` +
    `Нажмите кнопку ниже или используйте команды <code>.кн да</code> / <code>.кн нет</code>.`
  );
}

function buildChallengeKeyboard(challengeId) {
  return [
    [
      Markup.button.callback('⚔️ Принять вызов', `utt_acc_${challengeId}`),
      Markup.button.callback('❌ Отклонить', `utt_dec_${challengeId}`)
    ]
  ];
}

const CHALLENGE_TIMEOUT_MS = 120000; // 2 minutes
const TURN_TIMEOUT_MS = 120000;      // 2 minutes

// In-memory managers
const challenges = new Map();           // challengeId -> challenge object
const activeGames = new Map();          // gameId -> game object
const userActiveGame = new Map();       // telegramId -> gameId
const userPendingChallenge = new Map();  // telegramId -> challengeId

function cleanUpGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }

  userActiveGame.delete(game.playerX.id);
  userActiveGame.delete(game.playerO.id);
  activeGames.delete(gameId);
}

function resetTurnTimer(bot, game) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
  }
  game.turnTimer = setTimeout(() => {
    handleTurnTimeout(bot, game.id);
  }, TURN_TIMEOUT_MS);
}

async function handleTurnTimeout(bot, gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.winner) return;

  const timedOutSymbol = game.currentTurn;
  const timedOutUser = timedOutSymbol === 'X' ? game.playerX : game.playerO;
  const winningSymbol = timedOutSymbol === 'X' ? 'O' : 'X';

  game.winner = winningSymbol;
  game.timedOutBy = timedOutUser.id;

  const text = renderGameMessage(game);

  try {
    await bot.telegram.editMessageText(game.chatId, game.messageId, null, text, {
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('Error updating game message on turn timeout:', err.message);
  }

  cleanUpGame(gameId);
}

async function handleChallengeTimeout(bot, challengeId) {
  const challenge = challenges.get(challengeId);
  if (!challenge) return;

  challenges.delete(challengeId);
  userPendingChallenge.delete(challenge.sender.id);
  userPendingChallenge.delete(challenge.target.id);

  const text = (
    `⏳ <b>Время вызова истекло!</b>\n\n` +
    `Вызов на битву в «Супер Крестики-Нолики» от <a href="tg://user?id=${challenge.sender.id}">${escapeHtml(challenge.sender.name)}</a> ` +
    `к <a href="tg://user?id=${challenge.target.id}">${escapeHtml(challenge.target.name)}</a> аннулирован.`
  );

  try {
    await bot.telegram.editMessageText(challenge.chatId, challenge.messageId, null, text, {
      parse_mode: 'HTML'
    });
  } catch (err) {
    // Ignore edit failures on expired challenges
  }
}

async function acceptChallenge(bot, ctx, challengeId, callerUserId) {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { ok: false, message: '⏳ Этот вызов уже недействителен или время истекло.' };
  }

  if (callerUserId && callerUserId !== challenge.target.id) {
    return { ok: false, isUnauthorized: true, message: '❌ Этот вызов предназначен не вам!' };
  }

  if (challenge.timer) {
    clearTimeout(challenge.timer);
  }
  challenges.delete(challengeId);
  userPendingChallenge.delete(challenge.sender.id);
  userPendingChallenge.delete(challenge.target.id);

  if (userActiveGame.has(challenge.sender.id) || userActiveGame.has(challenge.target.id)) {
    return { ok: false, message: '❌ Один из участников уже находится в активной игре!' };
  }

  const gameId = Math.random().toString(36).substring(2, 9);
  const game = new UltimateTicTacToeGame(
    gameId,
    challenge.sender,
    challenge.target,
    challenge.chatId,
    challenge.messageId
  );

  activeGames.set(gameId, game);
  userActiveGame.set(challenge.sender.id, gameId);
  userActiveGame.set(challenge.target.id, gameId);

  resetTurnTimer(bot, game);

  const text = renderGameMessage(game);
  const keyboard = buildGameKeyboard(game);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    } else {
      if (challenge.messageId) {
        try {
          await bot.telegram.editMessageText(challenge.chatId, challenge.messageId, null, text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(keyboard)
          });
        } catch (e) {
          const sent = await ctx.reply(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(keyboard)
          });
          game.messageId = sent.message_id;
          game.chatId = sent.chat?.id || ctx.chat.id;
        }
      } else {
        const sent = await ctx.reply(text, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(keyboard)
        });
        game.messageId = sent.message_id;
        game.chatId = sent.chat?.id || ctx.chat.id;
      }
    }
  } catch (err) {
    console.error('Error starting game UI:', err.message);
  }

  return { ok: true, game };
}

async function declineChallenge(bot, ctx, challengeId, callerUserId) {
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return { ok: false, message: '⏳ Этот вызов уже недействителен или время истекло.' };
  }

  if (callerUserId && callerUserId !== challenge.target.id && callerUserId !== challenge.sender.id) {
    return { ok: false, isUnauthorized: true, message: '❌ Вы не можете отклонить этот вызов!' };
  }

  if (challenge.timer) {
    clearTimeout(challenge.timer);
  }
  challenges.delete(challengeId);
  userPendingChallenge.delete(challenge.sender.id);
  userPendingChallenge.delete(challenge.target.id);

  const isDeclinedByTarget = callerUserId === challenge.target.id;
  const declineText = isDeclinedByTarget
    ? `❌ <a href="tg://user?id=${challenge.target.id}">${escapeHtml(challenge.target.name)}</a> отклонил(а) вызов на бой от <a href="tg://user?id=${challenge.sender.id}">${escapeHtml(challenge.sender.name)}</a>.`
    : `❌ <a href="tg://user?id=${challenge.sender.id}">${escapeHtml(challenge.sender.name)}</a> отменил(а) свой вызов.`;

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(declineText, { parse_mode: 'HTML' });
    } else {
      if (challenge.messageId) {
        try {
          await bot.telegram.editMessageText(challenge.chatId, challenge.messageId, null, declineText, {
            parse_mode: 'HTML'
          });
        } catch (e) {
          await ctx.reply(declineText, { parse_mode: 'HTML' });
        }
      } else {
        await ctx.reply(declineText, { parse_mode: 'HTML' });
      }
    }
  } catch (err) {
    console.error('Error declining challenge message:', err.message);
  }

  return { ok: true };
}

async function handleSurrender(bot, ctx, gameId, callerUserId) {
  const game = activeGames.get(gameId);
  if (!game || game.winner) {
    return { ok: false, message: 'Игра не найдена или уже завершена.' };
  }

  if (callerUserId !== game.playerX.id && callerUserId !== game.playerO.id) {
    return { ok: false, isUnauthorized: true, message: '❌ Вы не участвуете в этой игре!' };
  }

  const surrenderingSymbol = callerUserId === game.playerX.id ? 'X' : 'O';
  const winningSymbol = surrenderingSymbol === 'X' ? 'O' : 'X';

  game.winner = winningSymbol;
  game.surrenderedBy = callerUserId;

  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }

  const text = renderGameMessage(game);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML' });
    } else {
      await bot.telegram.editMessageText(game.chatId, game.messageId, null, text, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('Error handling surrender message:', err.message);
  }

  cleanUpGame(gameId);
  return { ok: true };
}

async function resolveTargetUser(ctx, User) {
  // 1. Check explicit argument in text first
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

  // 2. If explicit argument provided, resolve by username or ID
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

  // 3. If no explicit text argument, check text_mention entity
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
  `🎮 <b>«Супер Крестики-Нолики» (Ultimate Tic-Tac-Toe)</b>\n\n` +
  `<b>Правила игры:</b>\n` +
  `1️⃣ Игровое поле состоит из 9 секторов (3х3). В каждом секторе расположено малое поле 3х3 (всего 81 клетка).\n` +
  `2️⃣ Игроки ходят по очереди, выставляя ❌ и ⭕.\n` +
  `3️⃣ Собрав 3 в ряд на малом поле — вы побеждаете в этом секторе! Сектор отмечается вашим знаком (❌ или ⭕).\n` +
  `4️⃣ <b>Главное правило перемещения:</b> клетка, выбранная вами на малом поле, определяет сектор, в котором обязан ходить соперник!\n` +
  `5️⃣ Если вас отправляют в уже завершённый или заполненный сектор — у вас <b>свободный выбор</b> любого доступного сектора!\n` +
  `6️⃣ <b>Главная победа:</b> победите на 3 малых полях в ряд на глобальной карте (3х3)!\n\n` +
  `<b>Команды:</b>\n` +
  `• <code>.кн вызов &lt;участник&gt;</code> — вызвать игрока (ответом на сообщение, по @username или по ID)\n` +
  `• <code>.кн да</code> — принять входящий вызов\n` +
  `• <code>.кн нет</code> — отклонить входящий вызов\n` +
  `• <code>.кн сдаться</code> — сдаться в текущей игре\n` +
  `• <code>.кн помощь</code> — показать эту справку`
);

function initUltimateTicTacToe(bot, { User } = {}) {
  // Command: .кн вызов <участник> or .кн @username
  bot.hears(/^\.кн\s+(?:вызов(?:\s+(.+))?|@([a-zA-Z0-9_]+))$/i, async (ctx) => {
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
          `ℹ️ <b>Как вызвать игрока в «Супер Крестики-Нолики»:</b>\n` +
          `• Ответьте на сообщение игрока командой <code>.кн вызов</code>\n` +
          `• Или напишите: <code>.кн вызов @username</code>\n` +
          `• Или укажите Telegram ID: <code>.кн вызов 123456789</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (target.notFound) {
        return ctx.reply(`❌ Пользователь ${escapeHtml(target.query)} не найден в базе данных бота.`, { parse_mode: 'HTML' });
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

      const messageText = buildChallengeMessage(sender, target);
      const keyboard = buildChallengeKeyboard(challengeId);

      const sent = await ctx.reply(messageText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });

      challenge.messageId = sent.message_id;

      challenge.timer = setTimeout(() => {
        handleChallengeTimeout(bot, challengeId);
      }, CHALLENGE_TIMEOUT_MS);

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

  // Inline Button: Accept Challenge
  bot.action(/^utt_acc_(.+)$/, async (ctx) => {
    try {
      const challengeId = ctx.match[1];
      const result = await acceptChallenge(bot, ctx, challengeId, ctx.from.id);
      if (!result.ok) {
        return ctx.answerCbQuery(result.message, { show_alert: true });
      }
      await ctx.answerCbQuery('⚔️ Вызов принят! Игра началась.');
    } catch (err) {
      console.error('Error in utt_acc action:', err);
      ctx.answerCbQuery('Ошибка при принятии вызова.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Decline Challenge
  bot.action(/^utt_dec_(.+)$/, async (ctx) => {
    try {
      const challengeId = ctx.match[1];
      const result = await declineChallenge(bot, ctx, challengeId, ctx.from.id);
      if (!result.ok) {
        return ctx.answerCbQuery(result.message, { show_alert: true });
      }
      await ctx.answerCbQuery('Вызов отклонён.');
    } catch (err) {
      console.error('Error in utt_dec action:', err);
      ctx.answerCbQuery('Ошибка при отклонении вызова.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Surrender
  bot.action(/^utt_sur_(.+)$/, async (ctx) => {
    try {
      const gameId = ctx.match[1];
      const result = await handleSurrender(bot, ctx, gameId, ctx.from.id);
      if (!result.ok) {
        return ctx.answerCbQuery(result.message, { show_alert: true });
      }
      await ctx.answerCbQuery('Вы сдались.');
    } catch (err) {
      console.error('Error in utt_sur action:', err);
      ctx.answerCbQuery('Ошибка при сдаче.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Cell Click (utt_c_<gameId>_<sectorIdx>_<cellIdx>)
  bot.action(/^utt_c_([^_]+)_(\d)_(\d)$/, async (ctx) => {
    try {
      const gameId = ctx.match[1];
      const s = parseInt(ctx.match[2], 10);
      const c = parseInt(ctx.match[3], 10);

      const game = activeGames.get(gameId);
      if (!game || game.winner) {
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

      if (game.activeSector !== null && s !== game.activeSector) {
        return ctx.answerCbQuery(`⚠️ Вы должны ходить в секторе № ${game.activeSector + 1}!`, { show_alert: true });
      }

      const moveResult = game.makeMove(s, c, callerSymbol);
      if (!moveResult.valid) {
        return ctx.answerCbQuery(moveResult.reason || 'Недопустимый ход!', { show_alert: true });
      }

      await ctx.answerCbQuery();

      if (!moveResult.gameOver) {
        resetTurnTimer(bot, game);
      } else {
        if (game.turnTimer) clearTimeout(game.turnTimer);
      }

      const text = renderGameMessage(game);
      const keyboard = buildGameKeyboard(game);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(keyboard)
        });
      } catch (err) {
        if (!err.description?.includes('message is not modified')) {
          console.error('Error updating board after move:', err.message);
        }
      }

      if (moveResult.gameOver) {
        cleanUpGame(game.id);
      }
    } catch (err) {
      console.error('Error in utt_c action:', err);
      ctx.answerCbQuery('Ошибка при совершении хода.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: Sector Click (in map view) (utt_s_<gameId>_<sectorIdx>)
  bot.action(/^utt_s_([^_]+)_(\d)$/, async (ctx) => {
    try {
      const gameId = ctx.match[1];
      const s = parseInt(ctx.match[2], 10);

      const game = activeGames.get(gameId);
      if (!game || game.winner) {
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

      if (game.activeSector !== null) {
        // Player is navigating to view/inspect this sector
        game.viewMode = 'sector';
        game.viewSector = s;
        await ctx.answerCbQuery();
      } else {
        // Free choice: cannot pick a finished sector
        if (game.sectors[s] !== null) {
          return ctx.answerCbQuery('❌ Этот сектор уже завершён! Выберите открытый сектор.', { show_alert: true });
        }
        game.viewMode = 'sector';
        game.viewSector = s;
        await ctx.answerCbQuery();
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
          console.error('Error switching to sector:', err.message);
        }
      }
    } catch (err) {
      console.error('Error in utt_s action:', err);
      ctx.answerCbQuery('Ошибка при выборе сектора.', { show_alert: true }).catch(() => {});
    }
  });

  // Inline Button: View switch (utt_v_<gameId>_<viewMode>)
  bot.action(/^utt_v_([^_]+)_([a-z]+)$/, async (ctx) => {
    try {
      const gameId = ctx.match[1];
      const view = ctx.match[2];

      const game = activeGames.get(gameId);
      if (!game || game.winner) {
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

      if (view === 'map') {
        game.viewMode = 'map';
      } else {
        game.viewMode = 'sector';
        if (game.activeSector !== null) {
          game.viewSector = game.activeSector;
        }
      }

      await ctx.answerCbQuery();

      const text = renderGameMessage(game);
      const keyboard = buildGameKeyboard(game);

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(keyboard)
        });
      } catch (err) {
        if (!err.description?.includes('message is not modified') && !err.message?.includes('message is not modified')) {
          console.error('Error switching view mode:', err.message);
        }
      }
    } catch (err) {
      console.error('Error in utt_v action:', err);
      ctx.answerCbQuery('Ошибка переключения вида.', { show_alert: true }).catch(() => {});
    }
  });
}

module.exports = {
  UltimateTicTacToeGame,
  WIN_LINES,
  SECTOR_NAMES,
  NUM_EMOJIS,
  escapeHtml,
  renderGlobalGrid,
  renderGameMessage,
  buildGameKeyboard,
  buildChallengeMessage,
  buildChallengeKeyboard,
  initUltimateTicTacToe,
  challenges,
  activeGames,
  userActiveGame,
  userPendingChallenge,
  cleanUpGame,
  acceptChallenge,
  declineChallenge,
  handleSurrender
};
