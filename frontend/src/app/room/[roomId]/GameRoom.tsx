"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getWsUrl } from "@/lib/ws";
import { generateBattleQuizAction, type BattleQuestion } from "@/app/actions/battle-quiz";
import MarkdownText from "@/components/MarkdownText";

// ── 型定義 ──────────────────────────────────────────────

interface GameRoomProps {
  roomId: string;
  user: { id: string; name: string; github_login: string; github_id: number };
}

interface Opponent {
  id: string;
  github_login: string;
  rate: number;
  gnu_balance: number;
}

interface TurnStartPayload {
  turn: number;
  total_turns: number;
  difficulty: string;
  question_text: string;
  choices: string[];
  time_limit_sec: number;
  your_gnu_balance: number;
  min_bet: number;
  max_bet: number;
}

interface TurnResultPayload {
  turn: number;
  correct_answer: string;
  correct_index: number;
  your_answer: number;
  is_correct: boolean;
  tips: string;
  gnu_delta: number;
  your_gnu_balance: number;
  opponent_is_correct: boolean;
  opponent_gnu_delta: number;
}

interface GameEndPayload {
  result: "win" | "lose" | "draw";
  your_correct_count: number;
  opponent_correct_count: number;
  your_final_gnu: number;
  opponent_final_gnu: number;
  gnu_earned_this_game: number;
  total_turns: number;
}

interface TkoPayload {
  message: string;
  tko_bonus: number;
  your_final_gnu: number;
}

type GamePhase =
  | "connecting"
  | "waiting_room_ready"
  | "preparing_questions"
  | "turn_start"
  | "answering"
  | "turn_result"
  | "game_end"
  | "tko"
  | "error";

// ── 定数 ──────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  easy: {
    label: "Easy",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  normal: {
    label: "Normal",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  hard: {
    label: "Hard",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
  },
};

// Bot対戦時に使う固定ダミー問題（bot_player.go と対応）
const BOT_DUMMY_QUESTIONS: BattleQuestion[] = [
  {
    difficulty: "easy",
    question_text: "Next.js で「use client」ディレクティブを先頭に書く目的は？",
    correct_answer: "クライアントコンポーネントとして動作させるため",
    tips: 'App Router では、デフォルトがサーバーコンポーネント。"use client" を書くとブラウザ上で実行される React コンポーネントになります。',
    choices: [
      "クライアントコンポーネントとして動作させるため",
      "SSR を無効化するため",
      "TypeScript を有効にするため",
      "環境変数を読み込むため",
    ],
  },
  {
    difficulty: "hard",
    question_text: "Go の goroutine でデータ競合を防ぐ最も推奨された方法はどれ？",
    correct_answer: "channel を使ってデータをやり取りする",
    tips: '"Do not communicate by sharing memory; instead, share memory by communicating." channel は Go の並行処理の中心的な仕組みです。',
    choices: [
      "channel を使ってデータをやり取りする",
      "グローバル変数にする",
      "sync.Mutex だけを使う",
      "goroutine を1つに制限する",
    ],
  },
  {
    difficulty: "easy",
    question_text: "HTTP ステータスコード 404 が示すものは？",
    correct_answer: "Not Found",
    tips: "404 は「リソースが見つからない」を示します。クライアント側のリクエストに問題がある 4xx 系エラーの代表格です。",
    choices: ["Not Found", "Internal Server Error", "Unauthorized", "Bad Request"],
  },
  {
    difficulty: "normal",
    question_text: "Git で直前のコミットメッセージを修正するコマンドはどれ？",
    correct_answer: "git commit --amend",
    tips: "--amend は直前のコミットを上書き修正します。push 済みの場合は force push が必要です。",
    choices: ["git commit --amend", "git rebase -i", "git reset HEAD~1", "git revert HEAD"],
  },
  {
    difficulty: "normal",
    question_text: "RESTful API で「リソースの一部更新」に使うHTTPメソッドはどれ？",
    correct_answer: "PATCH",
    tips: "PATCHはリソースの部分更新、PUTはリソース全体の置換に使います。",
    choices: ["PATCH", "PUT", "POST", "UPDATE"],
  },
];

