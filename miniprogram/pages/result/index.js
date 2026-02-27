/* global Page, wx */
const { roomGetSnapshot, gameReplay } = require('../../utils/cloud-api');

const POLL_INTERVAL_MS = 3000;

Page({
  data: {
    roomId: '',
    gameId: '',
    winnerText: '结算中...',
    subtitle: '正在同步结算结果',
    results: [],
    winnerTheme: 'pending',
    topVoteValue: 0,
  },

  onShow() {
    this._pollTimer = null;
    const roomId = wx.getStorageSync('roomId') || '';
    if (!roomId) {
      wx.showToast({ title: '缺少房间信息', icon: 'none' });
      return;
    }
    this.setData({ roomId });
    this.refreshResult();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      this.refreshResult();
    }, POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async refreshResult() {
    if (!this.data.roomId) {
      return;
    }

    try {
      const snapshot = await roomGetSnapshot({ roomId: this.data.roomId });
      if (!snapshot.ok) {
        wx.showToast({ title: '结算拉取失败', icon: 'none' });
        return;
      }

      const {game} = snapshot;
      if (!game) {
        wx.redirectTo({ url: '/pages/lobby/index' });
        return;
      }

      wx.setStorageSync('gameId', game.gameId || '');

      if (game.phase !== 'result') {
        if (game.phase === 'night') {
          wx.redirectTo({ url: '/pages/night/index' });
          return;
        }
        if (game.phase === 'vote') {
          wx.redirectTo({ url: '/pages/vote/index' });
          return;
        }
      }

      const result = game.result || {};
      const rows = result.rows || [];
      const topVoteValue = rows.reduce((max, row) => {
        const votes = Number(row.votesReceived) || 0;
        return votes > max ? votes : max;
      }, 0);
      const winnerText = result.winnerText || '结算中...';
      this.setData({
        gameId: game.gameId || '',
        winnerText,
        subtitle: result.subtitle || '正在同步结算结果',
        results: rows,
        topVoteValue,
        winnerTheme: winnerText.includes('村民') ? 'village' : winnerText.includes('狼人') ? 'wolf' : 'pending',
      });
    } catch {
      wx.showToast({ title: '结算拉取失败', icon: 'none' });
    }
  },

  async replay() {
    if (!this.data.roomId) {
      return;
    }

    wx.showLoading({ title: '开新一局...' });
    try {
      const result = await gameReplay({ roomId: this.data.roomId });
      if (!result.ok) {
        wx.showToast({ title: '开局失败', icon: 'none' });
        return;
      }
      wx.setStorageSync('gameId', result.gameId || '');
      wx.redirectTo({ url: '/pages/night/index' });
    } catch {
      wx.showToast({ title: '开局失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  backLobby() {
    wx.redirectTo({
      url: '/pages/lobby/index',
    });
  },
});
