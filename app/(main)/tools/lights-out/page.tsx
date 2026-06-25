"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import BackButton from "@/app/_components/article/BackButton";

/* ========== 类型 ========== */
type Solution = number[] | null;

/* ========== 常量 ========== */
const PRESET_SIZES = [4, 5, 6, 7, 8, 9, 10];
const MIN_CUSTOM_SIZE = 2;
const MAX_CUSTOM_SIZE = 20;
const MAX_ENUM_COMBOS = 1 << 18;

/* ========== 工具函数 ========== */

/** 独立最高分存储（按尺寸 + 覆盖率） */
function getHighScore(size: number, coverage: number): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = `lightsOut_hs_${size}_${coverage}`;
    return parseInt(localStorage.getItem(key) ?? "0", 10);
  } catch {
    return 0;
  }
}

function setHighScore(size: number, coverage: number, score: number) {
  if (typeof window === "undefined") return;
  try {
    const key = `lightsOut_hs_${size}_${coverage}`;
    localStorage.setItem(key, String(score));
  } catch { /* noop */ }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ========== 棋盘操作（扁平 Uint8Array：0=暗 1=亮） ========== */

function toggleAt(state: Uint8Array, r: number, c: number, n: number): void {
  state[r * n + c] ^= 1;
}

function toggleFlatInPlace(state: Uint8Array, r: number, c: number, n: number): void {
  toggleAt(state, r, c, n);
  if (r > 0) toggleAt(state, r - 1, c, n);
  if (r < n - 1) toggleAt(state, r + 1, c, n);
  if (c > 0) toggleAt(state, r, c - 1, n);
  if (c < n - 1) toggleAt(state, r, c + 1, n);
}

function toggleFlat(state: Uint8Array, r: number, c: number, n: number): Uint8Array {
  const ns = new Uint8Array(state);
  toggleFlatInPlace(ns, r, c, n);
  return ns;
}

function allLit(state: Uint8Array): boolean {
  for (let i = 0; i < state.length; i++) if (!state[i]) return false;
  return true;
}

/** 计算点击后亮灯变化量（负数为减少） */
function deltaLitFlat(state: Uint8Array, r: number, c: number, n: number): number {
  let lit = 0, dark = 0;
  const idx = r * n + c;
  if (state[idx]) lit++; else dark++;
  if (r > 0) { if (state[idx - n]) lit++; else dark++; }
  if (r < n - 1) { if (state[idx + n]) lit++; else dark++; }
  if (c > 0) { if (state[idx - 1]) lit++; else dark++; }
  if (c < n - 1) { if (state[idx + 1]) lit++; else dark++; }
  return dark - lit;
}

/** 智能生成指定覆盖率的棋盘 */
function generateBoard(n: number, targetCoverage: number): { state: Uint8Array; coverage: number } {
  const total = n * n;
  const targetLit = Math.round((targetCoverage / 100) * total);
  const state = new Uint8Array(total);
  state.fill(1); // all lit
  let litCount = total;

  const maxIters = total * 3;
  let iter = 0;

  while (litCount > targetLit && iter < maxIters) {
    iter++;
    const indices = shuffle(Array.from({ length: total }, (_, i) => i));

    let clicked = false;
    for (const idx of indices) {
      const r = Math.floor(idx / n);
      const c = idx % n;
      if (deltaLitFlat(state, r, c, n) < 0) {
        toggleFlatInPlace(state, r, c, n);
        litCount = 0;
        for (let k = 0; k < total; k++) litCount += state[k];
        clicked = true;
        if (litCount <= targetLit) break;
      }
    }

    // 卡住时随机点一个打破僵局
    if (!clicked) {
      toggleFlatInPlace(state, Math.floor(Math.random() * n), Math.floor(Math.random() * n), n);
      litCount = 0;
      for (let k = 0; k < total; k++) litCount += state[k];
    }
  }

  const coverage = Math.round((litCount / total) * 100);
  return { state, coverage };
}

/* ========== 求解器（BigInt 位打包 Gauss-Jordan GF(2)） ========== */

const matrixCache = new Map<number, bigint[]>();

function buildPackedMatrix(n: number): bigint[] {
  const size = n * n;
  const rows = new Array<bigint>(size);
  for (let i = 0; i < size; i++) {
    let row = 0n;
    const r = Math.floor(i / n);
    const c = i % n;
    row |= 1n << BigInt(i);
    if (r > 0) row |= 1n << BigInt(i - n);
    if (r < n - 1) row |= 1n << BigInt(i + n);
    if (c > 0) row |= 1n << BigInt(i - 1);
    if (c < n - 1) row |= 1n << BigInt(i + 1);
    rows[i] = row;
  }
  return rows;
}

function getPackedMatrix(n: number): bigint[] {
  let m = matrixCache.get(n);
  if (!m) {
    m = buildPackedMatrix(n);
    matrixCache.set(n, m);
  }
  return m;
}

/** Brian Kernighan popcount — O(置位数) */
function popcount(n: bigint): number {
  let c = 0;
  while (n) { n &= n - 1n; c++; }
  return c;
}

function gaussGF2Packed(A: bigint[], b: number[]):
  { solvable: boolean; steps?: number; sol?: number[] } {
  const size = A.length;
  // 增广矩阵：aug[i] = A[i] | (b[i] << size)
  const aug = new Array<bigint>(size);
  for (let i = 0; i < size; i++) {
    aug[i] = A[i] | (b[i] ? (1n << BigInt(size)) : 0n);
  }

  const pivotRows: number[] = [];
  const pivotCols: number[] = [];
  let row = 0;

  // 前向消元（Gauss-Jordan：消除所有行，不只下方）
  for (let col = 0; col < size; col++) {
    const bit = 1n << BigInt(col);
    let pr = -1;
    for (let r = row; r < size; r++) {
      if (aug[r] & bit) { pr = r; break; }
    }
    if (pr === -1) continue; // 自由变量
    if (pr !== row) [aug[row], aug[pr]] = [aug[pr], aug[row]];
    pivotRows.push(row);
    pivotCols.push(col);
    for (let r = 0; r < size; r++) {
      if (r !== row && (aug[r] & bit)) aug[r] ^= aug[row];
    }
    row++;
  }

  // 检查无解
  for (let r = row; r < size; r++) {
    const forward = aug[r] & ((1n << BigInt(size)) - 1n);
    if (forward === 0n && (aug[r] >> BigInt(size)) & 1n) {
      return { solvable: false };
    }
  }

  // 特解
  const x0bits = pivotCols.reduce((acc, pc, i) => {
    if ((aug[pivotRows[i]] >> BigInt(size)) & 1n) acc |= 1n << BigInt(pc);
    return acc;
  }, 0n);

  // 自由变量
  const pivotSet = new Set(pivotCols);
  const freeCols: number[] = [];
  for (let i = 0; i < size; i++) if (!pivotSet.has(i)) freeCols.push(i);

  // 零空间基向量
  const basis = freeCols.map(fc => {
    let v = 1n << BigInt(fc);
    for (let i = 0; i < pivotCols.length; i++) {
      if (aug[pivotRows[i]] & (1n << BigInt(fc))) v |= 1n << BigInt(pivotCols[i]);
    }
    return v;
  });

  // 枚举自由变量组合找最小步数解
  const d = freeCols.length;
  const limit = d < 31 ? Math.min(1 << d, MAX_ENUM_COMBOS) : MAX_ENUM_COMBOS;
  let minW = Infinity;
  let bestBits = x0bits;

  for (let mask = 0; mask < limit; mask++) {
    let cand = x0bits;
    let m = mask;
    let j = 0;
    while (m) {
      if (m & 1) cand ^= basis[j];
      m >>= 1;
      j++;
    }
    const w = popcount(cand);
    if (w < minW) { minW = w; bestBits = cand; }
  }

  // 转回数组
  const sol: number[] = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    if (bestBits & (1n << BigInt(i))) sol[i] = 1;
  }

  return { solvable: true, steps: minW, sol };
}

