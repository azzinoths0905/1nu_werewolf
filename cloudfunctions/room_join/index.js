const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const MAX_NICKNAME_LENGTH = 20;
const MAX_ROOM_PLAYERS = 20;
const DEBUG_PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

function getEffectiveOpenId(event, openId) {
  const debugPlayerId = ((event && event.__debugPlayerId) || '').trim();
  if (!debugPlayerId || !DEBUG_PLAYER_ID_PATTERN.test(debugPlayerId)) {
    return openId;
  }
  return `${openId}#${debugPlayerId}`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);
  const roomCode = (event.roomCode || '').trim().toUpperCase();
  const nickname = (event.nickname || '玩家').trim().slice(0, MAX_NICKNAME_LENGTH);

  const roomQuery = await db.collection('rooms').where({ roomCode }).limit(1).get();
  const room = roomQuery.data[0];

  if (!room) {
    return { ok: false, error: 'ROOM_NOT_FOUND' };
  }

  if (room.status !== 'lobby') {
    return { ok: false, error: 'GAME_ALREADY_STARTED' };
  }

  if ((room.players || []).length >= MAX_ROOM_PLAYERS) {
    return { ok: false, error: 'ROOM_FULL' };
  }

  const exists = (room.players || []).some((player) => player.openId === effectiveOpenId);
  if (!exists) {
    room.players.push({ openId: effectiveOpenId, nickname });
    await db.collection('rooms').doc(room._id).update({
      data: {
        players: room.players,
        updatedAt: db.serverDate(),
      },
    });
  }

  return { ok: true, roomId: room._id, roomCode: room.roomCode };
};
