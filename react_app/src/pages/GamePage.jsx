import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/* ---------- Вспомогательные функции (логика игры) ---------- */
function findTop(tube) {
  for (let i = 0; i < tube.length; i++) if (tube[i] !== -1) return i;
  return -1;
}
function canPour(source, target) {
  const fromTop = findTop(source);
  if (fromTop === -1) return false;
  const toTop = findTop(target);
  if (toTop === 0) return false;
  if (toTop === -1) return true;                     // приёмник пуст
  return source[fromTop] === target[toTop];          // цвета совпадают
}
function pour(src, dst) {
  const A = [...src], B = [...dst];
  let from = findTop(A);
  const color = A[from];
  let count = 1;
  for (let i = from + 1; i < A.length && A[i] === color; i++) count++;

  let to = findTop(B);
  to = to === -1 ? B.length - 1 : to - 1;

  let moved = false;
  while (count > 0 && to >= 0) {
    if (B[to] === -1) {
      B[to] = color;
      A[from] = -1;
      from++;
      to--;
      count--;
      moved = true;
    } else break;
  }
  return { newSource: A, newTarget: B, moved };
}
function cloneState(state) {
  return state.map((tube) => [...tube]);
}
function isSolved(state) {
  return state.every(
    (tube) =>
      tube.every((c) => c === -1) || tube.every((c) => c !== -1 && c === tube[0])
  );
}
/* ----------------------------------------------------------- */

async function fetchCurrentProgress(userId) {
  try {
    const { data } = await api.get(`/progress?userId=${userId}`);
    return {
      levelId: data.levelId,
      state: data.state,
      status: data.status,
    };
  } catch (e) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}

async function startLevel(userId, levelId) {
  // получаем оригинальный state уровня
  const { data } = await api.get(`/levels/${levelId}`);
  await api.post("/progress/start", {
    userId,
    levelId,
    state: data.level_data.state,
  });
  return {
    levelId,
    state: data.level_data.state,
    status: "in_progress",
  };
}

async function makeMove(userId, levelId, from, to) {
  const resp = await api.post("/progress/move", { userId, levelId, from, to });
  return resp.data; // { state, status }
}

