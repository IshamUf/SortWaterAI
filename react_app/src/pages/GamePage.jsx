// src/pages/GamePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  wsGetSelf,
  wsGetProgress,
  wsStart,
  wsMove,
  wsSolveLevel,
} from "../sockets/socket";

/* ---------- утилиты ---------- */
const findTop   = (tube) => tube.findIndex((c) => c !== -1);
const deepClone = (s)    => s.map((t) => [...t]);
const canPour   = (src, dst) => {
  const f = findTop(src); if (f === -1) return false;
  const t = findTop(dst); if (t === 0)  return false;
  return t === -1 || src[f] === dst[t];
};
const pour      = (src, dst) => {
  const A = [...src], B = [...dst];
  let f = findTop(A), color = A[f], cnt = 1;
  for (let i = f+1; i < A.length && A[i]===color; i++) cnt++;
  let t = findTop(B); t = t===-1?B.length-1:t-1;
  while(cnt>0 && t>=0 && B[t]===-1){
    B[t]=color; A[f]=-1; f++; t--; cnt--;
  }
  return { newSource: A, newTarget: B };
};
const isSolved  = (state) =>
  state.every(tube =>
    tube.every(c => c===-1) ||
    tube.every(c => c!==-1 && c===tube[0])
  );

/* ---------- Tube UI ---------- */
const colorMap = [
  "bg-[#8CB4C9]", "bg-[#C9ADA7]", "bg-[#B5CDA3]", "bg-[#E0C097]",
  "bg-[#A9A9B3]", "bg-[#DAB6C4]", "bg-[#A1C6EA]", "bg-[#BFCBA8]"
];
const getColorBlock = (c, idx, tube) => {
  const base    = "w-full h-full mx-auto transition-all duration-500 ease-in-out";
  const rounded = (idx===tube.length-1||tube[idx+1]===-1)? "rounded-b-full":"";
  return `${base} ${colorMap[c]||"bg-transparent"} ${rounded} opacity-90`;
};
const Tube = ({ tube, index, onClick, selected }) => (
  <div
    onClick={()=>onClick(index)}
    className={`w-16 h-[160px] border-[4px] rounded-b-full rounded-t-xl flex flex-col justify-start items-stretch cursor-pointer ${
      selected?"border-blue-400":"border-[#3B3F45]"
    } bg-transparent overflow-hidden`}
  >
    <div className="flex flex-col justify-end pt-2 h-full">
      {tube.map((cell,i)=>(
        <div
          key={i}
          className={`flex-1 mx-[2px] ${
            cell===-1?"opacity-0":getColorBlock(cell,i,tube)
          }`}
        />
      ))}
    </div>
  </div>
);

