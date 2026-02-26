/* global Page, wx */
const { roomGetSnapshot, gameSubmitNightAction } = require('../../utils/cloud-api');

const POLL_INTERVAL_MS = 2000;

Page({
  data: {
    roomId: '',
    gameId: '',
    roleText: '未知身份',
    instruction: '等待同步对局状态...',
    actions: [],
    selectedActionIndex: 0,
    hasSubmitted: false,
    submittedCount: 0,
    totalCount: 0,
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
        wx.showToast({ title: '对局状态拉取失败', icon: 'none' });
        return;
      }

      const {game} = snapshot;
      if (!game) {
        wx.showToast({ title: '本局尚未开始', icon: 'none' });
        wx.redirectTo({ url: '/pages/lobby/index' });
        return;
      }

      wx.setStorageSync('gameId', game.gameId || '');

      if (game.phase !== 'night') {
        this.routeToPhase(game.phase);
        return;
      }

      const night = game.night || {};
      const actions = night.actionOptions || [];
      let {selectedActionIndex} = this.data;
      if (selectedActionIndex >= actions.length) {
        selectedActionIndex = 0;
      }

      this.setData({
        gameId: game.gameId || '',
        roleText: (game.me && game.me.initialRoleText) || '未知身份',
        instruction: night.instruction || '等待同步...',
        actions,
        selectedActionIndex,
        hasSubmitted: !!night.hasSubmitted,
        submittedCount: night.submittedCount || 0,
        totalCount: night.totalCount || 0,
      });
    } catch {
      wx.showToast({ title: '对局状态拉取失败', icon: 'none' });
    }
  },

  chooseAction(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    if (Number.isNaN(index)) {
      return;
    }
    this.setData({ selectedActionIndex: index });
  },

  async confirmAction() {
    if (!this.data.roomId || !this.data.gameId) {
      wx.showToast({ title: '缺少对局信息', icon: 'none' });
      return;
    }

    const actions = this.data.actions || [];
    const selected = actions[this.data.selectedActionIndex] || {
      actionType: 'noop',
      actionData: {},
    };

    wx.showLoading({ title: this.data.hasSubmitted ? '刷新中...' : '提交中...' });
    try {
      const result = await gameSubmitNightAction({
        roomId: this.data.roomId,
        gameId: this.data.gameId,
        actionType: selected.actionType,
        actionData: selected.actionData || {},
      });

      if (!result.ok) {
        wx.showToast({ title: '提交失败', icon: 'none' });
        return;
      }

      if (result.phase && result.phase !== 'night') {
        this.routeToPhase(result.phase);
        return;
      }

      this.refreshGame();
    } catch {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
