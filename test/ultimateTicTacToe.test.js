'use strict';

const assert = require('assert');
const {
  UltimateTicTacToeGame,
  renderGlobalGrid,
  renderGameMessage,
  buildGameKeyboard,
  buildChallengeMessage,
  buildChallengeKeyboard,
  escapeHtml
} = require('../src/games/ultimateTicTacToe');

async function runTests() {
  console.log('--- Starting Ultimate Tic-Tac-Toe Unit Tests ---');

  const p1 = { id: 101, name: 'Alice <Tester>', username: 'alice' };
  const p2 = { id: 202, name: 'Bob & Co', username: 'bob' };

  // 1. Initialization Test
  {
    console.log('[Test 1] Initialization');
    const game = new UltimateTicTacToeGame('test1', p1, p2, 999);
    assert.strictEqual(game.currentTurn, 'X');
    assert.strictEqual(game.activeSector, null, 'First move must be free choice');
    assert.strictEqual(game.winner, null);
    assert.strictEqual(game.cells.length, 9);
    assert.strictEqual(game.sectors.length, 9);
    game.cells.forEach(sec => {
      assert.strictEqual(sec.length, 9);
      assert.ok(sec.every(c => c === null));
    });
    assert.ok(game.sectors.every(s => s === null));
    console.log('✓ Passed');
  }

  // 2. Normal Move & Next Sector Direction
  {
    console.log('[Test 2] Normal Move & Sector Direction');
    const game = new UltimateTicTacToeGame('test2', p1, p2, 999);
    // Player X plays in Sector 4 (Center), Cell 2 (Top-Right)
    const res1 = game.makeMove(4, 2, 'X');
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.gameOver, false);
    assert.strictEqual(game.cells[4][2], 'X');
    assert.strictEqual(game.currentTurn, 'O');
    assert.strictEqual(game.activeSector, 2, 'Next active sector must be cell index 2');

    // Player O plays in Sector 2, Cell 7 (Bottom-Center)
    const res2 = game.makeMove(2, 7, 'O');
    assert.strictEqual(res2.valid, true);
    assert.strictEqual(game.cells[2][7], 'O');
    assert.strictEqual(game.currentTurn, 'X');
    assert.strictEqual(game.activeSector, 7);
    console.log('✓ Passed');
  }

  // 3. Move Validation & Rejections
  {
    console.log('[Test 3] Move Validation & Illegal Moves');
    const game = new UltimateTicTacToeGame('test3', p1, p2, 999);
    game.makeMove(4, 2, 'X'); // activeSector is now 2, turn is 'O'

    // Wrong player
    const resWrongPlayer = game.makeMove(2, 0, 'X');
    assert.strictEqual(resWrongPlayer.valid, false);
    assert.ok(resWrongPlayer.reason.includes('Сейчас не ваш ход'));

    // Wrong sector
    const resWrongSector = game.makeMove(5, 0, 'O');
    assert.strictEqual(resWrongSector.valid, false);
    assert.ok(resWrongSector.reason.includes('Вы должны ходить в секторе № 3'));

    // Playing on occupied cell
    game.cells[2][0] = 'X';
    const resOccupied = game.makeMove(2, 0, 'O');
    assert.strictEqual(resOccupied.valid, false);
    assert.ok(resOccupied.reason.includes('уже занята'));

    // Out of bounds coordinates
    assert.strictEqual(game.makeMove(-1, 0, 'O').valid, false);
    assert.strictEqual(game.makeMove(2, 99, 'O').valid, false);
    console.log('✓ Passed');
  }

  // 4. Sector Win Detection (Rows, Cols, Diagonals)
  {
    console.log('[Test 4] Sector Win Detection');
    // Row win: 0, 1, 2
    assert.strictEqual(UltimateTicTacToeGame.checkSectorWinner(['X', 'X', 'X', null, null, null, null, null, null]), 'X');
    // Col win: 1, 4, 7
    assert.strictEqual(UltimateTicTacToeGame.checkSectorWinner([null, 'O', null, null, 'O', null, null, 'O', null]), 'O');
    // Diag win: 0, 4, 8
    assert.strictEqual(UltimateTicTacToeGame.checkSectorWinner(['X', null, null, null, 'X', null, null, null, 'X']), 'X');
    // Diag win: 2, 4, 6
    assert.strictEqual(UltimateTicTacToeGame.checkSectorWinner([null, null, 'O', null, 'O', null, 'O', null, null]), 'O');
    // Sector Draw: 9 cells full, no 3 in a row
    const drawBoard = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X'
    ];
    assert.strictEqual(UltimateTicTacToeGame.checkSectorWinner(drawBoard), 'D');
    console.log('✓ Passed');
  }

  // 5. Redirection to Won Sector Triggers Free Choice
  {
    console.log('[Test 5] Redirection to Won Sector -> Free Choice');
    const game = new UltimateTicTacToeGame('test5', p1, p2, 999);
    // Mark sector 0 as won by X
    game.sectors[0] = 'X';

    // Player X plays in sector 4, cell 0 (pointing to sector 0)
    const res = game.makeMove(4, 0, 'X');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(game.currentTurn, 'O');
    assert.strictEqual(game.activeSector, null, 'Target sector is won, must grant free choice');
    assert.strictEqual(game.viewMode, 'map');

    // Player O can now play in ANY unfinished sector, e.g. Sector 8
    const resO = game.makeMove(8, 5, 'O');
    assert.strictEqual(resO.valid, true);
    assert.strictEqual(game.cells[8][5], 'O');
    assert.strictEqual(game.activeSector, 5);
    console.log('✓ Passed');
  }

  // 6. Redirection to Full Sector (Draw) Triggers Free Choice
  {
    console.log('[Test 6] Redirection to Full Sector -> Free Choice');
    const game = new UltimateTicTacToeGame('test6', p1, p2, 999);
    // Mark sector 3 as 'D' (draw)
    game.sectors[3] = 'D';

    // Player X plays in sector 4, cell 3 (pointing to sector 3)
    const res = game.makeMove(4, 3, 'X');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(game.activeSector, null, 'Target sector is full/draw, must grant free choice');
    console.log('✓ Passed');
  }

  // 7. Global Win Detection (3 sectors in a row)
  {
    console.log('[Test 7] Global Win Detection');
    // Horizontal win across sectors 0, 1, 2
    const sectorsRow = ['X', 'X', 'X', null, null, null, null, null, null];
    assert.strictEqual(UltimateTicTacToeGame.checkGlobalWinner(sectorsRow), 'X');

    // Vertical win across sectors 1, 4, 7
    const sectorsCol = [null, 'O', null, null, 'O', null, null, 'O', null];
    assert.strictEqual(UltimateTicTacToeGame.checkGlobalWinner(sectorsCol), 'O');

    // Diagonal win across sectors 2, 4, 6
    const sectorsDiag = [null, null, 'X', null, 'X', null, 'X', null, null];
    assert.strictEqual(UltimateTicTacToeGame.checkGlobalWinner(sectorsDiag), 'X');

    // Draw when all sectors resolved without 3 in a row
    const sectorsDraw = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'D'
    ];
    assert.strictEqual(UltimateTicTacToeGame.checkGlobalWinner(sectorsDraw), 'D');
    console.log('✓ Passed');
  }

  // 8. Winning the Game via Moves
  {
    console.log('[Test 8] Complete Game Win via makeMove');
    const game = new UltimateTicTacToeGame('test8', p1, p2, 999);
    // Pre-win sectors 0 and 1 for X
    game.sectors[0] = 'X';
    game.sectors[1] = 'X';
    // Setup sector 2 with 2 'X's on cells 0, 1
    game.cells[2][0] = 'X';
    game.cells[2][1] = 'X';

    // Force turn to X in sector 2
    game.activeSector = 2;
    game.currentTurn = 'X';

    // X completes sector 2 (cell 2)
    const res = game.makeMove(2, 2, 'X');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.gameOver, true);
    assert.strictEqual(res.winner, 'X');
    assert.strictEqual(game.winner, 'X');
    assert.strictEqual(game.sectors[2], 'X');

    // Any subsequent move must be rejected
    const postMove = game.makeMove(5, 5, 'O');
    assert.strictEqual(postMove.valid, false);
    assert.ok(postMove.reason.includes('Игра уже завершена'));
    console.log('✓ Passed');
  }

  // 9. HTML Escaping & UI Rendering
  {
    console.log('[Test 9] HTML Escaping & Message Formatting');
    assert.strictEqual(escapeHtml('<script>alert("xss")&'), '&lt;script&gt;alert(&quot;xss&quot;)&amp;');

    const game = new UltimateTicTacToeGame('test9', p1, p2, 999);
    const msg = renderGameMessage(game);
    // Must contain escaped nicknames
    assert.ok(msg.includes('Alice &lt;Tester&gt;'));
    assert.ok(msg.includes('Bob &amp; Co'));
    assert.ok(msg.includes('Глобальное поле 3х3:'));
    assert.ok(msg.includes('┌───┬───┬───┐'));

    // Keyboard check (Sector mode)
    game.viewMode = 'sector';
    const kbSector = buildGameKeyboard(game);
    assert.strictEqual(kbSector.length, 4); // 3 rows of cells + 1 nav row
    assert.strictEqual(kbSector[0].length, 3);
    assert.strictEqual(kbSector[3].length, 2); // 'Вся карта' + 'Сдаться'

    // Keyboard check (Map mode)
    game.viewMode = 'map';
    const kbMap = buildGameKeyboard(game);
    assert.strictEqual(kbMap.length, 4);
    assert.strictEqual(kbMap[0].length, 3);
    assert.strictEqual(kbMap[3].length, 2); // 'Текущий сектор' + 'Сдаться'

    // Challenge message check
    const chalMsg = buildChallengeMessage(p1, p2);
    assert.ok(chalMsg.includes('Alice &lt;Tester&gt;'));
    assert.ok(chalMsg.includes('Bob &amp; Co'));
    assert.ok(chalMsg.includes('2 минуты'));

    const chalKb = buildChallengeKeyboard('chal123');
    assert.strictEqual(chalKb.length, 1);
    assert.strictEqual(chalKb[0].length, 2);
    console.log('✓ Passed');
  }

  // 10. All 8 Global Win Lines Test
  {
    console.log('[Test 10] All 8 Global Win Lines');
    const allLines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diags
    ];

    allLines.forEach((line, idx) => {
      const sectorsX = Array(9).fill(null);
      line.forEach(pos => { sectorsX[pos] = 'X'; });
      assert.strictEqual(UltimateTicTacToeGame.checkGlobalWinner(sectorsX), 'X', `Line ${idx} should win for X`);

      const sectorsO = Array(9).fill(null);
      line.forEach(pos => { sectorsO[pos] = 'O'; });
      assert.strictEqual(UltimateTicTacToeGame.checkGlobalWinner(sectorsO), 'O', `Line ${idx} should win for O`);
    });
    console.log('✓ Passed');
  }

  // 11. Challenge Lifecycle & Authorization Tests
  {
    console.log('[Test 11] Challenge Lifecycle & Authorization');
    const {
      challenges,
      activeGames,
      userActiveGame,
      userPendingChallenge,
      acceptChallenge,
      declineChallenge,
      handleSurrender
    } = require('../src/games/ultimateTicTacToe');

    // Create a mock challenge
    const cId = 'mock_chal_1';
    const mockChal = {
      id: cId,
      sender: p1,
      target: p2,
      chatId: 888,
      messageId: 777,
      timer: null
    };
    challenges.set(cId, mockChal);
    userPendingChallenge.set(p1.id, cId);
    userPendingChallenge.set(p2.id, cId);

    // Mock bot & ctx
    const mockBot = { telegram: { editMessageText: async () => {} } };
    const mockCtx = {
      callbackQuery: true,
      editMessageText: async () => {},
      answerCbQuery: async () => {}
    };

    // Third party tries to accept -> must be rejected
    const thirdPartyId = 99999;
    const resThird = await acceptChallenge(mockBot, mockCtx, cId, thirdPartyId);
    assert.strictEqual(resThird.ok, false);
    assert.strictEqual(resThird.isUnauthorized, true);

    // Target accepts -> must succeed and create activeGame
    const resTarget = await acceptChallenge(mockBot, mockCtx, cId, p2.id);
    assert.strictEqual(resTarget.ok, true);
    assert.ok(resTarget.game);
    assert.strictEqual(resTarget.game.playerX.id, p1.id);
    assert.strictEqual(resTarget.game.playerO.id, p2.id);
    assert.strictEqual(userActiveGame.get(p1.id), resTarget.game.id);
    assert.strictEqual(userActiveGame.get(p2.id), resTarget.game.id);

    // Third party tries to surrender -> rejected
    const surThird = await handleSurrender(mockBot, mockCtx, resTarget.game.id, thirdPartyId);
    assert.strictEqual(surThird.ok, false);
    assert.strictEqual(surThird.isUnauthorized, true);

    // Player X surrenders -> Player O wins
    const surP1 = await handleSurrender(mockBot, mockCtx, resTarget.game.id, p1.id);
    assert.strictEqual(surP1.ok, true);
    assert.strictEqual(resTarget.game.winner, 'O');
    assert.strictEqual(resTarget.game.surrenderedBy, p1.id);
    // Active game must be cleaned up
    assert.strictEqual(userActiveGame.has(p1.id), false);
    assert.strictEqual(userActiveGame.has(p2.id), false);

    console.log('✓ Passed');
  }

  // 12. Decline Challenge Authorization
  {
    console.log('[Test 12] Decline Challenge Authorization');
    const {
      challenges,
      userPendingChallenge,
      declineChallenge
    } = require('../src/games/ultimateTicTacToe');

    const cId2 = 'mock_chal_2';
    challenges.set(cId2, {
      id: cId2,
      sender: p1,
      target: p2,
      chatId: 888,
      messageId: 777,
      timer: null
    });
    userPendingChallenge.set(p1.id, cId2);
    userPendingChallenge.set(p2.id, cId2);

    const mockBot = { telegram: { editMessageText: async () => {} } };
    const mockCtx = {
      callbackQuery: true,
      editMessageText: async () => {},
      answerCbQuery: async () => {}
    };

    // Third party declines -> rejected
    const decThird = await declineChallenge(mockBot, mockCtx, cId2, 99999);
    assert.strictEqual(decThird.ok, false);
    assert.strictEqual(decThird.isUnauthorized, true);

    // Target declines -> succeeds
    const decTarget = await declineChallenge(mockBot, mockCtx, cId2, p2.id);
    assert.strictEqual(decTarget.ok, true);
    assert.strictEqual(challenges.has(cId2), false);
    assert.strictEqual(userPendingChallenge.has(p1.id), false);
    assert.strictEqual(userPendingChallenge.has(p2.id), false);

    console.log('✓ Passed');
  }

  console.log('=== All 12 Unit Test Suites Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('Unit tests failed:', err);
  process.exit(1);
});
