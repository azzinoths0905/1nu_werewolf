import { NextRequest } from "next/server";
import {
  GameState,
  LobbyStore,
  createEmptyState,
  maskStateForClient,
  shuffleRoles,
  runNextNightStep,
  resolveVotes,
  castVote,
  defaultTimer,
  updateTimer,
  ensureDeck,
  NIGHT_ORDER,
  Role,
} from "@/lib/gameLogic";

declare global {
  var __werewolfStores: Record<string, LobbyStore> | undefined;
}

const stores: Record<string, LobbyStore> = globalThis.__werewolfStores || {};
globalThis.__werewolfStores = stores;

function getStore(lobbyId: string): LobbyStore {
  if (!stores[lobbyId]) {
    stores[lobbyId] = {
      state: createEmptyState(lobbyId),
      subscribers: [],
    };
  }
  return stores[lobbyId];
}

function broadcast(lobbyId: string) {
  const store = getStore(lobbyId);
  store.subscribers.forEach((sub) => {
    const view = maskStateForClient(store.state, sub.clientId);
    sub.send(view);
  });
}

function addSubscriber(lobbyId: string, clientId: string, send: (data: GameState) => void) {
  const store = getStore(lobbyId);
  store.subscribers.push({ clientId, send });
  send(maskStateForClient(store.state, clientId));
}

function removeSubscriber(lobbyId: string, clientId: string) {
  const store = getStore(lobbyId);
  store.subscribers = store.subscribers.filter((s) => s.clientId !== clientId);
}

function stopTimer(lobbyId: string) {
  const store = getStore(lobbyId);
  if (store.timerHandle) {
    clearInterval(store.timerHandle);
    store.timerHandle = undefined;
  }
  store.state = updateTimer(store.state, (timer) => ({ ...timer, running: false }));
}

function ensureFinalized(state: GameState): GameState {
  const hasFinalRoles = state.players.every((p) => p.finalRole);
  if (hasFinalRoles && state.phase !== "night") return state;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, finalRole: p.finalRole ?? p.assignedRole })),
    nightStep: NIGHT_ORDER.length,
    phase: state.phase === "night" ? "day" : state.phase,
    logs: state.logs.includes("夜晚结束，进入白天讨论")
      ? state.logs
      : [...state.logs, "夜晚结束，进入白天讨论"],
    timer: state.phase === "night" ? { label: "白天讨论", seconds: 300, running: false } : state.timer,
  };
}

function startTimer(lobbyId: string) {
  stopTimer(lobbyId);
  const store = getStore(lobbyId);
  store.state = updateTimer(store.state, (timer) => ({ ...timer, running: true }));
  store.timerHandle = setInterval(() => {
    store.state = updateTimer(store.state, (timer) => ({ ...timer, seconds: Math.max(0, timer.seconds - 1) }));
    broadcast(lobbyId);
  }, 1000);
}

export async function GET(req: NextRequest) {
  const lobbyId = req.nextUrl.searchParams.get("lobbyId") || "default";
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const accept = req.headers.get("accept") || "";
  const isSSE = accept.includes("text/event-stream");

  if (!isSSE) {
    const store = getStore(lobbyId);
    return new Response(JSON.stringify(maskStateForClient(store.state, clientId)), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      addSubscriber(lobbyId, clientId, (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      });
    },
    cancel() {
      removeSubscriber(lobbyId, clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const lobbyId: string = body.lobbyId || "default";
  const action: string = body.action;
  const clientId: string = body.clientId || "";
  const store = getStore(lobbyId);

  switch (action) {
    case "join": {
      const name: string = body.name;
      const isHost: boolean = body.isHost;
      if (!store.state.players.some((p) => p.id === clientId)) {
        store.state = {
          ...store.state,
          players: [...store.state.players, { id: clientId, name, isHost }],
          logs: [...store.state.logs, `${name} 加入了房间`],
        };
      }
      break;
    }
    case "ready": {
      store.state = {
        ...store.state,
        players: store.state.players.map((p) => (p.id === clientId ? { ...p, ready: body.ready } : p)),
      };
      break;
    }
    case "configure": {
      const deck: Role[] = body.deck;
      store.state = ensureDeck({ ...store.state, deck });
      break;
    }
    case "shuffle": {
      store.state = shuffleRoles(store.state);
      stopTimer(lobbyId);
      break;
    }
    case "runNight": {
      store.state = runNextNightStep(store.state);
      break;
    }
    case "startDay": {
      store.state = ensureFinalized(store.state);
      break;
    }
    case "startVoting": {
      store.state = ensureFinalized({
        ...store.state,
        phase: "voting",
        timer: { label: "投票倒计时", seconds: 90, running: false },
      });
      break;
    }
    case "castVote": {
      store.state = castVote(store.state, clientId, body.targetId);
      break;
    }
    case "resolve": {
      store.state = resolveVotes(ensureFinalized(store.state));
      stopTimer(lobbyId);
      break;
    }
    case "timer": {
      const intent: "start" | "pause" | "reset" = body.intent;
      if (intent === "start") startTimer(lobbyId);
      if (intent === "pause") stopTimer(lobbyId);
      if (intent === "reset") {
        stopTimer(lobbyId);
        store.state = updateTimer(store.state, () => defaultTimer());
      }
      break;
    }
    default:
      break;
  }

  broadcast(lobbyId);
  return new Response(JSON.stringify({ ok: true }));
}
