export type Role =
  | "Villager"
  | "Werewolf"
  | "Seer"
  | "Robber"
  | "Troublemaker"
  | "Drunk"
  | "Insomniac"
  | "Tanner";

export type GamePhase = "lobby" | "night" | "day" | "voting" | "resolution";

export interface PlayerState {
  id: string;
  name: string;
  isHost?: boolean;
  ready?: boolean;
  assignedRole?: Role;
  finalRole?: Role;
  nightKnowledge?: string;
  voteFor?: string;
}

export interface TimerState {
  label: string;
  seconds: number;
  running: boolean;
}

export interface GameState {
  lobbyId: string;
  players: PlayerState[];
  center: Role[];
  deck: Role[];
  phase: GamePhase;
  nightStep: number;
  logs: string[];
  timer: TimerState;
  results?: {
    winners: string[];
    message: string;
    executedIds: string[];
  };
}

export interface LobbyStore {
  state: GameState;
  timerHandle?: NodeJS.Timeout;
  subscribers: Array<{ clientId: string; send: (data: GameState) => void }>;
}

export const NIGHT_ORDER: Role[] = [
  "Werewolf",
  "Seer",
  "Robber",
  "Troublemaker",
  "Drunk",
  "Insomniac",
];

export const DEFAULT_CENTER_COUNT = 3;

export const BASE_ROLES: Role[] = [
  "Werewolf",
  "Werewolf",
  "Seer",
  "Robber",
  "Troublemaker",
  "Drunk",
  "Insomniac",
  "Tanner",
  "Villager",
  "Villager",
  "Villager",
];

export const defaultTimer = (): TimerState => ({
  label: "",
  seconds: 120,
  running: false,
});

export function createEmptyState(lobbyId: string): GameState {
  return {
    lobbyId,
    players: [],
    center: [],
    deck: BASE_ROLES.slice(0, 10),
    phase: "lobby",
    nightStep: 0,
    logs: ["房间已创建，等待玩家加入"],
    timer: defaultTimer(),
  };
}

export function ensureDeck(state: GameState): GameState {
  const needed = state.players.length + DEFAULT_CENTER_COUNT;
  if (state.deck.length < needed) {
    return { ...state, deck: [...state.deck, ...Array(needed - state.deck.length).fill("Villager") as Role[]] };
  }
  return { ...state, deck: state.deck.slice(0, needed) };
}

export function shuffleRoles(state: GameState): GameState {
  const deck = ensureDeck(state).deck;
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  const players = state.players.map((p, idx) => ({
    ...p,
    assignedRole: shuffled[idx],
    finalRole: undefined,
    voteFor: undefined,
    nightKnowledge: undefined,
  }));
  const center = shuffled.slice(players.length, players.length + DEFAULT_CENTER_COUNT);
  return {
    ...state,
    center,
    players,
    phase: "night",
    nightStep: 0,
    logs: [...state.logs, "身份已打乱，进入夜晚阶段"],
    results: undefined,
  };
}

function finalizeNight(state: GameState): GameState {
  const finalized = state.players.map((p) => ({ ...p, finalRole: p.assignedRole }));
  return {
    ...state,
    players: finalized,
    phase: "day",
    nightStep: NIGHT_ORDER.length,
    logs: state.logs.includes("夜晚结束，进入白天讨论")
      ? state.logs
      : [...state.logs, "夜晚结束，进入白天讨论"],
    timer: { label: "白天讨论", seconds: 300, running: false },
  };
}

export function updateTimer(state: GameState, updater: (t: TimerState) => TimerState): GameState {
  return { ...state, timer: updater(state.timer) };
}

function log(state: GameState, entry: string): GameState {
  return { ...state, logs: [...state.logs, entry] };
}

function swapRoles(a: PlayerState, b: PlayerState): [PlayerState, PlayerState] {
  const roleA = a.assignedRole;
  return [
    { ...a, assignedRole: b.assignedRole },
    { ...b, assignedRole: roleA },
  ];
}

