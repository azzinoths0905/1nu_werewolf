const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const MIN_START_PLAYERS = 3;
const CENTER_CARD_COUNT = 3;
const WEREWOLF_THRESHOLD_EXTRA = 8;
const DEFAULT_DISCUSSION_SECONDS = 180;

function clonePlayers(players) {
  return (players || []).map((player) => ({
    openId: player.openId,
    nickname: player.nickname || '玩家',
    isBot: !!player.isBot,
  }));
}

function listPlayers(game) {
  return (game.players || []).map((player) => ({
    openId: player.openId,
    nickname: player.nickname || '玩家',
    isBot: !!player.isBot,
  }));
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

function prefillBotNightActions(gamePayload) {
  const actionsByOpenId = {};
  const players = listPlayers(gamePayload);

  players.forEach((player) => {
    if (!player.isBot) {
      return;
    }
    const action = buildBotNightAction(gamePayload, player.openId);
    actionsByOpenId[player.openId] = {
      actionType: action.actionType,
      actionData: action.actionData,
      submittedAt: new Date().toISOString(),
      isBotAuto: true,
    };
  });

  const submittedCount = Object.keys(actionsByOpenId).length;
  gamePayload.night = Object.assign({}, gamePayload.night, {
    actionsByOpenId,
    submittedCount,
  });
  return gamePayload;
}

function shuffle(list) {
  const arr = list.slice();
  for (let index = arr.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = arr[index];
    arr[index] = arr[randomIndex];
    arr[randomIndex] = temp;
  }
  return arr;
}

function buildDefaultRoles(totalCards, playerCount) {
  const roles = ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker'];
  if (playerCount >= WEREWOLF_THRESHOLD_EXTRA) {
    roles.push('werewolf');
  }
  while (roles.length < totalCards) {
    roles.push('villager');
  }
  return roles.slice(0, totalCards);
}

function buildDeck(roomConfig, playerCount) {
  const totalCards = playerCount + CENTER_CARD_COUNT;
  const configRoles = Array.isArray(roomConfig && roomConfig.roles) ? roomConfig.roles.filter(Boolean) : [];

  if (configRoles.length === totalCards) {
    return shuffle(configRoles);
  }

  return shuffle(buildDefaultRoles(totalCards, playerCount));
}

function assignRoles(players, roomConfig) {
  const deck = buildDeck(roomConfig, players.length);
  const initialRolesByOpenId = {};
  const finalRolesByOpenId = {};
  const playerOrder = [];

  players.forEach((player, index) => {
    const role = deck[index];
    playerOrder.push(player.openId);
    initialRolesByOpenId[player.openId] = role;
    finalRolesByOpenId[player.openId] = role;
  });

  const centerRoles = deck.slice(players.length, players.length + CENTER_CARD_COUNT);

  return {
    playerOrder,
    initialRolesByOpenId,
    finalRolesByOpenId,
    centerRoles,
  };
}

function createGamePayload(roomId, room) {
  const players = clonePlayers(room.players || []);
  const roleState = assignRoles(players, room.config || {});

  return {
    roomId,
    phase: 'night',
    status: 'running',
    players,
    config: {
      discussionSeconds: (room.config && room.config.discussionSeconds) || DEFAULT_DISCUSSION_SECONDS,
      roles: Array.isArray(room.config && room.config.roles) ? room.config.roles : [],
    },
    playerOrder: roleState.playerOrder,
    initialRolesByOpenId: roleState.initialRolesByOpenId,
    finalRolesByOpenId: roleState.finalRolesByOpenId,
    centerRoles: roleState.centerRoles,
    night: {
      actionsByOpenId: {},
      privateResultsByOpenId: {},
      resolved: false,
      submittedCount: 0,
      totalCount: players.length,
    },
    vote: {
      votesByOpenId: {},
      submittedCount: 0,
      totalCount: players.length,
      locked: false,
    },
    result: null,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };
}

exports.main = async (event) => {
  const roomId = (event.roomId || '').trim();
  if (!roomId) {
    return { ok: false, error: 'ROOM_ID_REQUIRED' };
  }

  const roomRes = await db.collection('rooms').doc(roomId).get();
  const room = roomRes.data;

  if (!room) {
    return { ok: false, error: 'ROOM_NOT_FOUND' };
  }

  if ((room.players || []).length < MIN_START_PLAYERS) {
    return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
  }

  if (room.status === 'in_game' && room.currentGameId) {
    return { ok: false, error: 'GAME_ALREADY_RUNNING', gameId: room.currentGameId };
  }

  const gamePayload = createGamePayload(roomId, room);
  prefillBotNightActions(gamePayload);
  const gameRes = await db.collection('games').add({ data: gamePayload });

  await db.collection('rooms').doc(roomId).update({
    data: {
      status: 'in_game',
      currentGameId: gameRes._id,
      updatedAt: db.serverDate(),
    },
  });

  return {
    ok: true,
    roomId,
    gameId: gameRes._id,
    phase: 'night',
  };
};
