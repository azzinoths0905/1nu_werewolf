const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const CENTER_LABELS = ['A', 'B', 'C'];
const ROLE_LABELS = {
  werewolf: '狼人',
  seer: '预言家',
  robber: '强盗',
  troublemaker: '捣蛋鬼',
  villager: '村民',
};
const MAX_TROUBLEMAKER_PAIR_OPTIONS = 30;
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

function roleLabel(roleId) {
  return ROLE_LABELS[roleId] || roleId || '未知身份';
}

function toSafePlayers(players) {
  return (players || []).map((player) => ({
    openId: player.openId,
    nickname: player.nickname || '玩家',
  }));
}

function buildRoleChips(roleIds) {
  const counts = {};
  (roleIds || []).forEach((roleId) => {
    counts[roleId] = (counts[roleId] || 0) + 1;
  });
  return Object.keys(counts).map((roleId) => `${roleLabel(roleId)} x${counts[roleId]}`);
}

function buildNightInstruction(roleId) {
  if (roleId === 'seer') {
    return '请选择 1 名玩家查看身份，或查看 2 张中心牌。';
  }
  if (roleId === 'robber') {
    return '请选择 1 名玩家交换身份，并查看你交换后的身份。';
  }
  if (roleId === 'troublemaker') {
    return '请选择 2 名玩家交换身份（你不会看到交换结果）。';
  }
  if (roleId === 'werewolf') {
    return '本夜你没有可执行动作，确认后等待其他玩家。';
  }
  return '本夜你没有可执行动作，确认后等待其他玩家。';
}

function buildNightActionOptions(game, meOpenId) {
  const safePlayers = toSafePlayers(game.players || []);
  const myRole = (game.initialRolesByOpenId || {})[meOpenId];
  const otherPlayers = safePlayers.filter((player) => player.openId !== meOpenId);

  if (myRole === 'seer') {
    const playerOptions = otherPlayers.map((player) => ({
      key: `seer-player-${player.openId}`,
      label: `查看玩家：${player.nickname}`,
      actionType: 'seer_peek_player',
      actionData: { targetOpenId: player.openId },
    }));

    const centerOptions = [
      [0, 1],
      [0, 2],
      [1, 2],
    ].map((indexes) => ({
      key: `seer-center-${indexes.join('-')}`,
      label: `查看中心牌 ${CENTER_LABELS[indexes[0]]}+${CENTER_LABELS[indexes[1]]}`,
      actionType: 'seer_peek_center',
      actionData: { centerIndexes: indexes },
    }));

    return playerOptions.concat(centerOptions);
  }

  if (myRole === 'robber') {
    return otherPlayers.map((player) => ({
      key: `robber-${player.openId}`,
      label: `交换并查看：${player.nickname}`,
      actionType: 'robber_swap',
      actionData: { targetOpenId: player.openId },
    }));
  }

  if (myRole === 'troublemaker') {
    const options = [];
    for (let i = 0; i < otherPlayers.length; i += 1) {
      for (let j = i + 1; j < otherPlayers.length; j += 1) {
        if (options.length >= MAX_TROUBLEMAKER_PAIR_OPTIONS) {
          return options;
        }
        const first = otherPlayers[i];
        const second = otherPlayers[j];
        options.push({
          key: `tm-${first.openId}-${second.openId}`,
          label: `交换：${first.nickname} ↔ ${second.nickname}`,
          actionType: 'troublemaker_swap',
          actionData: { targetOpenIds: [first.openId, second.openId] },
        });
      }
    }
    return options;
  }

  return [
    {
      key: 'noop',
      label: '确认（本夜无行动）',
      actionType: 'noop',
      actionData: {},
    },
  ];
}

function buildResultSubtitle(result) {
  if (!result) {
    return '';
  }
  if (result.subtitle) {
    return result.subtitle;
  }
  return '';
}