export default function GamePage() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [userId] = useState(navState?.userId || 1);
  const [coins, setCoins] = useState(0);

  const [levelId, setLevelId] = useState(null);
  const [levelState, setLevelState] = useState(null);
  const [status, setStatus] = useState("in_progress");

  const [selectedTube, setSelectedTube] = useState(null);
  const [showSolvedModal, setShowSolvedModal] = useState(false);

  /* ---------- Инициализация ---------- */
  useEffect(() => {
    (async () => {
      try {
        const u = await api.get(`/users/${userId}`);
        setCoins(u.data.coins);
      } catch (e) {
        console.error("Ошибка загрузки монет:", e);
      }

      let progress = await fetchCurrentProgress(userId);
      if (!progress) progress = await startLevel(userId, 1);

      setLevelId(progress.levelId);
      setLevelState(progress.state);
      setStatus(progress.status);
      if (progress.status === "completed") setShowSolvedModal(true);
    })();
  }, [userId]);

  if (!levelState)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        Loading level…
      </div>
    );

  /* ---------- Обработчик клика по колбе ---------- */
  async function handleTubeClick(idx) {
    if (status === "completed") return;

    if (selectedTube === null) {
      // выбираем источник
      if (levelState[idx][levelState[idx].length - 1] !== -1) {
        setSelectedTube(idx);
      }
      return;
    }

    if (selectedTube === idx) {
      setSelectedTube(null);
      return;
    }

    if (!canPour(levelState[selectedTube], levelState[idx])) {
      setSelectedTube(null);
      return;
    }

    // оптимистичное обновление UI
    const { newSource, newTarget } = pour(
      levelState[selectedTube],
      levelState[idx]
    );
    const optimistic = cloneState(levelState);
    optimistic[selectedTube] = newSource;
    optimistic[idx] = newTarget;
    setLevelState(optimistic);
    setSelectedTube(null);

    try {
      const { state, status } = await makeMove(userId, levelId, selectedTube, idx);
      setLevelState(state);
      setStatus(status);
      if (status === "completed") setShowSolvedModal(true);
    } catch (err) {
      console.error("Сервер отклонил ход:", err?.response?.data || err);
      // откат UI
      setLevelState(levelState);
    }
  }

  /* ---------- Сброс уровня ---------- */
  async function handleResetLevel() {
    try {
      const progress = await startLevel(userId, levelId);
      setLevelState(progress.state);
      setStatus("in_progress");
      setSelectedTube(null);
    } catch (err) {
      console.error("Ошибка при сбросе уровня:", err);
    }
  }

  /* ---------- Отрисовка ---------- */
  const topRow = levelState.slice(0, 4);
  const bottomRow = levelState.length > 4 ? levelState.slice(4) : [];

  function getColorBlock(color, layerIndex, tube) {
    const base =
      "w-full h-full mx-auto rounded-none transition-all duration-500 ease-in-out";
    const isBottomFilled =
      layerIndex === tube.length - 1 || tube[layerIndex + 1] === -1;
    const rounded = isBottomFilled ? "rounded-b-full" : "";
    const colorMap = {
      0: "bg-[#8CB4C9]",
      1: "bg-[#C9ADA7]",
      2: "bg-[#B5CDA3]",
      3: "bg-[#E0C097]",
      4: "bg-[#A9A9B3]",
      5: "bg-[#DAB6C4]",
      6: "bg-[#A1C6EA]",
      7: "bg-[#BFCBA8]",
    };
    return `${base} ${colorMap[color] || "bg-transparent"} ${rounded} opacity-90`;
  }

  function Tube({ tube, index }) {
    return (
      <div
        className={`w-16 h-[160px] border-[4px] rounded-b-full rounded-t-xl flex flex-col justify-start items-stretch cursor-pointer ${
          selectedTube === index ? "border-blue-400" : "border-[#3B3F45]"
        } bg-transparent overflow-hidden`}
        onClick={() => handleTubeClick(index)}
      >
        <div className="flex flex-col justify-end pt-2 h-full">
          {tube.map((cell, i) => (
            <div
              key={i}
              className={`flex-1 mx-[2px] transition-opacity duration-500 ${
                cell === -1 ? "opacity-0" : getColorBlock(cell, i, tube)
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-start bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6 overflow-hidden">
      <div className="w-full max-w-lg mx-auto text-white flex flex-col h-full">
        {/* ---- Header ---- */}
        <div className="flex justify-between items-center mb-4">
          <button
            className="bg-gray-700 px-3 py-1.5 rounded-full text-sm hover:bg-gray-600 transition"
            onClick={() => navigate("/")}
          >
            &larr; Main
          </button>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full flex items-center space-x-1 text-sm">
            <span className="font-semibold">{coins}</span>
            <span className="text-yellow-400">🪙</span>
          </div>
        </div>

        {/* ---- Game field ---- */}
        <div className="flex flex-col items-center justify-center flex-grow gap-6">
          <div className="text-center text-sm text-gray-400">
            Level {levelId}
          </div>
          <h2 className="text-xl font-bold">
            {status === "completed" ? "Level Solved!" : "Keep playing..."}
          </h2>

          <div className="flex flex-col gap-4">
            <div className="flex justify-center gap-4">
              {topRow.map((tube, i) => (
                <Tube key={i} tube={tube} index={i} />
              ))}
            </div>
            {bottomRow.length > 0 && (
              <div className="flex justify-center gap-4">
                {bottomRow.map((tube, idx) => {
                  const realIdx = idx + topRow.length;
                  return (
                    <Tube
                      key={realIdx}
                      tube={tube}
                      index={realIdx}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleResetLevel}
            className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-full w-full text-center font-semibold transition max-w-xs"
          >
            Reset Level
          </button>
        </div>
      </div>

      {/* ---- Solved modal ---- */}
      {showSolvedModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center">
            <h3 className="text-lg font-bold mb-4">Уровень пройден!</h3>
            <div className="flex flex-col space-y-3">
              <button
                className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                Continue
              </button>
              <button
                className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
                onClick={() => navigate("/")}
              >
                Main
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
