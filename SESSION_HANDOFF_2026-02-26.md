# Session Handoff (2026-02-26)

## 目标与当前方向
项目已从 Web/Next.js 方向转为：
- **原生微信小程序**（WXML/WXSS/JS）
- **微信云开发（CloudBase）**：云函数 + 云数据库

目标是先完成一个 **可玩的一夜狼人 MVP**（3-20 人，中文，线下同场景）。

## 已确认产品约束（来自本次会话）
- 支持最多 **20 人**
- 仅用于你和朋友线下玩（**不做指标统计**）
- MVP 不做 ready 状态
- MVP 不设固定 host（任意玩家可执行开局等操作）
- 游戏语言为 **简体中文**
- 后端优先使用微信云函数（不走自建 REST/Express）

## 关键文档（已在仓库）
- `/Users/bytedance/Code/1nu_werewolf/PRD.md`
- `/Users/bytedance/Code/1nu_werewolf/UI_SPEC.md`
- `/Users/bytedance/Code/1nu_werewolf/PROJECT_PROGRESS.md`

## 当前代码状态（已完成）
### 小程序端（原生）
已存在并接入云函数的页面：
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/home/index.*`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/lobby/index.*`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/night/index.*`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/vote/index.*`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/result/index.*`

页面链路（代码侧）已打通：
- 首页创建/加入房间
- 大厅轮询房间快照、开始本局
- 夜晚页提交夜晚动作
- 投票页提交投票
- 结算页展示结果、再来一局

同步策略：
- 目前使用 **轮询** `room_get_snapshot`（`setInterval`），暂未使用数据库 `watch()`。
- 这样更容易先跑通，不依赖数据库权限规则/监听配置。

### 云函数端（已实现最小可玩链路）
`cloudfunctions/` 已初始化并配置到 `project.config.json` 的 `cloudfunctionRoot`。

已实现（可用）云函数：
- `room_create`
- `room_join`
- `room_get_snapshot`
- `game_start`
- `game_submit_night_action`
- `game_submit_vote`
- `game_replay`

其他已存在但未完整接入/非当前关键路径：
- `room_update_config`
- `game_reconnect`
- `housekeeping_cleanup`

### 最小规则实现（当前版本）
已实现角色与流程：
- 角色：狼人 / 预言家 / 强盗 / 捣蛋鬼 / 村民
- 开局自动补齐牌组到 `玩家数 + 3`（中心牌固定 3 张）
- 夜晚阶段：所有玩家都需提交一次（无行动角色提交 noop）
- 夜晚结算顺序：`werewolf -> seer -> robber -> troublemaker`
- 投票阶段：所有玩家提交后自动结算
- 平票：最高票平票全出局
- 胜负（当前最小版）：
  - 若有狼人被票出 => 村民胜
  - 否则 => 狼人胜

## 重要配置（必须确认）
### 1) 云环境 ID
文件：`/Users/bytedance/Code/1nu_werewolf/miniprogram/app.js`

当前代码中使用：
```js
wx.cloud.init({
  env: 'cloud1',
  traceUser: true,
})
```
你已经反馈之前 `INVALID_ENV`，后来已能继续，说明你会改这个值。

下一个 session 要先确认这里仍然是**真实云环境 ID**，不是占位字符串。

### 2) 微信开发者工具项目配置
文件：`/Users/bytedance/Code/1nu_werewolf/project.config.json`

已包含：
- `miniprogramRoot: "miniprogram/"`
- `cloudfunctionRoot: "cloudfunctions/"`

## 你必须手动完成的操作（无法由 Codex 代做）
在微信开发者工具里完成：

### A. 创建云数据库集合
至少要有：
- `rooms`
- `games`
- `actions`
- `votes`

### B. 上传并部署云函数（云端安装依赖）
优先部署以下函数（最小可玩链路必须）：
1. `room_create`
2. `room_join`
3. `room_get_snapshot`
4. `game_start`
5. `game_submit_night_action`
6. `game_submit_vote`
7. `game_replay`

可后续再部署：
- `room_update_config`
- `game_reconnect`
- `housekeeping_cleanup`

## 建议的联调顺序（下一个 session 直接照着做）
1. 在微信开发者工具中确认 `app.js` 的 `env` 为真实环境 ID
2. 创建数据库集合（`rooms/games/actions/votes`）
3. 部署 7 个关键云函数（云端安装依赖）
4. 用设备 A：创建房间
5. 用设备 B：加入房间（输入房间码）
6. 任意一方在大厅点击“开始本局”
7. 两边都在夜晚页提交动作
8. 两边都在投票页提交投票
9. 查看结算页结果
10. 点击“再来一局”验证重开链路

## 常见报错与定位方式（已知）
### 1) `cloud.callFunction ... INVALID_ENV`
原因：`wx.cloud.init({ env })` 配错（不是合法环境 ID）

处理：改 `/Users/bytedance/Code/1nu_werewolf/miniprogram/app.js` 中 `env`

### 2) 首页显示“创建失败/加入失败”
当前首页会隐藏具体异常（只展示友好文案），排查要看：
- 微信开发者工具 console
- 对应云函数日志（云开发控制台）

建议下一个 session 如需提高可调试性：
- 在首页 `catch` 里临时 `console.error(error)`
- 直接把 `error.errMsg` toast 出来（仅联调阶段）

### 3) 开局失败但房间里已有在进行对局
`game_start` 已处理 `GAME_ALREADY_RUNNING`，大厅页会尝试直接进入当前阶段。

## 代码质量与检查结果（本次会话）
- 前端 JS 已使用 `standard-lint --autofix`，通过
- 多个关键云函数已通过 `node -c` 语法检查

注意：
- 这是个 **TypeScript 项目背景**，但小程序/云函数当前仍为 **JS**（为先打通可玩链路）
- TS 化已记录在 `/Users/bytedance/Code/1nu_werewolf/PROJECT_PROGRESS.md` 的后续阶段里

## 重要文件索引（下个 session高频查看）
### 小程序入口与云函数调用封装
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/app.js`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/utils/cloud-api.js`

### 小程序页面（联调重点）
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/home/index.js`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/lobby/index.js`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/night/index.js`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/vote/index.js`
- `/Users/bytedance/Code/1nu_werewolf/miniprogram/pages/result/index.js`

### 云函数（联调重点）
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/room_create/index.js`
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/room_join/index.js`
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/room_get_snapshot/index.js`
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/game_start/index.js`
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/game_submit_night_action/index.js`
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/game_submit_vote/index.js`
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/game_replay/index.js`

## 目前最可能还需要修的地方（下个 session优先关注）
1. 云数据库字段更新兼容性（部分点路径写法/嵌套对象写回在不同环境表现差异）
2. 并发提交导致的重复结算（当前有基础防护，但还未严格幂等）
3. 页面轮询跳转边界（`redirectTo/navigateTo` 在某些栈状态下失败）
4. 云数据库权限规则未配置时的联调行为差异
5. 夜晚动作合法性校验仍是最小版（前端/后端都可继续收紧）

## 下一个 session 的建议起手动作（最省时间）
1. 让你先完成：建表 + 部署 7 个云函数
2. 立刻实测一局
3. 把第一条报错（小程序 `errMsg` + 云函数日志）贴回来
4. 继续修到稳定可玩

