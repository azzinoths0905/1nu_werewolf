# UI Specification (Mobile MVP)

## Product
One Night Werewolf (狼人杀一夜版)

## Version
v1.0 MVP

## Date
2026-02-13

## 1. Scope
This document defines the mobile UI specification for MVP based on `/Users/bytedance/Code/1nu_werewolf/PRD.md`.

Constraints:
- Mobile only (phone-first)
- Simplified Chinese only
- 3-20 players per room
- No host role/access control in MVP

## 2. Information Architecture
Main flow:
1. 首页（创建/加入）
2. 大厅（房间与配置）
3. 夜晚行动（按身份执行）
4. 投票阶段
5. 结算阶段

Global non-blocking overlays:
- 弱网提示
- 重连中
- 错误 Toast

## 3. Viewport and Layout Rules
- Design width baseline: 390px
- Supported width: 360px to 430px
- Safe area: support notch phones (`viewport-fit=cover`)
- Minimum touch target: 44px x 44px
- Page horizontal padding: 12px
- Card radius: 12-18px
- Vertical rhythm: 8px grid

## 4. Visual System (MVP)
### 4.1 Color Tokens
- `bg/base`: `#070A12`
- `bg/panel`: `#121C30`
- `border/default`: `#2D436D`
- `text/primary`: `#F6F8FF`
- `text/secondary`: `#A8B8DE`
- `accent/primary`: `#43F4B1`
- `status/danger`: `#FF7D72`

### 4.2 Typography
- Font family: `PingFang SC`, `Hiragino Sans GB`, `Noto Sans CJK SC`, sans-serif
- H1/H2: 26px, semibold
- Section title: 14px, semibold
- Body: 14px regular
- Meta/caption: 12px regular

### 4.3 Elevation and Surface
- Screen card shadow: `0 14px 30px rgba(0, 0, 0, 0.28)`
- Primary button style: high contrast filled button
- Secondary button style: outline button

## 5. Components
### 5.1 Buttons
- Primary (`btn-primary`): confirm or forward progression
- Secondary (`btn-ghost`): secondary actions
- Disabled state: 40% opacity + no shadow + no click

### 5.2 Input
- Single-line text input for nickname / room code
- Error state: red border + inline error text

### 5.3 Status Tag
- Small top tag to indicate current screen phase (e.g., 首页/大厅/夜晚阶段)

### 5.4 Timer
- Default timer style for normal phase
- Danger timer style when remaining <= 15 seconds

### 5.5 Selection Cards
- Night action choices
- Vote candidates
- Active state uses accent border + tinted background

### 5.6 Result Rows
- Player name + final role
- Two-column row with left-right alignment

### 5.7 Toast
- Bottom toast, auto-dismiss 2.5s
- Types: info / success / error

## 6. Screen Specs
## 6.1 S01 首页
### Purpose
Entry point for create/join room.

### Layout
- Tag: `首页`
- Title: `今晚谁是狼人？`
- Subtitle: `输入昵称，3-20 人线下开玩。`
- Panel:
  - Label: `昵称`
  - Input placeholder: `例如：阿哲`
  - Primary button: `创建房间`
  - Secondary button: `加入房间`

### Actions
- Tap `创建房间`: create room and route to S02
- Tap `加入房间`: open room-code input sheet or inline field

### Validation
- Nickname required
- Nickname length: 1-20 chars
- Trim leading/trailing spaces

### States
- Default
- Loading (`正在创建...` / `正在加入...`)
- Error (`昵称不能为空` / `房间不存在`)

## 6.2 S02 大厅
### Purpose
Show room context, players, role config, and start action.

### Layout
- Tag: `大厅`
- Title: `房间 #7K9M`
- Subtitle: `当前 12/20 人 | 任意玩家可开局`
- Panel:
  - Section: `玩家列表`
  - Player list (wrap/line list; if long, collapse with `...`)
  - Section: `角色池`
  - Role chips
  - Primary button: `开始本局`
  - Secondary button (optional): `复制房间码`

### Actions
- Any player may update role set
- Any player may press `开始本局`
- Copy room code to clipboard

### Constraints
- Room player count: 3-20
- Role set must pass game constraints before start

### States
- Not enough players: start button disabled + hint `至少 3 人可开始`
- Start conflict: if multiple players start simultaneously, first successful request wins; others receive toast `本局已开始`

## 6.3 S03 夜晚行动
### Purpose
Collect role-specific action privately.

