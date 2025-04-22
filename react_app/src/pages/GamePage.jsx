// src/pages/GamePage.jsx
// src/pages/GamePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  wsGetSelf,
  wsGetProgress,
  wsStart,
  wsMove,
} from "../sockets/socket";

/* ---------- утилиты ---------- */
const findTop = (tube) => tube.findIndex((c) => c !== -1);
const deepClone = (s) => s.map((t) => [...t]);

const canPour = (src, dst) => {
  const f = findTop(src);
  if (f === -1) return false;
  const t = findTop(dst);
  if (t === 0) return false;
  return t === -1 || src[f] === dst[t];
};
const pour = (src, dst) => {
  const A = [...src], B = [...dst];
  let f = findTop(A), color = A[f], cnt = 1;
  for (let i = f + 1; i < A.length && A[i] === color; i++) cnt++;
  let t = findTop(B);
  t = t === -1 ? B.length - 1 : t - 1;
  while (cnt && t >= 0 && B[t] === -1) {
    B[t] = color;
    A[f] = -1;
    f++;
    t--;
    cnt--;
  }
  return { newSource: A, newTarget: B };
};
const isSolved = (state) =>
  state.every(
    (tube) =>
      tube.every((c) => c === -1) ||
      tube.every((c) => c !== -1 && c === tube[0])
  );
/* --------------------------- */

/* Tube UI */
const colorMap = [
  "bg-[#8CB4C9]","bg-[#C9ADA7]","bg-[#B5CDA3]","bg-[#E0C097]",
  "bg-[#A9A9B3]","bg-[#DAB6C4]","bg-[#A1C6EA]","bg-[#BFCBA8]"
];
const getColorBlock = (c, idx, tube) => {
  const base = "w-full h-full mx-auto transition-all duration-500 ease-in-out";
  const rounded = idx === tube.length - 1 || tube[idx + 1] === -1 ? "rounded-b-full" : "";
  return `${base} ${colorMap[c] || "bg-transparent"} ${rounded} opacity-90`;
};
const Tube = ({ tube, index, onClick, selected }) => (
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
/* --------------------------- */

export default function GamePage() {
  const navigate = useNavigate();
  const [levelId, setLevelId] = useState(null);
  const [state, setState] = useState(null);
  const [moves, setMoves] = useState(0);
  const [coins, setCoins] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await wsGetSelf();
      setCoins(me.coins);
      let prog = await wsGetProgress();
      if (prog.error) prog = await wsStart({ levelId: 1 });
      setLevelId(prog.levelId);
      setState(prog.state);
      setMoves(prog.moves);
    })();
  }, []);

  if (!state)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        Loading…
      </div>
    );

  const solved = isSolved(state);
  const topRow = state.slice(0, 4);
  const bottomRow = state.slice(4);

  const clickTube = async (idx) => {
    if (solved) return;
    if (selected === null) {
      if (state[idx][state[idx].length - 1] !== -1) setSelected(idx);
      return;
    }
    if (selected === idx) return setSelected(null);
    if (!canPour(state[selected], state[idx])) return setSelected(null);

    const { newSource, newTarget } = pour(state[selected], state[idx]);
    const optimistic = deepClone(state);
    optimistic[selected] = newSource;
    optimistic[idx] = newTarget;
    setState(optimistic);
    const from = selected;
    const to = idx;
    setSelected(null);

    const resp = await wsMove({ levelId, from, to });
    if (resp.error) {
      console.error(resp.error);
      return setState(state);
    }
    setState(resp.state);
    setMoves(resp.moves);
    if (resp.status === "completed") setShowModal(true);
  };

  const resetLevel = async () => {
    const resp = await wsStart({ levelId });
    setState(resp.state);
    setMoves(resp.moves);
    setSelected(null);
  };

  const continueGame = async () => {
    setShowModal(false);
    const prog = await wsGetProgress();
    if (prog.error) return navigate("/");
    setLevelId(prog.levelId);
    setState(prog.state);
    setMoves(prog.moves);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-start bg-animated-photo px-4 py-6 overflow-hidden">
      <div className="w-full max-w-lg mx-auto text-white flex flex-col h-full">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
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
        <div className="flex flex-col flex-grow items-center">
          <div className="text-sm text-gray-400 mb-1">Level {levelId}</div>

          {/* Moves + side buttons */}
          <div className="relative w-full mb-4 h-14">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center">
              <button className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                🤖
              </button>
              <span className="text-xs mt-1 text-white">100</span>
            </div>
            <h2 className="text-xl font-bold text-center">Moves: {moves}</h2>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center">
              <button className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                ❓
              </button>
              <span className="text-xs mt-1 text-white">10</span>
            </div>
          </div>

          {/* Tubes */}
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
            className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl text-xl font-bold shadow-md hover:scale-105 transition"
          >
            Reset Level
          </button>
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center space-y-4">
              <h3 className="text-lg font-bold">Level completed!</h3>
              <div className="inline-flex items-center bg-gray-700 px-3 py-1.5 rounded-full mx-auto">
                <span className="font-semibold text-white">+10</span>
                <span className="text-gray-300 ml-1">🪙</span>
              </div>
              <div className="flex justify-between mt-4">
                <button
                  className="bg-gray-700 px-4 py-2 rounded-xl text-xl font-bold shadow-md"
                  onClick={() => navigate("/")}
                >
                  Main
                </button>
                <button
                  className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-2 rounded-xl text-xl font-bold shadow-md hover:scale-105 transition"
                  onClick={continueGame}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
