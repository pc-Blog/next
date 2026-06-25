"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import BackButton from "@/app/_components/article/BackButton";

// ============ 类型定义 ============
type Difficulty = "easy" | "medium" | "hard";
type Board = number[][];
type Notes = (Set<number> | null)[][];

interface Action {
  row: number;
  col: number;
  prevValue: number;
  newValue: number;
  prevNotes: Set<number> | null;
  newNotes: Set<number> | null;
}

const GRID_SIZE = 9;
const BOX_SIZE = 3;

// 难度对应的提示数范围
const DIFFICULTY_HINTS: Record<Difficulty, { min: number; max: number; label: string }> = {
  easy: { min: 36, max: 40, label: "简单" },
  medium: { min: 28, max: 32, label: "中等" },
  hard: { min: 22, max: 26, label: "困难" },
};

// ============ 数独算法 ============
function isValidPlacement(board: Board, row: number, col: number, num: number): boolean {
  for (let c = 0; c < GRID_SIZE; c++) {
    if (board[row][c] === num) return false;
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    if (board[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function countSolutions(board: Board, limit: number = 2): number {
  let count = 0;
  const boardCopy = board.map((r) => [...r]);

  function solve() {
    if (count >= limit) return;
    let minOptions = GRID_SIZE + 1;
    let bestRow = -1;
    let bestCol = -1;
    let bestOptions: number[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (boardCopy[r][c] === 0) {
          const options: number[] = [];
          for (let n = 1; n <= GRID_SIZE; n++) {
            if (isValidPlacement(boardCopy, r, c, n)) options.push(n);
          }
          if (options.length < minOptions) {
            minOptions = options.length;
            bestRow = r;
            bestCol = c;
            bestOptions = options;
            if (minOptions === 0) return;
            if (minOptions === 1) break;
          }
        }
      }
      if (minOptions === 1) break;
    }

    if (bestRow === -1) {
      count++;
      return;
    }
    for (const num of bestOptions) {
      boardCopy[bestRow][bestCol] = num;
      solve();
      if (count >= limit) return;
      boardCopy[bestRow][bestCol] = 0;
    }
  }
  solve();
  return count;
}

function generateFullBoard(): Board {
  const board: Board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  // 先填充3个对角线宫
  for (let box = 0; box < BOX_SIZE; box++) {
    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const startRow = box * BOX_SIZE;
    const startCol = box * BOX_SIZE;
    for (let i = 0; i < BOX_SIZE; i++) {
      for (let j = 0; j < BOX_SIZE; j++) {
        board[startRow + i][startCol + j] = nums[i * BOX_SIZE + j];
      }
    }
  }
  function fillRemaining(): boolean {
    let minOptions = GRID_SIZE + 1;
    let bestRow = -1;
    let bestCol = -1;
    let bestOptions: number[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (board[r][c] === 0) {
          const options: number[] = [];
          for (let n = 1; n <= GRID_SIZE; n++) {
            if (isValidPlacement(board, r, c, n)) options.push(n);
          }
          if (options.length < minOptions) {
            minOptions = options.length;
            bestRow = r;
            bestCol = c;
            bestOptions = options;
            if (minOptions === 0) return false;
            if (minOptions === 1) break;
          }
        }
      }
      if (minOptions === 1) break;
    }
    if (bestRow === -1) return true;
    const shuffled = shuffleArray(bestOptions);
    for (const num of shuffled) {
      board[bestRow][bestCol] = num;
      if (fillRemaining()) return true;
      board[bestRow][bestCol] = 0;
    }
    return false;
  }
  if (!fillRemaining()) return generateFullBoard();
  return board;
}

function createPuzzle(fullBoard: Board, difficulty: Difficulty): Board {
  const hintRange = DIFFICULTY_HINTS[difficulty];
  const targetHints = hintRange.min + Math.floor(Math.random() * (hintRange.max - hintRange.min + 1));
  const targetBlanks = GRID_SIZE * GRID_SIZE - targetHints;
  const puzzle = fullBoard.map((r) => [...r]);
  const allCells: { r: number; c: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) allCells.push({ r, c });
  const shuffled = shuffleArray(allCells);
  let blanksCreated = 0;
  for (const { r, c } of shuffled) {
    if (blanksCreated >= targetBlanks) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      blanksCreated++;
    } else {
      puzzle[r][c] = backup;
    }
  }
  if (blanksCreated < targetBlanks - 5) {
    const remaining = shuffled.filter(({ r, c }) => puzzle[r][c] !== 0);
    const shuffledRem = shuffleArray(remaining);
    for (const { r, c } of shuffledRem) {
      if (blanksCreated >= targetBlanks) break;
      const backup = puzzle[r][c];
      puzzle[r][c] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        blanksCreated++;
      } else {
        puzzle[r][c] = backup;
      }
    }
  }
  return puzzle;
}

