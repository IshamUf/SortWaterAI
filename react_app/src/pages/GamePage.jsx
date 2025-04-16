import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/* ---------- утилиты ---------- */
const findTop = (tube) => tube.findIndex((c) => c !== -1);
const clone = (s) => s.map((t) => [...t]);

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
  const color = A[f];
  let cnt = 1;
  for (let i = f + 1; i < A.length && A[i] === color; i++) cnt++;
  let t = findTop(B);
  t = t === -1 ? B.length - 1 : t - 1;
  while (cnt > 0 && t >= 0 && B[t] === -1) {
    B[t] = color;
    A[f] = -1;
    f++;
    t--;
    cnt--;
  }
  return { newSource: A, newTarget: B };
}
function isSolved(state) {
  return state.every(
    (tube) =>
      tube.every((c) => c === -1) || tube.every((c) => c !== -1 && c === tube[0])
  );
}
/* -------------------------------- */

/* ---------- цветовая карта ---------- */
function getColorBlock(c, idx, tube) {
  const base =
    "w-full h-full mx-auto rounded-none transition-all duration-500 ease-in-out";
  const rounded =
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
  return `${base} ${map[c] || "bg-transparent"} ${rounded} opacity-90`;
}
/* ------------------------------------ */

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
            className={`flex-1 mx-[2px] ${
              cell === -1 ? "opacity-0" : getColorBlock(cell, i, tube)
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function GamePage() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [userId] = useState(navState?.userId || 1);

  const [levelId, setLevelId] = useState(null);
  const [state, setState] = useState(null);
  const [coins, setCoins] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  /* ---------- начальная загрузка ---------- */
  useEffect(() => {
    (async () => {
      const u = await api.get(`/users/${userId}`).catch(() => null);
      if (u) setCoins(u.data.coins);

      let p;
      try {
        p = (await api.get(`/progress?userId=${userId}`)).data;
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
      }

      if (!p) {
        const first = await api.get("/levels/1");
        await api.post("/progress/start", {
          userId,
          levelId: 1,
          state: first.data.level_data.state,
        });
        p = {
          levelId: 1,
          state: first.data.level_data.state,
          status: "in_progress",
        };
      }

      setLevelId(p.levelId);
      setState(p.state);
    })();
  }, [userId]);

  if (!state)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        Loading…
      </div>
    );

  const solved = isSolved(state);

  const clickTube = async (idx) => {
    if (solved) return;
    if (selected === null) {
      if (state[idx][state[idx].length - 1] !== -1) setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    if (!canPour(state[selected], state[idx])) {
      setSelected(null);
      return;
    }

    const { newSource, newTarget } = pour(state[selected], state[idx]);
    const optimistic = clone(state);
    optimistic[selected] = newSource;
    optimistic[idx] = newTarget;
    setState(optimistic);
    const from = selected;
    const to = idx;
    setSelected(null);

    try {
      const resp = await api.post("/progress/move", {
        userId,
        levelId,
        from,
        to,
      });
      setState(resp.data.state);
      if (resp.data.status === "completed") {
        setShowModal(true);
      }
    } catch (e) {
      console.error("move error:", e?.response?.data || e);
      setState(state);
    }
  };

  const resetLevel = async () => {
    const { data } = await api.get(`/levels/${levelId}`);
    await api.post("/progress/start", {
      userId,
      levelId,
      state: data.level_data.state,
    });
    setState(data.level_data.state);
    setSelected(null);
  };

  const topRow = state.slice(0, 4);
  const bottomRow = state.slice(4);

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-start bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6 overflow-hidden">
      <div className="w-full max-w-lg mx-auto text-white flex flex-col h-full">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 px-4">
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

        {/* FIELD */}
        <div className="flex flex-col flex-grow px-4 py-4 items-center">
          <div className="text-sm text-gray-400 mb-2">Level {levelId}</div>
          <h2 className="text-xl font-bold mb-4">
            {solved ? "Level Solved!" : "Keep playing..."}
          </h2>

          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="flex justify-center gap-4">
              {topRow.map((tube, i) => (
                <Tube
                  key={i}
                  tube={tube}
                  index={i}
                  onClick={clickTube}
                  selected={selected === i}
                />
              ))}
            </div>
            {bottomRow.length > 0 && (
              <div className="flex justify-center gap-4">
                {bottomRow.map((tube, i) => (
                  <Tube
                    key={i + 4}
                    tube={tube}
                    index={i + 4}
                    onClick={clickTube}
                    selected={selected === i + 4}
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

        {/* MODAL */}
        {showModal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center">
              <h3 className="text-lg font-bold mb-4">Уровень пройден!</h3>
              <div className="flex flex-col space-y-3">
                <button
                  className="bg-blue-600 px-4 py-2 rounded"
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
      </div>
    </div>
  );
}
