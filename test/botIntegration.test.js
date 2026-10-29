'use strict';

const assert = require('assert');
const {
  initTicTacToe,
  challenges,
  activeGames,
  finishedGames,
  userActiveGame,
  userPendingChallenge,
  messageToGame,
  TicTacToeGame
} = require('../src/games/ticTacToe');

async function testBotIntegration() {
  console.log('--- Starting Bot Integration Tests (3x3 Tic-Tac-Toe & Rich Buttons) ---');

  const hearsHandlers = [];
  const actionHandlers = [];

  const mockBot = {
    hears: (pattern, handler) => {
      hearsHandlers.push({ pattern, handler });
    },
    action: (pattern, handler) => {
      actionHandlers.push({ pattern, handler });
    },
    telegram: {
      editMessageText: async () => {},
      sendMessage: async () => ({ message_id: 111 })
    }
  };

  const mockUser = {
    findOne: async (query) => {
      if (query.username && query.username.test('charlie')) {
        return { telegramId: 303, nickname: 'Charlie', username: 'charlie' };
      }
      if (query.telegramId === 303) {
        return { telegramId: 303, nickname: 'Charlie', username: 'charlie' };
      }
      return null;
    }
  };

  // Initialize
  initTicTacToe(mockBot, { User: mockUser });

  console.log(`Registered ${hearsHandlers.length} hears handlers and ${actionHandlers.length} action handlers.`);
  assert.ok(hearsHandlers.length >= 5);
  assert.ok(actionHandlers.length >= 4);

  function findHears(text) {
    for (const h of hearsHandlers) {
      if (h.pattern instanceof RegExp) {
        const match = text.match(h.pattern);
        if (match) return { handler: h.handler, match };
      } else if (typeof h.pattern === 'string' && h.pattern === text) {
        return { handler: h.handler, match: [text] };
      }
    }
    return null;
  }

  function findAction(data) {
    for (const a of actionHandlers) {
      if (a.pattern instanceof RegExp) {
        const match = data.match(a.pattern);
        if (match) return { handler: a.handler, match };
      } else if (typeof a.pattern === 'string' && a.pattern === data) {
        return { handler: a.handler, match: [data] };
      }
    }
    return null;
  }

  // 1. Test .кн help
  {
    console.log('[Integration 1] .кн помощь');
    const matched = findHears('.кн');
    assert.ok(matched, 'Must match .кн');
    let repliedText = '';
    await matched.handler({
      message: { text: '.кн' },
      reply: (text) => { repliedText = text; }
    });
    assert.ok(repliedText.includes('Крестики-Нолики 3×3') || repliedText.includes('Крестики-Нолики'));
    assert.ok(repliedText.includes('Правила игры:'));
    console.log('✓ Passed');
  }

  // 2. Test .кн вызов with @username
  let challengeId = null;
  {
    console.log('[Integration 2] .кн вызов @charlie (Rich buttons & inline fallback)');
    const matched = findHears('.кн вызов @charlie');
    assert.ok(matched);

    let sentMsg = null;
    const ctx = {
      from: { id: 101, first_name: 'Alice', username: 'alice' },
      chat: { id: 999 },
      message: { text: '.кн вызов @charlie' },
      state: { user: { nickname: 'Alice' } },
      reply: async (text, extra) => {
        sentMsg = { text, extra, message_id: 555 };
        return sentMsg;
      }
    };

    await matched.handler(ctx);
    assert.ok(sentMsg);
    assert.ok(sentMsg.text.includes('Вызов на битву'));
    assert.ok(sentMsg.text.includes('Charlie'));
    assert.ok(sentMsg.extra?.reply_markup?.inline_keyboard);

    challengeId = userPendingChallenge.get(101);
    assert.ok(challengeId);
    assert.strictEqual(userPendingChallenge.get(303), challengeId);
    console.log('✓ Passed');
  }

  // 3. Test Unauthorized Accept via button
  {
    console.log('[Integration 3] Unauthorized user clicks accept');
    const actionMatch = findAction(`ttt_acc_${challengeId}`);
    assert.ok(actionMatch);

    let alertMsg = '';
    const ctx = {
      from: { id: 88888 }, // random user
      match: actionMatch.match,
      answerCbQuery: async (msg, opts) => {
        alertMsg = msg;
      }
    };

    await actionMatch.handler(ctx);
    assert.ok(alertMsg.includes('не вам'));
    console.log('✓ Passed');
  }

  // 4. Test Target accepts via button
  let gameId = null;
  {
    console.log('[Integration 4] Target accepts via button');
    const actionMatch = findAction(`ttt_acc_${challengeId}`);
    assert.ok(actionMatch);

    let editedText = '';
    let editedKeyboard = null;
    const ctx = {
      from: { id: 303 }, // Charlie
      match: actionMatch.match,
      callbackQuery: { message: { message_id: 555 } },
      editMessageText: async (text, extra) => {
        editedText = text;
        editedKeyboard = extra;
      },
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    assert.ok(editedText.includes('Крестики-Нолики 3×3'));
    assert.ok(editedText.includes('Ход:'));
    assert.ok(editedKeyboard);

    gameId = userActiveGame.get(303);
    assert.ok(gameId);
    assert.strictEqual(userActiveGame.get(101), gameId);
    console.log('✓ Passed');
  }

  // 5. Test Gameplay: Non-turn player tries to move
  {
    console.log('[Integration 5] Bob/Charlie tries to move out of turn');
    // First turn is Alice (X, id: 101)
    const actionMatch = findAction(`ttt_m_4`);
    assert.ok(actionMatch);

    let alertMsg = '';
    const ctx = {
      from: { id: 303 }, // Charlie (O)
      match: actionMatch.match,
      answerCbQuery: async (msg, opts) => { alertMsg = msg; }
    };

    await actionMatch.handler(ctx);
    assert.ok(alertMsg.includes('Сейчас ход соперника'));
    console.log('✓ Passed');
  }

  // 6. Test Gameplay: Alice makes valid move in Cell 4
  {
    console.log('[Integration 6] Alice moves in Cell 4 (Center)');
    const actionMatch = findAction(`ttt_m_4`);
    assert.ok(actionMatch);

    let updatedText = '';
    let updatedKeyboard = null;
    const ctx = {
      from: { id: 101 }, // Alice (X)
      match: actionMatch.match,
      editMessageText: async (text, extra) => {
        updatedText = text;
        updatedKeyboard = extra;
      },
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    const game = activeGames.get(gameId);
    assert.strictEqual(game.board[4], 'X');
    assert.strictEqual(game.currentTurn, 'O');
    console.log('✓ Passed');
  }

  // 7. Test Gameplay: Occupied cell click rejected
  {
    console.log('[Integration 7] Charlie tries to move in already occupied Cell 4');
    const actionMatch = findAction(`ttt_m_4`);
    assert.ok(actionMatch);

    let alertMsg = '';
    const ctx = {
      from: { id: 303 }, // Charlie (O)
      match: actionMatch.match,
      answerCbQuery: async (msg, opts) => { alertMsg = msg; }
    };

    await actionMatch.handler(ctx);
    assert.ok(alertMsg.includes('уже занята'));
    console.log('✓ Passed');
  }

  // 7a. Test Spectator click rejected
  {
    console.log('[Integration 7a] Spectator click rejected');
    const actionMatch = findAction(`ttt_m_0`);
    assert.ok(actionMatch);

    let alertMsg = '';
    const ctx = {
      from: { id: 77777 }, // spectator
      match: actionMatch.match,
      answerCbQuery: async (msg, opts) => { alertMsg = msg; }
    };

    await actionMatch.handler(ctx);
    assert.ok(alertMsg.includes('не участвуете в этой игре'));
    console.log('✓ Passed');
  }

  // 7b. Test Charlie makes valid move in Cell 0
  {
    console.log('[Integration 7b] Charlie moves in Cell 0');
    const actionMatch = findAction(`ttt_m_0`);
    assert.ok(actionMatch);

    let updatedText = '';
    const ctx = {
      from: { id: 303 }, // Charlie (O)
      match: actionMatch.match,
      editMessageText: async (text) => { updatedText = text; },
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    const game = activeGames.get(gameId);
    assert.strictEqual(game.board[0], 'O');
    assert.strictEqual(game.currentTurn, 'X');
    console.log('✓ Passed');
  }

  // 8. Test Surrender
  {
    console.log('[Integration 8] Charlie surrenders');
    const actionMatch = findAction(`ttt_sur`);
    assert.ok(actionMatch);

    let surrenderText = '';
    const ctx = {
      from: { id: 303 },
      match: actionMatch.match,
      callbackQuery: true,
      editMessageText: async (text) => { surrenderText = text; },
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    assert.ok(surrenderText.includes('ПОБЕДА'));
    assert.ok(surrenderText.includes('Alice'));
    assert.strictEqual(userActiveGame.has(101), false);
    assert.strictEqual(userActiveGame.has(303), false);
    console.log('✓ Passed');
  }

  // 9. Test .кн вызов via Reply to message & text decline .кн нет
  {
    console.log('[Integration 9] .кн вызов via Reply & text decline .кн нет');
    const matched = findHears('.кн вызов');
    assert.ok(matched);

    let sentMsg = null;
    const ctx = {
      from: { id: 101, first_name: 'Alice' },
      chat: { id: 999 },
      message: {
        text: '.кн вызов',
        reply_to_message: {
          from: { id: 404, first_name: 'Dave', username: 'dave', is_bot: false }
        }
      },
      state: { user: { nickname: 'Alice' } },
      reply: async (text, extra) => {
        sentMsg = { text, extra, message_id: 666 };
        return sentMsg;
      }
    };

    await matched.handler(ctx);
    assert.ok(sentMsg);
    assert.ok(sentMsg.text.includes('Dave'));
    const replyChalId = userPendingChallenge.get(101);
    assert.ok(replyChalId);

    // Dave declines via command .кн нет
    const declineMatch = findHears('.кн нет');
    assert.ok(declineMatch);

    let declineReply = '';
    await declineMatch.handler({
      from: { id: 404 },
      message: { text: '.кн нет' },
      reply: async (text) => { declineReply = text; }
    });
    assert.strictEqual(userPendingChallenge.has(101), false);
    assert.strictEqual(userPendingChallenge.has(404), false);
    console.log('✓ Passed');
  }

  // 10. Test explicit argument in text overrides reply message
  {
    console.log('[Integration 10] Explicit argument in text overrides reply message');
    const matched = findHears('.кн вызов @charlie');
    assert.ok(matched);

    let sentMsg = null;
    const ctx = {
      from: { id: 101, first_name: 'Alice' },
      chat: { id: 999 },
      message: {
        text: '.кн вызов @charlie',
        reply_to_message: {
          // Replying to Dave (404), but typed @charlie (303)
          from: { id: 404, first_name: 'Dave', username: 'dave', is_bot: false }
        }
      },
      state: { user: { nickname: 'Alice' } },
      reply: async (text, extra) => {
        sentMsg = { text, extra, message_id: 777 };
        return sentMsg;
      }
    };

    await matched.handler(ctx);
    assert.ok(sentMsg);
    // MUST challenge Charlie, NOT Dave!
    assert.ok(sentMsg.text.includes('Charlie'), 'Target in message must be Charlie');
    assert.ok(!sentMsg.text.includes('Dave'), 'Target in message must not be Dave');

    const explicitChalId = userPendingChallenge.get(101);
    assert.ok(explicitChalId);
    assert.strictEqual(userPendingChallenge.get(303), explicitChalId, 'Pending challenge must be for Charlie');
    assert.strictEqual(userPendingChallenge.has(404), false, 'Dave must not have a pending challenge');

    // Clean up
    const declineMatch = findHears('.кн нет');
    await declineMatch.handler({
      from: { id: 303 },
      message: { text: '.кн нет' },
      reply: async () => {}
    });
    console.log('✓ Passed');
  }

  // 11. Test Full Game: Complete Win Sequence (3 in a row)
  {
    console.log('[Integration 11] Full Game: Alice wins with 3 in a row');
    // Challenge
    const callMatch = findHears('.кн вызов @charlie');
    await callMatch.handler({
      from: { id: 101, first_name: 'Alice' },
      chat: { id: 999 },
      message: { text: '.кн вызов @charlie' },
      reply: async () => ({ message_id: 888 })
    });
    const cId = userPendingChallenge.get(101);

    // Charlie accepts
    const accMatch = findAction(`ttt_acc_${cId}`);
    await accMatch.handler({
      from: { id: 303 },
      match: accMatch.match,
      callbackQuery: { message: { message_id: 888 } },
      editMessageText: async () => {},
      answerCbQuery: async () => {}
    });

    const gId = userActiveGame.get(101);
    assert.ok(gId);

    // Helper to make a move via action handler
    async function doMove(userId, cell) {
      const match = findAction(`ttt_m_${cell}`);
      let editedText = '';
      await match.handler({
        from: { id: userId },
        match: match.match,
        editMessageText: async (text) => { editedText = text; },
        answerCbQuery: async () => {}
      });
      return editedText;
    }

    // Moves: Alice=0, Charlie=3, Alice=1, Charlie=4, Alice=2 (Row 0 win)
    await doMove(101, 0); // X at 0
    await doMove(303, 3); // O at 3
    await doMove(101, 1); // X at 1
    await doMove(303, 4); // O at 4
    const finalMsg = await doMove(101, 2); // X at 2 -> WIN!

    assert.ok(finalMsg.includes('ПОБЕДА'));
    assert.ok(finalMsg.includes('Alice'));
    assert.ok(!finalMsg.includes('🏳️ Сдаться')); // Surrender button removed
    assert.strictEqual(userActiveGame.has(101), false, 'Active game must be cleared');
    assert.strictEqual(userActiveGame.has(303), false, 'Active game must be cleared');
    console.log('✓ Passed');
  }

  // 12. Test Full Game: Draw Sequence
  {
    console.log('[Integration 12] Full Game: 9 moves to Draw');
    const callMatch = findHears('.кн вызов @charlie');
    await callMatch.handler({
      from: { id: 101, first_name: 'Alice' },
      chat: { id: 999 },
      message: { text: '.кн вызов @charlie' },
      reply: async () => ({ message_id: 999 })
    });
    const cId = userPendingChallenge.get(101);

    const accMatch = findAction(`ttt_acc_${cId}`);
    await accMatch.handler({
      from: { id: 303 },
      match: accMatch.match,
      callbackQuery: { message: { message_id: 999 } },
      editMessageText: async () => {},
      answerCbQuery: async () => {}
    });

    async function doMove(userId, cell) {
      const match = findAction(`ttt_m_${cell}`);
      let editedText = '';
      await match.handler({
        from: { id: userId },
        match: match.match,
        editMessageText: async (text) => { editedText = text; },
        answerCbQuery: async () => {}
      });
      return editedText;
    }

    // Draw board:
    // X O X
    // X O O
    // O X X
    // Order:
    // X: 0, O: 1
    // X: 2, O: 4
    // X: 3, O: 5
    // X: 7, O: 6
    // X: 8
    await doMove(101, 0);
    await doMove(303, 1);
    await doMove(101, 2);
    await doMove(303, 4);
    await doMove(101, 3);
    await doMove(303, 5);
    await doMove(101, 7);
    await doMove(303, 6);
    const drawMsg = await doMove(101, 8);

    assert.ok(drawMsg.includes('Ничья!'));
    assert.ok(!drawMsg.includes('🏳️ Сдаться'));
    assert.strictEqual(userActiveGame.has(101), false);
    assert.strictEqual(userActiveGame.has(303), false);
    console.log('✓ Passed');
  }

  // 13. Test click on finished game message answers with 'Игра уже завершена.'
  {
    console.log('[Integration 13] Click on finished game message alerts "Игра уже завершена."');
    const match = findAction('ttt_m_5');
    let alertMsg = '';
    await match.handler({
      from: { id: 101 },
      match: match.match,
      callbackQuery: { message: { message_id: 999 } },
      answerCbQuery: async (msg) => { alertMsg = msg; },
      editMessageText: async () => {}
    });
    assert.strictEqual(alertMsg, 'Игра уже завершена.');
    console.log('✓ Passed');
  }

  // 14. Test Cross-Game Message Isolation
  {
    console.log('[Integration 14] Cross-Game Message Isolation: Bob in Game 2 cannot hijack Game 1');
    const g1 = new TicTacToeGame('g1_iso', { id: 101, name: 'Alice' }, { id: 102, name: 'Charlie' }, 999, 1001);
    const g2 = new TicTacToeGame('g2_iso', { id: 201, name: 'Bob' }, { id: 202, name: 'Dave' }, 999, 2002);

    activeGames.set(g1.id, g1);
    userActiveGame.set(101, g1.id);
    userActiveGame.set(102, g1.id);
    messageToGame.set(1001, g1.id);

    activeGames.set(g2.id, g2);
    userActiveGame.set(201, g2.id);
    userActiveGame.set(202, g2.id);
    messageToGame.set(2002, g2.id);

    // Bob (201) clicks cell 4 on Game 1's message (1001)!
    const match = findAction('ttt_m_4');
    let alertMsg = '';
    let edited = false;

    await match.handler({
      from: { id: 201 },
      match: match.match,
      callbackQuery: { message: { message_id: 1001 } },
      answerCbQuery: async (msg) => { alertMsg = msg; },
      editMessageText: async () => { edited = true; }
    });

    assert.ok(alertMsg.includes('не участвуете в этой игре'), `Expected spectator rejection, got: ${alertMsg}`);
    assert.strictEqual(edited, false, 'Message 1001 must NOT be edited');
    assert.strictEqual(g1.board[4], null, 'Game 1 board must be untouched');
    assert.strictEqual(g2.board[4], null, 'Game 2 board must be untouched');

    // Clean up test games
    activeGames.delete(g1.id);
    activeGames.delete(g2.id);
    userActiveGame.delete(101);
    userActiveGame.delete(102);
    userActiveGame.delete(201);
    userActiveGame.delete(202);
    messageToGame.delete(1001);
    messageToGame.delete(2002);
    console.log('✓ Passed');
  }

  // 15. Test text_mention resolution for user without username
  {
    console.log('[Integration 15] .кн вызов resolves target from text_mention entity');
    const matched = findHears('.кн вызов John');
    assert.ok(matched);

    let sentMsg = null;
    await matched.handler({
      from: { id: 101, first_name: 'Alice' },
      chat: { id: 999 },
      message: {
        text: '.кн вызов John',
        entities: [
          {
            type: 'text_mention',
            offset: 10,
            length: 4,
            user: { id: 777, first_name: 'John Doe', is_bot: false }
          }
        ]
      },
      reply: async (text, extra) => {
        sentMsg = { text, extra, message_id: 3333 };
        return sentMsg;
      }
    });

    assert.ok(sentMsg);
    assert.ok(sentMsg.text.includes('John Doe'));
    const pendingChalId = userPendingChallenge.get(101);
    assert.ok(pendingChalId);
    assert.strictEqual(userPendingChallenge.get(777), pendingChalId);

    // Clean up
    challenges.delete(pendingChalId);
    userPendingChallenge.delete(101);
    userPendingChallenge.delete(777);
    console.log('✓ Passed');
  }

  // 16. Test Surrender on finished game
  {
    console.log('[Integration 16] Surrender on finished game alerts "Игра уже завершена."');
    const match = findAction('ttt_sur');
    let alertMsg = '';
    await match.handler({
      from: { id: 101 },
      match: match.match,
      callbackQuery: { message: { message_id: 999 } },
      answerCbQuery: async (msg) => { alertMsg = msg; },
      editMessageText: async () => {}
    });
    assert.strictEqual(alertMsg, 'Игра уже завершена.');
    console.log('✓ Passed');
  }

  console.log('=== All Integration Tests Passed Successfully! ===');
}

testBotIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
