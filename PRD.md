# Product Requirements Document (PRD)

## Product Name
One Night Werewolf (Web, Real-time Multiplayer)

## Version
v1.0 MVP

## Date
2026-02-13

## Document Owner
Product + Design + Engineering (shared)

## 1. Overview
One Night Werewolf is a fast social-deduction party game for face-to-face groups using their own phones/laptops.

MVP objective: let 3-20 players create or join a room, run a full game loop (setup -> night actions -> discussion -> vote -> results), and replay quickly.

Product language for MVP is Simplified Chinese only.

## 2. Problem Statement
Current options are inconvenient for small friend groups:
- Physical cards require setup and manual moderation.
- Existing digital tools often require account setup or extra onboarding.

We need a low-friction web game your friends can open and play immediately in person.

## 3. Goals
- Start a playable round quickly with minimal setup.
- Complete one full round reliably without manual moderation.
- Keep rules transparent and result resolution fair.

## 4. Target Users
- Casual friend groups playing face-to-face (3-20 players).
- Users opening the game on phones and laptops in the same physical space.

## 5. User Scenarios
1. Any player creates a room and shares room code/link.
2. Other players join and set display names.
3. Any player configures role set and starts game.
4. Players complete private night actions on personal devices.
5. Group discusses, then all vote.
6. System reveals final roles and declares winning side.
7. Group starts next round in the same room.

## 6. Scope
### In Scope (MVP)
- Room creation and join by code/link.
- Lobby with connected player list.
- No fixed host role; all players can perform room/game controls.
- Role assignment from configurable role set.
- Night action flow for included roles.
- Discussion timer and voting.
- Result resolution and reveal.
- Replay next round in same room.
- Basic reconnect handling.
- Simplified Chinese UI copy.

### Out of Scope (MVP)
- Matchmaking with strangers.
- User accounts/profiles/friends list.
- Voice/video chat.
- Rankings, achievements, progression systems.
- Multi-language localization.
- Spectator mode.

## 7. Functional Requirements
### 7.1 Room & Lobby
- FR-001: Any player can create a room.
- FR-002: Room has a short unique code and shareable link.
- FR-003: Players can join room with display name.
- FR-004: Lobby shows connected players and current count.
- FR-005: Any player can configure role set before starting.
- FR-006: Any player can start game when player/role constraints are valid.
- FR-007: Room supports 3-20 players.

### 7.2 Game Setup
- FR-008: System assigns one hidden role per player plus center cards.
- FR-009: Each player sees only their own initial role.
- FR-010: Assignment is random and validated against selected role set.

### 7.3 Night Phase
- FR-011: Night phase progresses in predefined role order.
- FR-012: Only eligible players can submit role actions.
- FR-013: Ineligible players see waiting screen with phase indicator.
- FR-014: Night actions are private and not leaked before reveal.
- FR-015: System applies action effects to game state deterministically.

### 7.4 Day Discussion + Vote
- FR-016: Discussion timer starts after night phase (configurable duration).
- FR-017: Each player can cast one vote before timer ends.
- FR-018: Vote can be changed until lock/end.
- FR-019: System auto-locks votes at timer expiry.

### 7.5 Resolution
- FR-020: System computes eliminated player(s) using vote rules.
- FR-021: System computes winner (Village vs Werewolf team) per rules.
- FR-022: Results screen reveals timeline: initial roles, actions, final roles, votes, winner.
- FR-023: Any player can trigger next round without recreating room.

### 7.6 Session Reliability
- FR-024: Temporary disconnect allows rejoin to same seat when possible.
- FR-025: If critical player loss blocks round, system ends round gracefully and returns to lobby.

## 8. Role Set (MVP)
To reduce complexity, MVP includes:
- Werewolf
- Seer
- Robber
- Troublemaker
- Villager

Future roles are deferred.

