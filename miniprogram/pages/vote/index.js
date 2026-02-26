/* global Page, wx */
const { roomGetSnapshot, gameSubmitVote } = require('../../utils/cloud-api');

const POLL_INTERVAL_MS = 2000;

Page({
  data: {
    roomId: '',
    gameId: '',
    votes: [],
    selectedTargetOpenId: '',
    submittedCount: 0,
    totalCount: 0,
    privateNightResult: '',
    statusHint: '请选择你认为的狼人',
  },

  onShow() {
    this._pollTimer = null;
    this._isNavigating = false;
    const roomId = wx.getStorageSync('roomId') || '';
    if (!roomId) {
      wx.showToast({ title: '缺少房间信息', icon: 'none' });
      return;
    }
    this.setData({ roomId });
    this.refreshGame();
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
      this.refreshGame();
    }, POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  routeToPhase(phase) {
    if (this._isNavigating) {
      return;
    }
    this._isNavigating = true;
    this.stopPolling();

    let url = '/pages/vote/index';
    if (phase === 'result') {
      url = '/pages/result/index';
    }
    if (phase === 'night') {
      url = '/pages/night/index';
    }

    wx.redirectTo({
      url,
      fail: () => {
        this._isNavigating = false;
        this.startPolling();
      },
    });
  },

  async refreshGame() {
    if (!this.data.roomId) {
      return;
    }

    try {
      const snapshot = await roomGetSnapshot({ roomId: this.data.roomId });
      if (!snapshot.ok) {
        wx.showToast({ title: '状态拉取失败', icon: 'none' });
        return;
      }

      const {game} = snapshot;
      if (!game) {
        wx.redirectTo({ url: '/pages/lobby/index' });
        return;
      }

      wx.setStorageSync('gameId', game.gameId || '');
      if (game.phase !== 'vote') {
        this.routeToPhase(game.phase);
        return;
      }

      const vote = game.vote || {};
      const candidates = vote.candidates || [];
      let selectedTargetOpenId = vote.selectedTargetOpenId || this.data.selectedTargetOpenId || '';
      if (!selectedTargetOpenId && candidates.length > 0) {
        selectedTargetOpenId = candidates[0].openId;
      }

      this.setData({
        gameId: game.gameId || '',
        votes: candidates,
        selectedTargetOpenId,
        submittedCount: vote.submittedCount || 0,
        totalCount: vote.totalCount || 0,
        privateNightResult: (game.me && game.me.privateNightResult) || '',
        statusHint: vote.hasVoted ? '你已投票，可在锁票前改票' : '请选择你认为的狼人',
      });
    } catch {
      wx.showToast({ title: '状态拉取失败', icon: 'none' });
    }
  },

  chooseVote(event) {
    const targetOpenId = event.currentTarget.dataset.openid || '';
    if (!targetOpenId) {
      return;
    }
    this.setData({ selectedTargetOpenId: targetOpenId });
  },

  async submitVote() {
    if (!this.data.roomId || !this.data.gameId || !this.data.selectedTargetOpenId) {
      wx.showToast({ title: '请选择投票目标', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      const result = await gameSubmitVote({
        roomId: this.data.roomId,
        gameId: this.data.gameId,
        targetOpenId: this.data.selectedTargetOpenId,
      });

      if (!result.ok) {
        wx.showToast({ title: '提交失败', icon: 'none' });
        return;
      }

      if (result.phase && result.phase !== 'vote') {
        this.routeToPhase(result.phase);
        return;
      }

      await this.refreshGame();
    } catch {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
