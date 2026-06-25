"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import BackButton from "@/app/_components/article/BackButton";

// ---------- 颜色定义 ----------
const COLOR_HEX = [
  "#FF4136",
  "#0074D9",
  "#2ECC40",
  "#FFDC00",
  "#FF851B",
  "#B10DC9",
];
const COLOR_GRADIENT = [
  "radial-gradient(circle at 38% 32%, #ff6b63, #c0392b 90%)",
  "radial-gradient(circle at 38% 32%, #4da6ff, #004d99 90%)",
  "radial-gradient(circle at 38% 32%, #5dfc6d, #1a9928 90%)",
  "radial-gradient(circle at 38% 32%, #ffe84d, #c8a800 90%)",
  "radial-gradient(circle at 38% 32%, #ff9d4d, #cc5500 90%)",
  "radial-gradient(circle at 38% 32%, #d94dff, #7a0099 90%)",
];

const TOTAL_SLOTS = 4;
const MAX_ATTEMPTS = 10;
const OPTIMAL_STEPS = 5;
const MAX_SCORE = 100;
const SCORE_DEDUCTION = 20;
const MIN_SCORE = 20;
const LS_KEY = "mastermind_highscore_v2";

interface ConfettiPiece {
  id: number;
  left: string;
  delay: string;
  duration: string;
  bg: string;
  size: string;
  borderRadius: string;
}

