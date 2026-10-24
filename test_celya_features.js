const assert = require('assert');
const fs = require('fs');
const { createCanvas } = require('canvas');

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
  checkTicTacToeWinner,
  getTicTacToeKeyboard,
  getBlackjackKeyboard
} = require('./src/celyaGames');

const {
  ZODIAC_SIGNS,
  getDailyHoroscope,
  getMagicBallAnswer,
  getProbability,
  getHelpMainMenu,
  getHelpCategoryContent
} = require('./src/celyaEntertainment');

console.log('=== STARTING CELYA / CELESTIANA SUITE VERIFICATION ===\n');

async function runTests() {
  // 1. Marriage Certificate Generation
  console.log('1. Testing Marriage Certificate Generator...');
  const certBuf = await generateMarriageCertificate({
    partner1Nick: 'Celestiana',
    partner2Nick: 'Abigail',
    dateStr: '24.10.2026'
  });
  assert(Buffer.isBuffer(certBuf), 'Must return a Buffer');
  assert(certBuf.length > 25000, `Certificate buffer must be >25KB, got: ${certBuf.length}`);
  // Check PNG header
  assert.strictEqual(certBuf[0], 0x89);
  assert.strictEqual(certBuf[1], 0x50); // 'P'
  assert.strictEqual(certBuf[2], 0x4e); // 'N'
  assert.strictEqual(certBuf[3], 0x47); // 'G'
  console.log('   ✅ Marriage Certificate generated successfully (' + certBuf.length + ' bytes)');

  // 2. Ultrasound Card Generation
  console.log('2. Testing Ultrasound Card Generator...');
  const uziBuf = await generateUltrasoundCard({
    weeks: 6,
    heartbeat: 154,
    genderText: 'Девочка 👧',
    motherNick: 'Celestiana',
    fatherNick: 'Abigail',
    leftHours: 36
  });
  assert(Buffer.isBuffer(uziBuf), 'Must return a Buffer');
  assert(uziBuf.length > 25000, `Ultrasound buffer must be >25KB, got: ${uziBuf.length}`);
  assert.strictEqual(uziBuf[0], 0x89);
  console.log('   ✅ Ultrasound Card generated successfully (' + uziBuf.length + ' bytes)');

  // 3. Quote Card Generation
  console.log('3. Testing Telegram Quote Card Generator...');
  const quoteBuf = await generateQuoteCard({
    text: 'Любовь побеждает всё,\nдаже баги в коде!',
    authorName: 'Celestiana',
    timestamp: '22:00'
  });
  assert(Buffer.isBuffer(quoteBuf), 'Must return a Buffer');
  assert(quoteBuf.length > 10000, `Quote card buffer must be >10KB, got: ${quoteBuf.length}`);
  assert.strictEqual(quoteBuf[0], 0x89);
  console.log('   ✅ Quote Card generated successfully (' + quoteBuf.length + ' bytes)');

  // 4. Demotivator Generation
  console.log('4. Testing Demotivator Generator...');
  const testCanvas = createCanvas(400, 300);
  const tCtx = testCanvas.getContext('2d');
  tCtx.fillStyle = '#38bdf8';
  tCtx.fillRect(0, 0, 400, 300);
  const samplePhotoBuf = testCanvas.toBuffer('image/png');

  const demoBuf = await generateDemotivator({
    imageBuffer: samplePhotoBuf,
    title: 'ПРОГРАММИРОВАНИЕ',
    subtitle: 'Когда все тесты зеленые'
  });
  assert(Buffer.isBuffer(demoBuf), 'Must return a Buffer');
  assert(demoBuf.length > 15000, `Demotivator buffer must be >15KB, got: ${demoBuf.length}`);
  assert.strictEqual(demoBuf[0], 0x89);
  console.log('   ✅ Demotivator generated successfully (' + demoBuf.length + ' bytes)');

  // 5. Photo Filters
  console.log('5. Testing Canvas Photo Filters (.чб, .негатив, .пиксель, .зерк, .блюр)...');
  const filters = ['чб', 'негатив', 'пиксель', 'зерк', 'блюр'];
  for (const filter of filters) {
    const resBuf = await applyPhotoFilter(samplePhotoBuf, filter);
    assert(Buffer.isBuffer(resBuf), `Filter ${filter} must return a Buffer`);
    assert(resBuf.length > 500, `Filter ${filter} output must be valid PNG`);
    assert.strictEqual(resBuf[0], 0x89);
    console.log(`   ✅ Filter [${filter}] passed (${resBuf.length} bytes)`);
  }

  // 6. Game Mechanics
  console.log('6. Testing Game Mechanics (Dice, Bets, Blackjack, Tic-Tac-Toe)...');
  // Bet parsing with decimal multiplier precision
  assert.strictEqual(parseBetAmount('100', 1000), 100);
  assert.strictEqual(parseBetAmount('5к', 10000), 5000);
  assert.strictEqual(parseBetAmount('2.5к', 10000), 2500, '2.5к must be 2,500 cookies');
  assert.strictEqual(parseBetAmount('2,5к', 10000), 2500, '2,5к with comma must be 2,500 cookies');
  assert.strictEqual(parseBetAmount('0.5к', 10000), 500, '0.5к must be 500 cookies');
  assert.strictEqual(parseBetAmount('1.5м', 2000000), 1500000, '1.5м must be 1,500,000 cookies');
  assert.strictEqual(parseBetAmount('1м', 2000000), 1000000);
  assert.strictEqual(parseBetAmount('всё', 750), 750);
  assert.strictEqual(parseBetAmount('все', 750), 750);
  assert.strictEqual(parseBetAmount('-50', 1000), null);
  assert.strictEqual(parseBetAmount('0', 1000), null);
  assert.strictEqual(parseBetAmount('абвгд', 1000), null);
  assert.strictEqual(parseBetAmount('5kk', 1000), null, 'Invalid double suffix must return null');

  // Edge cases in canvas generators: whitespace nicknames, long unbroken strings, tall images
  console.log('   Testing Canvas Edge Cases (whitespace names, long URLs, tall demotivators)...');
  const certWhitespace = await generateMarriageCertificate({
    partner1Nick: '   ',
    partner2Nick: 'Abigail'
  });
  assert(Buffer.isBuffer(certWhitespace));

  const quoteWhitespace = await generateQuoteCard({
    text: 'https://example.com/very/long/unbroken/url/path/to/resource?param1=abcdefghijklmnopqrstuvwxyz&param2=1234567890',
    authorName: '   '
  });
  assert(Buffer.isBuffer(quoteWhitespace));

  // Tall demotivator image (height >> width)
  const tallCanvas = createCanvas(100, 800);
  const tallCtx = tallCanvas.getContext('2d');
  tallCtx.fillStyle = '#ff0055';
  tallCtx.fillRect(0, 0, 100, 800);
  const tallBuf = tallCanvas.toBuffer('image/png');
  const demoTall = await generateDemotivator({ imageBuffer: tallBuf, title: 'ВЫСОКОЕ ФОТО' });
  assert(Buffer.isBuffer(demoTall));

  // Blackjack deck and score
  const deck = createDeck();
  assert.strictEqual(deck.length, 52, 'Deck must contain 52 cards');

  // Hard score
  assert.strictEqual(calculateHandScore([{ score: 10, value: '10' }, { score: 9, value: '9' }]), 19);
  // Natural 21
  assert.strictEqual(calculateHandScore([{ score: 11, value: 'A' }, { score: 10, value: 'K' }]), 21);
  // Ace reduction: A + A + 9 = 21 (11 + 1 + 9)
  assert.strictEqual(calculateHandScore([{ score: 11, value: 'A' }, { score: 11, value: 'A' }, { score: 9, value: '9' }]), 21);
  // Triple Ace + 8 = 21 (1 + 1 + 11 + 8)
  assert.strictEqual(calculateHandScore([{ score: 11, value: 'A' }, { score: 11, value: 'A' }, { score: 11, value: 'A' }, { score: 8, value: '8' }]), 21);
  // Bust with Ace: A + 9 + 8 + 5 = 23 (1 + 9 + 8 + 5)
  assert.strictEqual(calculateHandScore([{ score: 11, value: 'A' }, { score: 9, value: '9' }, { score: 8, value: '8' }, { score: 5, value: '5' }]), 23);

  // Tic-Tac-Toe
  assert.strictEqual(checkTicTacToeWinner(['X', 'X', 'X', null, null, null, null, null, null]), 'X');
  assert.strictEqual(checkTicTacToeWinner(['O', null, null, 'O', null, null, 'O', null, null]), 'O');
  assert.strictEqual(checkTicTacToeWinner(['X', null, null, null, 'X', null, null, null, 'X']), 'X');
  assert.strictEqual(checkTicTacToeWinner(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), 'draw');
  assert.strictEqual(checkTicTacToeWinner(['X', 'O', null, null, null, null, null, null, null]), null);

  // Tic-Tac-Toe callback action regex matching test
  const tttActionRegex = /^ttt_m_([0-9a-zA-Z-]+)_(\d+)$/;
  const sampleGameId = '123456-789012-1729800000000';
  const sampleCb = `ttt_m_${sampleGameId}_4`;
  assert(tttActionRegex.test(sampleCb), 'tttActionRegex must match hyphenated gameId callback');
  const matchRes = sampleCb.match(tttActionRegex);
  assert.strictEqual(matchRes[1], sampleGameId);
  assert.strictEqual(matchRes[2], '4');

  const tttNoopRegex = /^ttt_noop(?:_.*)?$/;
  assert(tttNoopRegex.test(`ttt_noop_${sampleGameId}`), 'tttNoopRegex must match noop callbacks');

  const tttKb = getTicTacToeKeyboard(sampleGameId, Array(9).fill(null), false);
  assert(tttKb?.reply_markup?.inline_keyboard?.length === 3, 'Must have 3 rows');
  assert(tttKb?.reply_markup?.inline_keyboard[0]?.length === 3, 'Must have 3 cols');
  console.log('   ✅ All game algorithms & callback patterns verified');

  // 7. Entertainment & Utilities
  console.log('7. Testing Entertainment & Utilities (Horoscope, Magic Ball, Infa, Help)...');
  const signs = Object.keys(ZODIAC_SIGNS);
  assert.strictEqual(signs.length, 12, 'Must have 12 zodiac signs');
  for (const s of signs) {
    const h = getDailyHoroscope(s);
    assert(h.name && h.phrase && h.love && h.luck && h.luckyNum && h.compatibleSign);
  }

  const ballAnswer = getMagicBallAnswer();
  assert(typeof ballAnswer === 'string' && ballAnswer.length > 0);

  const infa = getProbability('тест');
  assert(infa.percent >= 0 && infa.percent <= 100);
  assert(infa.comment && infa.comment.length > 0);

  const helpMain = getHelpMainMenu();
  assert(helpMain.text.includes('GRIZZLY BOT'));
  assert(helpMain.keyboard?.reply_markup?.inline_keyboard?.length >= 4);

  const cats = ['relations', 'games', 'economy', 'photo', 'admin', 'fun'];
  for (const c of cats) {
    const catContent = getHelpCategoryContent(c);
    assert(catContent.text.length > 20, `Category ${c} content must be non-empty`);
    assert(catContent.keyboard?.reply_markup?.inline_keyboard?.length > 0, `Category ${c} must have back button`);
  }
  console.log('   ✅ All entertainment & help menus verified');

  // 8. Command Patterns verification in index.js
  console.log('8. Verifying index.js integration and command patterns...');
  const indexSource = fs.readFileSync('index.js', 'utf8');

  const requiredPatterns = [
    'generateMarriageCertificate',
    'generateUltrasoundCard',
    'generateQuoteCard',
    'generateDemotivator',
    'applyPhotoFilter',
    'handleDemotivator',
    'handlePhotoFilter',
    "bot.on('photo'",
    'ttt_noop',
    'ttt_m_',
    'activeBlackjacks',
    'activeTicTacToe',
    'completeMarriageAcceptance',
    'демотиватор|дем',
    'чб|негатив|пиксель|зерк|зеркало|блюр',
    'кости',
    'монетка',
    'блэкджек|бк',
    'кн',
    'гороскоп',
    'шар',
    'инфа',
    'выбери',
    'помощь|help',
    'help_cat_'
  ];

  for (const pat of requiredPatterns) {
    assert(indexSource.includes(pat), `index.js must include pattern: ${pat}`);
  }
  console.log('   ✅ All required patterns confirmed in index.js');

  console.log('\n>>> 🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
