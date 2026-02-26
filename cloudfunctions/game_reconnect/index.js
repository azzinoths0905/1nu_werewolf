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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);
  const roomId = (event.roomId || '').trim();

  const roomRes = await db.collection('rooms').doc(roomId).get();
  const room = roomRes.data;

  if (!room) {
    return { ok: false, error: 'ROOM_NOT_FOUND' };
  }

  const gameId = room.currentGameId;
  const game = gameId ? (await db.collection('games').doc(gameId).get()).data : null;

  const resolvedPlayerOpenId = resolvePlayerOpenId(room.players || [], OPENID, effectiveOpenId);
  const seatIndex = (room.players || []).findIndex((player) => player.openId === resolvedPlayerOpenId);

  return {
    ok: true,
    room,
    game,
    seatIndex,
  };
};
