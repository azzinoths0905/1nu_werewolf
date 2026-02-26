const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event) => {
  const roomId = (event.roomId || '').trim();
  const patch = event.config || {};

  const roomRes = await db.collection('rooms').doc(roomId).get();
  const room = roomRes.data;

  if (!room || room.status !== 'lobby') {
    return { ok: false, error: 'ROOM_NOT_EDITABLE' };
  }

  const nextConfig = {
    ...(room.config || {}),
    ...patch,
  };

  await db.collection('rooms').doc(roomId).update({
    data: {
      config: nextConfig,
      updatedAt: db.serverDate(),
    },
  });

  return { ok: true, roomId, config: nextConfig };
};
