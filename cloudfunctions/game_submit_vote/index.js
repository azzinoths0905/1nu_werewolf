const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
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

function toSafePlayers(players) {
  return (players || []).map((player) => ({
    openId: player.openId,
    nickname: player.nickname || '玩家',
  }));
}

function nicknameMap(players) {
  const map = {};
  toSafePlayers(players).forEach((player) => {
    map[player.openId] = player.nickname;
  });
  return map;
}

function allPlayersVoted(game) {
  const players = toSafePlayers(game.players || []);
  const votesByOpenId = (game.vote && game.vote.votesByOpenId) || {};
  return players.every((player) => !!votesByOpenId[player.openId]);
}

function listBotPlayers(game) {
  return (game.players || [])
    .filter((player) => player && player.isBot)
    .map((player) => ({
      openId: player.openId,
      nickname: player.nickname || '机器人',
    }));
}

function chooseBotVoteTarget(game, botOpenId) {
  const players = toSafePlayers(game.players || []);
  const candidates = players.filter((player) => player.openId !== botOpenId);
  if (candidates.length > 0) {
    return candidates[0].openId;
  }
  return players[0] ? players[0].openId : '';
}

async function fillMissingBotVotes(gameId, roomId, game) {
  if (!game || game.phase !== 'vote') {
    return game;
  }

  const currentVotes = (game.vote && game.vote.votesByOpenId) || {};
  const patch = {};
  const voteLogs = [];
  let updated = false;

  listBotPlayers(game).forEach((bot) => {
    if (currentVotes[bot.openId]) {
      return;
    }
    const targetOpenId = chooseBotVoteTarget(game, bot.openId);
    if (!targetOpenId) {
      return;
    }
    patch[`vote.votesByOpenId.${bot.openId}`] = targetOpenId;
    voteLogs.push({
      gameId,
      roomId,
      voterOpenId: bot.openId,
      targetOpenId,
      createdAt: db.serverDate(),
      isBotAuto: true,
    });
    updated = true;
  });

  if (!updated) {
    return game;
  }

  patch.updatedAt = db.serverDate();
  await db.collection('games').doc(gameId).update({ data: patch });

  await Promise.all(
    voteLogs.map(async (data) => {
      try {
        await db.collection('votes').add({ data });
      } catch (error) {
        // 机器人投票日志失败不影响主流程
      }
    }),
  );

  const refreshed = await db.collection('games').doc(gameId).get();
  return refreshed.data;
}

