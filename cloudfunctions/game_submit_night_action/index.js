const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const DEBUG_PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

function getEffectiveOpenId(event, openId) {
  const debugPlayerId = ((event && event.__debugPlayerId) || '').trim();
  if (!debugPlayerId || !DEBUG_PLAYER_ID_PATTERN.test(debugPlayerId)) {
    return openId;
  }
  return `${openId}#${debugPlayerId}`;
}
function resolvePlayerOpenId(players, openId, effectiveOpenId) {
  const playerIds = (players || []).map((player) => player && player.openId).filter(Boolean);
  if (playerIds.includes(effectiveOpenId)) {
    return effectiveOpenId;
  }
  if (playerIds.includes(openId)) {
    return openId;
  }

  const prefixed = playerIds.filter((id) => id.indexOf(`${openId}#`) === 0);
  if (prefixed.length === 1) {
    return prefixed[0];
  }
  return '';
}
const NIGHT_RESOLUTION_ORDER = ['werewolf', 'seer', 'robber', 'troublemaker'];
const CENTER_LABELS = ['A', 'B', 'C'];
const ROLE_LABELS = {
  werewolf: '狼人',
  seer: '预言家',
  robber: '强盗',
  troublemaker: '捣蛋鬼',
  villager: '村民',
};

function roleLabel(roleId) {
  return ROLE_LABELS[roleId] || roleId || '未知身份';
}

function cloneObject(input) {
  return JSON.parse(JSON.stringify(input || {}));
}

function listPlayers(game) {
  return (game.players || []).map((player) => ({
    openId: player.openId,
    nickname: player.nickname || '玩家',
  }));
}

function nicknameByOpenId(game) {
  const map = {};
  listPlayers(game).forEach((player) => {
    map[player.openId] = player.nickname;
  });
  return map;
}

function sanitizeAction(action) {
  if (!action || typeof action !== 'object') {
    return { actionType: 'noop', actionData: {} };
  }

  return {
    actionType: action.actionType || 'noop',
    actionData: action.actionData && typeof action.actionData === 'object' ? action.actionData : {},
  };
}

function buildDefaultPrivateResults(game) {
  const initialRoles = game.initialRolesByOpenId || {};
  const players = listPlayers(game);
  const names = nicknameByOpenId(game);
  const results = {};

  players.forEach((player) => {
    const roleId = initialRoles[player.openId];
    if (roleId === 'werewolf') {
      const teammates = players
        .filter((item) => item.openId !== player.openId && initialRoles[item.openId] === 'werewolf')
        .map((item) => names[item.openId]);
      if (teammates.length > 0) {
        results[player.openId] = `你是狼人。同伴：${teammates.join('、')}`;
      } else {
        results[player.openId] = '你是狼人（独狼）。本版本未实现独狼查看中心牌，直接进入下一阶段。';
      }
      return;
    }

    if (roleId === 'villager') {
      results[player.openId] = '你是村民，本夜没有行动。';
      return;
    }

    if (roleId === 'seer') {
      results[player.openId] = '预言家行动完成后，你将在投票阶段看到结果提示。';
      return;
    }

    if (roleId === 'robber') {
      results[player.openId] = '强盗行动完成后，你将在投票阶段看到交换后的身份。';
      return;
    }

    if (roleId === 'troublemaker') {
      results[player.openId] = '捣蛋鬼行动完成后，你不会看到交换结果。';
      return;
    }

    results[player.openId] = '本夜没有行动。';
  });

  return results;
}

function applySeer(game, playerOpenId, action, privateResults) {
  const initialRoles = game.initialRolesByOpenId || {};
  const players = listPlayers(game);
  const names = nicknameByOpenId(game);
  const centerRoles = Array.isArray(game.centerRoles) ? game.centerRoles : [];

  if (action.actionType === 'seer_peek_player') {
    const targetOpenId = action.actionData ? action.actionData.targetOpenId : '';
    const target = players.find((player) => player.openId === targetOpenId);
    if (target && target.openId !== playerOpenId) {
      privateResults[playerOpenId] = `你查看了 ${names[target.openId]}，其初始身份是：${roleLabel(initialRoles[target.openId])}`;
      return;
    }
  }

  if (action.actionType === 'seer_peek_center') {
    const indexes = Array.isArray(action.actionData && action.actionData.centerIndexes)
      ? action.actionData.centerIndexes
      : [];
    if (indexes.length === 2) {
      const firstIndex = indexes[0];
      const secondIndex = indexes[1];
      const firstRole = centerRoles[firstIndex];
      const secondRole = centerRoles[secondIndex];
      if (firstRole && secondRole && firstIndex !== secondIndex) {
        privateResults[playerOpenId] = `你查看了中心牌 ${CENTER_LABELS[firstIndex]} 与 ${CENTER_LABELS[secondIndex]}：${roleLabel(firstRole)}、${roleLabel(secondRole)}`;
        return;
      }
    }
  }

  privateResults[playerOpenId] = '预言家本夜未执行有效操作。';
}

