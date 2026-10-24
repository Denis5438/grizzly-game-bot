const { Markup } = require('telegraf');

// Парсер ставок (числа, "все", "всё", сокращения "к", "м", поддержка десятичных 2.5к / 1.5м)
function parseBetAmount(rawBet, currentCookies) {
  if (!rawBet) return null;
  const str = String(rawBet).trim().toLowerCase().replace(/\s+/g, '');
  if (str === 'всё' || str === 'все') {
    return Math.max(0, Math.floor(Number(currentCookies) || 0));
  }

  // Регулярное выражение для чисел с опциональной десятичной точкой/запятой и суффиксом (к/k/м/m)
  const match = str.match(/^(\d+(?:[.,]\d+)?)(к|k|м|m)?$/i);
  if (!match) return null;

  const numPart = parseFloat(match[1].replace(',', '.'));
  if (isNaN(numPart) || numPart <= 0) return null;

  const suffix = (match[2] || '').toLowerCase();
  let multiplier = 1;
  if (suffix === 'к' || suffix === 'k') {
    multiplier = 1000;
  } else if (suffix === 'м' || suffix === 'm') {
    multiplier = 1000000;
  }

  const result = Math.floor(numPart * multiplier);
  if (isNaN(result) || result <= 0) return null;
  return result;
}

// Форматирование чисел с разделителями тысяч
function formatNumber(num) {
  return Number(num || 0).toLocaleString('ru-RU');
}

// =============================================================
// 1. БЛЭКДЖЕК (21)
// =============================================================
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const v of CARD_VALUES) {
      let score = parseInt(v, 10);
      if (['J', 'Q', 'K'].includes(v)) score = 10;
      if (v === 'A') score = 11;
      deck.push({ suit: s, value: v, score });
    }
  }
  // Перемешивание Фишера-Йетса
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateHandScore(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.score;
    if (card.value === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function formatHand(hand, hideSecond = false) {
  if (hideSecond && hand.length >= 2) {
    return `[ ${hand[0].suit} ${hand[0].value} ] [ 🎴 ? ]`;
  }
  const cardsStr = hand.map(c => `[ ${c.suit} ${c.value} ]`).join(' ');
  const score = calculateHandScore(hand);
  return `${cardsStr} (<b>${score}</b>)`;
}

// Хранилище активных сессий Блэкджека
const activeBlackjacks = new Map();

function getBlackjackKeyboard(userId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Взять карту 🃏', `bj_hit_${userId}`),
      Markup.button.callback('Хватит 🛑', `bj_stand_${userId}`)
    ]
  ]);
}

// =============================================================
// 2. КРЕСТИКИ-НОЛИКИ 3x3
// =============================================================
const activeTicTacToe = new Map();

function checkTicTacToeWinner(board) {
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
    [0, 4, 8], [2, 4, 6]             // диагонали
  ];
  for (const [a, b, c] of winLines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' или 'O'
    }
  }
  if (board.every(cell => cell !== null)) {
    return 'draw';
  }
  return null;
}

function getTicTacToeKeyboard(gameId, board, gameOver = false) {
  const buttons = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const val = board[idx];
      const text = val === 'X' ? '❌' : val === 'O' ? '⭕' : '·';
      const callback = gameOver || val ? `ttt_noop_${gameId}` : `ttt_m_${gameId}_${idx}`;
      row.push(Markup.button.callback(text, callback));
    }
    buttons.push(row);
  }
  return Markup.inlineKeyboard(buttons);
}

module.exports = {
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
};
