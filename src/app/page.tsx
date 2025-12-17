"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BASE_ROLES, DEFAULT_CENTER_COUNT, GameState, NIGHT_ORDER, Role } from "@/lib/gameLogic";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
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
      <header className="flex flex-col gap-3 border-b bg-white px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-zinc-500">房间号：{lobbyId}</p>
          <h1 className="text-xl font-semibold">一夜狼人·主持面板</h1>
          <p className="text-sm text-zinc-600">阶段：{prettyPhase(state?.phase)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-zinc-700">
          <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1">
            <Label className="text-xs text-zinc-500">玩家昵称</Label>
            <Input className="h-8 w-28 border-none bg-transparent px-0" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1">
            <Label className="text-xs text-zinc-500">房间号</Label>
            <Input
              className="h-8 w-24 border-none bg-transparent px-0"
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
            />
          </div>
          <Label className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-normal">
            <Checkbox checked={isHost} onChange={(e) => setIsHost(e.target.checked)} />
            <span>我是主持</span>
          </Label>
          <Button className="h-9 rounded-full px-4" onClick={() => sendAction({ action: "join", lobbyId, clientId, name, isHost })}>
            加入/同步房间
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>阶段控制</CardTitle>
              <CardDescription>控制计时、夜晚步骤与阶段推进。</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">计时：{state?.timer.seconds ?? 0}s</Badge>
              <Button
                variant="secondary"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={!isCurrentHost}
                onClick={() => sendAction({ action: "timer", intent: timerRunning ? "pause" : "start", lobbyId })}
              >
                {timerRunning ? "暂停" : "开始"}
              </Button>
              <Button variant="outline" disabled={!isCurrentHost} onClick={() => sendAction({ action: "timer", intent: "reset", lobbyId })}>
                重置
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button className="px-4" disabled={!canShuffle} onClick={() => sendAction({ action: "shuffle", lobbyId })}>
                打乱身份
              </Button>
              <div className="flex flex-wrap gap-2">
                {NIGHT_ORDER.map((r, idx) => (
                  <Button
                    key={r}
                    variant={state?.nightStep === idx ? "default" : "secondary"}
                    className={clsx(
                      "px-3",
                      state?.nightStep === idx ? "bg-amber-500 hover:bg-amber-400" : "",
                      !isCurrentHost || state?.phase !== "night" ? "opacity-50" : ""
                    )}
                    disabled={!isCurrentHost || state?.phase !== "night"}
                    onClick={() => sendAction({ action: "runNight", lobbyId })}
                  >
                    夜晚步骤 {idx + 1}: {roleLabels[r]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                disabled={!isCurrentHost || phaseDisabled(state?.phase ?? "lobby", "night")}
                onClick={() => sendAction({ action: "startDay", lobbyId })}
              >
                进入白天
              </Button>
              <Button
                variant="outline"
                className="border-sky-200 text-sky-700 hover:bg-sky-50"
                disabled={!isCurrentHost || phaseDisabled(state?.phase ?? "lobby", "day")}
                onClick={() => sendAction({ action: "startVoting", lobbyId })}
              >
                进入投票
              </Button>
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={!isCurrentHost || phaseDisabled(state?.phase ?? "lobby", "voting")}
                onClick={() => sendAction({ action: "resolve", lobbyId })}
              >
                公布结果
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>角色牌组设置</CardTitle>
            <CardDescription>
              玩家人数：{state?.players.length ?? 0}，中央牌 {DEFAULT_CENTER_COUNT} 张。确保总牌数等于玩家数 + 中央牌。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {BASE_ROLES.map((role) => (
                <Label
                  key={role}
                  className={clsx(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    deckSelection.includes(role)
                      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  )}
                >
                  <Checkbox checked={deckSelection.includes(role)} onChange={() => toggleRole(role)} />
                  <span>{roleLabels[role]}</span>
                </Label>
              ))}
            </div>
            <Button
              className="w-fit"
              disabled={!isCurrentHost}
              onClick={() => sendAction({ action: "configure", lobbyId, deck: deckSelection, clientId })}
            >
              保存牌组
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>玩家与身份</CardTitle>
            <CardDescription>当前玩家 {state?.players.length ?? 0} 人</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(state?.players ?? []).map((player) => (
                <div key={player.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">{player.isHost ? "主持" : "玩家"}</p>
                      <p className="text-lg font-semibold">{player.name}</p>
                    </div>
                    <Badge variant="outline">{player.assignedRole ? roleLabels[player.assignedRole] : "隐藏"}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-zinc-600">
                    {player.finalRole && <p>最终身份：{roleLabels[player.finalRole]}</p>}
                    {player.voteFor && <p>投票给：{state?.players.find((p) => p.id === player.voteFor)?.name}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary" className="bg-zinc-200 text-zinc-800">
                中央牌：{(state?.center ?? []).join("，")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>夜晚步骤</CardTitle>
            <CardDescription>
              当前步骤：{state?.nightStep ?? 0}/{NIGHT_ORDER.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {NIGHT_ORDER.map((role, index) => (
              <Badge
                key={role}
                variant={index < (state?.nightStep ?? 0) ? "success" : "outline"}
                className={clsx(
                  "px-4 py-2 text-sm",
                  index < (state?.nightStep ?? 0) ? "border-emerald-200" : ""
                )}
              >
                {index + 1}. {roleLabels[role]}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>投票与结算</CardTitle>
            <CardDescription>阶段：{prettyPhase(state?.phase)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {playerTargets.map((player) => (
              <div key={player.id} className="flex items-center gap-2">
                <span className="w-24">{player.name}</span>
                <Select
                  className="w-48"
                  disabled={state?.phase !== "voting"}
                  value={player.voteFor ?? ""}
                  onChange={(e) =>
                    sendAction({ action: "castVote", lobbyId, clientId: player.id, targetId: (e.target as HTMLSelectElement).value })
                  }
                >
                  <option value="">未选择</option>
                  {playerTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            {state?.results && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-semibold">结果：{state.results.message}</p>
                <p>胜利者：{state.results.winners.join("，")}</p>
                <p>被处决：{state.results.executedIds.map((id) => state.players.find((p) => p.id === id)?.name).join("，")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>日志</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="max-h-56 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {(state?.logs ?? []).slice().reverse().map((log, idx) => (
                <p key={idx} className="py-0.5">
                  {log}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