function buildGameSnapshot(game, room, meOpenId) {
  if (!game) {
    return null;
  }

  const safePlayers = toSafePlayers(game.players || room.players || []);
  const me = safePlayers.find((player) => player.openId === meOpenId);
  const initialRolesByOpenId = game.initialRolesByOpenId || {};
  const finalRolesByOpenId = game.finalRolesByOpenId || {};
  const night = game.night || {};
  const vote = game.vote || {};
  const result = game.result || null;
  const nightActionsByOpenId = night.actionsByOpenId || {};
  const votesByOpenId = vote.votesByOpenId || {};
  const privateResultsByOpenId = night.privateResultsByOpenId || {};

  const base = {
    gameId: game._id,
    phase: game.phase || 'night',
    status: game.status || 'running',
    players: safePlayers,
    me: {
      openId: meOpenId,
      nickname: me ? me.nickname : '玩家',
      initialRole: initialRolesByOpenId[meOpenId] || '',
      initialRoleText: roleLabel(initialRolesByOpenId[meOpenId] || ''),
      privateNightResult: privateResultsByOpenId[meOpenId] || '',
    },
  };

  if (base.phase === 'night') {
    base.night = {
      instruction: buildNightInstruction(initialRolesByOpenId[meOpenId] || ''),
      actionOptions: buildNightActionOptions(game, meOpenId),
      submittedCount: night.submittedCount || Object.keys(nightActionsByOpenId).length,
      totalCount: night.totalCount || safePlayers.length,
      hasSubmitted: !!nightActionsByOpenId[meOpenId],
      resolved: !!night.resolved,
    };
    return base;
  }

  if (base.phase === 'vote') {
    const myVote = votesByOpenId[meOpenId] || '';
    base.vote = {
      candidates: safePlayers,
      selectedTargetOpenId: myVote,
      hasVoted: !!myVote,
      submittedCount: vote.submittedCount || Object.keys(votesByOpenId).length,
      totalCount: vote.totalCount || safePlayers.length,
    };
    return base;
  }

  if (base.phase === 'result') {
    const rows = safePlayers.map((player) => ({
      openId: player.openId,
      nickname: player.nickname,
      initialRoleText: roleLabel(initialRolesByOpenId[player.openId] || ''),
      finalRoleText: roleLabel(finalRolesByOpenId[player.openId] || ''),
      votesReceived: result && result.voteCountsByOpenId ? (result.voteCountsByOpenId[player.openId] || 0) : 0,
    }));

    base.result = {
      winner: result ? result.winner : '',
      winnerText: result ? result.winnerText : '',
      subtitle: buildResultSubtitle(result),
      eliminatedOpenIds: result ? (result.eliminatedOpenIds || []) : [],
      rows,
      voteCountsByOpenId: result ? (result.voteCountsByOpenId || {}) : {},
    };
    return base;
  }

  return base;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);
  const roomId = (event.roomId || '').trim();

  if (!roomId) {
    return { ok: false, error: 'ROOM_ID_REQUIRED' };
  }

  let room;
  try {
    const roomRes = await db.collection('rooms').doc(roomId).get();
    room = roomRes.data;
  } catch (error) {
    return { ok: false, error: 'ROOM_NOT_FOUND' };
  }

  const safePlayers = toSafePlayers(room.players || []);
  const resolvedPlayerOpenId = resolvePlayerOpenId(safePlayers, OPENID, effectiveOpenId);
  if (!resolvedPlayerOpenId) {
    return { ok: false, error: 'NOT_IN_ROOM' };
  }

  let game = null;
  if (room.currentGameId) {
    try {
      const gameRes = await db.collection('games').doc(room.currentGameId).get();
      game = gameRes.data;
    } catch (error) {
      game = null;
    }
  }

  return {
    ok: true,
    room: {
      roomId: room._id,
      roomCode: room.roomCode,
      status: room.status || 'lobby',
      currentGameId: room.currentGameId || '',
      playerCount: safePlayers.length,
      players: safePlayers,
      roleChips: buildRoleChips((room.config && room.config.roles) || []),
      config: room.config || {},
    },
    game: buildGameSnapshot(game, room, resolvedPlayerOpenId),
  };
};