export default function LightsOutPage() {
  const gameRef = useRef<HTMLDivElement>(null);

  // ---------- 游戏状态 ----------
  const [secretCode, setSecretCode] = useState<number[]>([]);
  const [currentGuess, setCurrentGuess] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [history, setHistory] = useState<
    { guess: number[]; feedback: { black: number; white: number } }[]
  >([]);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [beatHighScoreFlag, setBeatHighScoreFlag] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);

  // ---------- 持久化最高分 ----------
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val >= 0 && val <= MAX_SCORE) {
          setHighScore(val);
        }
      }
    } catch {
      // 降级：保持内存状态
    }
  }, []);

  const saveHighScore = useCallback((score: number) => {
    try {
      localStorage.setItem(LS_KEY, String(score));
    } catch {
      // 降级
    }
    setHighScore(score);
  }, []);

  // ---------- 工具函数 ----------
  const generateCode = useCallback((): number[] => {
    return Array.from({ length: TOTAL_SLOTS }, () =>
      Math.floor(Math.random() * 6)
    );
  }, []);

  const calcFeedback = useCallback(
    (guess: (number | null)[], code: number[]) => {
      const codeCopy = [...code];
      const guessCopy = [...guess];
      let black = 0;
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        if (guessCopy[i] === codeCopy[i]) {
          black++;
          codeCopy[i] = -1;
          guessCopy[i] = -2;
        }
      }
      let white = 0;
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        const g = guessCopy[i];
        if (g !== null && g >= 0) {
          const j = codeCopy.indexOf(g);
          if (j !== -1) {
            white++;
            codeCopy[j] = -1;
          }
        }
      }
      return { black, white };
    },
    []
  );

  const calculateScore = useCallback((steps: number) => {
    if (steps === OPTIMAL_STEPS) return MAX_SCORE;
    return Math.max(MAX_SCORE - (steps - OPTIMAL_STEPS) * SCORE_DEDUCTION, MIN_SCORE);
  }, []);

  // ---------- 重置游戏 ----------
  const resetGame = useCallback(() => {
    const newCode = generateCode();
    setSecretCode(newCode);
    setCurrentGuess([null, null, null, null]);
    setHistory([]);
    setSelectedColor(null);
    setCurrentStep(0);
    setGameOver(false);
    setVictory(false);
    setCurrentScore(0);
    setShowSecret(false);
    setBeatHighScoreFlag(false);
    setConfettiPieces([]);
  }, [generateCode]);

  // 初始化
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // ---------- 游戏交互 ----------
  const handleColorSelect = (colorIdx: number) => {
    if (gameOver) return;
    setSelectedColor((prev) => (prev === colorIdx ? null : colorIdx));
  };

  const handleSlotClick = (slotIdx: number) => {
    if (gameOver || currentStep >= MAX_ATTEMPTS) return;
    if (selectedColor === null) return;
    setCurrentGuess((prev) => {
      const next = [...prev];
      next[slotIdx] = selectedColor;
      return next;
    });
  };

  const handleClear = () => {
    if (gameOver) return;
    setCurrentGuess([null, null, null, null]);
    setSelectedColor(null);
  };

  const handleSubmit = () => {
    if (gameOver || currentStep >= MAX_ATTEMPTS) return;
    if (currentGuess.some((c) => c === null)) return;

    const feedback = calcFeedback(currentGuess as number[], secretCode);
    const newHistory = [
      ...history,
      { guess: [...currentGuess] as number[], feedback },
    ];
    const newStep = currentStep + 1;
    const isWin = feedback.black === TOTAL_SLOTS;

    setHistory(newHistory);
    setCurrentStep(newStep);

    if (isWin) {
      const score = calculateScore(newStep);
      setCurrentScore(score);
      setVictory(true);
      setGameOver(true);
      setShowSecret(true);
      setCurrentGuess([null, null, null, null]);
      setSelectedColor(null);

      const beat = score > highScore;
      setBeatHighScoreFlag(beat);
      if (beat) {
        saveHighScore(score);
        triggerConfetti();
      }
    } else if (newStep >= MAX_ATTEMPTS) {
      // 失败
      setGameOver(true);
      setShowSecret(true);
      setCurrentScore(0);
      setCurrentGuess([null, null, null, null]);
      setSelectedColor(null);
      setBeatHighScoreFlag(false);
    } else {
      // 继续下一轮
      setCurrentGuess([null, null, null, null]);
      setSelectedColor(null);
    }
  };

  const handleNewGame = () => {
    resetGame();
  };

  // ---------- 纸屑特效 ----------
  const triggerConfetti = () => {
    const confettiColors = [
      ...COLOR_HEX,
      "#FFD700",
      "#FF69B4",
      "#00CED1",
      "#FFA500",
      "#fff",
    ];
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 70; i++) {
      pieces.push({
        id: Date.now() + i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.2}s`,
        duration: `${Math.random() * 2 + 2.5}s`,
        bg: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        size: `${Math.random() * 9 + 5}px`,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      });
    }
    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 4000);
  };

  // ---------- 键盘快捷键 ----------
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (currentGuess.every((c) => c !== null)) {
          handleSubmit();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      }
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= 6 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const idx = numKey - 1;
        setSelectedColor((prev) => (prev === idx ? null : idx));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, currentGuess, currentStep]);

  // ---------- 辅助渲染函数 ----------
  const allSlotsFilled = currentGuess.every((c) => c !== null);
  const canSubmit = allSlotsFilled && !gameOver && currentStep < MAX_ATTEMPTS;
  const isGameActive = !gameOver && currentStep < MAX_ATTEMPTS;

  const renderSecretDots = () => {
    return secretCode.map((colorIdx, i) => (
      <span
        key={i}
        className={`inline-block w-7 h-7 rounded-full transition-all duration-500 ${showSecret
            ? "shadow-[inset_0_-3px_6px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.2),0_3px_8px_rgba(0,0,0,0.3)]"
            : "border-2 border-dashed border-white/30 bg-white/10"
          }`}
        style={showSecret ? { background: COLOR_GRADIENT[colorIdx] } : undefined}
      />
    ));
  };

  const renderCurrentSlots = () => {
    return [0, 1, 2, 3].map((i) => {
      const colorIdx = currentGuess[i];
      const filled = colorIdx !== null;
      return (
        <button
          key={i}
          disabled={!isGameActive}
          className={`w-10 h-10 rounded-full transition-all duration-300 flex-shrink-0 ${filled
              ? "shadow-[inset_0_-4px_7px_rgba(0,0,0,0.4),inset_0_3px_5px_rgba(255,255,255,0.22),0_4px_10px_rgba(0,0,0,0.35)] hover:scale-110 hover:shadow-[inset_0_-4px_7px_rgba(0,0,0,0.4),inset_0_3px_5px_rgba(255,255,255,0.28),0_6px_18px_rgba(0,0,0,0.45),0_0_16px_rgba(255,255,255,0.15)]"
              : "border-2 border-dashed border-white/40 bg-white/5 animate-[slotPulse_2.2s_ease-in-out_infinite] hover:border-white/70 hover:shadow-[0_0_18px_rgba(255,255,255,0.18)] hover:scale-105"
            }`}
          style={filled ? { background: COLOR_GRADIENT[colorIdx] } : undefined}
          onClick={() => handleSlotClick(i)}
          aria-label={`槽位 ${i + 1}`}
        />
      );
    });
  };

  const renderHistory = () => {
    return history.map((entry, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 dark:bg-slate-900/20 border border-white/10 animate-[rowSlideIn_0.35s_ease-out]"
      >
        <div className="flex gap-2">
          {entry.guess.map((c, j) => (
            <span
              key={j}
              className="w-8 h-8 rounded-full shadow-[inset_0_-3px_6px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.2),0_3px_8px_rgba(0,0,0,0.3)]"
              style={{ background: COLOR_GRADIENT[c] }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 ml-auto">
          {[0, 1, 2, 3].map((p) => {
            const isBlack = p < entry.feedback.black;
            const isWhite =
              p >= entry.feedback.black &&
              p < entry.feedback.black + entry.feedback.white;
            return (
              <span
                key={p}
                className={`w-3 h-3 rounded-full shadow-[inset_0_-1.5px_3px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(255,255,255,0.25),0_1.5px_3px_rgba(0,0,0,0.35)] ${isBlack
                    ? "bg-[radial-gradient(circle_at_40%_35%,#555,#1a1a1a_90%)]"
                    : isWhite
                      ? "bg-[radial-gradient(circle_at_40%_35%,#fff,#c8c8c8_90%)]"
                      : "bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  }`}
              />
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className="min-h-screen py-24 px-4" ref={gameRef}>
      <style>{`
        @keyframes slotPulse {
          0%, 100% { box-shadow: 0 0 6px rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 20px rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.55); }
        }
        @keyframes rowSlideIn {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes selectedGlow {
          0%, 100% { box-shadow: 0 0 0 5px rgba(255,255,255,0.22), 0 0 24px 6px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 3px 5px rgba(255,255,255,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(255,255,255,0.35), 0 0 34px 10px rgba(255,255,255,0.38), inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 3px 5px rgba(255,255,255,0.2); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-60px) rotate(0deg) scale(1); opacity: 1; }
          15% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg) scale(0.4); opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          z-index: 200;
          pointer-events: none;
          animation: confettiFall linear forwards;
          border-radius: 2px;
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <BackButton />

        <div className="flex flex-col md:flex-row gap-6 mt-6">
          {/* ========== 左侧游戏区 ========== */}
          <div className="w-full md:w-[56%] flex flex-col gap-4">
            <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 flex flex-col gap-4">
              {/* 标题 */}
              <h1 className="text-2xl font-black tracking-tighter text-center text-slate-900 dark:text-white">
                💎 珠玑妙算 💎
              </h1>

              {/* 分数面板 */}
              <div className="flex flex-wrap items-center justify-center gap-4 px-3 py-2 rounded-xl bg-white/10 dark:bg-slate-900/20 border border-white/10">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>🎯 最优解</span>
                  <span className="text-sm font-bold text-amber-400">5步</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>📝 本局步数</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentStep}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>⭐ 本局得分</span>
                  <span
                    className={`text-sm font-bold ${victory && currentScore === MAX_SCORE
                        ? "text-amber-300"
                        : victory
                          ? "text-amber-400"
                          : gameOver && !victory
                            ? "text-red-400"
                            : "text-slate-900 dark:text-white"
                      }`}
                  >
                    {victory
                      ? `${currentScore}分${currentScore === MAX_SCORE ? " ✨" : ""}`
                      : gameOver && !victory
                        ? "0分"
                        : "--"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>🏆 历史最高</span>
                  <span className="text-sm font-bold text-amber-400">
                    {highScore}分
                  </span>
                </div>
              </div>

              {/* 密码揭示区 */}
              <div className="flex items-center justify-center gap-2 min-h-[2.5rem]">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {showSecret ? "🎉 密码" : "🔒 密码"}
                </span>
                {renderSecretDots()}
              </div>

              {/* 胜利/失败内联提示 */}
              {gameOver && (
                <div
                  className={`px-4 py-2 rounded-xl text-center text-sm font-medium ${victory
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
                    }`}
                >
                  {victory ? (
                    <>
                      🎉 恭喜破解！得分 {currentScore} 分。
                      {beatHighScoreFlag && " 🏆 新纪录！"}
                      {currentStep === OPTIMAL_STEPS
                        ? " 完美！达成最优解！"
                        : ` 超出最优解 ${currentStep - OPTIMAL_STEPS} 步。`}
                    </>
                  ) : (
                    <>😞 挑战失败，密码已揭示。得分 0 分。</>
                  )}
                </div>
              )}

              {/* 历史猜测滚动区 */}
              <div className="flex flex-col gap-2 max-h-[440px] overflow-y-auto pr-1 scrollbar-thin">
                {renderHistory()}
              </div>

              {/* 当前猜测行 */}
              <div className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                {gameOver
                  ? "游戏已结束"
                  : currentStep >= MAX_ATTEMPTS
                    ? "⛔ 已达最大尝试次数"
                    : `⬇ 当前猜测 第 ${currentStep + 1}/${MAX_ATTEMPTS} 次（点击槽位填入颜色）`}
              </div>
              <div className="flex items-center justify-center gap-2 py-1">
                {renderCurrentSlots()}
              </div>

              {/* 颜色选择器 */}
              <div className="flex flex-wrap justify-center gap-3">
                {COLOR_GRADIENT.map((gradient, idx) => (
                  <button
                    key={idx}
                    className={`w-10 h-10 rounded-full border-[3px] transition-all duration-300 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.35),inset_0_3px_5px_rgba(255,255,255,0.2),0_3px_10px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:scale-105 active:scale-95 ${selectedColor === idx
                        ? "border-white scale-110 animate-[selectedGlow_1.5s_ease-in-out_infinite]"
                        : "border-transparent"
                      }`}
                    style={{ background: gradient }}
                    onClick={() => handleColorSelect(idx)}
                    aria-label={`颜色 ${idx + 1}`}
                  />
                ))}
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-4 py-2 text-sm font-bold rounded-xl transition-colors bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-slate-500/50 disabled:text-white/50 disabled:cursor-not-allowed"
                >
                  ✅ 提交猜测
                </button>
                <button
                  onClick={handleClear}
                  disabled={!isGameActive}
                  className="px-4 py-2 rounded-xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🧹 清空当前行
                </button>
                <button
                  onClick={handleNewGame}
                  className="px-4 py-2 text-sm font-bold rounded-xl transition-colors bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  🔄 新游戏
                </button>
              </div>
            </div>
          </div>

          {/* ========== 右侧教程面板 ========== */}
          <div className="w-full md:w-[44%]">
            <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto sticky top-24">
              <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 text-center border-b border-white/10 pb-2">
                📖 游戏教程
              </h2>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-400">🎯 游戏目标</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  猜出隐藏的 <strong>4 颗颜色珠子</strong> 的正确顺序和颜色。颜色可重复，共有 6 种颜色可选，你拥有 <strong>10 次</strong> 猜测机会。
                </p>
              </div>
              <hr className="border-white/10" />

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-400">🎮 操作方法</h4>
                <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-4 list-decimal">
                  <li>在下方<strong>颜色选择器</strong>中点击选中一种颜色（出现高亮光晕）。</li>
                  <li>点击上方<strong>当前行的空槽</strong>放入珠子。</li>
                  <li>可再次点击<strong>已填槽</strong>更换颜色。</li>
                  <li>填满一行 4 个槽后，点击 <strong>「提交猜测」</strong>。</li>
                </ol>
              </div>
              <hr className="border-white/10" />

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-400">💡 反馈解读</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  每次提交后，右侧 2×2 网格给出反馈：
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_40%_35%,#555,#1a1a1a_90%)] shadow-sm" />
                  <strong>黑色钉</strong>：颜色和位置都正确
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff,#c8c8c8_90%)] shadow-sm" />
                  <strong>白色钉</strong>：颜色正确但位置错误
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <strong>示例：</strong>
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[0.7rem] text-slate-400">密码</span>
                  {[0, 1, 2, 3].map((c) => (
                    <span
                      key={c}
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ background: COLOR_GRADIENT[c] }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[0.7rem] text-slate-400">猜测</span>
                  {[0, 3, 1, 2].map((c, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ background: COLOR_GRADIENT[c] }}
                    />
                  ))}
                  <span className="mx-1">→</span>
                  <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_40%_35%,#555,#1a1a1a_90%)] shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff,#c8c8c8_90%)] shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff,#c8c8c8_90%)] shadow-sm" />
                  <span className="text-[0.7rem] text-slate-400">1黑2白</span>
                </div>
              </div>
              <hr className="border-white/10" />

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-400">📊 计分规则</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  最优解固定为 <strong>5 步</strong>（满分💯）。
                </p>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-4 list-disc">
                  <li><strong>5步猜对</strong> → 100分 🎉「完美！达成最优解！」</li>
                  <li><strong>6~9步猜对</strong> → 每多1步扣20分，最低20分</li>
                  <li><strong>10步猜对</strong> → 20分（最低保障）</li>
                  <li><strong>失败</strong>（10次未中）→ 0分</li>
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  🏆 挑战历史最高分，超越自我！
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 五彩纸屑 */}
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            backgroundColor: piece.bg,
            width: piece.size,
            height: `calc(${piece.size} * 1.2)`,
            borderRadius: piece.borderRadius,
          }}
        />
      ))}
    </div>
  );
}