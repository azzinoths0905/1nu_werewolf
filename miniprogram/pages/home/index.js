/* global Page, wx */
const { DEBUG_PLAYER_STORAGE_KEY, roomCreate, roomJoin } = require('../../utils/cloud-api');

const ERROR_MESSAGES = {
  ROOM_NOT_FOUND: '房间不存在',
  ROOM_FULL: '房间已满',
  GAME_ALREADY_STARTED: '本局已开始，请等下一局',
};

function errorText(result, fallback) {
  if (!result || !result.error) {
    return fallback;
  }
  return ERROR_MESSAGES[result.error] || fallback;
}

Page({
  data: {
    nickname: '',
    roomCode: '',
    debugPlayerId: '',
    showDebugIdentityTools: false,
  },

  onLoad() {
    let showDebugIdentityTools = false;
    try {
      const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
      const envVersion = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.envVersion : '';
      showDebugIdentityTools = envVersion !== 'release';
    } catch {
      showDebugIdentityTools = true;
    }

    this.setData({
      showDebugIdentityTools,
      debugPlayerId: wx.getStorageSync(DEBUG_PLAYER_STORAGE_KEY) || '',
    });
  },

  onNicknameInput(event) {
    this.setData({ nickname: event.detail.value });
  },

  onRoomCodeInput(event) {
    this.setData({ roomCode: (event.detail.value || '').toUpperCase() });
  },

  onDebugPlayerIdInput(event) {
    const debugPlayerId = (event.detail.value || '').trim();
    this.setData({ debugPlayerId });
    wx.setStorageSync(DEBUG_PLAYER_STORAGE_KEY, debugPlayerId);
  },

  setDebugPlayerPreset(event) {
    const debugPlayerId = (event.currentTarget.dataset.playerid || '').trim();
    this.setData({ debugPlayerId });
    wx.setStorageSync(DEBUG_PLAYER_STORAGE_KEY, debugPlayerId);
  },

  clearDebugPlayerId() {
    this.setData({ debugPlayerId: '' });
    wx.removeStorageSync(DEBUG_PLAYER_STORAGE_KEY);
  },

  async createRoom() {
    const nickname = (this.data.nickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    try {
      const result = await roomCreate({ nickname });
      if (!result.roomId) {
        wx.showToast({ title: errorText(result, '创建失败'), icon: 'none' });
        return;
      }
      wx.setStorageSync('roomId', result.roomId || '');
      wx.navigateTo({ url: '/pages/lobby/index' });
    } catch {
      wx.showToast({ title: '创建失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async joinRoom() {
    const nickname = (this.data.nickname || '').trim();
    const roomCode = (this.data.roomCode || '').trim();

    if (!nickname || !roomCode) {
      wx.showToast({ title: '请输入昵称和房间码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...' });
    try {
      const result = await roomJoin({ nickname, roomCode });
      if (!result.ok) {
        wx.showToast({ title: errorText(result, '加入失败'), icon: 'none' });
        return;
      }
      wx.setStorageSync('roomId', result.roomId || '');
      wx.navigateTo({ url: '/pages/lobby/index' });
    } catch {
      wx.showToast({ title: '加入失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
