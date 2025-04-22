#!/usr/bin/env python3
# sortwaterai-bot/ai_functions/solver.py

# N-Число пробирок, K-сколько пустых, L - Число слоёв

#!/usr/bin/env python3
import os
import json
import psycopg2
from pathlib import Path
from typing import List, Dict, Optional
import numpy as np

import torch
from ai_functions.water_sort_env import WaterSortEnvFixed, DiscreteActionWrapper
from ai_functions.dqn_agent       import MaskedDQNAgent

# Настройки подключения к БД из env
DB_CFG = {
    "dbname":   os.getenv("POSTGRES_DB"),
    "user":     os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "host":     os.getenv("POSTGRES_HOST", "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", 5432)),
}

def create_env(
    num_tubes: int,
    max_layers: int,
    num_colors: int,
    max_steps: int = 100
) -> DiscreteActionWrapper:
    """
    Создаёт и настраивает окружение по начальному состоянию.
    """
    base_env = WaterSortEnvFixed(
        num_tubes  = num_tubes,
        max_layers = max_layers,
        num_colors = num_colors,
        max_steps  = max_steps
    )

    env = DiscreteActionWrapper(base_env)
    return env

def load_agent(
    model_name: str,
    env: DiscreteActionWrapper,
    N: int
) -> MaskedDQNAgent:
    """
    Загружает DQN‑агента, используя env для определения размеров входа/выхода.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model_path = Path(__file__).parent / "ai_models" / f"{model_name}.pth"
    if not model_path.exists():
        raise RuntimeError(f"Модель не найдена: {model_path}")

    obs_dim = env.observation_space.shape[0]
    act_dim = env.action_space.n
    net_arch = [(N*(N-1))*25, (N*(N-1))*10]

    agent = MaskedDQNAgent(
        state_dim=obs_dim,
        action_dim=act_dim,
        net_arch=net_arch,
        device=device
    )
    agent.load_state_dict(torch.load(model_path, map_location=device))
    agent.eval()
    return agent

def solve_with_agent(
    agent: MaskedDQNAgent,
    env: DiscreteActionWrapper,
    state: List[List[int]],
    N: int,
    max_steps: int = 100
) -> Optional[List[List[int]]]:
    """
    Подсовывает в env уже готовое состояние и запускает агент.
    """
    # Разворачиваем raw env и вручную ставим state
    raw: WaterSortEnvFixed = env.env
    raw.state = np.array(state, dtype=int)
    raw.prev_state = raw._get_obs()  # чтобы wrapper.prev_state тоже был валиден
    raw.steps = 0
    raw.recent_states.clear()

    # Получаем первое наблюдение
    obs = raw._get_obs().flatten()
    done = False
    steps = 0
    actions: List[List[int]] = []
    while not done and steps < max_steps:
        act = agent.sample_actions_masked(obs[None], env)[0]
        actions.append([int(act // N), int(act % N)])
        obs, _, done, truncated, _ = env.step(act)
        steps += 1
        if truncated:
            break

    return actions if done else None

def solve_level(
    level_id: int,
    state: List[List[int]],
    user_moves: int
) -> Dict:
    """
    Решает уровень по двум сценариям:
      - user_moves == 0: возвращаем готовый solution из БД.
      - user_moves > 0: решаем уровнь через агента, используя create_env и load_agent.
    """
    conn = psycopg2.connect(**DB_CFG)
    cur  = conn.cursor()

    # Сценарий 1: возвращаем solution из БД, если пользователь не ходил
    if user_moves == 0:
        cur.execute('SELECT solution FROM "Levels" WHERE id = %s', (level_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if row and row[0]:
            sol = row[0]
            return {"solvable": True, "ai_steps": len(sol), "solution": sol}
        else:
            return {"solvable": False, "ai_steps": 0, "solution": []}

    # Сценарий 2: загружаем модель из level_format
    cur.execute('SELECT level_format FROM "Levels" WHERE id = %s', (level_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row or not row[0]:
        return {"solvable": False, "ai_steps": 0, "solution": []}
    model_name = row[0]

    try:
        N, K, L = map(int, model_name.split("_")) # N-Число пробирок, K-сколько пустых, L - Число слоёв
    except Exception:
        return {"solvable": False, "ai_steps": 0, "solution": []}

    # Создаём окружение и агента
    env = create_env(num_tubes=N, num_colors=N-K, max_layers=L)
    try:
        agent = load_agent(model_name, env, N)
        sol = solve_with_agent(agent, env, state, N)
        if sol is None:
            return {"solvable": False, "ai_steps": 0, "solution": []}
        return {"solvable": True, "ai_steps": len(sol), "solution": sol}
    except Exception as e:
        print(f"[solver] Error solving level {level_id}: {e}")
        return {"solvable": False, "ai_steps": 0, "solution": []}

# # CLI для отладки
# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser()
#     parser.add_argument("level_id",   type=int)
#     parser.add_argument("state",      type=str, help="JSON array of arrays")
#     parser.add_argument("user_moves", type=int)
#     args = parser.parse_args()
#
#     state = json.loads(args.state)
#     result = solve_level(args.level_id, state, args.user_moves)
#     print(json.dumps(result, ensure_ascii=False))