function solve(n: number, state: Uint8Array) {
  const size = n * n;
  const A = getPackedMatrix(n);
  const b = new Array<number>(size);
  for (let i = 0; i < size; i++) b[i] = state[i] ? 0 : 1; // 亮→0，暗→1（需要切换）
  return gaussGF2Packed(A, b);
}

/* ========== 动画样式 ========== */
const STYLES = `
  @keyframes cellLightUp{0%{transform:scale(.85)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
  @keyframes hintPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
  @keyframes hintRing{0%,100%{border-color:rgba(255,255,180,.7)}50%{border-color:#fff}}
  @keyframes victoryFlash{0%,100%{box-shadow:0 0 16px rgba(255,193,7,.55)}50%{box-shadow:0 0 40px #fff,0 0 70px rgba(255,220,100,.8)}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 50px 18px rgba(255,193,7,.25)}50%{box-shadow:0 0 80px 35px rgba(255,193,7,.55)}}
  @keyframes bannerIn{0%{opacity:0;transform:translateY(-16px) scale(.94)}100%{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes highlightPulse{0%,100%{border-color:rgba(255,193,7,.5)}50%{border-color:rgba(255,220,100,.9)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .lo-cell{border-radius:6px;cursor:pointer;transition:all .22s cubic-bezier(.4,0,.2,1);border:1.5px solid transparent;aspect-ratio:1;display:flex;align-items:center;justify-content:center;position:relative;-webkit-tap-highlight-color:transparent;user-select:none}
  .lo-cell.off{background:rgba(35,35,55,.8);border-color:rgba(60,60,85,.5);box-shadow:inset 0 2px 5px rgba(0,0,0,.45),0 1px 2px rgba(0,0,0,.3)}
  .dark .lo-cell.off{background:rgba(30,30,50,.85);border-color:rgba(70,70,95,.5)}
  .lo-cell.off:hover{border-color:rgba(255,255,255,.25);background:rgba(50,50,72,.85)}
  .dark .lo-cell.off:hover{background:rgba(55,55,78,.85)}
  .lo-cell.lit{background:radial-gradient(circle at 40% 35%,#fff3b0,#ffc107 60%,#e6a800);border-color:rgba(255,180,20,.6);box-shadow:0 0 16px rgba(255,193,7,.55),0 0 32px rgba(255,180,20,.3),inset 0 1px 2px rgba(255,255,255,.45);animation:cellLightUp .35s ease-out}
  .lo-cell.hint-highlight{z-index:2;animation:hintPulse .9s ease-in-out infinite;border-color:#fff!important;box-shadow:0 0 18px rgba(255,255,100,.9),0 0 40px rgba(255,200,30,.7)!important}
  .lo-cell.hint-highlight::after{content:'';position:absolute;inset:-4px;border-radius:inherit;border:3px solid rgba(255,255,200,.85);animation:hintRing 1.2s ease-in-out infinite;pointer-events:none}
  .lo-cell.victory-flash{animation:victoryFlash .15s ease-in-out 4}
  .board-glow-victory{animation:glowPulse .7s ease-in-out 3}
  .result-banner-anim{animation:bannerIn .4s ease}
  .highlight-best-anim{animation:highlightPulse .6s ease-in-out 5}
`;