function applyRobber(game, playerOpenId, action, finalRolesByOpenId, privateResults) {
  const players = listPlayers(game);
  const names = nicknameByOpenId(game);
  const targetOpenId = action.actionData ? action.actionData.targetOpenId : '';
  const target = players.find((player) => player.openId === targetOpenId);

  if (!target || target.openId === playerOpenId) {
    privateResults[playerOpenId] = '强盗本夜未执行有效操作。';
    return;
  }

  const myRole = finalRolesByOpenId[playerOpenId];
  const targetRole = finalRolesByOpenId[target.openId];

  finalRolesByOpenId[playerOpenId] = targetRole;
  finalRolesByOpenId[target.openId] = myRole;
  privateResults[playerOpenId] = `你与 ${names[target.openId]} 交换了身份，你当前身份是：${roleLabel(finalRolesByOpenId[playerOpenId])}`;
}

function applyTroublemaker(game, playerOpenId, action, finalRolesByOpenId, privateResults) {
  const players = listPlayers(game);
  const names = nicknameByOpenId(game);
  const targetOpenIds = Array.isArray(action.actionData && action.actionData.targetOpenIds)
    ? action.actionData.targetOpenIds
    : [];

  if (targetOpenIds.length !== 2) {
    privateResults[playerOpenId] = '捣蛋鬼本夜未执行有效操作。';
    return;
  }

  const first = targetOpenIds[0];
  const second = targetOpenIds[1];
  const valid =
    first &&
    second &&
    first !== second &&
    first !== playerOpenId &&
    second !== playerOpenId &&
    players.some((player) => player.openId === first) &&
    players.some((player) => player.openId === second);

  if (!valid) {
    privateResults[playerOpenId] = '捣蛋鬼本夜未执行有效操作。';
    return;
  }

  const temp = finalRolesByOpenId[first];
  finalRolesByOpenId[first] = finalRolesByOpenId[second];
  finalRolesByOpenId[second] = temp;
  privateResults[playerOpenId] = `你交换了 ${names[first]} 与 ${names[second]} 的身份。`;
}

function resolveNight(game) {
  const initialRolesByOpenId = cloneObject(game.initialRolesByOpenId);
  const finalRolesByOpenId = cloneObject(game.finalRolesByOpenId || game.initialRolesByOpenId);
  const actionsByOpenId = cloneObject(game.night && game.night.actionsByOpenId);
  const players = listPlayers(game);
  const privateResults = buildDefaultPrivateResults(game);

  NIGHT_RESOLUTION_ORDER.forEach((roleId) => {
    players.forEach((player) => {
      if (initialRolesByOpenId[player.openId] !== roleId) {
        return;
      }
      const action = sanitizeAction(actionsByOpenId[player.openId]);

      if (roleId === 'seer') {
        applySeer(game, player.openId, action, privateResults);
        return;
      }

      if (roleId === 'robber') {
        applyRobber(game, player.openId, action, finalRolesByOpenId, privateResults);
        return;
      }

      if (roleId === 'troublemaker') {
        applyTroublemaker(game, player.openId, action, finalRolesByOpenId, privateResults);
      }
    });
  });

  return {
    finalRolesByOpenId,
    privateResultsByOpenId: privateResults,
  };
}

function hasAllNightActions(game) {
  const players = listPlayers(game);
  const actionsByOpenId = (game.night && game.night.actionsByOpenId) || {};
  return players.every((player) => !!actionsByOpenId[player.openId]);
}

function listBotPlayers(game) {
  return (game.players || [])
    .filter((player) => player && player.isBot)
    .map((player) => ({ openId: player.openId, nickname: player.nickname || '机器人' }));
}

function buildBotNightAction(game, playerOpenId) {
  const players = listPlayers(game);
  const myRole = (game.initialRolesByOpenId || {})[playerOpenId] || '';
  const otherPlayers = players.filter((player) => player.openId !== playerOpenId);

  if (myRole === 'seer') {
    if (otherPlayers.length > 0) {
      return {
        actionType: 'seer_peek_player',
        actionData: { targetOpenId: otherPlayers[0].openId },
      };
    }
    return {
      actionType: 'seer_peek_center',
      actionData: { centerIndexes: [0, 1] },
    };
  }

  if (myRole === 'robber') {
    if (otherPlayers.length > 0) {
      return {
        actionType: 'robber_swap',
        actionData: { targetOpenId: otherPlayers[0].openId },
      };
    }
    return { actionType: 'noop', actionData: {} };
  }

  if (myRole === 'troublemaker') {
    if (otherPlayers.length >= 2) {
      return {
        actionType: 'troublemaker_swap',
        actionData: { targetOpenIds: [otherPlayers[0].openId, otherPlayers[1].openId] },
      };
    }
    return { actionType: 'noop', actionData: {} };
  }

  return { actionType: 'noop', actionData: {} };
}

