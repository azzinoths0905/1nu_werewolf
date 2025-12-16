"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_ROLES, DEFAULT_CENTER_COUNT, GameState, NIGHT_ORDER, Role } from "@/lib/gameLogic";
import clsx from "clsx";
import { v4 as uuid } from "uuid";

const roleLabels: Record<Role, string> = {
  Villager: "村民",
  Werewolf: "狼人",
  Seer: "预言家",
  Robber: "强盗",
  Troublemaker: "捣蛋鬼",
  Drunk: "酒鬼",
  Insomniac: "失眠者",
  Tanner: "小丑",
};

function prettyPhase(phase?: GameState["phase"]) {
  switch (phase) {
    case "lobby":
      return "大厅";
    case "night":
      return "夜晚";
    case "day":
      return "白天讨论";
    case "voting":
      return "投票";
    case "resolution":
      return "结算";
    default:
      return "加载中";
  }
}

async function sendAction(body: Record<string, unknown>) {
  await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function Home() {
  const [clientId] = useState<string>(() => {
    if (typeof window === "undefined") return uuid();
    const stored = localStorage.getItem("werewolf-client-id") || uuid();
    localStorage.setItem("werewolf-client-id", stored);
    return stored;
  });
  const [name, setName] = useState("主持人");
  const [isHost, setIsHost] = useState(true);
  const [lobbyId, setLobbyId] = useState("demo");
  const [state, setState] = useState<GameState | null>(null);
  const [deckSelection, setDeckSelection] = useState<Role[]>(BASE_ROLES.slice(0, 10));

  useEffect(() => {
    if (!clientId) return;
    const join = async () => {
      await sendAction({ action: "join", lobbyId, clientId, name, isHost });
      await sendAction({ action: "configure", lobbyId, clientId, deck: deckSelection });
    };
    join();
    const es = new EventSource(`/api/state?lobbyId=${lobbyId}&clientId=${clientId}`);
    es.onmessage = (event) => {
      const payload = JSON.parse(event.data) as GameState;
      setState(payload);
    };
    return () => {
      es.close();
    };
  }, [clientId, lobbyId, name, isHost, deckSelection]);

  const isCurrentHost = useMemo(() => state?.players.some((p) => p.id === clientId && p.isHost), [clientId, state]);

  const playerTargets = useMemo(() => state?.players ?? [], [state]);

  const canShuffle = isCurrentHost && (state?.players?.length ?? 0) > 2;
  const timerRunning = state?.timer.running;

  const toggleRole = (role: Role) => {
    setDeckSelection((prev) => {
      if (prev.includes(role)) return prev.filter((r) => r !== role);
      return [...prev, role];
    });
  };

  const phaseDisabled = (phase: GameState["phase"], compare: GameState["phase"]) => phase !== compare;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="flex flex-col gap-2 border-b bg-white px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-zinc-500">房间号：{lobbyId}</p>
          <h1 className="text-xl font-semibold">一夜狼人·主持面板</h1>
          <p className="text-sm text-zinc-600">阶段：{prettyPhase(state?.phase)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-zinc-700">
          <label className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1">
            <span>玩家昵称</span>
            <input
              className="w-28 rounded border border-zinc-200 px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1">
            <span>房间号</span>
            <input
              className="w-24 rounded border border-zinc-200 px-2 py-1"
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1">
            <input type="checkbox" checked={isHost} onChange={(e) => setIsHost(e.target.checked)} />
            <span>我是主持</span>
          </label>
          <button
            className="rounded-full bg-indigo-600 px-3 py-1 text-white shadow disabled:cursor-not-allowed disabled:bg-indigo-300"
            onClick={() => sendAction({ action: "join", lobbyId, clientId, name, isHost })}
          >
            加入/同步房间
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <section className="grid gap-4 rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">阶段控制</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-zinc-100 px-3 py-1">计时：{state?.timer.seconds ?? 0}s</span>
              <button
                className="rounded bg-emerald-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-emerald-200"
                disabled={!isCurrentHost}
                onClick={() => sendAction({ action: "timer", intent: timerRunning ? "pause" : "start", lobbyId })}
              >
                {timerRunning ? "暂停" : "开始"}
              </button>
              <button
                className="rounded bg-zinc-200 px-3 py-1 text-zinc-800 disabled:cursor-not-allowed"
                disabled={!isCurrentHost}
                onClick={() => sendAction({ action: "timer", intent: "reset", lobbyId })}
              >
                重置
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              className="rounded bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
              disabled={!canShuffle}
              onClick={() => sendAction({ action: "shuffle", lobbyId })}
            >
              打乱身份
            </button>
            <div className="flex flex-wrap gap-2">
              {NIGHT_ORDER.map((r, idx) => (
                <button
                  key={r}
                  className={clsx(
                    "rounded px-3 py-1",
                    state?.nightStep === idx ? "bg-amber-500 text-white" : "bg-zinc-200 text-zinc-800",
                    !isCurrentHost || state?.phase !== "night" ? "opacity-50" : ""
                  )}
                  disabled={!isCurrentHost || state?.phase !== "night"}
                  onClick={() => sendAction({ action: "runNight", lobbyId })}
                >
                  夜晚步骤 {idx + 1}: {roleLabels[r]}
                </button>
              ))}
            </div>
            <button
              className="rounded bg-blue-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-blue-200"
              disabled={!isCurrentHost || phaseDisabled(state?.phase ?? "lobby", "night")}
              onClick={() => sendAction({ action: "startDay", lobbyId })}
            >
              进入白天
            </button>
            <button
              className="rounded bg-sky-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-sky-200"
              disabled={!isCurrentHost || phaseDisabled(state?.phase ?? "lobby", "day")}
              onClick={() => sendAction({ action: "startVoting", lobbyId })}
            >
              进入投票
            </button>
            <button
              className="rounded bg-emerald-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-emerald-200"
              disabled={!isCurrentHost || phaseDisabled(state?.phase ?? "lobby", "voting")}
              onClick={() => sendAction({ action: "resolve", lobbyId })}
            >
              公布结果
            </button>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">角色牌组设置</h2>
          <p className="text-sm text-zinc-600">玩家人数：{state?.players.length ?? 0}，中央牌 {DEFAULT_CENTER_COUNT} 张。确保总牌数等于玩家数 + 中央牌。</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {BASE_ROLES.map((role) => (
              <label key={role} className={clsx("flex items-center gap-2 rounded px-3 py-2", deckSelection.includes(role) ? "bg-indigo-50 border border-indigo-200" : "bg-zinc-100") }>
                <input
                  type="checkbox"
                  checked={deckSelection.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="accent-indigo-600"
                />
                <span>{roleLabels[role]}</span>
              </label>
            ))}
          </div>
          <button
            className="w-fit rounded bg-indigo-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-indigo-200"
            disabled={!isCurrentHost}
            onClick={() => sendAction({ action: "configure", lobbyId, deck: deckSelection, clientId })}
          >
            保存牌组
          </button>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">玩家与身份</h2>
            <span className="text-sm text-zinc-600">当前玩家 {state?.players.length ?? 0} 人</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(state?.players ?? []).map((player) => (
              <div key={player.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">{player.isHost ? "主持" : "玩家"}</p>
                    <p className="text-lg font-semibold">{player.name}</p>
                  </div>
                  <span className="rounded-full bg-zinc-200 px-3 py-1 text-sm">
                    {player.assignedRole ? roleLabels[player.assignedRole] : "隐藏"}
                  </span>
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  {player.finalRole && <p>最终身份：{roleLabels[player.finalRole]}</p>}
                  {player.voteFor && <p>投票给：{state?.players.find((p) => p.id === player.voteFor)?.name}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded bg-zinc-200 px-3 py-1">中央牌：{(state?.center ?? []).join("，")}</span>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">夜晚步骤</h2>
            <p className="text-sm text-zinc-500">当前步骤：{state?.nightStep ?? 0}/{NIGHT_ORDER.length}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {NIGHT_ORDER.map((role, index) => (
              <div
                key={role}
                className={clsx(
                  "rounded border px-3 py-2 text-sm",
                  index < (state?.nightStep ?? 0) ? "border-emerald-400 bg-emerald-50" : "border-zinc-200"
                )}
              >
                {index + 1}. {roleLabels[role]}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">投票与结算</h2>
            <p className="text-sm text-zinc-600">阶段：{prettyPhase(state?.phase)}</p>
          </div>
          <div className="grid gap-2 text-sm">
            {playerTargets.map((player) => (
              <div key={player.id} className="flex items-center gap-2">
                <span className="w-24">{player.name}</span>
                <select
                  className="w-48 rounded border border-zinc-300 px-2 py-1"
                  disabled={state?.phase !== "voting"}
                  value={player.voteFor ?? ""}
                  onChange={(e) => sendAction({ action: "castVote", lobbyId, clientId: player.id, targetId: e.target.value })}
                >
                  <option value="">未选择</option>
                  {playerTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {state?.results && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">结果：{state.results.message}</p>
              <p>胜利者：{state.results.winners.join("，")}</p>
              <p>被处决：{state.results.executedIds.map((id) => state.players.find((p) => p.id === id)?.name).join("，")}</p>
            </div>
          )}
        </section>

        <section className="grid gap-2 rounded-2xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">日志</h2>
          <div className="max-h-56 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            {(state?.logs ?? []).slice().reverse().map((log, idx) => (
              <p key={idx} className="py-0.5">
                {log}
              </p>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
