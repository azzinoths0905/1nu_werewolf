# 项目进度（狼人杀一夜版 - 微信小程序）

## 项目目标
在微信小程序 + 云开发（云函数/云数据库）架构下，完成一个可供 3-20 人线下游玩的最小可玩版本（MVP），能跑通一局完整流程：
- 创建/加入房间
- 大厅展示玩家
- 开始本局
- 夜晚阶段（提交动作）
- 投票阶段（提交投票）
- 结算阶段（自动结算）
- 再来一局

## 当前架构（已确定）
- 前端：原生微信小程序（WXML/WXSS/JS）
- 后端：微信云开发云函数（CloudBase）
- 存储：云数据库（`rooms` / `games` / `actions` / `votes`）
- 同步策略：客户端轮询 `room_get_snapshot`（先不依赖 `watch`）

## 总体路线图
### Phase 0 - 需求与设计（已完成）
- [x] PRD（移动端、中文、3-20 人、无固定房主）
- [x] UI 规格（Mobile MVP）
- [x] 移动端界面稿（静态）

### Phase 1 - 项目骨架（已完成）
- [x] 微信小程序项目目录结构
- [x] 5 个页面骨架（首页/大厅/夜晚/投票/结算）
- [x] `project.config.json` / `cloudfunctionRoot`
- [x] `wx.cloud.init` 初始化
- [x] 云函数目录与模板（10 个函数）

### Phase 2 - 最小可玩链路（大部分已完成）
- [x] 创建房间（`room_create`）
- [x] 加入房间（`room_join`）
- [x] 大厅拉取快照（`room_get_snapshot`）
- [x] 开始本局（`game_start`）
- [x] 开局分配角色与对局状态初始化（真实逻辑）
- [x] 夜晚行动提交（真实写入 + 阶段推进）
- [x] 投票提交（真实写入 + 自动结算）
- [x] 结算快照（脱敏/最终揭示）
- [x] 页面接入真实对局数据（夜晚/投票/结算）
- [x] 轮询同步（无 `watch` 版本）
- [ ] 微信开发者工具中实际联调验证完整一局（待你部署云函数后验证）

### Phase 3 - 稳定性与可用性（部分待做）
- [ ] 断线重进（`game_reconnect` 完整脱敏返回 / 页面接入）
- [ ] 房间状态冲突处理（并发开始/重复提交进一步收敛）
- [ ] 云数据库权限规则建议稿 + 最小安全配置
- [ ] 错误提示细化（按错误码显示）

### Phase 4 - 工程化（待开始）
- [ ] TypeScript 化（小程序与云函数）
- [ ] 共享类型与协议定义
- [ ] 云函数单元测试 / 本地模拟测试

## 当前状态（最新）
### 已打通（代码侧）
- 首页：创建房间 / 加入房间（云函数调用）
- 大厅：轮询房间快照、显示玩家与角色池、开始本局
- 夜晚页：根据身份动态动作选项、提交夜晚动作、等待所有玩家完成
- 投票页：显示候选玩家、提交投票、等待自动结算
- 结算页：显示胜负、票数、初始/最终身份、再来一局
- 云函数：已实现最小版本角色分配 + 夜晚结算（预言家/强盗/捣蛋鬼）+ 投票结算

### 当前实现的规则说明（最小可玩）
- 角色：狼人 / 预言家 / 强盗 / 捣蛋鬼 / 村民
- 牌组：会根据人数自动补齐（中心牌固定 3 张）
- 夜晚：所有玩家都要提交一次（无行动角色提交 noop）
- 结算：按最高票（平票全出局）结算；若有狼人被票出则村民胜，否则狼人胜

### 仍需你手动完成（我无法代操作）
1. 云数据库创建集合：`rooms`, `games`, `actions`, `votes`
2. 云函数上传部署（云端安装依赖）
3. 确认 `miniprogram/app.js` 中 `wx.cloud.init({ env })` 为真实环境 ID
4. 用两台或多台设备实测一局（创建 -> 加入 -> 开始 -> 夜晚 -> 投票 -> 结算）

## 本轮新增/修改的关键文件
- `PROJECT_PROGRESS.md`（本文件）
- `cloudfunctions/game_start/index.js`
- `cloudfunctions/game_replay/index.js`
- `cloudfunctions/game_submit_night_action/index.js`
- `cloudfunctions/game_submit_vote/index.js`
- `cloudfunctions/room_get_snapshot/index.js`
- `miniprogram/pages/home/index.js`
- `miniprogram/pages/lobby/index.js`
- `miniprogram/pages/lobby/index.wxml`
- `miniprogram/pages/night/index.js`
- `miniprogram/pages/night/index.wxml`
- `miniprogram/pages/vote/index.js`
- `miniprogram/pages/vote/index.wxml`
- `miniprogram/pages/result/index.js`
- `miniprogram/pages/result/index.wxml`
- `miniprogram/app.wxss`

## 最近更新记录
- 2026-02-26：新增本进度文件，统一记录实施路线与状态。
- 2026-02-26：完成最小可玩链路代码实现（云函数逻辑 + 夜晚/投票/结算页面接入 + 轮询同步）。
- 2026-02-26：下一步优先事项变为“云端部署与真机联调”。
