'use strict';

const assert = require('assert');
const { initUltimateTicTacToe, challenges, activeGames, userActiveGame, userPendingChallenge } = require('../src/games/ultimateTicTacToe');

async function testBotIntegration() {
  console.log('--- Starting Bot Integration Tests ---');

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
  initUltimateTicTacToe(mockBot, { User: mockUser });

  console.log(`Registered ${hearsHandlers.length} hears handlers and ${actionHandlers.length} action handlers.`);
  assert.ok(hearsHandlers.length >= 5);
  assert.ok(actionHandlers.length >= 6);

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
    assert.ok(repliedText.includes('Супер Крестики-Нолики'));
    assert.ok(repliedText.includes('Правила игры:'));
    console.log('✓ Passed');
  }

  // 2. Test .кн вызов with @username
  let challengeId = null;
  {
    console.log('[Integration 2] .кн вызов @charlie');
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

    challengeId = userPendingChallenge.get(101);
    assert.ok(challengeId);
    assert.strictEqual(userPendingChallenge.get(303), challengeId);
    console.log('✓ Passed');
  }

  // 3. Test Unauthorized Accept via button
  {
    console.log('[Integration 3] Unauthorized user clicks accept');
    const actionMatch = findAction(`utt_acc_${challengeId}`);
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
    const actionMatch = findAction(`utt_acc_${challengeId}`);
    assert.ok(actionMatch);

    let editedText = '';
    let editedKeyboard = null;
    const ctx = {
      from: { id: 303 }, // Charlie
      match: actionMatch.match,
      callbackQuery: true,
      editMessageText: async (text, extra) => {
        editedText = text;
        editedKeyboard = extra;
      },
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    assert.ok(editedText.includes('Супер Крестики-Нолики'));
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
    const actionMatch = findAction(`utt_c_${gameId}_4_0`);
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

  // 6. Test Gameplay: Alice makes valid move in Sector 4, Cell 0
  {
    console.log('[Integration 6] Alice moves in Sector 4, Cell 0');
    const actionMatch = findAction(`utt_c_${gameId}_4_0`);
    assert.ok(actionMatch);

    let updatedText = '';
    const ctx = {
      from: { id: 101 }, // Alice (X)
      match: actionMatch.match,
      editMessageText: async (text) => { updatedText = text; },
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    const game = activeGames.get(gameId);
    assert.strictEqual(game.cells[4][0], 'X');
    assert.strictEqual(game.activeSector, 0, 'Next active sector must be 0');
    assert.strictEqual(game.currentTurn, 'O');
    console.log('✓ Passed');
  }

  // 7. Test Switch View to Map
  {
    console.log('[Integration 7] Switch View to Map');
    const actionMatch = findAction(`utt_v_${gameId}_map`);
    assert.ok(actionMatch);

    const ctx = {
      from: { id: 303 },
      match: actionMatch.match,
      editMessageText: async () => {},
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    const game = activeGames.get(gameId);
    assert.strictEqual(game.viewMode, 'map');
    console.log('✓ Passed');
  }

  // 7a. Test Inactive Player cannot navigate or pick sector during opponent's turn
  {
    console.log('[Integration 7a] Inactive Player navigation rejected');
    // It is Charlie's (303) turn. Alice (101) tries to switch view.
    const actionMatch = findAction(`utt_v_${gameId}_sec`);
    assert.ok(actionMatch);

    let alertMsg = '';
    const ctx = {
      from: { id: 101 }, // Alice (inactive)
      match: actionMatch.match,
      answerCbQuery: async (msg, opts) => { alertMsg = msg; }
    };

    await actionMatch.handler(ctx);
    assert.ok(alertMsg.includes('Сейчас ход соперника'));

    // Inactive player also cannot pick sector
    const sectorMatch = findAction(`utt_s_${gameId}_2`);
    assert.ok(sectorMatch);
    let sectorAlert = '';
    await sectorMatch.handler({
      from: { id: 101 },
      match: sectorMatch.match,
      answerCbQuery: async (msg) => { sectorAlert = msg; }
    });
    assert.ok(sectorAlert.includes('Сейчас ход соперника'));
    console.log('✓ Passed');
  }

  // 7b. Test Active Player switches back to sector view via [ 🎯 Текущий сектор ]
  {
    console.log('[Integration 7b] Active player returns to sector view');
    const actionMatch = findAction(`utt_v_${gameId}_sec`);
    assert.ok(actionMatch);

    const ctx = {
      from: { id: 303 }, // Charlie (active)
      match: actionMatch.match,
      editMessageText: async () => {},
      answerCbQuery: async () => {}
    };

    await actionMatch.handler(ctx);
    const game = activeGames.get(gameId);
    assert.strictEqual(game.viewMode, 'sector');
    assert.strictEqual(game.viewSector, 0);
    console.log('✓ Passed');
  }

  // 8. Test Surrender
  {
    console.log('[Integration 8] Charlie surrenders');
    const actionMatch = findAction(`utt_sur_${gameId}`);
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

  // 9. Test .кн вызов via Reply to message
  {
    console.log('[Integration 9] .кн вызов via Reply');
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

  console.log('=== All Integration Tests Passed Successfully! ===');
}

testBotIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