## 9. Rules Baseline (MVP)
- Player count: 3-20.
- Center cards: 3.
- Exactly one vote per player.
- If tie for highest votes, all tied players are considered eliminated.
- Win logic follows selected role set and final role positions.

Note: final tie/win edge cases will be codified in `game-rules-spec.md` before implementation.

## 10. Non-Functional Requirements
### Performance
- NFR-001: Action acknowledgement <= 300ms median (normal network).
- NFR-002: Realtime event propagation <= 500ms p95.
- NFR-003: Game state updates remain stable with up to 20 simultaneous players in one room.

### Availability and Fault Tolerance
- NFR-004: Graceful handling of transient disconnects.
- NFR-005: No single client should be authoritative for game state.

### Security & Fairness
- NFR-006: Server-authoritative state transitions.
- NFR-007: Clients can send intents only; server validates legality.
- NFR-008: Hidden information must not be exposed in network payloads to unauthorized clients.

### Usability
- NFR-009: Mobile-first UI supports 360px width and up.
- NFR-010: UI text is Simplified Chinese only in MVP.

## 11. UX Requirements (Design Inputs)
- Simple onboarding: input name + join.
- Strong phase clarity: always show current phase and next expected action.
- Hidden info safety: no accidental role leaks through UI states.
- Fast replay: next-round action on results screen.
- Explicit waiting states for non-active roles at night.
- Accessible text contrast and minimum tap targets (44px).
- Terminology and all player-facing text must be Simplified Chinese.

## 12. Edge Cases and Error Handling
- Duplicate display names in same room.
- Player joins after game start.
- Player disconnects during own night turn.
- Multiple rapid action submissions.
- Timer desync between clients.
- Vote submission after lock.
- Simultaneous control actions from multiple players (start/replay/config updates).
- Abandoned room cleanup.

## 13. Dependencies
- Realtime transport layer (websocket/socket abstraction).
- Deterministic game engine module.
- Timer and synchronization mechanism.
- Hosting environment capable of low-latency bidirectional communication.

## 14. Milestones
### M1: Product + Design Spec Complete
- PRD approved.
- UX flows approved.
- Wireframes for all primary screens complete.
- Simplified Chinese copy baseline approved.

### M2: Game Engine + Lobby Vertical Slice
- Room, join, start.
- Role assignment and phase machine.

### M3: Full Round Playable
- Night actions, discussion, vote, results.

### M4: Hardening + QA
- Edge case handling.
- 20-player stress validation for one room.

## 15. Acceptance Criteria (Release Gate)
- AC-001: 3-20 users can create/join/start without manual backend intervention.
- AC-002: One complete round executes without inconsistent state in 50 consecutive internal tests.
- AC-003: Hidden information is not leaked across clients in role/action payloads.
- AC-004: Reconnect works in active round for at least one transient disconnect scenario per phase.
- AC-005: Results logic matches documented rules for all tested edge cases.
- AC-006: Mobile usability pass on iOS Safari + Android Chrome latest major versions.
- AC-007: All MVP user-facing text is Simplified Chinese.

## 16. Open Questions
- Final MVP role combinations and minimum recommended presets for larger rooms.
- Exact tie-break and no-werewolf edge behavior.
- Default discussion duration and whether it can be modified mid-lobby.
- Whether to allow duplicate names or auto-append suffixes.
- Data retention policy for completed rooms.

## 17. Risks
- Rule ambiguity causes user trust issues.
- Realtime sync bugs can invalidate rounds.
- 20-player rooms can increase UI and network complexity.

Mitigation:
- Freeze MVP role list early.
- Encode rules in a unit-tested game engine before UI polish.
- Add deterministic event log for debugging round disputes.
- Stress-test room behavior at 20 players before release.

## 18. Post-MVP Backlog (Not part of v1)
- Additional roles (e.g., Mason, Drunk, Insomniac, Tanner, Hunter).
- Custom presets and saved room settings.
- Friend/account system.
- Moderation/reporting for public rooms.
- Multi-language support.
