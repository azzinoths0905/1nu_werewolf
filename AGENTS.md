# AGENTS.md

## Purpose

This project is a **native WeChat Mini Program** (not a web app) for a face-to-face One Night Werewolf game.

Primary implementation targets:
- Mini Program client: `miniprogram/` (WXML / WXSS / JS)
- Cloud backend: `cloudfunctions/` (WeChat Cloud Functions via `wx-server-sdk`)

This file is the quick-start guide for future sessions, with emphasis on **WeChat Mini Program development resources** and project-specific operating rules.

## Read First (Project Context)

Before making changes, read these files:
- `/Users/bytedance/Code/1nu_werewolf/SESSION_HANDOFF_2026-02-26.md`
- `/Users/bytedance/Code/1nu_werewolf/PROJECT_PROGRESS.md`
- `/Users/bytedance/Code/1nu_werewolf/PRD.md`
- `/Users/bytedance/Code/1nu_werewolf/UI_SPEC.md`

## Core Tech Decisions

- Frontend framework: **Native WeChat Mini Program**
- Backend style: **CloudBase Cloud Functions** (not Express REST for MVP)
- Sync strategy (current): polling `room_get_snapshot` cloud function
- Language: Simplified Chinese UI copy
- Current code status: playable MVP path implemented in JS; TypeScript migration is pending

## Official WeChat Resources (Primary References)

Use official docs first. Prefer Context7 mirrors for lookup, then official URLs.

### Mini Program Framework (Client)

- Project / directory structure (app.js, app.json, app.wxss, pages):
  - [https://developers.weixin.qq.com/miniprogram/dev/framework/framework/structure](https://developers.weixin.qq.com/miniprogram/dev/framework/framework/structure)
- Quickstart framework concepts (App/Page lifecycle, page file structure):
  - [https://developers.weixin.qq.com/miniprogram/dev/framework/framework/quickstart/framework](https://developers.weixin.qq.com/miniprogram/dev/framework/framework/quickstart/framework)
- Mini Program API reference (client APIs like `wx.request`, storage, UI APIs):
  - [https://developers.weixin.qq.com/miniprogram/dev/api/](https://developers.weixin.qq.com/miniprogram/dev/api/)

### Cloud Development (CloudBase / 云开发)

- 云开发入门（用户给定参考入口）:
  - [https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/basis/getting-started.html](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/basis/getting-started.html)
- 小程序端初始化云开发（`wx.cloud.init`）:
  - [https://developers.weixin.qq.com/miniprogram/dev/framework/wxcloudservice/wxcloud/guide/init](https://developers.weixin.qq.com/miniprogram/dev/framework/wxcloudservice/wxcloud/guide/init)
- 云函数能力与 `wx-server-sdk`（`cloud.getWXContext()` 等）:
  - [https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/basis/capabilities](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/basis/capabilities)

### WeChat DevTools / Deployment

- 开发者工具 CLI（云函数部署命令、参数）:
  - [https://developers.weixin.qq.com/miniprogram/dev/devtools/cli](https://developers.weixin.qq.com/miniprogram/dev/devtools/cli)
- 开发者工具本地 HTTP 接口（含云函数部署接口）:
  - [https://developers.weixin.qq.com/miniprogram/dev/devtools/http](https://developers.weixin.qq.com/miniprogram/dev/devtools/http)

## Context7 References (for fast lookup)

These Context7 library IDs are known-good for this project:

- WeChat Mini Program framework docs:
  - `/websites/developers_weixin_qq_miniprogram_dev_framework`
- WeChat Mini Program general docs:
  - `/websites/developers_weixin_qq_miniprogram_dev`

When generating code, setup steps, or API usage in future sessions, query Context7 first.

## Project Layout (Current)

- `/Users/bytedance/Code/1nu_werewolf/miniprogram/`
  - native mini program pages (`home`, `lobby`, `night`, `vote`, `result`)
  - `utils/cloud-api.js` wraps cloud function calls
- `/Users/bytedance/Code/1nu_werewolf/cloudfunctions/`
  - cloud functions for room/game flow
- `/Users/bytedance/Code/1nu_werewolf/project.config.json`
  - must include `miniprogramRoot` and `cloudfunctionRoot`

Note:
- There are old Next.js files in `/Users/bytedance/Code/1nu_werewolf/src/`, but the active product direction is WeChat Mini Program.

## WeChat Cloud Setup Checklist (Mandatory)

Do these in WeChat DevTools before testing gameplay:

1. Configure cloud environment ID in:
   - `/Users/bytedance/Code/1nu_werewolf/miniprogram/app.js`
2. Create DB collections:
   - `rooms`
   - `games`
   - `actions`
   - `votes`
3. Upload and deploy cloud functions (remote npm install):
   - `room_create`
   - `room_join`
   - `room_get_snapshot`
   - `game_start`
   - `game_submit_night_action`
   - `game_submit_vote`
   - `game_replay`

## Current Cloud Functions (MVP)

Primary playable path:
- `room_create`
- `room_join`
- `room_get_snapshot`
- `game_start`
- `game_submit_night_action`
- `game_submit_vote`
- `game_replay`

Secondary / later:
- `room_update_config`
- `game_reconnect`
- `housekeeping_cleanup`

## Known Pitfalls / Debug Notes

### `INVALID_ENV` on `wx.cloud.callFunction`

Symptom:
- `errCode: -501000`
- `Param Invalid: env check invalid`

Cause:
- `wx.cloud.init({ env })` uses an invalid env ID.

Fix:
- Replace placeholder value in `/Users/bytedance/Code/1nu_werewolf/miniprogram/app.js` with the real CloudBase env ID from WeChat DevTools.

### Cloud Function Not Found / Invocation Failures

Common causes:
- Function not uploaded/deployed yet
- Deployed to the wrong cloud environment
- Missing collection / collection permissions misconfigured

## Dev Workflow (Recommended)

1. Read `SESSION_HANDOFF` and `PROJECT_PROGRESS`
2. Reproduce issue in WeChat DevTools
3. Check cloud function logs first (server truth)
4. Fix cloud function logic before UI polish if game flow is broken
5. Update `/Users/bytedance/Code/1nu_werewolf/PROJECT_PROGRESS.md` after meaningful changes

## Formatting / Codegen Rules (Project-Specific)

- Use `Context7` first for setup/config/API docs lookup.
- Use `standard-lint` for frontend JS/TS/TSX/CSS changes:
  - `standard-lint <paths> --autofix`
- Mini Program and cloud functions currently run as JS; do not partially migrate only a few files to TS without adding a build pipeline.

## Next Engineering Priorities (If No User-Specific Task)

1. Complete end-to-end real-device testing with 2+ players
2. Fix any cloud function runtime errors from logs
3. Add DB permission rules (prevent direct client writes to critical game state)
4. Improve sync from polling to `watch()` only after permissions are stable
5. Plan full TypeScript migration (client + cloud functions + shared game types)