export default function GamePage() {
  const navigate = useNavigate();

  const [levelId,      setLevelId]      = useState(null);
  const [state,        setState]        = useState(null);
  const [moves,        setMoves]        = useState(0);
  const [coins,        setCoins]        = useState(0);
  const [selected,     setSelected]     = useState(null);

  const [showModal,    setShowModal]    = useState(false);
  const [modalType,    setModalType]    = useState("success"); // "success" | "fail"
  const [closeEnabled, setCloseEnabled] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalReward,  setModalReward]  = useState(0);

  const [isSolving,  setIsSolving]       = useState(false);

  // initialization
  useEffect(() => {
    (async () => {
      const me   = await wsGetSelf(); setCoins(me.coins);
      let prog   = await wsGetProgress();
      if (prog.error) prog = await wsStart({ levelId: 1 });
      setLevelId(prog.levelId);
      setState(prog.state);
      setMoves(prog.moves);
    })();
  }, []);

  // success confetti
  useEffect(() => {
    if (showModal && modalType === "success") {
      confetti({ particleCount:100, spread:60, origin:{x:0.5,y:0.7} });
    }
  }, [showModal, modalType]);

  if (!state) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
      Loading…
    </div>
  );

  const solved    = isSolved(state);
  const topRow    = state.slice(0,4);
  const bottomRow = state.slice(4);

  // handle bot click
  const handleSolve = async () => {
    if (isSolving) return;
    setIsSolving(true);
    try {
      const resp = await wsSolveLevel({ levelId, state, user_moves: moves });
      setIsSolving(false);

      if (!resp.solvable) {
        // unsolvable
        setModalType("fail");
        setModalMessage("Sorry, I can’t solve this configuration.");
        setModalReward(0);
        setShowModal(true);
        setCloseEnabled(false);
        setTimeout(() => setCloseEnabled(true), 3000);

      } else {
        // здесь будем анимировать и потом показывать успех
        // для начала просто покажем модалку успеха
        setModalType("success");
        setModalMessage("Level completed!");
        setModalReward(resp.ai_steps); // или любое другое число
        setCoins(resp.coins);
        setShowModal(true);
      }
    } catch(err) {
      console.error(err);
      setIsSolving(false);
    }
  };

  // reset level
  const resetLevel = async () => {
    const resp = await wsStart({ levelId });
    setState(resp.state);
    setMoves(resp.moves);
    setSelected(null);
    setShowModal(false);
  };

  // tube click
  const clickTube = async (idx) => {
    if (solved) return;
    if (selected === null) {
      if (state[idx][state[idx].length-1] !== -1) setSelected(idx);
      return;
    }
    if (selected === idx) { setSelected(null); return; }
    if (!canPour(state[selected], state[idx])) { setSelected(null); return; }

    const { newSource, newTarget } = pour(state[selected], state[idx]);
    const optimistic = deepClone(state);
    optimistic[selected] = newSource;
    optimistic[idx]      = newTarget;
    setState(optimistic);

    const resp = await wsMove({ levelId, from:selected, to:idx });
    if (resp.error) {
      console.error(resp.error);
      return setState(state);
    }
    setState(resp.state);
    setMoves(resp.moves);
    setSelected(null);
    if (resp.status === "completed") {
      // сервер уже отправил reward/message при progress:move
      setModalType("success");
      setModalMessage(resp.message);
      setModalReward(resp.reward);
      setCoins(resp.coins);
      setShowModal(true);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-start bg-animated-photo px-4 py-6 overflow-hidden">
      <div className="w-full max-w-lg mx-auto text-white flex flex-col h-full">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={()=>navigate("/")} className="bg-gray-700 px-3 py-1.5 rounded-full text-sm">
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

          {/* bot + moves */}
          <div className="relative w-full mb-4 flex items-center justify-center">
            <div className="absolute left-0 flex flex-col items-center">
              <button
                onClick={handleSolve}
                disabled={isSolving}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                  isSolving
                    ? "bg-gray-600 opacity-60 cursor-not-allowed"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                🤖
              </button>
              <span className="text-xs text-gray-400 mt-1">100</span>
            </div>
            <h2 className="text-xl font-bold">Moves: {moves}</h2>
            <div className="absolute right-0 flex flex-col items-center">
              <button
                disabled
                className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl opacity-60 cursor-not-allowed"
              >
                ❓
              </button>
              <span className="text-xs text-gray-400 mt-1">10</span>
            </div>
          </div>

          {/* TUBES */}
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="flex justify-center gap-4">
              {topRow.map((tube,i)=>(
                <Tube key={i} tube={tube} index={i} onClick={clickTube} selected={selected===i}/>
              ))}
            </div>
            {bottomRow.length>0 && (
              <div className="flex justify-center gap-4">
                {bottomRow.map((tube,i)=>(
                  <Tube key={i+4} tube={tube} index={i+4} onClick={clickTube} selected={selected===i+4}/>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* MODAL для fail */}
        {showModal && modalType === "fail" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
            <div className="relative bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center">
              <button
                onClick={()=>closeEnabled && setShowModal(false)}
                disabled={!closeEnabled}
                className={`absolute top-2 left-2 text-white text-xl ${
                  !closeEnabled ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >×</button>
              <h3 className="text-lg font-bold mb-4">{modalMessage}</h3>
              <button
                onClick={resetLevel}
                className="mt-4 w-full bg-red-600 hover:bg-red-500 py-2 rounded-full font-semibold"
              >Reset Level</button>
            </div>
          </div>
        )}

        {/* MODAL для success (будем дорабатывать) */}
        {showModal && modalType === "success" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center">
              <h3 className="text-lg font-bold">{modalMessage}</h3>
              <div className="bg-gray-700 px-3 py-1.5 rounded-full inline-block text-white font-semibold">
                +{modalReward} 🪙
              </div>
              <div className="flex space-x-4 mt-4">
                <button
                  className="flex-1 bg-gray-700 py-3 rounded-xl text-xl font-bold"
                  onClick={()=>navigate("/")}
                >Main</button>
                <button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl text-xl font-bold"
                  onClick={resetLevel}
                >Continue</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

