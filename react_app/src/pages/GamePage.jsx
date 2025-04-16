import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/* ---------- вспомогательные функции ---------- */
async function fetchLevelDataForUser(userId) {
  try {
    const { data } = await api.get(`/progress?userId=${userId}`);
    if (data?.state)
      return {
        Level_id : data.levelId,
        state    : data.state,
        completed: data.status === "completed",
      };
    return await fallbackToLevel(1);
  } catch (e) {
    if (e.response?.status === 404) return await fallbackToLevel(1);
    console.error("Ошибка загрузки прогресса:", e);
    return null;
  }
}
async function fallbackToLevel(levelId) {
  try {
    const { data } = await api.get(`/levels/${levelId}`);
    return { Level_id: data.id, state: data.level_data.state, completed: false };
  } catch (e) {
    console.error("Ошибка загрузки fallback‑уровня:", e);
    return null;
  }
}
async function saveProgress(userId, levelId, state, completed = false) {
  await api.post("/progress", {
    user_id: userId,
    level_id: levelId,
    progress_data: { state },
    completed,
  });
}
async function setNextLevelAsInProgress(userId, nextLevelId) {
  try {
    const { data } = await api.get(`/levels/${nextLevelId}`);
    await api.post("/progress", {
      user_id: userId,
      level_id: data.id,
      progress_data: { state: data.level_data.state },
      completed: false,
    });
  } catch (e) {
    console.error("Ошибка назначения следующего уровня:", e);
  }
}
/* ------------------------------------------------ */

function getColorBlock(c, idx, tube) {
  const base =
    "w-full h-full mx-auto rounded-none transition-all duration-500 ease-in-out";
  const isBottom =
    idx === tube.length - 1 || tube[idx + 1] === -1 ? "rounded-b-full" : "";
  const map = {
    0: "bg-[#8CB4C9]",
    1: "bg-[#C9ADA7]",
    2: "bg-[#B5CDA3]",
    3: "bg-[#E0C097]",
    4: "bg-[#A9A9B3]",
    5: "bg-[#DAB6C4]",
    6: "bg-[#A1C6EA]",
    7: "bg-[#BFCBA8]",
  };
  return `${base} ${map[c] || "bg-transparent"} ${isBottom} opacity-90`;
}

function findTop(t) {
  for (let i = 0; i < t.length; i++) if (t[i] !== -1) return i;
  return -1;
}
function canPour(src, dst) {
  const f = findTop(src);
  if (f === -1) return false;
  const t = findTop(dst);
  if (t === 0) return false;
  return t === -1 || src[f] === dst[t];
}
function pour(src, dst) {
  const A = [...src],
    B = [...dst];
  let f = findTop(A);
  if (f === -1) return { newSource: A, newTarget: B };
  const col = A[f];
  let cnt = 1;
  for (let i = f + 1; i < A.length && A[i] === col; i++) cnt++;
  let t = findTop(B);
  t = t === -1 ? B.length - 1 : t - 1;
  while (cnt > 0 && t >= 0 && B[t] === -1) {
    B[t] = col;
    A[f] = -1;
    f++;
    t--;
    cnt--;
  }
  return { newSource: A, newTarget: B };
}
function clone(state) {
  return state.map((t) => [...t]);
}
function isSolved(state) {
  return state.every(
    (t) => t.every((c) => c === -1) || t.every((c) => c !== -1 && c === t[0])
  );
}

/* ---------------- Tube ---------------- */
function Tube({ tube, index, onClick, selected }) {
  return (
    <div
      onClick={() => onClick(index)}
      className={`w-16 h-[160px] border-[4px] rounded-b-full rounded-t-xl flex flex-col justify-start items-stretch cursor-pointer ${
        selected ? "border-blue-400" : "border-[#3B3F45]"
      } bg-transparent overflow-hidden`}
    >
      <div className="flex flex-col justify-end pt-2 h-full">
        {tube.map((cell, i) => (
          <div
            key={i}
            //! FIX — и у цветных, и у пустых блоков снова есть flex‑1
            className={`flex-1 mx-[2px] ${
              cell === -1 ? "opacity-0" : getColorBlock(cell, i, tube)
            }`}
          />
        ))}
      </div>
    </div>
  );
}
/* ------------------------------------------------ */