// ── コンポーネント ────────────────────────────────────────

export default function GameRoom({ roomId, user }: GameRoomProps) {
  const wsUrl = getWsUrl(
    `/ws/room/${roomId}?github_login=${encodeURIComponent(user.github_login)}&github_id=${user.github_id}`,
  );

  // ゲーム状態
  const [phase, setPhase] = useState<GamePhase>("connecting");
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [myGnu, setMyGnu] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<TurnStartPayload | null>(null);
  const [turnResult, setTurnResult] = useState<TurnResultPayload | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEndPayload | null>(null);
  const [tkoResult, setTkoResult] = useState<TkoPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 問題準備フェーズの状態
  const [quizGenStatus, setQuizGenStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [quizGenError, setQuizGenError] = useState<string | null>(null);

  // 回答・ベット状態
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState(0);
  const [betConfirmed, setBetConfirmed] = useState(false);
  const [answered, setAnswered] = useState(false);

  // ターンタイマー
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnStartTimeRef = useRef<number>(0);

  // ターン開始アニメーション用タイムアウト
  const turnAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sendMessage を onMessage コールバック内から参照するための ref
  const sendMessageRef = useRef<((msg: unknown) => void) | null>(null);

  // 全ターン結果の蓄積
  const [turnHistory, setTurnHistory] = useState<TurnResultPayload[]>([]);

  // ── タイマー制御 ────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds: number) => {
      stopTimer();
      setTimeLeft(seconds);
      turnStartTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stopTimer],
  );

  useEffect(() => {
    return () => {
      stopTimer();
      if (turnAnimTimerRef.current) clearTimeout(turnAnimTimerRef.current);
    };
  }, [stopTimer]);

  // ── 問題自動生成 ──────────────────────────────────────

  const autoGenerateAndSubmit = useCallback(
    async (opponentGithubLogin: string) => {
      setQuizGenStatus("loading");
      setQuizGenError(null);
      try {
        const result = await generateBattleQuizAction(roomId, opponentGithubLogin);
        if (!result || result.myQuestions.length < 5 || result.forOpponent.length < 5) {
          throw new Error("問題を十分に生成できませんでした");
        }
        sendMessageRef.current?.({
          type: "act_submit_questions",
          payload: {
            my_questions: result.myQuestions,
            for_opponent: result.forOpponent,
          },
        });
        setQuizGenStatus("done");
        setPhase("waiting_room_ready");
      } catch (e) {
        setQuizGenStatus("error");
        setQuizGenError(e instanceof Error ? e.message : "問題の生成に失敗しました");
      }
    },
    [roomId],
  );

  // ── WS メッセージハンドラ ─────────────────────────────

  const { sendMessage, connect } = useWebSocket({
    url: wsUrl,
    onMessage: useCallback(
      (data: unknown) => {
        const msg = data as { type: string; payload: Record<string, unknown> };
        console.log("[GameRoom] WS:", msg.type, msg.payload);

        switch (msg.type) {
          case "ev_room_ready": {
            const opp = msg.payload.opponent as Opponent;
            const myBalance = msg.payload.your_gnu_balance as number;
            setOpponent(opp);
            setMyGnu(myBalance);
            // Bot対戦の場合は固定ダミー問題を即時送信（5問 vs 5問）
            if (opp.github_login === "test-bot") {
              sendMessageRef.current?.({
                type: "act_submit_questions",
                payload: {
                  my_questions: BOT_DUMMY_QUESTIONS,
                  for_opponent: BOT_DUMMY_QUESTIONS,
                },
              });
              setPhase("waiting_room_ready");
            } else {
              // 通常対戦: 相手のgithub_loginを使って自動問題生成開始
              setPhase("preparing_questions");
              autoGenerateAndSubmit(opp.github_login);
            }
            break;
          }

          case "ev_turn_start": {
            const payload = msg.payload as unknown as TurnStartPayload;
            stopTimer();
            setCurrentTurn(payload);
            setMyGnu(payload.your_gnu_balance);
            setBetAmount(0);
            setBetConfirmed(false);
            setSelectedChoice(null);
            setAnswered(false);
            setTurnResult(null);
            setPhase("turn_start");
            // 短いアニメーション後に answering へ
            if (turnAnimTimerRef.current) clearTimeout(turnAnimTimerRef.current);
            turnAnimTimerRef.current = setTimeout(() => {
              setPhase("answering");
              startTimer(payload.time_limit_sec);
            }, 800);
            break;
          }

          case "ev_bet_confirmed": {
            setBetConfirmed(true);
            break;
          }

          case "ev_turn_result": {
            const payload = msg.payload as unknown as TurnResultPayload;
            stopTimer();
            setTurnResult(payload);
            setMyGnu(payload.your_gnu_balance);
            setTurnHistory((prev) => [...prev, payload]);
            setPhase("turn_result");
            break;
          }

          case "ev_game_end": {
            const payload = msg.payload as unknown as GameEndPayload;
            stopTimer();
            setGameEnd(payload);
            setPhase("game_end");
            break;
          }

          case "ev_tko": {
            const payload = msg.payload as unknown as TkoPayload;
            stopTimer();
            setTkoResult(payload);
            setPhase("tko");
            break;
          }

          case "ev_error": {
            const code = msg.payload.code as string;
            const message = msg.payload.message as string;
            stopTimer();
            const errorMessages: Record<string, string> = {
              opponent_disconnected: "対戦相手が切断しました",
              question_timeout: "問題の準備時間が終了しました",
              invalid_questions: "問題の形式が不正です",
            };
            setErrorMsg(errorMessages[code] ?? message ?? "エラーが発生しました");
            setPhase("error");
            break;
          }
        }
      },
      [startTimer, stopTimer, autoGenerateAndSubmit],
    ),
  });

  // sendMessageRef を常に最新の sendMessage で更新する
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    connect();
  }, [connect]);

  // ── アクション送信 ────────────────────────────────────

  const sendBet = useCallback(
    (amount: number) => {
      sendMessage({ type: "act_bet_gnu", payload: { amount } });
    },
    [sendMessage],
  );

  const sendAnswer = useCallback(
    (choiceIndex: number) => {
      if (answered) return;
      const timeMs = Date.now() - turnStartTimeRef.current;
      sendMessage({
        type: "act_submit_answer",
        payload: { choice_index: choiceIndex, time_ms: timeMs },
      });
      setSelectedChoice(choiceIndex);
      setAnswered(true);
      stopTimer();
    },
    [answered, sendMessage, stopTimer],
  );

  // ── レンダリング ────────────────────────────────────────

  const difficultyInfo = currentTurn
    ? (DIFFICULTY_LABEL[currentTurn.difficulty] ?? {
        label: currentTurn.difficulty,
        color: "text-zinc-600",
        bg: "bg-zinc-100",
      })
    : null;

  // タイマーのプログレス幅
  const timerPct = currentTurn ? (timeLeft / currentTurn.time_limit_sec) * 100 : 100;
  const timerColor =
    timeLeft > 8 ? "bg-emerald-500" : timeLeft > 4 ? "bg-amber-500" : "bg-rose-500";

  const totalTurns = (gameEnd?.total_turns ?? turnHistory.length) || 10;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* ── ヘッダー ── */}
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏟️</span>
            <span className="font-bold text-zinc-900 dark:text-white text-sm">ゲームルーム</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono hidden sm:block">
              {roomId.slice(0, 8)}...
            </span>
          </div>

          {/* GNU バランス */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <span className="text-sm">🦬</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {myGnu.toLocaleString()} GNU
            </span>
          </div>
        </div>

        {/* 対戦相手バー */}
        {opponent && (
          <div className="px-5 py-2.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                {opponent.github_login.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {opponent.github_login}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Rate {opponent.rate}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>🦬</span>
              <span>{opponent.gnu_balance.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* ターン進捗バー */}
        {currentTurn && (
          <div className="px-5 py-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
              ターン {currentTurn.turn}/{currentTurn.total_turns}
            </span>
            <div className="flex gap-1 flex-1">
              {Array.from({ length: currentTurn.total_turns }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < currentTurn.turn - 1
                      ? "bg-blue-500"
                      : i === currentTurn.turn - 1
                        ? "bg-blue-300"
                        : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── メインエリア ── */}
      <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* 接続中 */}
        {phase === "connecting" && (
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-blue-500 animate-spin" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">ゲームルームに接続中...</p>
          </div>
        )}

        {/* 問題準備フェーズ（自動生成中） */}
        {phase === "preparing_questions" && (
          <div className="p-10 flex flex-col items-center gap-5">
            {quizGenStatus === "error" ? (
              <>
                <div className="text-5xl">😵</div>
                <p className="font-bold text-rose-600 dark:text-rose-400 text-center">
                  {quizGenError ?? "問題の生成に失敗しました"}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
                  接続が切れるか、リポジトリが未解析の可能性があります
                </p>
                <Link
                  href="/lobby"
                  className="px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl"
                >
                  ロビーに戻る
                </Link>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-purple-500 animate-spin" />
                  <span className="absolute inset-0 flex items-center justify-center text-2xl">🤖</span>
                </div>
                <div className="text-center">
                  <p className="font-bold text-zinc-900 dark:text-white">問題を生成中...</p>
                  {opponent && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      あなたと {opponent.github_login} のリポジトリを解析しています
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 animate-pulse">
                    AIが問題を生成中です。しばらくお待ちください
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ルーム待機（問題送信済み・相手待ち） */}
        {phase === "waiting_room_ready" && (
          <div className="p-10 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-purple-500 animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl">⚔️</span>
            </div>
            <div className="text-center">
              <p className="font-bold text-zinc-900 dark:text-white">対戦準備中</p>
              {opponent && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {opponent.github_login} との対戦が始まります
                </p>
              )}
              {opponent && opponent.github_login !== "test-bot" && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 animate-pulse">
                  相手が問題を生成中...
                </p>
              )}
            </div>
          </div>
        )}

        {/* ターン開始アニメーション */}
        {phase === "turn_start" && currentTurn && (
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="text-5xl animate-bounce">❓</div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white animate-pulse">
              ターン {currentTurn.turn}
            </p>
            {difficultyInfo && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${difficultyInfo.bg} ${difficultyInfo.color}`}
              >
                {difficultyInfo.label}
              </span>
            )}
          </div>
        )}

        {/* 回答フェーズ */}
        {phase === "answering" && currentTurn && (
          <div className="flex flex-col">
            {/* タイマー */}
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">残り時間</span>
                <span
                  className={`text-sm font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-500 animate-pulse" : "text-zinc-700 dark:text-zinc-300"}`}
                >
                  {timeLeft}秒
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>

            {/* 難易度バッジ */}
            {difficultyInfo && (
              <div className="px-5 pt-3 flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${difficultyInfo.bg} ${difficultyInfo.color}`}
                >
                  {difficultyInfo.label}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  ターン {currentTurn.turn}/{currentTurn.total_turns}
                </span>
              </div>
            )}

            {/* 問題文 */}
            <div className="px-5 pt-3 pb-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-white leading-relaxed whitespace-pre-wrap">
                {currentTurn.question_text}
              </p>
            </div>

            {/* ベットセクション */}
            <div className="mx-5 my-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  🦬 ヌーを賭ける
                </span>
                <span
                  className={`text-xs font-bold ${betConfirmed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                >
                  {betConfirmed ? "✓ 確定" : "未確定"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  {currentTurn.min_bet}
                </span>
                <input
                  type="range"
                  min={currentTurn.min_bet}
                  max={currentTurn.max_bet}
                  value={betAmount}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBetAmount(v);
                    setBetConfirmed(false);
                  }}
                  disabled={answered}
                  className="flex-1 accent-amber-500 disabled:opacity-50"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  {currentTurn.max_bet}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {betAmount.toLocaleString()} GNU
                </span>
                {!answered && (
                  <button
                    onClick={() => sendBet(betAmount)}
                    disabled={betConfirmed}
                    className="text-xs px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {betConfirmed ? "確定済み" : "賭ける"}
                  </button>
                )}
              </div>
            </div>

            {/* 選択肢 */}
            <div className="px-5 pb-5 grid grid-cols-1 gap-2">
              {currentTurn.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => sendAnswer(i)}
                  disabled={answered}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all duration-200
                    ${
                      answered && selectedChoice === i
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 scale-[0.98]"
                        : answered
                          ? "border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:scale-[1.01] text-zinc-900 dark:text-white cursor-pointer"
                    }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs shrink-0 font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {choice}
                  </span>
                </button>
              ))}
            </div>

            {answered && (
              <div className="px-5 pb-5 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">
                  相手の回答を待っています...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ターン結果 */}
        {phase === "turn_result" && turnResult && currentTurn && (
          <div className="flex flex-col">
            {/* 結果バナー */}
            <div
              className={`px-5 py-6 flex flex-col items-center gap-2 ${
                turnResult.is_correct
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "bg-rose-50 dark:bg-rose-900/20"
              }`}
            >
              <div className="text-4xl">{turnResult.is_correct ? "✅" : "❌"}</div>
              <p
                className={`text-xl font-bold ${
                  turnResult.is_correct
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {turnResult.is_correct ? "正解！" : "不正解"}
              </p>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-sm ${
                  turnResult.gnu_delta >= 0
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                }`}
              >
                <span>🦬</span>
                <span>
                  {turnResult.gnu_delta >= 0 ? "+" : ""}
                  {turnResult.gnu_delta.toLocaleString()} GNU
                </span>
              </div>
            </div>

            {/* 正解・対戦相手情報 */}
            <div className="px-5 py-4 space-y-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">正解</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {currentTurn.choices[turnResult.correct_index]}
                </p>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-center">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">あなた</p>
                  <p className="text-2xl mt-1">{turnResult.is_correct ? "✅" : "❌"}</p>
                  <p
                    className={`text-xs font-bold mt-1 ${turnResult.gnu_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}
                  >
                    {turnResult.gnu_delta >= 0 ? "+" : ""}
                    {turnResult.gnu_delta} GNU
                  </p>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-center">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">相手</p>
                  <p className="text-2xl mt-1">{turnResult.opponent_is_correct ? "✅" : "❌"}</p>
                  <p
                    className={`text-xs font-bold mt-1 ${turnResult.opponent_gnu_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}
                  >
                    {turnResult.opponent_gnu_delta >= 0 ? "+" : ""}
                    {turnResult.opponent_gnu_delta} GNU
                  </p>
                </div>
              </div>

              {/* Tips */}
              {turnResult.tips && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    💡 Tips
                  </p>
                  <MarkdownText
                    content={turnResult.tips}
                    className="mt-2 text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed"
                  />
                </div>
              )}

              {/* GNU バランス */}
              <div className="flex items-center justify-center gap-1.5 py-1">
                <span className="text-sm">🦬</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  残り {turnResult.your_gnu_balance.toLocaleString()} GNU
                </span>
              </div>

              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center animate-pulse">
                次のターンを待っています...
              </p>
            </div>
          </div>
        )}

        {/* ゲーム終了 */}
        {phase === "game_end" && gameEnd && (
          <div className="flex flex-col">
            {/* 結果バナー */}
            <div
              className={`px-5 py-8 flex flex-col items-center gap-3 ${
                gameEnd.result === "win"
                  ? "bg-linear-to-b from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10"
                  : gameEnd.result === "lose"
                    ? "bg-linear-to-b from-zinc-50 to-zinc-100 dark:from-zinc-800/30 dark:to-zinc-800/20"
                    : "bg-linear-to-b from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10"
              }`}
            >
              <div className="text-6xl">
                {gameEnd.result === "win" ? "🏆" : gameEnd.result === "lose" ? "💀" : "🤝"}
              </div>
              <p
                className={`text-3xl font-black tracking-tight ${
                  gameEnd.result === "win"
                    ? "text-amber-600 dark:text-amber-400"
                    : gameEnd.result === "lose"
                      ? "text-zinc-600 dark:text-zinc-400"
                      : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {gameEnd.result === "win" ? "WIN!" : gameEnd.result === "lose" ? "LOSE" : "DRAW"}
              </p>

              <div
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold ${
                  gameEnd.gnu_earned_this_game >= 0
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                }`}
              >
                <span>🦬</span>
                <span>
                  {gameEnd.gnu_earned_this_game >= 0 ? "+" : ""}
                  {gameEnd.gnu_earned_this_game.toLocaleString()} GNU
                </span>
              </div>
            </div>

            {/* スコア詳細 */}
            <div className="px-5 py-4 space-y-3">
              {/* 正解数比較 */}
              <div className="flex gap-3">
                <div className="flex-1 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-center">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">あなたの正解数</p>
                  <p className="text-3xl font-black text-zinc-900 dark:text-white">
                    {gameEnd.your_correct_count}
                    <span className="text-base font-normal text-zinc-400 dark:text-zinc-500">
                      {" "}
                      / {totalTurns}
                    </span>
                  </p>
                </div>
                <div className="flex-1 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-center">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">相手の正解数</p>
                  <p className="text-3xl font-black text-zinc-900 dark:text-white">
                    {gameEnd.opponent_correct_count ?? 0}
                    <span className="text-base font-normal text-zinc-400 dark:text-zinc-500">
                      {" "}
                      / {totalTurns}
                    </span>
                  </p>
                </div>
              </div>

              {/* GNU 残高 */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    最終 GNU 残高
                  </span>
                  <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                    🦬 {gameEnd.your_final_gnu.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* ターン別履歴 */}
              {turnHistory.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    ターン履歴
                  </p>
                  {turnHistory.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs"
                    >
                      <span className="text-zinc-500 dark:text-zinc-400">ターン {t.turn}</span>
                      <span>{t.is_correct ? "✅" : "❌"}</span>
                      <span
                        className={
                          t.gnu_delta >= 0
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : "text-rose-500 font-bold"
                        }
                      >
                        {t.gnu_delta >= 0 ? "+" : ""}
                        {t.gnu_delta} GNU
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/lobby"
                className="block w-full text-center px-6 py-3.5 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200"
              >
                🔄 もう一度対戦する
              </Link>
              <Link
                href="/home"
                className="block w-full text-center py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                ← ホームに戻る
              </Link>
            </div>
          </div>
        )}

        {/* TKO 勝利 */}
        {phase === "tko" && tkoResult && (
          <div className="flex flex-col">
            <div className="px-5 py-8 flex flex-col items-center gap-3 bg-linear-to-b from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10">
              <div className="text-6xl">🏆</div>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400">TKO WIN!</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                {tkoResult.message}
              </p>
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 font-bold text-emerald-700 dark:text-emerald-400">
                <span>🦬</span>
                <span>+{tkoResult.tko_bonus.toLocaleString()} GNU ボーナス</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  最終 GNU 残高
                </span>
                <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                  🦬 {tkoResult.your_final_gnu.toLocaleString()}
                </span>
              </div>
              <Link
                href="/lobby"
                className="block w-full text-center px-6 py-3.5 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200"
              >
                🔄 もう一度対戦する
              </Link>
              <Link
                href="/home"
                className="block w-full text-center py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                ← ホームに戻る
              </Link>
            </div>
          </div>
        )}

        {/* エラー */}
        {phase === "error" && (
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="text-5xl">😵</div>
            <p className="font-bold text-zinc-900 dark:text-white">
              {errorMsg ?? "エラーが発生しました"}
            </p>
            <Link
              href="/lobby"
              className="px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all duration-200"
            >
              ロビーに戻る
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
