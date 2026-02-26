const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const ROOM_CODE_RADIX = 36;
const ROOM_CODE_START = 2;
const ROOM_CODE_END = 6;
const MAX_NICKNAME_LENGTH = 20;
const DEBUG_PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

function getEffectiveOpenId(event, openId) {
  const debugPlayerId = ((event && event.__debugPlayerId) || '').trim();
  if (!debugPlayerId || !DEBUG_PLAYER_ID_PATTERN.test(debugPlayerId)) {
    return openId;
  }
  return `${openId}#${debugPlayerId}`;
}

function createRoomCode() {
  return Math.random().toString(ROOM_CODE_RADIX).slice(ROOM_CODE_START, ROOM_CODE_END).toUpperCase();
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const effectiveOpenId = getEffectiveOpenId(event, OPENID);
  const nickname = (event.nickname || '玩家').trim().slice(0, MAX_NICKNAME_LENGTH);

  const room = {
    roomCode: createRoomCode(),
    status: 'lobby',
    players: [{ openId: effectiveOpenId, nickname }],
    config: {
      discussionSeconds: 180,
      roles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager'],
    },
    currentGameId: '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };

  const result = await db.collection('rooms').add({ data: room });

  return {
    roomId: result._id,
    roomCode: room.roomCode,
  };
};