function computeVoteResult(game) {
  const players = toSafePlayers(game.players || []);
  const names = nicknameMap(players);
  const votesByOpenId = (game.vote && game.vote.votesByOpenId) || {};
  const voteCountsByOpenId = {};

  players.forEach((player) => {
    voteCountsByOpenId[player.openId] = 0;
  });

  Object.keys(votesByOpenId).forEach((voterOpenId) => {
    const targetOpenId = votesByOpenId[voterOpenId];
    if (voteCountsByOpenId[targetOpenId] === undefined) {
      return;
    }
    voteCountsByOpenId[targetOpenId] += 1;
  });

  let maxVote = 0;
  Object.keys(voteCountsByOpenId).forEach((openId) => {
    if (voteCountsByOpenId[openId] > maxVote) {
      maxVote = voteCountsByOpenId[openId];
    }
  });

  const eliminatedOpenIds = maxVote > 0
    ? Object.keys(voteCountsByOpenId).filter((openId) => voteCountsByOpenId[openId] === maxVote)
    : [];

  const finalRolesByOpenId = game.finalRolesByOpenId || game.initialRolesByOpenId || {};
  const werewolfOpenIds = Object.keys(finalRolesByOpenId).filter((openId) => finalRolesByOpenId[openId] === 'werewolf');
  const eliminatedWerewolf = eliminatedOpenIds.some((openId) => werewolfOpenIds.includes(openId));

  let winner = 'werewolf';
  let winnerText = '狼人阵营胜利';

  if (werewolfOpenIds.length === 0) {
    if (eliminatedOpenIds.length === 0) {
      winner = 'village';
      winnerText = '村民阵营胜利';
    }
  } else if (eliminatedWerewolf) {
    winner = 'village';
    winnerText = '村民阵营胜利';
  }

  const subtitle = eliminatedOpenIds.length > 0
    ? `最高票：${eliminatedOpenIds.map((openId) => `${names[openId]}（${voteCountsByOpenId[openId]}票）`).join('、')}`
    : '无人出局';

  const rows = players.map((player) => ({
    openId: player.openId,
    nickname: player.nickname,
    initialRole: (game.initialRolesByOpenId || {})[player.openId] || '',
    finalRole: finalRolesByOpenId[player.openId] || '',
    initialRoleText: roleLabel((game.initialRolesByOpenId || {})[player.openId] || ''),
    finalRoleText: roleLabel(finalRolesByOpenId[player.openId] || ''),
    votesReceived: voteCountsByOpenId[player.openId] || 0,
  }));

  return {
    winner,
    winnerText,
    subtitle,
    eliminatedOpenIds,
    voteCountsByOpenId,
    rows,
    lockedAt: new Date().toISOString(),
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);
  const gameId = (event.gameId || '').trim();
  const roomId = (event.roomId || '').trim();
  const targetOpenId = (event.targetOpenId || '').trim();

  if (!gameId || !roomId || !targetOpenId) {
    return { ok: false, error: 'GAME_ROOM_TARGET_REQUIRED' };
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

  if (game.phase !== 'vote') {
    return { ok: true, gameId, phase: game.phase, skipped: true };
  }

  const players = toSafePlayers(game.players || []);
  const resolvedPlayerOpenId = resolvePlayerOpenId(players, OPENID, effectiveOpenId);
  const inGame = !!resolvedPlayerOpenId;
  const validTarget = players.some((player) => player.openId === targetOpenId);
  if (!inGame) {
    return { ok: false, error: 'NOT_IN_GAME' };
  }
  if (!validTarget) {
    return { ok: false, error: 'INVALID_TARGET' };
  }

  const votePatch = {};
  votePatch[`vote.votesByOpenId.${resolvedPlayerOpenId}`] = targetOpenId;
  votePatch.updatedAt = db.serverDate();
  await db.collection('games').doc(gameId).update({ data: votePatch });

  try {
    await db.collection('votes').add({
      data: {
        gameId,
        roomId,
        voterOpenId: resolvedPlayerOpenId,
        targetOpenId,
        createdAt: db.serverDate(),
      },
    });
  } catch (error) {
    // 投票日志失败不影响主流程
  }

  const latestGameRes = await db.collection('games').doc(gameId).get();
  let latestGame = latestGameRes.data;
  latestGame = await fillMissingBotVotes(gameId, roomId, latestGame);
  if (!latestGame || latestGame.phase !== 'vote') {
    return { ok: true, gameId, phase: latestGame ? latestGame.phase : 'unknown' };
  }

  const latestVotesByOpenId = (latestGame.vote && latestGame.vote.votesByOpenId) || {};
  const submittedCount = Object.keys(latestVotesByOpenId).length;

  if (!allPlayersVoted(latestGame)) {
    const nextVote = Object.assign({}, latestGame.vote || {}, {
      submittedCount,
    });
    await db.collection('games').doc(gameId).update({
      data: {
        vote: nextVote,
        updatedAt: db.serverDate(),
      },
    });

    return {
      ok: true,
      gameId,
      phase: 'vote',
      submittedCount,
      totalCount: (latestGame.vote && latestGame.vote.totalCount) || players.length,
    };
  }

  const result = computeVoteResult(latestGame);

  const nextVote = Object.assign({}, latestGame.vote || {}, {
    submittedCount,
    totalCount: players.length,
    locked: true,
    lockedAt: db.serverDate(),
  });

  await db.collection('games').doc(gameId).update({
    data: {
      phase: 'result',
      status: 'finished',
      result: _.set(result),
      vote: _.set(nextVote),
      updatedAt: db.serverDate(),
    },
  });

  try {
    await db.collection('rooms').doc(roomId).update({
      data: {
        status: 'lobby',
        updatedAt: db.serverDate(),
      },
    });
  } catch (error) {
    // 房间状态更新失败不影响本次结算返回
  }

  return {
    ok: true,
    gameId,
    phase: 'result',
    result: {
      winner: result.winner,
      winnerText: result.winnerText,
      subtitle: result.subtitle,
    },
  };
};