### Layout
- Tag: `夜晚阶段`
- Title: `你的身份：{角色名}`
- Subtitle: role instruction text
- Panel:
  - Timer: `剩余 00:28`
  - Action choice buttons (dynamic by role)
  - Primary button: `确认行动`

### Behavior
- Only eligible role sees actionable controls
- Non-eligible roles see waiting content:
  - Title: `其他玩家行动中`
  - Description: `请保持安静，等待夜晚结束`

### Rules
- Action can be changed before confirm
- If timer expires and no action submitted:
  - Auto-submit default no-op where rules allow

### States
- Default
- Choice selected
- Confirming
- Submitted (lock UI + waiting)

## 6.4 S04 投票阶段
### Purpose
Collect one vote from each player.

### Layout
- Tag: `投票阶段`
- Title: `请投票你认为的狼人`
- Subtitle: `锁票前可改票。`
- Panel:
  - Danger timer near end
  - Candidate grid (2 columns)
  - Primary button: `提交投票`

### Rules
- One vote per player
- Can change vote until lock
- Timer expiry auto-locks current selection
- Unselected on expiry: submit empty vote per engine rule (or abstain=false default handling in engine)

### States
- No selection: submit disabled
- Selected: submit enabled
- Locked: all cards and button disabled

## 6.5 S05 结算阶段
### Purpose
Show winner and reveal information clearly.

### Layout
- Tag: `结算`
- Title: `{村民阵营胜利 | 狼人阵营胜利}`
- Subtitle example: `最高票：小泽（5 票）`
- Panel:
  - Section: `身份揭示`
  - Result rows: `玩家名 | 最终身份`
  - Primary button: `再来一局`
  - Secondary button: `返回大厅改配置`

### Behavior
- Any player can trigger replay
- Replay keeps room and players, resets round state

### States
- Normal result
- Replay in progress (`正在开始下一局...`)

## 7. Copy Spec (Simplified Chinese)
Core labels:
- 首页
- 大厅
- 夜晚阶段
- 投票阶段
- 结算

Primary buttons:
- 创建房间
- 加入房间
- 开始本局
- 确认行动
- 提交投票
- 再来一局

Common errors:
- 昵称不能为空
- 房间不存在
- 房间已满
- 当前无法开始本局
- 网络异常，请重试
- 本局已开始

Network/reconnect copy:
- 重连中...
- 已恢复连接
- 连接中断，正在尝试重新加入房间

## 8. Interaction and State Machine Mapping
UI phase mapping to game phase:
- `lobby` -> S02
- `night` -> S03
- `discussion` -> (MVP optional simple timer banner, no dedicated screen)
- `vote` -> S04
- `result` -> S05

Transitions:
- S01 -> S02 after create/join success
- S02 -> S03 when game starts
- S03 -> S04 when night ends
- S04 -> S05 when vote resolved
- S05 -> S02 for reconfigure or -> S03 for immediate replay start

## 9. Error and Edge UI
- Duplicate names:
  - Option A: allow duplicates
  - Option B (recommended): auto-append suffix, e.g., `阿哲#2`
- Mid-game join:
  - Show `本局已开始，请等待下一局` and spectator-like waiting card (no gameplay interaction)
- Disconnect during action:
  - Full-screen reconnect mask + retry loop
- Simultaneous control actions:
  - Backend is source of truth; frontend shows final accepted state + toast

## 10. Accessibility
- Contrast ratio target: >= WCAG AA for body text
- Touch targets: >= 44px
- Avoid color-only status indication (timer + text)
- Dynamic type tolerance: UI should remain usable with system font scaling up to 120%

## 11. Performance UX Requirements
- Input-to-feedback: <= 100ms for local UI changes
- Button loading indicators must appear immediately on submit
- Avoid jank during timer ticks (use 1s updates)

## 12. Deliverables in Repo
- UI spec: `/Users/bytedance/Code/1nu_werewolf/UI_SPEC.md`
- Mobile mockup HTML: `/Users/bytedance/Code/1nu_werewolf/design-mockups/ui-mockups-mobile.html`
- Mobile mockup CSS: `/Users/bytedance/Code/1nu_werewolf/design-mockups/ui-mockups-mobile.css`
- Preview image: `/Users/bytedance/Code/1nu_werewolf/design-mockups/preview-mobile-only.png`

## 13. Implementation Notes (for next step)
- Build screens first as static routes/components with mock data
- Integrate realtime state after visual baseline is accepted
- Keep all user-facing strings centralized in one `zh-CN` dictionary file
