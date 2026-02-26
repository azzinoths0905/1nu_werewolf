const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const MAX_ROOM_PLAYERS = 20;
const MAX_ADD_BOTS_ONCE = 18;
const DEBUG_PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

function getEffectiveOpenId(event, openId) {
  const debugPlayerId = ((event && event.__debugPlayerId) || '').trim();
  if (!debugPlayerId || !DEBUG_PLAYER_ID_PATTERN.test(debugPlayerId)) {
    return openId;
  }
  return `${openId}#${debugPlayerId}`;
}

function buildBotId(roomId, index) {
  return `bot:${roomId}:${Date.now()}:${index}`;
}

function nextBotName(players) {
  let maxIndex = 0;
  (players || []).forEach((player) => {
    if (!player || !player.isBot) {
      return;
    }
    const match = /^机器人(\d+)$/.exec(player.nickname || '');
    if (!match) {
      return;
    }
    const currentIndex = Number(match[1]);
    if (Number.isFinite(currentIndex) && currentIndex > maxIndex) {
      maxIndex = currentIndex;
    }
  });
  return `机器人${maxIndex + 1}`;
}

exports.main = async (event) => {
  const roomId = (event.roomId || '').trim();
  const requestedCount = Math.floor(Number(event.count) || 0);
  const count = Math.max(1, Math.min(MAX_ADD_BOTS_ONCE, requestedCount || 1));
  const isDebugCall = !!(event && event.__debugAllowBotOps);
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);

  if (!isDebugCall) {
    return { ok: false, error: 'DEBUG_ONLY' };
  }
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

  if (!room) {
    return { ok: false, error: 'ROOM_NOT_FOUND' };
  }
  if (room.status !== 'lobby') {
    return { ok: false, error: 'GAME_ALREADY_STARTED' };
  }

  const players = Array.isArray(room.players) ? room.players.slice() : [];
  const callerInRoom = players.some((player) => player && player.openId === effectiveOpenId);
  if (!callerInRoom) {
    return { ok: false, error: 'NOT_IN_ROOM' };
  }

  const availableSlots = Math.max(0, MAX_ROOM_PLAYERS - players.length);
  const addedCount = Math.min(availableSlots, count);
  for (let index = 0; index < addedCount; index += 1) {
    players.push({
      openId: buildBotId(roomId, index),
      nickname: nextBotName(players),
      isBot: true,
    });
  }

  if (!addedCount) {
    return { ok: true, addedCount: 0, playerCount: players.length };
  }

  await db.collection('rooms').doc(roomId).update({
    data: {
      players,
      updatedAt: db.serverDate(),
    },
  });

  return {
    ok: true,
    addedCount,
    playerCount: players.length,
  };
};
