const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const EXPIRE_HOURS = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

exports.main = async () => {
  const expireAt = Date.now() - EXPIRE_HOURS * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

  const staleRooms = await db.collection('rooms').where({
    updatedAt: _.lt(new Date(expireAt)),
  }).get();

  let removed = 0;
  for (const room of staleRooms.data || []) {
    await db.collection('rooms').doc(room._id).remove();
    removed += 1;
  }

  return {
    ok: true,
    removed,
  };
};