export function runNextNightStep(state: GameState): GameState {
  const stepRole = NIGHT_ORDER[state.nightStep];
  if (!stepRole) {
    return finalizeNight(state);
  }

  let next = { ...state } as GameState;
  switch (stepRole) {
    case "Werewolf": {
      const wolves = next.players.filter((p) => p.assignedRole === "Werewolf");
      if (wolves.length === 1) {
        const randomCenter = next.center[0];
        next = log(next, `唯一的狼人偷看了中央牌：${randomCenter ?? "未知"}`);
      } else if (wolves.length > 1) {
        const names = wolves.map((p) => p.name).join("、");
        next = log(next, `狼人互相确认了身份：${names}`);
      } else {
        next = log(next, "没有狼人醒来");
      }
      break;
    }
    case "Seer": {
      const seer = next.players.find((p) => p.assignedRole === "Seer");
      if (seer) {
        const peeked = next.center.slice(0, 2).join("，") || "无";
        next = log(next, `预言家查看了中央两张牌：${peeked}`);
      }
      break;
    }
    case "Robber": {
      const robberIndex = next.players.findIndex((p) => p.assignedRole === "Robber");
      if (robberIndex >= 0) {
        const targetIndex = next.players.findIndex((p, idx) => idx !== robberIndex && p.assignedRole !== undefined);
        if (targetIndex >= 0) {
          const [robber, target] = swapRoles(next.players[robberIndex], next.players[targetIndex]);
          const updated = [...next.players];
          updated[robberIndex] = robber;
          updated[targetIndex] = target;
          next = { ...next, players: updated };
          next = log(next, `强盗与${target.name}交换了身份`);
        }
      }
      break;
    }
    case "Troublemaker": {
      const troubleIdx = next.players.findIndex((p) => p.assignedRole === "Troublemaker");
      if (troubleIdx >= 0) {
        const others = next.players.filter((p, idx) => idx !== troubleIdx);
        if (others.length >= 2) {
          const [first, second] = others.slice(0, 2);
          const firstIdx = next.players.findIndex((p) => p.id === first.id);
          const secondIdx = next.players.findIndex((p) => p.id === second.id);
          const [newFirst, newSecond] = swapRoles(next.players[firstIdx], next.players[secondIdx]);
          const updated = [...next.players];
          updated[firstIdx] = newFirst;
          updated[secondIdx] = newSecond;
          next = { ...next, players: updated };
          next = log(next, `${next.players[troubleIdx].name} 捣蛋鬼交换了 ${first.name} 与 ${second.name} 的身份`);
        }
      }
      break;
    }
    case "Drunk": {
      const drunkIndex = next.players.findIndex((p) => p.assignedRole === "Drunk");
      if (drunkIndex >= 0 && next.center.length > 0) {
        const centerRole = next.center[0];
        const playerRole = next.players[drunkIndex].assignedRole;
        const newCenter = [...next.center];
        newCenter[0] = playerRole as Role;
        const updatedPlayers = [...next.players];
        updatedPlayers[drunkIndex] = { ...next.players[drunkIndex], assignedRole: centerRole };
        next = { ...next, players: updatedPlayers, center: newCenter };
        next = log(next, `${next.players[drunkIndex].name} 与中央牌交换了身份`);
      }
      break;
    }
    case "Insomniac": {
      const insomniac = next.players.find((p) => p.assignedRole === "Insomniac");
      if (insomniac) {
        next = log(next, `${insomniac.name} 在夜晚结束时得知自己的身份是 ${insomniac.assignedRole}`);
      }
      break;
    }
    default:
      break;
  }

  return { ...next, nightStep: state.nightStep + 1 };
}

export function castVote(state: GameState, voterId: string, targetId?: string): GameState {
  const players = state.players.map((p) => (p.id === voterId ? { ...p, voteFor: targetId } : p));
  return { ...state, players };
}

export function resolveVotes(state: GameState): GameState {
  const tally = new Map<string, number>();
  state.players.forEach((p) => {
    if (p.voteFor) {
      tally.set(p.voteFor, (tally.get(p.voteFor) ?? 0) + 1);
    }
  });
  const highest = Math.max(0, ...Array.from(tally.values()));
  const executedIds = Array.from(tally.entries())
    .filter(([, count]) => count === highest && highest > 0)
    .map(([id]) => id);

  let winners: string[] = [];
  let message = "";
  const werewolves = state.players.filter((p) => p.finalRole === "Werewolf");
  const tanners = state.players.filter((p) => p.finalRole === "Tanner");

  const werewolvesExecuted = executedIds.some((id) => werewolves.some((w) => w.id === id));
  const tannerExecuted = executedIds.some((id) => tanners.some((t) => t.id === id));

  if (tannerExecuted) {
    winners = tanners.map((t) => t.name);
    message = "小丑被处决，小丑单独获胜";
  } else if (werewolves.length === 0) {
    winners = state.players.map((p) => p.name);
    message = "没有狼人在场，全体村民获胜";
  } else if (werewolvesExecuted) {
    winners = state.players.filter((p) => p.finalRole !== "Werewolf").map((p) => p.name);
    message = "狼人被处决，村民阵营获胜";
  } else {
    winners = werewolves.map((w) => w.name);
    message = "狼人存活，狼人阵营获胜";
  }

  return {
    ...state,
    results: { winners, message, executedIds },
    phase: "resolution",
    logs: [...state.logs, message],
  };
}

export function maskStateForClient(state: GameState, clientId: string): GameState {
  const revealAll = state.phase === "resolution" || state.players.some((p) => p.id === clientId && p.isHost);
  const players = state.players.map((p) => {
    if (revealAll || p.id === clientId) {
      return p;
    }
    return { ...p, assignedRole: undefined, finalRole: state.phase === "resolution" ? p.finalRole : undefined };
  });

  const center = revealAll ? state.center : Array(state.center.length).fill("?" as unknown as Role);
  return { ...state, players, center };
}
