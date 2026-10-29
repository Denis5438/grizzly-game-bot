'use strict';

const assert = require('assert');
const {
  TicTacToeGame,
  WIN_LINES,
  NUM_EMOJIS,
  escapeHtml,
  renderRichButtons,
  renderGameMessage,
  buildGameKeyboard,
  buildChallengeMessage,
  buildChallengeKeyboard,
  challenges,
  activeGames,
  finishedGames,
  userActiveGame,
  userPendingChallenge,
  messageToGame,
  cleanUpGame,
  cleanUpChallenge,
  acceptChallenge,
  declineChallenge,
  handleSurrender,
  handleTurnTimeout,
  handleChallengeTimeout
} = require('../src/games/ticTacToe');

async function runTests() {
  console.log('--- Starting Classic 3x3 Tic-Tac-Toe Unit Tests ---');

  const p1 = { id: 101, name: 'Alice <Pro>', username: 'alice' };
  const p2 = { id: 202, name: 'Bob & Co', username: 'bob' };

  // 1. Initialization Test
  {
    console.log('[Test 1] Initialization');
    const game = new TicTacToeGame('game1', p1, p2, 999);
    assert.strictEqual(game.id, 'game1');
    assert.strictEqual(game.currentTurn, 'X');
    assert.strictEqual(game.winner, null);
    assert.strictEqual(game.board.length, 9);
    assert.ok(game.board.every(cell => cell === null));
    assert.strictEqual(game.cells.length, 9); // backward-compat getter
    assert.strictEqual(game.movesCount, 0);
    console.log('✓ Passed');
  }

  // 2. Normal Moves & Turn Switching
  {
    console.log('[Test 2] Normal Moves & Turn Switching');
    const game = new TicTacToeGame('game2', p1, p2, 999);

    const m1 = game.makeMove(4, 'X');
    assert.strictEqual(m1.valid, true);
    assert.strictEqual(m1.gameOver, false);
    assert.strictEqual(m1.nextTurn, 'O');
    assert.strictEqual(game.board[4], 'X');
    assert.strictEqual(game.currentTurn, 'O');
    assert.strictEqual(game.movesCount, 1);

    const m2 = game.makeMove(0, 'O');
    assert.strictEqual(m2.valid, true);
    assert.strictEqual(m2.gameOver, false);
    assert.strictEqual(m2.nextTurn, 'X');
    assert.strictEqual(game.board[0], 'O');
    assert.strictEqual(game.currentTurn, 'X');
    assert.strictEqual(game.movesCount, 2);
    console.log('✓ Passed');
  }

  // 3. Move Validation & Rejections
  {
    console.log('[Test 3] Move Validation & Illegal Moves');
    const game = new TicTacToeGame('game3', p1, p2, 999);
    game.makeMove(4, 'X'); // Turn is now 'O'

    // Out of turn
    const mWrongTurn = game.makeMove(0, 'X');
    assert.strictEqual(mWrongTurn.valid, false);
    assert.ok(mWrongTurn.reason.includes('Сейчас не ваш ход'));

    // Occupied cell
    const mOccupied = game.makeMove(4, 'O');
    assert.strictEqual(mOccupied.valid, false);
    assert.ok(mOccupied.reason.includes('уже занята'));

    // Out of bounds
    assert.strictEqual(game.makeMove(-1, 'O').valid, false);
    assert.strictEqual(game.makeMove(9, 'O').valid, false);
    assert.strictEqual(game.makeMove(NaN, 'O').valid, false);
    console.log('✓ Passed');
  }

  // 4. Win Detection for all 8 lines (both X and O)
  {
    console.log('[Test 4] Win Detection for all 8 lines');
    assert.strictEqual(WIN_LINES.length, 8);

    WIN_LINES.forEach(([a, b, c], idx) => {
      // Test X win
      const boardX = Array(9).fill(null);
      boardX[a] = 'X';
      boardX[b] = 'X';
      boardX[c] = 'X';
      assert.strictEqual(TicTacToeGame.checkWinner(boardX), 'X', `Line ${idx} must win for X`);
      assert.deepStrictEqual(TicTacToeGame.getWinningLine(boardX), [a, b, c]);

      // Test O win
      const boardO = Array(9).fill(null);
      boardO[a] = 'O';
      boardO[b] = 'O';
      boardO[c] = 'O';
      assert.strictEqual(TicTacToeGame.checkWinner(boardO), 'O', `Line ${idx} must win for O`);
      assert.deepStrictEqual(TicTacToeGame.getWinningLine(boardO), [a, b, c]);
    });
    console.log('✓ Passed');
  }

  // 5. Draw Detection
  {
    console.log('[Test 5] Draw Detection');
    const drawBoard = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X'
    ];
    assert.strictEqual(TicTacToeGame.checkWinner(drawBoard), 'D');
    assert.strictEqual(TicTacToeGame.getWinningLine(drawBoard), null);
    console.log('✓ Passed');
  }

  // 6. Complete Game Win via makeMove
  {
    console.log('[Test 6] Complete Game Win via makeMove');
    const game = new TicTacToeGame('game6', p1, p2, 999);
    // X: 0, O: 3, X: 1, O: 4, X: 2 -> X wins on top row!
    game.makeMove(0, 'X');
    game.makeMove(3, 'O');
    game.makeMove(1, 'X');
    game.makeMove(4, 'O');
    const winMove = game.makeMove(2, 'X');

    assert.strictEqual(winMove.valid, true);
    assert.strictEqual(winMove.gameOver, true);
    assert.strictEqual(winMove.winner, 'X');
    assert.deepStrictEqual(winMove.line, [0, 1, 2]);
    assert.strictEqual(game.winner, 'X');

    // Moves rejected after game over
    const afterGameOver = game.makeMove(5, 'O');
    assert.strictEqual(afterGameOver.valid, false);
    assert.ok(afterGameOver.reason.includes('уже завершена'));
    console.log('✓ Passed');
  }

  // 7. Rich Message Buttons HTML Tags & Styles
  {
    console.log('[Test 7] Rich Message Buttons HTML Tags & Styles');
    const game = new TicTacToeGame('game7', p1, p2, 999);
    game.board[0] = 'X';
    game.board[2] = 'O';

    const htmlButtons = renderRichButtons(game);
    // 4 rows: 3 board rows + 1 surrender row
    const rowMatches = htmlButtons.match(/<tg-button-row align="center">/g);
    assert.strictEqual(rowMatches.length, 4);

    // Cell 0 is X -> danger style
    assert.ok(htmlButtons.includes('<tg-button type="callback_data" style="danger" data="ttt_m_0">❌</tg-button>'));
    // Cell 1 is empty -> primary style with emoji
    assert.ok(htmlButtons.includes('<tg-button type="callback_data" style="primary" data="ttt_m_1">2️⃣</tg-button>'));
    // Cell 2 is O -> success style
    assert.ok(htmlButtons.includes('<tg-button type="callback_data" style="success" data="ttt_m_2">⭕</tg-button>'));
    // Surrender button -> danger style
    assert.ok(htmlButtons.includes('<tg-button type="callback_data" style="danger" data="ttt_sur">🏳️ Сдаться</tg-button>'));

    // When game has winner, surrender row must be removed
    game.winner = 'X';
    const finishedHtml = renderRichButtons(game);
    const finishedRows = finishedHtml.match(/<tg-button-row align="center">/g);
    assert.strictEqual(finishedRows.length, 3);
    assert.ok(!finishedHtml.includes('🏳️ Сдаться'));
    console.log('✓ Passed');
  }

  // 8. Game Message Formatting & HTML Escaping
  {
    console.log('[Test 8] Game Message Formatting & HTML Escaping');
    assert.strictEqual(escapeHtml('<script>alert("x")&'), '&lt;script&gt;alert(&quot;x&quot;)&amp;');

    const game = new TicTacToeGame('game8', p1, p2, 999);
    const msg = renderGameMessage(game);

    // Nicknames must be escaped
    assert.ok(msg.includes('Alice &lt;Pro&gt;'));
    assert.ok(msg.includes('Крестики-Нолики 3×3'));
    assert.ok(msg.includes('Ход:'));
    assert.ok(msg.includes('Время на ход: 90 сек'));
    console.log('✓ Passed');
  }

  // 9. Telegraf Inline Keyboard Fallback
  {
    console.log('[Test 9] Telegraf Inline Keyboard Fallback');
    const game = new TicTacToeGame('game9', p1, p2, 999);
    game.board[4] = 'X';
    game.board[8] = 'O';

    const kb = buildGameKeyboard(game);
    // 3 rows of cells + 1 row for surrender = 4 rows
    assert.strictEqual(kb.length, 4);
    assert.strictEqual(kb[0].length, 3);
    assert.strictEqual(kb[1].length, 3);
    assert.strictEqual(kb[2].length, 3);
    assert.strictEqual(kb[3].length, 1);

    assert.strictEqual(kb[1][1].text, '❌');
    assert.strictEqual(kb[1][1].callback_data, 'ttt_m_4');
    assert.strictEqual(kb[2][2].text, '⭕');
    assert.strictEqual(kb[2][2].callback_data, 'ttt_m_8');
    assert.strictEqual(kb[0][0].text, '1️⃣');
    assert.strictEqual(kb[0][0].callback_data, 'ttt_m_0');
    assert.strictEqual(kb[3][0].text, '🏳️ Сдаться');
    assert.strictEqual(kb[3][0].callback_data, 'ttt_sur');

    // Finished game has no surrender button in fallback keyboard
    game.winner = 'O';
    const finishedKb = buildGameKeyboard(game);
    assert.strictEqual(finishedKb.length, 3);
    console.log('✓ Passed');
  }

  // 10. Challenge Message & Fallback Keyboard
  {
    console.log('[Test 10] Challenge Message & Fallback Keyboard');
    const chalMsg = buildChallengeMessage(p1, p2, 'chal99');
    assert.ok(chalMsg.includes('Alice &lt;Pro&gt;'));
    assert.ok(chalMsg.includes('@bob'));
    assert.ok(chalMsg.includes('2 минуты'));

    const chalKb = buildChallengeKeyboard('chal99');
    assert.strictEqual(chalKb.length, 1);
    assert.strictEqual(chalKb[0].length, 2);
    assert.strictEqual(chalKb[0][0].text, '⚔️ Принять вызов');
    assert.strictEqual(chalKb[0][0].callback_data, 'ttt_acc_chal99');
    assert.strictEqual(chalKb[0][1].text, '❌ Отклонить');
    assert.strictEqual(chalKb[0][1].callback_data, 'ttt_dec_chal99');
    console.log('✓ Passed');
  }

  // 11. Challenge Lifecycle, Authorization & Cleanup
  {
    console.log('[Test 11] Challenge Lifecycle, Authorization & Cleanup');
    const chalId = 'test_chal_1';
    const challenge = {
      id: chalId,
      sender: p1,
      target: p2,
      chatId: 999,
      messageId: 505,
      createdAt: Date.now(),
      timer: null
    };

    challenges.set(chalId, challenge);
    userPendingChallenge.set(p1.id, chalId);
    userPendingChallenge.set(p2.id, chalId);

    // Unauthorized user cannot accept
    const mockCtxUnauthorized = {
      from: { id: 9999 },
      answerCbQuery: async () => {}
    };
    const resUnauth = await acceptChallenge(null, mockCtxUnauthorized, chalId, 9999);
    assert.strictEqual(resUnauth.ok, false);
    assert.ok(resUnauth.message.includes('не вам'));

    // Sender cannot accept own challenge
    const resSender = await acceptChallenge(null, { from: { id: p1.id } }, chalId, p1.id);
    assert.strictEqual(resSender.ok, false);

    // Target accepts
    let editedText = '';
    const mockCtxTarget = {
      from: { id: p2.id },
      callbackQuery: { message: { message_id: 505 } },
      editMessageText: async (text) => { editedText = text; }
    };
    const resTarget = await acceptChallenge(null, mockCtxTarget, chalId, p2.id);
    assert.strictEqual(resTarget.ok, true);
    assert.ok(resTarget.game);
    assert.ok(editedText.includes('Крестики-Нолики 3×3'));

    // Pending challenge cleaned up
    assert.strictEqual(challenges.has(chalId), false);
    assert.strictEqual(userPendingChallenge.has(p1.id), false);
    assert.strictEqual(userPendingChallenge.has(p2.id), false);

    // Active game registered
    const activeGameId = userActiveGame.get(p1.id);
    assert.ok(activeGameId);
    assert.strictEqual(userActiveGame.get(p2.id), activeGameId);

    // Clean up
    cleanUpGame(activeGameId);
    assert.strictEqual(userActiveGame.has(p1.id), false);
    assert.strictEqual(userActiveGame.has(p2.id), false);
    console.log('✓ Passed');
  }

  // 12. Surrender Flow
  {
    console.log('[Test 12] Surrender Flow');
    const game = new TicTacToeGame('game12', p1, p2, 999, 606);
    activeGames.set(game.id, game);
    userActiveGame.set(p1.id, game.id);
    userActiveGame.set(p2.id, game.id);

    let surrenderText = '';
    const mockCtx = {
      from: { id: p1.id },
      callbackQuery: true,
      editMessageText: async (text) => { surrenderText = text; }
    };

    const resSurrender = await handleSurrender(null, mockCtx, game.id, p1.id);
    assert.strictEqual(resSurrender.ok, true);
    assert.strictEqual(game.winner, 'O');
    assert.strictEqual(game.surrenderedBy, 'X');
    assert.ok(surrenderText.includes('сдался'));
    assert.ok(surrenderText.includes('ПОБЕДА'));
    assert.strictEqual(userActiveGame.has(p1.id), false);
    assert.strictEqual(userActiveGame.has(p2.id), false);
    console.log('✓ Passed');
  }

  // 13. Turn Timeout Flow
  {
    console.log('[Test 13] Turn Timeout Flow');
    const game = new TicTacToeGame('game13', p1, p2, 999, 707);
    activeGames.set(game.id, game);
    userActiveGame.set(p1.id, game.id);
    userActiveGame.set(p2.id, game.id);

    let timeoutMsg = '';
    const mockBot = {
      telegram: {
        editMessageText: async (chatId, messageId, inlineId, text) => {
          timeoutMsg = text;
        }
      }
    };

    // Current turn is X. Turn timeout occurs -> O wins!
    handleTurnTimeout(mockBot, game.id);
    assert.strictEqual(game.winner, 'O');
    assert.strictEqual(game.timedOutBy, 'X');
    assert.ok(timeoutMsg.includes('Время на ход истекло'));
    assert.ok(timeoutMsg.includes('ПОБЕДА'));
    assert.strictEqual(userActiveGame.has(p1.id), false);
    assert.strictEqual(userActiveGame.has(p2.id), false);
    console.log('✓ Passed');
  }

  // 14. Decline Challenge Flow
  {
    console.log('[Test 14] Decline Challenge Flow');
    const chalId = 'test_chal_dec';
    const challenge = {
      id: chalId,
      sender: p1,
      target: p2,
      chatId: 999,
      messageId: 808,
      createdAt: Date.now(),
      timer: null
    };

    challenges.set(chalId, challenge);
    userPendingChallenge.set(p1.id, chalId);
    userPendingChallenge.set(p2.id, chalId);

    let declinedMsg = '';
    const mockCtx = {
      from: { id: p2.id },
      callbackQuery: true,
      editMessageText: async (text) => { declinedMsg = text; }
    };

    const resDec = await declineChallenge(null, mockCtx, chalId, p2.id);
    assert.strictEqual(resDec.ok, true);
    assert.ok(declinedMsg.includes('Вызов отклонён'));
    assert.strictEqual(challenges.has(chalId), false);
    assert.strictEqual(userPendingChallenge.has(p1.id), false);
    assert.strictEqual(userPendingChallenge.has(p2.id), false);
    console.log('✓ Passed');
  }

  // 15. Finished Games History & Message Mapping Retention
  {
    console.log('[Test 15] Finished Games History & Message Mapping Retention');
    const game = new TicTacToeGame('game15', p1, p2, 999, 1515);
    activeGames.set(game.id, game);
    userActiveGame.set(p1.id, game.id);
    userActiveGame.set(p2.id, game.id);
    messageToGame.set(1515, game.id);

    // End game
    game.winner = 'X';
    cleanUpGame(game.id);

    // Active stores cleared
    assert.strictEqual(activeGames.has(game.id), false);
    assert.strictEqual(userActiveGame.has(p1.id), false);
    assert.strictEqual(userActiveGame.has(p2.id), false);

    // Finished game and message mapping retained
    assert.strictEqual(finishedGames.has(game.id), true);
    assert.strictEqual(messageToGame.get(1515), game.id);
    console.log('✓ Passed');
  }

  // 16. Winning Line Highlight & Boundary Escaping
  {
    console.log('[Test 16] Winning Line Highlight & Boundary Escaping');
    assert.strictEqual(escapeHtml(0), '0');
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');

    const game = new TicTacToeGame('game16', p1, p2, 999);
    game.board[0] = 'X';
    game.board[1] = 'X';
    game.board[2] = 'X';
    game.winner = 'X';
    game.winningLine = [0, 1, 2];

    const msg = renderGameMessage(game);
    assert.ok(msg.includes('<b>Победная линия:</b> 1️⃣ 2️⃣ 3️⃣'));
    console.log('✓ Passed');
  }

  console.log('=== All 16 Unit Test Suites Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('Unit tests failed:', err);
  process.exit(1);
});
