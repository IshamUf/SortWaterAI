import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

async function fetchLevelDataForUser(userId) {
  try {
    const resp = await api.get(`/progress?userId=${userId}`);
    const data = resp.data;
    if (data && data.state) {
      return {
        Level_id: data.levelId,
        state: data.state,
        completed: data.status === "completed",
      };
    }
    return await fallbackToLevel(1);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return await fallbackToLevel(1);
    }
    console.error("Ошибка при загрузке прогресса:", error);
    return null;
  }
}

async function fallbackToLevel(levelId) {
  try {
    const resp = await api.get(`/levels/${levelId}`);
    const data = resp.data;
    return {
      Level_id: data.id,
      state: data.level_data.state,
      completed: false,
    };
  } catch (err) {
    console.error("Ошибка при загрузке fallback-уровня:", err);
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
    const resp = await api.get(`/levels/${nextLevelId}`);
    const nextData = resp.data;
    await api.post("/progress", {
      user_id: userId,
      level_id: nextData.id,
      progress_data: { state: nextData.level_data.state },
      completed: false,
    });
    console.log(`Next level (#${nextLevelId}) is now in progress.`);
  } catch (err) {
    console.error("Ошибка при назначении следующего уровня:", err);
  }
}

function Tube({ tube, index, onClick, selected }) {
  return (
    <div
      className={`w-16 h-[160px] border-[4px] rounded-b-full rounded-t-xl flex flex-col justify-start items-stretch cursor-pointer ${
        selected ? "border-blue-400" : "border-[#3B3F45]"
      } bg-transparent overflow-hidden`}
      onClick={() => onClick(index)}
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

function getColorBlock(color, layerIndex, tube) {
  const base = "w-full h-full mx-auto rounded-none transition-all duration-500 ease-in-out";
  const isBottomFilled = layerIndex === tube.length - 1 || tube[layerIndex + 1] === -1;
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

function findTop(tube) {
  for (let i = 0; i < tube.length; i++) {
    if (tube[i] !== -1) return i;
  }
  return -1;
}

function canPour(source, target) {
  const fromTop = findTop(source);
  if (fromTop === -1) return false;
  const toTop = findTop(target);
  if (toTop === 0) return false;
  const fromColor = source[fromTop];
  if (toTop === -1) return true;
  return fromColor === target[toTop];
}

function pour(source, target) {
  const newSource = [...source];
  const newTarget = [...target];
  let fromTop = findTop(newSource);
  if (fromTop === -1) return { newSource, newTarget };

  const color = newSource[fromTop];
  let count = 1;
  let checkIdx = fromTop + 1;
  while (checkIdx < newSource.length && newSource[checkIdx] === color) {
    count++;
    checkIdx++;
  }
  let toTop = findTop(newTarget);
  if (toTop === -1) {
    toTop = newTarget.length - 1;
  } else {
    toTop--;
  }
  while (count > 0 && toTop >= 0) {
    if (newTarget[toTop] === -1) {
      newTarget[toTop] = color;
      newSource[fromTop] = -1;
      fromTop++;
      toTop--;
      count--;
    } else {
      break;
    }
  }
  return { newSource, newTarget };
}

function cloneState(state) {
  return state.map(tube => [...tube]);
}

function isSolved(state) {
  for (let tube of state) {
    if (tube.every(c => c === -1)) continue;
    let first = tube[0];
    if (first === -1) return false;
    for (let i = 1; i < tube.length; i++) {
      if (tube[i] !== first) return false;
    }
  }
  return true;
}

export default function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId] = useState(location.state?.userId || 1);
  const [levelData, setLevelData] = useState(null);
  const [coins, setCoins] = useState(0);
  const [selectedTube, setSelectedTube] = useState(null);
  const [showSolvedModal, setShowSolvedModal] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const userResp = await api.get(`/users/${userId}`);
        setCoins(userResp.data.coins);
      } catch (err) {
        console.error("Ошибка загрузки монет:", err);
      }
      const data = await fetchLevelDataForUser(userId);
      if (data) setLevelData(data);
    }
    init();
  }, [userId]);

  if (!levelData) return <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">Loading level...</div>;

  const solved = isSolved(levelData.state);

  const handleTubeClick = async (tubeIndex) => {
    if (solved) return;
    const state = levelData.state;
    if (selectedTube === null) {
      const bottom = state[tubeIndex][state[tubeIndex].length - 1];
      if (bottom !== -1) setSelectedTube(tubeIndex);
    } else {
      if (selectedTube === tubeIndex) {
        setSelectedTube(null);
        return;
      }
      const source = state[selectedTube];
      const target = state[tubeIndex];
      if (!canPour(source, target)) {
        setSelectedTube(null);
        return;
      }
      const { newSource, newTarget } = pour(source, target);
      const newState = cloneState(state);
      newState[selectedTube] = newSource;
      newState[tubeIndex] = newTarget;
      const completed = isSolved(newState);
      setLevelData({ ...levelData, state: newState });
      await saveProgress(userId, levelData.Level_id, newState, completed);
      if (completed) {
        setShowSolvedModal(true);
        await setNextLevelAsInProgress(userId, levelData.Level_id + 1);
      }
      setSelectedTube(null);
    }
  };

  const handleResetLevel = async () => {
    try {
      const resp = await api.get(`/levels/${levelData.Level_id}`);
      const lvl = resp.data;
      await api.post("/progress", {
        user_id: userId,
        level_id: lvl.id,
        progress_data: { state: lvl.level_data.state },
        completed: false,
      });
      setLevelData({
        Level_id: lvl.id,
        state: lvl.level_data.state,
        completed: false,
      });
      setSelectedTube(null);
    } catch (err) {
      console.error("Ошибка при сбросе уровня:", err);
    }
  };

  const handleContinue = async () => {
    window.location.reload();
  };

  const topRow = levelData.state.slice(0, 4);
  const bottomRow = levelData.state.length > 4 ? levelData.state.slice(4) : [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6">
      <div className="w-[390px] h-[844px] bg-gray-900 rounded-3xl shadow-xl flex flex-col text-white relative overflow-hidden">
        <div className="flex justify-between items-center px-6 pt-6">
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
        <div className="flex flex-col flex-grow px-4 py-4 items-center">
          <div className="text-center text-sm text-gray-400 mb-2">
            Level {levelData.Level_id}
          </div>
          <h2 className="text-xl font-bold mb-4">
            {solved ? "Level Solved!" : "Keep playing..."}
          </h2>
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="flex justify-center gap-4">
              {topRow.map((tube, i) => (
                <Tube key={i} tube={tube} index={i} onClick={handleTubeClick} selected={selectedTube === i} />
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
                      onClick={handleTubeClick}
                      selected={selectedTube === realIdx}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="w-full mt-4">
            <button onClick={handleResetLevel} className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-full w-full text-center font-semibold transition">
              Reset Level
            </button>
          </div>
        </div>
        {solved && showSolvedModal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center">
              <h3 className="text-lg font-bold mb-4">Уровень пройден!</h3>
              <div className="flex flex-col space-y-3">
                <button className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700" onClick={handleContinue}>
                  Continue
                </button>
                <button className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition" onClick={() => navigate("/")}>Main</button>
              </div>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 w-full text-center">
          <button onClick={handleCopyText} className="text-xs text-gray-500 underline focus:outline-none">
            @SortWaterAI
          </button>
        </div>
      </div>
    </div>
  );
}

async function handleCopyText() {
  try {
    await navigator.clipboard.writeText("@SortWaterAI");
    alert("Текст '@SortWaterAI' скопирован в буфер обмена!");
  } catch (err) {
    console.error("Ошибка копирования текста:", err);
  }
}