async function fillMissingBotNightActions(gameId, game) {
  if (!game || game.phase !== 'night') {
    return game;
  }

  const currentActions = (game.night && game.night.actionsByOpenId) || {};
  const botPlayers = listBotPlayers(game);
  const patch = {};
  let updated = false;

  botPlayers.forEach((bot) => {
    if (currentActions[bot.openId]) {
      return;
    }
    const action = buildBotNightAction(game, bot.openId);
    patch[`night.actionsByOpenId.${bot.openId}`] = {
      actionType: action.actionType,
      actionData: action.actionData,
      submittedAt: db.serverDate(),
      isBotAuto: true,
    };
    updated = true;
  });

  if (!updated) {
    return game;
  }

  patch.updatedAt = db.serverDate();
  await db.collection('games').doc(gameId).update({ data: patch });
  const refreshed = await db.collection('games').doc(gameId).get();
  return refreshed.data;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);
  const gameId = (event.gameId || '').trim();
  const roomId = (event.roomId || '').trim();

  if (!gameId || !roomId) {
    return { ok: false, error: 'GAME_OR_ROOM_ID_REQUIRED' };
  }

  let game;
  try {
    const gameRes = await db.collection('games').doc(gameId).get();
    game = gameRes.data;
  } catch (error) {
    return { ok: false, error: 'GAME_NOT_FOUND' };
  }

  if (!game || game.roomId !== roomId) {
    return { ok: false, error: 'GAME_NOT_FOUND' };
  }

  if (game.phase !== 'night') {
    return { ok: true, gameId, phase: game.phase, skipped: true };
  }

  const resolvedPlayerOpenId = resolvePlayerOpenId(game.players || [], OPENID, effectiveOpenId);
  if (!resolvedPlayerOpenId) {
    return { ok: false, error: 'NOT_IN_GAME' };
  }

  const action = sanitizeAction({
    actionType: event.actionType,
    actionData: event.actionData,
  });

  const actionPatch = {};
  actionPatch[`night.actionsByOpenId.${resolvedPlayerOpenId}`] = {
    actionType: action.actionType,
    actionData: action.actionData,
    submittedAt: db.serverDate(),
  };
  actionPatch.updatedAt = db.serverDate();

  await db.collection('games').doc(gameId).update({ data: actionPatch });

  try {
    await db.collection('actions').add({
      data: {
        gameId,
        roomId,
        openId: resolvedPlayerOpenId,
        actionType: action.actionType,
        actionData: action.actionData,
        createdAt: db.serverDate(),
      },
    });
  } catch (error) {
    // 行为日志失败不影响主流程
  }

  const latestGameRes = await db.collection('games').doc(gameId).get();
  let latestGame = latestGameRes.data;
  latestGame = await fillMissingBotNightActions(gameId, latestGame);
  if (!latestGame || latestGame.phase !== 'night') {
    return { ok: true, gameId, phase: latestGame ? latestGame.phase : 'unknown' };
  }

  const actionsByOpenId = (latestGame.night && latestGame.night.actionsByOpenId) || {};
  const submittedCount = Object.keys(actionsByOpenId).length;

  if (!hasAllNightActions(latestGame)) {
    const nextNight = Object.assign({}, latestGame.night || {}, {
      submittedCount,
    });
    await db.collection('games').doc(gameId).update({
      data: {
        night: nextNight,
        updatedAt: db.serverDate(),
      },
    });
    return {
      ok: true,
      gameId,
      phase: 'night',
      submittedCount,
      totalCount: (latestGame.night && latestGame.night.totalCount) || (latestGame.players || []).length,
    };
  }

  const resolvedNight = resolveNight(latestGame);
  const totalCount = (latestGame.players || []).length;

  const nextNight = Object.assign({}, latestGame.night || {}, {
    privateResultsByOpenId: resolvedNight.privateResultsByOpenId,
    resolved: true,
    submittedCount,
    totalCount,
    resolvedAt: db.serverDate(),
  });
  const nextVote = Object.assign({}, latestGame.vote || {}, {
    votesByOpenId: {},
    submittedCount: 0,
    totalCount,
    locked: false,
  });

  await db.collection('games').doc(gameId).update({
    data: {
      phase: 'vote',
      finalRolesByOpenId: resolvedNight.finalRolesByOpenId,
      night: nextNight,
      vote: nextVote,
      updatedAt: db.serverDate(),
    },
  });

  return {
    ok: true,
    gameId,
    phase: 'vote',
    submittedCount,
    totalCount,
  };
};