/* ========== Cell 组件（React.memo 避免无关重渲染） ========== */

interface CellProps {
  lit: boolean;
  hinted: boolean;
  flashing: boolean;
  cellSize: number;
  animationDelay: string | undefined;
  row: number;
  col: number;
  onClick: (r: number, c: number) => void;
}

const Cell = memo(function Cell({ lit, hinted, flashing, cellSize, animationDelay, row, col, onClick }: CellProps) {
  return (
    <div
      className={`lo-cell ${lit ? "lit" : "off"} ${hinted ? "hint-highlight" : ""} ${flashing ? "victory-flash" : ""}`}
      style={{ width: cellSize, height: cellSize, animationDelay }}
      onClick={() => onClick(row, col)}
    />
  );
});

/* ========== 主组件 ========== */
export default function LightsOutPage() {
  const [size, setSize] = useState(5);
  const [board, setBoard] = useState<Uint8Array>(new Uint8Array(0));
  const [steps, setSteps] = useState(0);
  const [optSteps, setOptSteps] = useState<number | null>(null);
  const [solution, setSolution] = useState<Solution>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [hintOn, setHintOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highScore, setHS] = useState(0);
  const [cellSize, setCellSize] = useState(44);
  const [flash, setFlash] = useState(false);
  const [glow, setGlow] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [bestAnim, setBestAnim] = useState(false);
  const [targetCov, setTargetCov] = useState(50);

  const isCustom = !PRESET_SIZES.includes(size);
  const timerHint = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerGlow = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerResize = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);

  const currentCov =
    board.length > 0
      ? Math.round((board.reduce((s, v) => s + v, 0) / board.length) * 100)
      : 0;

  // 读取当前尺寸 + 覆盖率组合的历史最高分
  useEffect(() => {
    setHS(getHighScore(size, targetCov));
  }, [size, targetCov]);

  const calcCellSize = useCallback((n: number) => {
    if (typeof window === "undefined") return 44;
    const mobile = window.innerWidth < 750;
    const maxW = mobile ? Math.min(window.innerWidth - 50, 380) : 440;
    const gap = (n - 1) * 4 + 12;
    const raw = Math.floor((maxW - gap) / n);
    return Math.max(22, Math.min(raw, 70));
  }, []);

  const hideHint = useCallback(() => {
    if (timerHint.current) clearTimeout(timerHint.current);
    setHintOn(false);
  }, []);

  const showHint = useCallback(() => {
    if (won || !solution || loading) return;
    hideHint();
    setHintOn(true);
    timerHint.current = setTimeout(() => setHintOn(false), 5000);
  }, [won, solution, loading, hideHint]);

  const newGame = useCallback((n: number, cov: number) => {
    setLoading(true);
    setHintOn(false);
    if (timerHint.current) clearTimeout(timerHint.current);
    if (timerGlow.current) clearTimeout(timerGlow.current);
    setGlow(false);
    setFlash(false);
    setWon(false);
    setScore(null);
    setBestAnim(false);

    setTimeout(() => {
      const { state: s } = generateBoard(n, cov);
      const res = solve(n, s);
      let solvable = res.solvable,
        opt = res.steps ?? null,
        sol = res.sol ?? null;
      if (!solvable) {
        const { state: s2 } = generateBoard(n, cov);
        const res2 = solve(n, s2);
        opt = res2.steps ?? null;
        sol = res2.sol ?? null;
        setBoard(s2);
      } else {
        setBoard(s);
      }
      setOptSteps(opt);
      setSolution(sol);
      setSteps(0);
      setHistory([]);
      setWon(false);
      setScore(null);
      setHintOn(false);
      setLoading(false);
    }, 50);
  }, []);

  // 初始化
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      setCellSize(calcCellSize(5));
      newGame(5, 50);
    }
  }, [calcCellSize, newGame]);

  // resize
  useEffect(() => {
    const onResize = () => {
      if (timerResize.current) clearTimeout(timerResize.current);
      timerResize.current = setTimeout(() => setCellSize(calcCellSize(size)), 250);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size, calcCellSize]);

  // 胜利检测
  useEffect(() => {
    if (board.length > 0 && !won && allLit(board)) {
      const opt = optSteps ?? steps;
      const k = 0.8;
      const sc = Math.round(100 * Math.exp(-k * (steps - opt) / opt));
      setWon(true);
      setScore(sc);
      setFlash(true);
      setGlow(true);
      setHintOn(false);
      if (timerHint.current) clearTimeout(timerHint.current);

      // 更新该组合最高分
      const prevHigh = getHighScore(size, targetCov);
      if (sc > prevHigh) {
        setHighScore(size, targetCov, sc);
        setHS(sc);
        setBestAnim(true);
        setTimeout(() => setBestAnim(false), 3000);
      }

      if (timerGlow.current) clearTimeout(timerGlow.current);
      timerGlow.current = setTimeout(() => {
        setGlow(false);
        setFlash(false);
      }, 2200);
    }
  }, [board, won, steps, optSteps, size, targetCov]);

  const clickCell = useCallback((r: number, c: number) => {
    if (won || loading) return;
    hideHint();
    setBoard(prev => toggleFlat(prev, r, c, size));
    setSteps(s => s + 1);
    setHistory(prev => [...prev, r * size + c]);
  }, [won, loading, size, hideHint]);

  const undo = useCallback(() => {
    if (won || history.length === 0 || loading) return;
    hideHint();
    const lastIdx = history[history.length - 1];
    const r = Math.floor(lastIdx / size);
    const c = lastIdx % size;
    setBoard(prev => toggleFlat(prev, r, c, size));
    setSteps(s => s - 1);
    setHistory(prev => prev.slice(0, -1));
    setScore(null);
    setWon(false);
    setFlash(false);
    setGlow(false);
    if (timerGlow.current) clearTimeout(timerGlow.current);
  }, [won, history, loading, size, hideHint]);

  const onHint = useCallback(() => {
    if (!solution || won || loading) return;
    hintOn ? hideHint() : showHint();
  }, [solution, won, loading, hintOn, hideHint, showHint]);

  const onNew = useCallback(() => {
    if (loading) return;
    hideHint();
    newGame(size, targetCov);
  }, [loading, hideHint, newGame, size, targetCov]);

  const changeSize = useCallback((n: number) => {
    if (n === size && board.length > 0) return;
    setSize(n);
    setCellSize(calcCellSize(n));
    newGame(n, targetCov);
  }, [size, board, calcCellSize, newGame, targetCov]);

  const applyCustom = useCallback(() => {
    if (loading) return;
    let v = parseInt(customVal, 10);
    if (isNaN(v) || v < MIN_CUSTOM_SIZE) v = MIN_CUSTOM_SIZE;
    if (v > MAX_CUSTOM_SIZE) v = MAX_CUSTOM_SIZE;
    setCustomVal(String(v));
    changeSize(v);
  }, [loading, customVal, changeSize]);

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const canUndo = !won && history.length > 0 && !loading;
  const canHint = !won && solution !== null && !loading;
  const bannerType = score === 100 ? "perfect" : score !== null && score >= 60 ? "good" : "okay";
  const total = size * size;

  return (
    <div className="min-h-screen py-24 px-4">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="max-w-4xl mx-auto">
        <BackButton />

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
            💡 点灯游戏
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            经典 Lights Out 益智游戏 · 点击格子切换状态，使所有灯全部点亮
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-[0_0_62%] min-w-0 w-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 md:p-8 flex flex-col items-center gap-5">
            <div className="text-xl md:text-2xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
              💡 点灯游戏
            </div>

            {/* 尺寸选择器 */}
            <div className="flex gap-1.5 flex-wrap justify-center items-center">
              {PRESET_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setCustomVal("");
                    changeSize(s);
                  }}
                  disabled={loading}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border whitespace-nowrap ${size === s && !isCustom
                      ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                      : "bg-white/20 dark:bg-slate-700/30 border-white/20 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-indigo-400/50 hover:bg-white/40 dark:hover:bg-slate-700/50"
                    }`}
                >
                  {s}×{s}
                </button>
              ))}
              <div
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-all ${isCustom
                    ? "border-indigo-400 bg-indigo-500/15 shadow-lg shadow-indigo-500/15"
                    : "border-white/20 dark:border-white/15 bg-white/10 dark:bg-slate-700/20"
                  }`}
              >
                <input
                  type="number"
                  value={customVal}
                  onChange={e => setCustomVal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyCustom()}
                  disabled={loading}
                  placeholder="2~20"
                  min={2}
                  max={20}
                  className="w-14 bg-transparent border-none outline-none text-sm font-bold text-center text-slate-800 dark:text-white placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={applyCustom}
                  disabled={loading}
                  className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-35"
                >
                  ✓
                </button>
              </div>
            </div>

            {/* 覆盖率滑块 */}
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  💡 目标覆盖率
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {targetCov}%
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    当前：{board.length > 0 ? `${currentCov}%` : "--"}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={targetCov}
                onChange={e => setTargetCov(Number(e.target.value))}
                disabled={loading}
                className="w-full h-2 bg-white/50 dark:bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                <span>暗</span>
                <span>亮</span>
              </div>
            </div>

            {/* 棋盘 */}
            <div className="relative flex items-center justify-center p-2">
              <div
                className={`absolute -inset-3 rounded-2xl pointer-events-none transition-opacity duration-500 ${glow ? "opacity-100 board-glow-victory" : "opacity-0"
                  }`}
                style={{ boxShadow: glow ? "0 0 50px 18px rgba(255,193,7,0.25)" : "none" }}
              />
              <div
                className="grid gap-1 p-1.5 rounded-xl bg-black/20 dark:bg-black/40 shadow-inner relative z-[1]"
                style={{
                  gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
                }}
              >
                {board.length > 0 &&
                  Array.from({ length: total }, (_, idx) => {
                    const r = Math.floor(idx / size);
                    const c = idx % size;
                    return (
                      <Cell
                        key={idx}
                        lit={board[idx] === 1}
                        hinted={hintOn && solution?.[idx] === 1}
                        flashing={flash}
                        cellSize={cellSize}
                        animationDelay={flash ? `${idx * 25}ms` : undefined}
                        row={r}
                        col={c}
                        onClick={clickCell}
                      />
                    );
                  })}
              </div>
              {loading && (
                <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-indigo-400 rounded-full animate-[spin_0.8s_linear_infinite]" />
                </div>
              )}
            </div>

            {/* 信息栏 */}
            <div className="flex gap-2.5 flex-wrap justify-center w-full">
              <div
                className={`flex-1 min-w-[70px] rounded-2xl bg-white/20 dark:bg-slate-700/20 border text-center py-3 px-2 ${optSteps !== null
                    ? "border-amber-400/50 bg-amber-400/5"
                    : "border-white/10"
                  }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                  🎯 最优步数
                </div>
                <div className="text-lg font-black text-amber-400 drop-shadow-[0_0_12px_rgba(255,193,7,0.5)]">
                  {optSteps !== null ? `${optSteps}步` : "--"}
                </div>
              </div>
              <div className="flex-1 min-w-[70px] rounded-2xl bg-white/20 dark:bg-slate-700/20 border border-white/10 text-center py-3 px-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                  👣 当前步数
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {steps}
                </div>
              </div>
              <div className="flex-1 min-w-[70px] rounded-2xl bg-white/20 dark:bg-slate-700/20 border border-white/10 text-center py-3 px-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                  ⭐ 本局得分
                </div>
                <div
                  className={`text-lg font-black ${score === 100
                      ? "text-amber-400 drop-shadow-[0_0_12px_rgba(255,193,7,0.5)]"
                      : "text-slate-900 dark:text-white"
                    }`}
                >
                  {score !== null ? `${score}分` : "--"}
                </div>
              </div>
              <div
                className={`flex-1 min-w-[70px] rounded-2xl text-center py-3 px-2 transition-all border ${bestAnim
                    ? "border-amber-400/50 bg-amber-400/5 highlight-best-anim"
                    : "border-white/10 bg-white/20 dark:bg-slate-700/20"
                  }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                  🏆 最高分
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {highScore > 0 ? `${highScore}分` : "--"}
                </div>
              </div>
            </div>

            {/* 结果横幅 */}
            {score !== null && won && (
              <div
                className={`w-full py-3.5 px-5 rounded-2xl text-center font-bold text-sm result-banner-anim ${bannerType === "perfect"
                    ? "bg-gradient-to-r from-amber-400/20 to-amber-500/30 border border-amber-400/50 text-amber-200"
                    : bannerType === "good"
                      ? "bg-gradient-to-r from-emerald-400/15 to-emerald-500/20 border border-emerald-400/40 text-emerald-200"
                      : "bg-gradient-to-r from-amber-600/10 to-amber-700/15 border border-amber-500/30 text-amber-300/80"
                  }`}
              >
                {bannerType === "perfect"
                  ? "🎉 完美！达成最优解！满分 100 分！"
                  : bannerType === "good"
                    ? `👍 不错！超出最优解 ${steps - (optSteps ?? steps)} 步，得分 ${score} 分`
                    : `💪 继续加油！超出最优解 ${steps - (optSteps ?? steps)} 步，得分 ${score} 分`}
              </div>
            )}

            {/* 按钮 */}
            <div className="flex gap-2.5 flex-wrap justify-center">
              <button
                onClick={onNew}
                disabled={loading}
                className="px-5 py-2.5 text-white text-sm font-bold rounded-xl bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-35"
              >
                🔄 新游戏
              </button>
              <button
                onClick={onHint}
                disabled={!canHint}
                className="px-5 py-2.5 text-amber-200 text-sm font-bold rounded-xl bg-amber-500/15 border border-amber-400/40 hover:bg-amber-500/25 hover:border-amber-400/60 transition-all shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-35"
              >
                💡 提示
              </button>
              <button
                onClick={undo}
                disabled={!canUndo}
                className="px-5 py-2.5 rounded-xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all active:scale-95 disabled:opacity-35"
              >
                ↩ 撤销
              </button>
            </div>
          </div>

          {/* 教程卡片 */}
          <div className="flex-[0_0_34%] min-w-[220px] w-full lg:sticky lg:top-20 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 md:p-6">
            <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4 text-center">
              📖 游戏教程
            </h2>
            <div className="mb-3.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">🎯 游戏目标</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                点击格子，使<strong>所有灯都被点亮</strong>。
              </p>
            </div>
            <div className="mb-3.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">🖱 操作方法</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                点击格子会切换<strong>自身及上下左右邻居</strong>的亮灭状态。
              </p>
            </div>
            <hr className="border-t border-white/10 my-3" />
            <div className="mb-3.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">📊 计分规则</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                系统计算<span className="text-amber-400 font-bold">真实最优步数 M</span>。
                <br />
                步数 = M → <span className="text-amber-400 font-bold">满分100分</span>
                <br />
                每多一步扣10分，最低20分。
              </p>
            </div>
            <div className="mb-3.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">💡 提示与自定义</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                点击<strong>"💡提示"</strong>高亮最优点击位置。
                <br />
                可选预设4~10或<span className="text-amber-400 font-bold">输入2~20的自定义数值</span>。
                <br />
                拖动<span className="text-amber-400 font-bold">目标覆盖率</span>滑块调整初始亮灯比例，右侧显示实际比例。
                <br />
                <span className="text-amber-400 font-bold">不同尺寸/覆盖率组合拥有独立最高分记录</span>。
              </p>
            </div>
            <hr className="border-t border-white/10 my-3" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">🔧 小贴士</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                • 点击两次同一格子 = 没点
                <br />• 顺序不影响结果
                <br />• 善用<strong>撤销</strong>和<strong>提示</strong>
                <br />• 快捷键{" "}
                <kbd className="px-1 py-0.5 text-[10px] rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                  Ctrl+Z
                </kbd>{" "}
                撤销
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