function generateNewPuzzle(difficulty: Difficulty): { puzzle: Board; solution: Board } {
  const fullBoard = generateFullBoard();
  const puzzle = createPuzzle(fullBoard, difficulty);
  return { puzzle, solution: fullBoard };
}

// ============ 辅助函数 ============
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function getBoxId(row: number, col: number): number {
  return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE);
}

function findConflicts(board: Board): Set<string> {
  const conflicts = new Set<string>();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c];
      if (val === 0) continue;
      // 行
      for (let cc = 0; cc < GRID_SIZE; cc++) {
        if (cc !== c && board[r][cc] === val) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${r},${cc}`);
        }
      }
      // 列
      for (let rr = 0; rr < GRID_SIZE; rr++) {
        if (rr !== r && board[rr][c] === val) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${rr},${c}`);
        }
      }
      // 宫
      const boxRow = Math.floor(r / BOX_SIZE) * BOX_SIZE;
      const boxCol = Math.floor(c / BOX_SIZE) * BOX_SIZE;
      for (let rr = boxRow; rr < boxRow + BOX_SIZE; rr++) {
        for (let cc = boxCol; cc < boxCol + BOX_SIZE; cc++) {
          if ((rr !== r || cc !== c) && board[rr][cc] === val) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${rr},${cc}`);
          }
        }
      }
    }
  }
  return conflicts;
}

function checkBoardComplete(board: Board, solution: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0 || board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

// ============ 主组件 ============
export default function LightsOutPage() {
  const gameRef = useRef<HTMLDivElement>(null);

  // 游戏状态
  const [initialBoard, setInitialBoard] = useState<Board>(
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
  );
  const [currentBoard, setCurrentBoard] = useState<Board>(
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
  );
  const [solutionBoard, setSolutionBoard] = useState<Board>(
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
  );
  const [notes, setNotes] = useState<Notes>(
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null))
  );
  const [selectedRow, setSelectedRow] = useState(-1);
  const [selectedCol, setSelectedCol] = useState(-1);
  const [noteMode, setNoteMode] = useState(false);
  const [actionHistory, setActionHistory] = useState<Action[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>("medium");
  const [errorHighlightCells, setErrorHighlightCells] = useState<Set<string>>(new Set());
  const [showVictory, setShowVictory] = useState(false);
  const [bestScores, setBestScores] = useState<Record<Difficulty, number | null>>({
    easy: null,
    medium: null,
    hard: null,
  });
  const [fireworks, setFireworks] = useState<
    { id: number; x: number; y: number; tx: number; ty: number; color: string; size: number; delay: number; duration: number }[]
  >([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 冲突单元格（派生状态）
  const conflictCells = useMemo(() => findConflicts(currentBoard), [currentBoard]);

  // 从 localStorage 读取最佳成绩
  useEffect(() => {
    const scores: Record<Difficulty, number | null> = { easy: null, medium: null, hard: null };
    try {
      for (const diff of ["easy", "medium", "hard"] as Difficulty[]) {
        const stored = localStorage.getItem(`sudoku_best_${diff}`);
        if (stored !== null) {
          scores[diff] = parseInt(stored, 10);
        }
      }
    } catch {
      // localStorage 不可用
    }
    setBestScores(scores);
  }, []);

  // 初始化游戏
  const initGame = useCallback(
    (difficulty: Difficulty) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const { puzzle, solution } = generateNewPuzzle(difficulty);
      setInitialBoard(puzzle.map((r) => [...r]));
      setCurrentBoard(puzzle.map((r) => [...r]));
      setSolutionBoard(solution.map((r) => [...r]));
      setNotes(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null)));
      setSelectedRow(-1);
      setSelectedCol(-1);
      setNoteMode(false);
      setActionHistory([]);
      setTimerSeconds(0);
      setTimerRunning(true);
      setGameWon(false);
      setCurrentDifficulty(difficulty);
      setErrorHighlightCells(new Set());
      setShowVictory(false);
      setFireworks([]);
    },
    []
  );

  // 重置游戏
  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCurrentBoard(initialBoard.map((r) => [...r]));
    setNotes(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null)));
    setSelectedRow(-1);
    setSelectedCol(-1);
    setNoteMode(false);
    setActionHistory([]);
    setTimerSeconds(0);
    setTimerRunning(true);
    setGameWon(false);
    setErrorHighlightCells(new Set());
    setShowVictory(false);
    setFireworks([]);
  }, [initialBoard]);

  // 组件挂载时初始化
  useEffect(() => {
    initGame("medium");
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 计时器
  useEffect(() => {
    if (timerRunning && !gameWon) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerRunning, gameWon]);

  // 错误高亮自动清除
  useEffect(() => {
    if (errorHighlightCells.size > 0) {
      const timeout = setTimeout(() => {
        setErrorHighlightCells(new Set());
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [errorHighlightCells]);

  // 胜利检测
  useEffect(() => {
    if (!gameWon && checkBoardComplete(currentBoard, solutionBoard)) {
      setGameWon(true);
      setTimerRunning(false);
      setShowVictory(true);
      // 更新最佳成绩
      const bestKey = `sudoku_best_${currentDifficulty}`;
      const currentBest = bestScores[currentDifficulty];
      const isNewBest = currentBest === null || timerSeconds < currentBest;
      if (isNewBest) {
        try {
          localStorage.setItem(bestKey, timerSeconds.toString());
        } catch {
          // 忽略
        }
        setBestScores((prev) => ({ ...prev, [currentDifficulty]: timerSeconds }));
      }
      // 生成烟花
      triggerFireworks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoard]);

  // 烟花粒子
  const triggerFireworks = useCallback(() => {
    const colors = [
      "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
      "#ff922b", "#e64980", "#20c997", "#845ef7",
      "#ff6b9d", "#ffa94d", "#51cf66", "#339af0",
    ];
    const particles: typeof fireworks = [];
    const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
    const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
    let id = 0;
    for (let burst = 0; burst < 3; burst++) {
      const delay = burst * 200;
      const count = 24 + burst * 8;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = 60 + Math.random() * 130 + burst * 25;
        particles.push({
          id: id++,
          x: centerX,
          y: centerY,
          tx: Math.cos(angle) * distance,
          ty: Math.sin(angle) * distance,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 7,
          delay: delay + Math.random() * 150,
          duration: 900 + Math.random() * 800,
        });
      }
    }
    setFireworks(particles);
    // 清理烟花
    const maxDuration = Math.max(...particles.map((p) => p.delay + p.duration)) + 500;
    setTimeout(() => setFireworks([]), maxDuration);
  }, []);

  // 选中单元格
  const selectCell = useCallback(
    (row: number, col: number, toggleIfSame = true) => {
      if (gameWon) return;
      if (toggleIfSame && selectedRow === row && selectedCol === col) {
        setSelectedRow(-1);
        setSelectedCol(-1);
      } else {
        setSelectedRow(row);
        setSelectedCol(col);
      }
      setErrorHighlightCells(new Set());
    },
    [gameWon, selectedRow, selectedCol]
  );

  // 填入数字
  const fillNumber = useCallback(
    (row: number, col: number, num: number) => {
      if (gameWon) return;
      if (initialBoard[row][col] !== 0) return;
      if (currentBoard[row][col] === num && notes[row][col] === null) return;
      const oldValue = currentBoard[row][col];
      const oldNotes = notes[row][col] ? new Set(notes[row][col]) : null;
      const action: Action = {
        row,
        col,
        prevValue: oldValue,
        newValue: num,
        prevNotes: oldNotes,
        newNotes: null,
      };
      setCurrentBoard((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = num;
        return next;
      });
      setNotes((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = null;
        return next;
      });
      setActionHistory((prev) => [...prev, action]);
      setErrorHighlightCells(new Set());
      setSelectedRow(row);
      setSelectedCol(col);
    },
    [gameWon, initialBoard, currentBoard, notes]
  );

  // 清除单元格
  const clearCell = useCallback(
    (row: number, col: number) => {
      if (gameWon) return;
      if (initialBoard[row][col] !== 0) return;
      if (currentBoard[row][col] === 0 && (notes[row][col] === null || notes[row][col]!.size === 0)) return;
      const oldValue = currentBoard[row][col];
      const oldNotes = notes[row][col] ? new Set(notes[row][col]) : null;
      const action: Action = {
        row,
        col,
        prevValue: oldValue,
        newValue: 0,
        prevNotes: oldNotes,
        newNotes: null,
      };
      setCurrentBoard((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = 0;
        return next;
      });
      setNotes((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = null;
        return next;
      });
      setActionHistory((prev) => [...prev, action]);
      setErrorHighlightCells(new Set());
      setSelectedRow(row);
      setSelectedCol(col);
    },
    [gameWon, initialBoard, currentBoard, notes]
  );

  // 切换笔记
  const toggleNote = useCallback(
    (row: number, col: number, num: number) => {
      if (gameWon) return;
      if (initialBoard[row][col] !== 0) return;
      if (currentBoard[row][col] !== 0) return;
      const oldNotes = notes[row][col] ? new Set(notes[row][col]) : null;
      const currentNoteSet = notes[row][col] ? new Set(notes[row][col]) : new Set<number>();
      const hadNote = currentNoteSet.has(num);
      const newNotesSet = new Set(currentNoteSet);
      if (hadNote) {
        newNotesSet.delete(num);
      } else {
        newNotesSet.add(num);
      }
      const action: Action = {
        row,
        col,
        prevValue: 0,
        newValue: 0,
        prevNotes: oldNotes,
        newNotes: newNotesSet.size > 0 ? new Set(newNotesSet) : null,
      };
      setNotes((prev) => {
        const next = prev.map((r) => [...r]);
        if (hadNote) {
          const s = next[row][col] ? new Set(next[row][col]!) : new Set<number>();
          s.delete(num);
          next[row][col] = s.size > 0 ? s : null;
        } else {
          const s = next[row][col] ? new Set(next[row][col]!) : new Set<number>();
          s.add(num);
          next[row][col] = s;
        }
        return next;
      });
      setActionHistory((prev) => [...prev, action]);
      setErrorHighlightCells(new Set());
      setSelectedRow(row);
      setSelectedCol(col);
    },
    [gameWon, initialBoard, currentBoard, notes]
  );

  // 撤销
  const undo = useCallback(() => {
    if (gameWon) return;
    if (actionHistory.length === 0) return;
    const history = [...actionHistory];
    const action = history.pop()!;
    setActionHistory(history);
    setCurrentBoard((prev) => {
      const next = prev.map((r) => [...r]);
      next[action.row][action.col] = action.prevValue;
      return next;
    });
    setNotes((prev) => {
      const next = prev.map((r) => [...r]);
      next[action.row][action.col] = action.prevNotes ? new Set(action.prevNotes) : null;
      return next;
    });
    setErrorHighlightCells(new Set());
    setSelectedRow(action.row);
    setSelectedCol(action.col);
  }, [gameWon, actionHistory]);

  // 检查错误
  const checkErrors = useCallback(() => {
    if (gameWon) return;
    setErrorHighlightCells(new Set(conflictCells));
  }, [gameWon, conflictCells]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showVictory && e.key !== "Escape") return;
      if (e.key === "Escape") {
        setShowVictory(false);
        setSelectedRow(-1);
        setSelectedCol(-1);
        setErrorHighlightCells(new Set());
        return;
      }
      if (gameWon) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const num = parseInt(e.key);
        if (selectedRow >= 0 && selectedCol >= 0 && initialBoard[selectedRow][selectedCol] === 0) {
          if (noteMode) {
            toggleNote(selectedRow, selectedCol, num);
          } else {
            fillNumber(selectedRow, selectedCol, num);
          }
        }
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (selectedRow >= 0 && selectedCol >= 0) {
          clearCell(selectedRow, selectedCol);
        }
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        let newRow = selectedRow < 0 ? 0 : selectedRow;
        let newCol = selectedCol < 0 ? 0 : selectedCol;
        if (e.key === "ArrowUp") newRow = Math.max(0, newRow - 1);
        if (e.key === "ArrowDown") newRow = Math.min(GRID_SIZE - 1, newRow + 1);
        if (e.key === "ArrowLeft") newCol = Math.max(0, newCol - 1);
        if (e.key === "ArrowRight") newCol = Math.min(GRID_SIZE - 1, newCol + 1);
        selectCell(newRow, newCol, false);
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNoteMode((prev) => !prev);
        return;
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
        return;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showVictory, gameWon, selectedRow, selectedCol, noteMode, initialBoard, fillNumber, clearCell, toggleNote, selectCell, undo]);

  // 计算选中数字（用于高亮相同数字）
  const selectedValue =
    selectedRow >= 0 && selectedCol >= 0 ? currentBoard[selectedRow][selectedCol] : 0;

  // 计算每个数字的剩余数量
  const remainingCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let n = 1; n <= GRID_SIZE; n++) {
      let filled = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (currentBoard[r][c] === n) filled++;
        }
      }
      counts[n] = Math.max(0, GRID_SIZE - filled);
    }
    return counts;
  }, [currentBoard]);

  // 渲染数独网格单元格
  const renderCell = (r: number, c: number) => {
    const val = currentBoard[r][c];
    const isInitial = initialBoard[r][c] !== 0;
    const isSelected = selectedRow === r && selectedCol === c;
    const cellKey = `${r},${c}`;
    const isConflict = conflictCells.has(cellKey) && val !== 0;
    const isErrorHighlight = errorHighlightCells.has(cellKey);

    // 同行/同列/同宫高亮
    const sameRow = selectedRow >= 0 && r === selectedRow;
    const sameCol = selectedCol >= 0 && c === selectedCol;
    const sameBox =
      selectedRow >= 0 &&
      selectedCol >= 0 &&
      getBoxId(r, c) === getBoxId(selectedRow, selectedCol);
    const isRelated = (sameRow || sameCol || sameBox) && !isSelected;
    // 相同数字高亮
    const isSameNum =
      selectedValue !== 0 &&
      val === selectedValue &&
      !isSelected &&
      selectedRow >= 0 &&
      selectedCol >= 0;

    const boxId = getBoxId(r, c);
    const isAltBlock = boxId % 2 === 1;

    // 宫边界
    const borderRightThick = c % BOX_SIZE === 2 && c < GRID_SIZE - 1;
    const borderBottomThick = r % BOX_SIZE === 2 && r < GRID_SIZE - 1;
    const borderLeftThick = c % BOX_SIZE === 0 && c > 0;
    const borderTopThick = r % BOX_SIZE === 0 && r > 0;

    const cellNote = notes[r][c];
    const hasNotes = val === 0 && cellNote && cellNote.size > 0;

    // 动态类名构建
    const classes = [
      // 基础
      "flex items-center justify-center relative cursor-pointer select-none",
      "border border-slate-300 dark:border-slate-600/60",
      "transition-all duration-150",
      "min-w-0 min-h-0 outline-none",
      // 尺寸
      "w-[clamp(38px,9.5vw,52px)] h-[clamp(38px,9.5vw,52px)]",
      // 背景
      isAltBlock
        ? "bg-slate-100/60 dark:bg-slate-800/40"
        : "bg-white/60 dark:bg-slate-700/30",
      // 初始/用户数字
      isInitial
        ? "text-slate-700 dark:text-slate-300 font-bold"
        : val !== 0
          ? "text-indigo-600 dark:text-indigo-400 font-semibold"
          : "",
      // 选中
      isSelected
        ? "!bg-indigo-200/70 dark:!bg-indigo-500/35 shadow-[inset_0_0_0_3px_rgba(99,102,241,0.7)] dark:shadow-[inset_0_0_0_3px_rgba(129,140,248,0.7)] scale-[1.03] z-10 rounded-[4px] border-indigo-400 dark:border-indigo-400"
        : "",
      // 相关高亮
      isRelated && !isSelected
        ? "bg-indigo-100/40 dark:bg-indigo-500/12"
        : "",
      // 相同数字高亮
      isSameNum && !isSelected
        ? "!bg-indigo-100/50 dark:!bg-indigo-400/18 shadow-[inset_0_0_0_1.5px_rgba(99,102,241,0.3)] dark:shadow-[inset_0_0_0_1.5px_rgba(129,140,248,0.35)]"
        : "",
      // 冲突
      isConflict
        ? "!bg-red-200/55 dark:!bg-red-500/25 !text-red-600 dark:!text-red-400 animate-pulse-conflict border-red-400 dark:border-red-500 z-[1]"
        : "",
      // 错误检查高亮
      isErrorHighlight
        ? "animate-flash-error !bg-red-300/45 dark:!bg-red-500/35 border-red-400 dark:border-red-400"
        : "",
      // 粗边框
      borderRightThick ? "border-r-[2.5px] border-r-slate-400 dark:border-r-slate-500" : "",
      borderBottomThick
        ? "border-b-[2.5px] border-b-slate-400 dark:border-b-slate-500"
        : "",
      borderLeftThick ? "border-l-[3px] border-l-slate-400 dark:border-l-slate-500" : "",
      borderTopThick ? "border-t-[3px] border-t-slate-400 dark:border-t-slate-500" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={cellKey}
        className={classes}
        onClick={() => selectCell(r, c)}
        onDoubleClick={(e) => e.preventDefault()}
      >
        {/* 主数字 */}
        {!hasNotes && val !== 0 && (
          <span className="relative z-[1] pointer-events-none text-[clamp(1rem,3.5vw,1.35rem)]">
            {val}
          </span>
        )}
        {/* 笔记网格 */}
        {hasNotes && (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[2px] pointer-events-none">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span
                key={n}
                className={`flex items-center justify-center text-[clamp(8px,2vw,12px)] font-medium transition-opacity duration-150 ${cellNote!.has(n)
                    ? "opacity-85 text-indigo-500 dark:text-indigo-300"
                    : "opacity-0"
                  }`}
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-24 px-4 relative">
      {/* 背景装饰 */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(139,92,246,0.04) 0%, transparent 55%), radial-gradient(ellipse at 50% 80%, rgba(59,130,246,0.03) 0%, transparent 50%)",
        }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        <BackButton />

        {/* 主游戏卡片 */}
        <div
          ref={gameRef}
          className="mt-6 mx-auto w-full max-w-[520px] rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 flex flex-col gap-4"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-lg text-white shadow-md shadow-indigo-400/30 flex-shrink-0">
                🧩
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                数独 Sudoku
              </h1>
            </div>
            <div className="font-mono text-lg font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-700/40 rounded-2xl px-4 py-2 border border-slate-200 dark:border-slate-600/50 shadow-inner shadow-white/10 min-w-[80px] text-center">
              {formatTime(timerSeconds)}
            </div>
          </div>

          {/* 难度选择器 */}
          <div className="flex gap-1.5 bg-white/30 dark:bg-slate-700/30 rounded-2xl p-1 border border-slate-200/50 dark:border-slate-600/30 self-start">
            {(
              [
                { key: "easy", label: "🌟 简单" },
                { key: "medium", label: "⚡ 中等" },
                { key: "hard", label: "🔥 困难" },
              ] as { key: Difficulty; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  if (key !== currentDifficulty) initGame(key);
                }}
                className={`px-3.5 py-2 rounded-[16px] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${currentDifficulty === key
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-400/40 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/30 dark:hover:bg-slate-600/20"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 数独网格 */}
          <div
            className="grid grid-cols-9 self-center rounded-xl overflow-hidden border-[3px] border-slate-400 dark:border-slate-500 shadow-lg"
            style={{ width: "fit-content" }}
          >
            {Array.from({ length: GRID_SIZE }, (_, r) =>
              Array.from({ length: GRID_SIZE }, (_, c) => renderCell(r, c))
            ).flat()}
          </div>

          {/* 数字键盘 */}
          <div className="flex flex-col gap-2.5 items-center">
            <div className="flex gap-2 flex-wrap justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                const remaining = remainingCounts[n];
                const disabled = remaining <= 0;
                return (
                  <button
                    key={n}
                    disabled={disabled}
                    onClick={() => {
                      if (selectedRow < 0 || selectedCol < 0) return;
                      if (initialBoard[selectedRow][selectedCol] !== 0) return;
                      if (noteMode) {
                        toggleNote(selectedRow, selectedCol, n);
                      } else {
                        fillNumber(selectedRow, selectedCol, n);
                      }
                    }}
                    className={`relative w-10 h-11 sm:w-11 sm:h-12 rounded-xl text-base sm:text-lg font-bold transition-all duration-150 flex items-center justify-center overflow-hidden
                                            ${disabled
                        ? "opacity-35 pointer-events-none bg-slate-200/50 dark:bg-slate-700/30 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600/30"
                        : "bg-white/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white/80 dark:hover:bg-slate-600/70 hover:border-indigo-300 dark:hover:border-indigo-500 hover:-translate-y-0.5 hover:shadow-md active:scale-90 active:shadow-sm"
                      }
                                        `}
                  >
                    {n}
                    {remaining > 0 && remaining <= 3 && (
                      <span className="absolute bottom-1 right-1.5 text-[8px] text-slate-400 dark:text-slate-500 pointer-events-none">
                        {"●".repeat(remaining)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 操作按钮 */}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                onClick={() => setNoteMode((prev) => !prev)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${noteMode
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-400/40 border border-indigo-500"
                    : "bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  }`}
              >
                ✏️ {noteMode ? "笔记中" : "笔记"}
              </button>
              <button
                onClick={undo}
                disabled={actionHistory.length === 0}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 ${actionHistory.length === 0 ? "opacity-40 pointer-events-none" : ""
                  }`}
              >
                ↩️ 撤销
              </button>
              <button
                onClick={() => {
                  if (selectedRow >= 0 && selectedCol >= 0) clearCell(selectedRow, selectedCol);
                }}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60"
              >
                🧹 擦除
              </button>
              <button
                onClick={checkErrors}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60"
              >
                🔍 检查
              </button>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => initGame(currentDifficulty)}
              className="px-5 py-3 text-white text-sm font-bold rounded-xl transition-all duration-200 bg-indigo-500 hover:bg-indigo-600 active:scale-95 shadow-md shadow-indigo-400/30"
            >
              🎮 新游戏
            </button>
            <button
              onClick={resetGame}
              className="px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 active:scale-95"
            >
              🔄 重置
            </button>
          </div>
        </div>
      </div>

      {/* 胜利弹窗 */}
      {showVictory && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.4s_ease-out]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVictory(false);
          }}
        >
          <div className="bg-white/90 dark:bg-slate-800/95 border border-slate-200 dark:border-white/20 rounded-2xl p-8 text-center shadow-2xl max-w-[400px] w-[90%] animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)]">
            <span className="text-5xl block animate-[bounceIcon_0.6s_ease-out_0.3s_both]">
              🏆
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-3 mb-2">
              恭喜完成！
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-1">
              难度：<span className="font-bold text-amber-500">{DIFFICULTY_HINTS[currentDifficulty].label}</span>
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              用时：<span className="font-bold text-amber-500">{formatTime(timerSeconds)}</span>
            </p>
            {bestScores[currentDifficulty] !== null && (
              <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium mb-4">
                {bestScores[currentDifficulty] === timerSeconds
                  ? "🎉 新最佳记录！"
                  : `🏅 最佳记录：${formatTime(bestScores[currentDifficulty]!)}`}
              </p>
            )}
            <button
              onClick={() => {
                setShowVictory(false);
                initGame(currentDifficulty);
              }}
              className="px-6 py-3 text-white text-sm font-bold rounded-xl transition-all duration-200 bg-indigo-500 hover:bg-indigo-600 active:scale-95 shadow-lg shadow-indigo-400/40"
            >
              🎯 再来一局
            </button>
          </div>
        </div>
      )}

      {/* 烟花粒子 */}
      {fireworks.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none z-[200] rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animation: `fireworkBurst ${p.duration}ms ease-out ${p.delay}ms forwards`,
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* 动画关键帧 */}
      <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes popIn {
                    from { transform: scale(0.7); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes bounceIcon {
                    0% { transform: translateY(-40px); opacity: 0; }
                    50% { transform: translateY(8px); opacity: 1; }
                    70% { transform: translateY(-12px); }
                    100% { transform: translateY(0); opacity: 1; }
                }
                @keyframes fireworkBurst {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
                }
                @keyframes pulse-conflict {
                    0%, 100% { box-shadow: inset 0 0 0 2px rgba(239,68,68,0.5), 0 0 10px rgba(239,68,68,0.3); }
                    50% { box-shadow: inset 0 0 0 2px rgba(239,68,68,0.9), 0 0 20px rgba(239,68,68,0.6); }
                }
                @keyframes flash-error {
                    0%, 100% { box-shadow: inset 0 0 0 3px rgba(239,68,68,0.3); }
                    50% { box-shadow: inset 0 0 0 3px rgba(239,68,68,0.9), 0 0 22px rgba(239,68,68,0.7); }
                }
                .animate-pulse-conflict {
                    animation: pulse-conflict 0.8s ease-in-out infinite;
                }
                .animate-flash-error {
                    animation: flash-error 0.5s ease-in-out 3;
                }
            `}</style>
    </div>
  );
}