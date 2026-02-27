/* global Page, wx */
const { roomGetSnapshot, gameStart, roomAddBots } = require('../../utils/cloud-api');

const POLL_INTERVAL_MS = 2000;
const DEBUG_MAX_ADD_BOTS_ONCE = 18;

Page({
  data: {
    roomId: '',
    roomCode: '----',
    playerText: '',
    players: [],
    roles: [],
    playerCount: 0,
    roleCount: 0,
    roomStatus: 'lobby',
    currentGameId: '',
    statusHint: '等待玩家加入',
    showDebugStartTools: false,
    debugBotCount: 1,
  },

  onShow() {
    this._pollTimer = null;
    this._isNavigating = false;
    const roomId = wx.getStorageSync('roomId') || '';
    if (!roomId) {
      wx.showToast({ title: '缺少房间信息', icon: 'none' });
      return;
    }

    this.initDebugStartTools();
    this.setData({ roomId });
    this.refreshRoom();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  initDebugStartTools() {
    let showDebugStartTools = false;
    try {
      const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
      const envVersion = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.envVersion : '';
      showDebugStartTools = envVersion !== 'release';
    } catch {
      showDebugStartTools = true;
    }

    this.setData({
      showDebugStartTools,
    });
  },

  onDebugBotCountInput(event) {
    const rawValue = (event.detail.value || '').trim();
    if (!rawValue) {
      this.setData({ debugBotCount: 1 });
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const debugBotCount = Math.max(1, Math.min(DEBUG_MAX_ADD_BOTS_ONCE, Math.floor(parsed)));
    this.setData({ debugBotCount });
  },

  startPolling() {
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      this.refreshRoom();
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

    let url = '/pages/night/index';
    if (phase === 'vote') {
      url = '/pages/vote/index';
    }
    if (phase === 'result') {
      url = '/pages/result/index';
    }

    wx.navigateTo({
      url,
      fail: () => {
        this._isNavigating = false;
        this.startPolling();
      },
    });
  },

  async refreshRoom() {
    if (!this.data.roomId) {
      return;
    }

    try {
      const snapshot = await roomGetSnapshot({ roomId: this.data.roomId });
      if (!snapshot.ok) {
        wx.showToast({ title: '房间不存在或无权限', icon: 'none' });
        return;
      }

      const room = snapshot.room || {};
      const players = room.players || [];
      const playerNames = players.map((item) => item.nickname || '玩家');
      const {game} = snapshot;

      if (room.currentGameId) {
        wx.setStorageSync('gameId', room.currentGameId);
      }

      this.setData({
        roomCode: room.roomCode || '----',
        playerText: playerNames.join(' · '),
        players: players.map((item, index) => ({
          seatNo: index + 1,
          nickname: item.nickname || `玩家${index + 1}`,
          isBot: !!item.isBot,
        })),
        roles: room.roleChips || [],
        playerCount: room.playerCount || playerNames.length,
        roleCount: (room.roleChips || []).length,
        roomStatus: room.status || 'lobby',
        currentGameId: room.currentGameId || '',
        statusHint: room.status === 'in_game' ? '对局进行中，正在同步阶段...' : '等待玩家加入',
      });

      if (room.status === 'in_game' && game && game.phase) {
        this.routeToPhase(game.phase);
      }
    } catch {
      wx.showToast({ title: '房间拉取失败', icon: 'none' });
    }
  },

  async startGame() {
    if (!this.data.roomId) {
      return;
    }

    wx.showLoading({ title: '开局中...' });
    try {
      const result = await gameStart({ roomId: this.data.roomId });
      if (!result.ok) {
        if (result.error === 'GAME_ALREADY_RUNNING' && result.gameId) {
          wx.setStorageSync('gameId', result.gameId);
          this.routeToPhase('night');
          return;
        }
        wx.showToast({ title: '开局失败', icon: 'none' });
        return;
      }
      wx.setStorageSync('gameId', result.gameId || '');
      this.routeToPhase(result.phase || 'night');
    } catch {
      wx.showToast({ title: '开局失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async addBots() {
    if (!this.data.roomId) {
      return;
    }
    if (!this.data.showDebugStartTools) {
      return;
    }

    const count = Math.max(1, Math.min(DEBUG_MAX_ADD_BOTS_ONCE, Number(this.data.debugBotCount) || 1));
    wx.showLoading({ title: '添加机器人...' });
    try {
      const result = await roomAddBots({
        roomId: this.data.roomId,
        count,
        __debugAllowBotOps: true,
      });
      if (!result.ok) {
        wx.showToast({ title: '添加失败', icon: 'none' });
        return;
      }

      wx.showToast({ title: `已添加 ${result.addedCount || 0} 个`, icon: 'none' });
      this.refreshRoom();
    } catch {
      wx.showToast({ title: '添加失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
