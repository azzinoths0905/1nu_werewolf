# Cloud Functions

本目录用于微信云函数（CloudBase）。

## 已初始化函数
- room_create
- room_join
- room_update_config
- game_start
- game_submit_night_action
- game_submit_vote
- game_replay
- game_reconnect
- room_get_snapshot
- housekeeping_cleanup

## 说明
1. 每个函数目录下都包含 `index.js` 与 `package.json`。
2. 函数内使用：
   - `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`
3. 上传方式：微信开发者工具 -> 云开发 -> 云函数，选择函数后上传部署。
4. 首次部署前请先在云数据库创建集合：
   - `rooms`
   - `games`
   - `actions`
   - `votes`
