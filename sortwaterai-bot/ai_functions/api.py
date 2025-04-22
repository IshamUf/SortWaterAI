# sortwaterai-bot/ai_functions/api.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from ai_functions.solver import solve_level
from ai_functions.add_ai_level import run_ingest


app = FastAPI(
    title="SortWaterAI AI Functions",
    version="1.0",
    description="API для запуска генерации новых уровней и решения уровней через DQN‑агента"
)

class AddLevelsRequest(BaseModel):
    model_name: str
    count: int

class SolveRequest(BaseModel):
    level_id: int
    state: List[List[int]]
    user_moves: int

@app.post("/add_levels", response_model=Dict[str, Any])
def add_levels(req: AddLevelsRequest):
    """
    Запуск скрипта добавления новых уровней из указанной модели.
    """
    try:
        run_ingest(req.model_name, req.count)
        return {
            "status": "success",
            "model_name": req.model_name,
            "requested_count": req.count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/solve_level", response_model=Dict[str, Any])
def solve_level_endpoint(req: SolveRequest):
    """
    Решение уровня: возвращает {"solvable": bool, "ai_steps": int, "solution": List[List[int]]}
    """
    try:
        result = solve_level(req.level_id, req.state, req.user_moves)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
