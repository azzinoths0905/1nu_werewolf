/* global wx */
const DEBUG_PLAYER_STORAGE_KEY = 'ww_debug_player_id';

function getDebugPlayerId() {
  try {
    return (wx.getStorageSync(DEBUG_PLAYER_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function callCloud(name, data) {
  const payload = Object.assign({}, data || {});
  const debugPlayerId = getDebugPlayerId();
  if (debugPlayerId) {
    payload.__debugPlayerId = debugPlayerId;
  }

  return wx.cloud.callFunction({
    name,
    data: payload,
  }).then((res) => res.result || {});
}

module.exports = {
  DEBUG_PLAYER_STORAGE_KEY,
  roomCreate: (payload) => callCloud('room_create', payload),
  roomJoin: (payload) => callCloud('room_join', payload),
  roomAddBots: (payload) => callCloud('room_add_bots', payload),
  roomUpdateConfig: (payload) => callCloud('room_update_config', payload),
  gameStart: (payload) => callCloud('game_start', payload),
  gameSubmitNightAction: (payload) => callCloud('game_submit_night_action', payload),
  gameSubmitVote: (payload) => callCloud('game_submit_vote', payload),
  gameReplay: (payload) => callCloud('game_replay', payload),
  gameReconnect: (payload) => callCloud('game_reconnect', payload),
  roomGetSnapshot: (payload) => callCloud('room_get_snapshot', payload),
  housekeepingCleanup: (payload) => callCloud('housekeeping_cleanup', payload),
};