export default function GamePage() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [userId] = useState(navState?.userId || 1);

  const [levelData, setLevelData] = useState(null);
  const [coins, setCoins] = useState(0);
  const [selectedTube, setSelectedTube] = useState(null);
  const [showSolved, setShowSolved] = useState(false);

  /* загрузка */
  useEffect(() => {
    (async () => {
      try {
        const u = await api.get(`/users/${userId}`);
        setCoins(u.data.coins);
      } catch (e) {
        console.error("Ошибка монет:", e);
      }
      const data = await fetchLevelDataForUser(userId);
      if (data) setLevelData(data);
    })();
  }, [userId]);

  if (!levelData)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        Loading…
      </div>
    );

  const solved = isSolved(levelData.state);

  /* клик по колбе */
  const handleTubeClick = async (idx) => {
    if (solved) return;
    const state = levelData.state;

    if (selectedTube === null) {
      if (state[idx][state[idx].length - 1] !== -1) setSelectedTube(idx);
      return;
    }
    if (selectedTube === idx) {
      setSelectedTube(null);
      return;
    }
    if (!canPour(state[selectedTube], state[idx])) {
      setSelectedTube(null);
      return;
    }

    const { newSource, newTarget } = pour(state[selectedTube], state[idx]);
    const newState = clone(state);
    newState[selectedTube] = newSource;
    newState[idx] = newTarget;

    const completed = isSolved(newState);
    setLevelData({ ...levelData, state: newState });
    await saveProgress(userId, levelData.Level_id, newState, completed);

    if (completed) {
      setShowSolved(true);
      await setNextLevelAsInProgress(userId, levelData.Level_id + 1);
    }
    setSelectedTube(null);
  };

  /* reset */
  const resetLevel = async () => {
    try {
      const { data } = await api.get(`/levels/${levelData.Level_id}`);
      await api.post("/progress", {
        user_id: userId,
        level_id: data.id,
        progress_data: { state: data.level_data.state },
        completed: false,
      });
      setLevelData({
        Level_id: data.id,
        state: data.level_data.state,
        completed: false,
      });
      setSelectedTube(null);
    } catch (e) {
      console.error("Ошибка сброса:", e);
    }
  };

  /* рендер */
  const top = levelData.state.slice(0, 4);
  const bottom = levelData.state.slice(4);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6">
      <div className="w-[390px] h-[844px] bg-gray-900 rounded-3xl shadow-xl flex flex-col text-white relative overflow-hidden">
        {/* header */}
        <div className="flex justify-between items-center px-6 pt-6">
          <button
            onClick={() => navigate("/")}
            className="bg-gray-700 px-3 py-1.5 rounded-full text-sm"
          >
            &larr; Main
          </button>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full text-sm flex items-center space-x-1">
            <span className="font-semibold">{coins}</span>
            <span className="text-yellow-400">🪙</span>
          </div>
        </div>

        {/* field */}
        <div className="flex flex-col flex-grow px-4 py-4 items-center">
          <div className="text-sm text-gray-400 mb-2">
            Level {levelData.Level_id}
          </div>
          <h2 className="text-xl font-bold mb-4">
            {solved ? "Level Solved!" : "Keep playing..."}
          </h2>

          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="flex justify-center gap-4">
              {top.map((t, i) => (
                <Tube
                  key={i}
                  tube={t}
                  index={i}
                  onClick={handleTubeClick}
                  selected={selectedTube === i}
                />
              ))}
            </div>
            {bottom.length > 0 && (
              <div className="flex justify-center gap-4">
                {bottom.map((t, i) => (
                  <Tube
                    key={i + 4}
                    tube={t}
                    index={i + 4}
                    onClick={handleTubeClick}
                    selected={selectedTube === i + 4}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={resetLevel}
            className="w-full bg-red-600 hover:bg-red-500 py-2 rounded-full font-semibold transition"
          >
            Reset Level
          </button>
        </div>

        {/* modal */}
        {showSolved && (
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
                  className="bg-gray-700 px-4 py-2 rounded"
                  onClick={() => navigate("/")}
                >
                  Main
                </button>
              </div>
            </div>
          </div>
        )}

        {/* footer‑копирайт */}
        <div className="absolute bottom-3 w-full text-center">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText("@SortWaterAI");
                alert("Текст скопирован!");
              } catch (e) {
                console.error(e);
              }
            }}
            className="text-xs text-gray-500 underline"
          >
            @SortWaterAI
          </button>
        </div>
      </div>
    </div>
  );
}
