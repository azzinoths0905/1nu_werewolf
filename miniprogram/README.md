# One Night Werewolf - 微信小程序

## 运行方式
1. 打开微信开发者工具
2. 导入项目目录：`/Users/bytedance/Code/1nu_werewolf`
3. AppID 可先使用 `touristappid` 体验（真机与发布需替换为你自己的 AppID）
4. 确认 `miniprogramRoot` 为 `miniprogram/`

## 目录结构
- `miniprogram/app.js`：全局逻辑
- `miniprogram/app.json`：全局路由与窗口配置
- `miniprogram/app.wxss`：全局样式
- `miniprogram/pages/*`：页面文件（`.js` `.json` `.wxml` `.wxss`）

## MVP 页面
- `pages/home/index`：首页（创建/加入）
- `pages/lobby/index`：大厅
- `pages/night/index`：夜晚行动
- `pages/vote/index`：投票阶段
- `pages/result/index`：结算阶段
