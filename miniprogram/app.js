/* global App, wx */
App({
  onLaunch() {
    if (!wx.cloud) {
       
      console.error('基础库版本过低，请升级微信后重试');
      return;
    }

    wx.cloud.init({
      env: 'cloud1-5gnf6g3yb4528b8a',
      traceUser: true,
    });
  },

  globalData: {
    roomCode: '7K9M',
  },
});
