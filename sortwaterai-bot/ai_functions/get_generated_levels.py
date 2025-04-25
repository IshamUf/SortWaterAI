#!/usr/bin/env python3
from pathlib import Path
import os
import random
from typing import List, Dict

import numpy as np
import torch

from ai_functions.water_sort_env import WaterSortEnvFixed, DiscreteActionWrapper
from ai_functions.dqn_agent       import MaskedDQNAgent

def get_generated_levels(model: str, count: int) -> List[Dict]:
    """
    Генерирует `count` новых, решённых и уникальных уровней по модели.

    Каждый словарь:
      {
        "state":     List[List[int]],   # начальное N×L,
        "ai_steps":  int,               # сколько шагов до победы,
        "solution":  List[List[int]],   # список ходов [[from,to],…]
      }
    """
    try:
        N, K, L = map(int, model.split("_")) # N-Число пробирок, K-сколько пустых, L - Число слоёв
    except ValueError:
        raise RuntimeError(f"Некорректное имя модели: {model}")

    max_steps  = int(os.getenv("MAX_STEPS_PER_GAME", 100))
    device     = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model_path = Path(__file__).parent / "ai_models" / f"{model}.pth"
    if not model_path.exists():
        raise RuntimeError(f"Модель не найдена: {model_path}")

    num_colors = N - K
    base_env = WaterSortEnvFixed(
        num_tubes = N,
        max_layers= L,
        num_empty=K,
        num_colors= num_colors,
        max_steps = max_steps
    )
    env = DiscreteActionWrapper(base_env)

    obs_dim = env.observation_space.shape[0]
    act_dim = env.action_space.n
    net_arch = [(N*(N-1))*25, (N*(N-1))*10]

    agent = MaskedDQNAgent(
        state_dim = obs_dim,
        action_dim= act_dim,
        net_arch = net_arch,
        device   = device
    )
    agent.load_state_dict(torch.load(model_path, map_location=device))
    agent.eval()
    agent.epsilon = 0

    results = []
    seen = set()
    attempts = 0
    MAX_ATTEMPTS = int(os.getenv("MAX_GENERATE_ATTEMPTS", 5))

    while len(results) < count and attempts < MAX_ATTEMPTS:
        attempts += 1
        batch = max(count*2, 10)
        for _ in range(batch):
            obs, _ = env.reset()
            initial = obs.copy().reshape(N, L).tolist()

            done=False; steps=0; actions=[]
            while not done and steps < max_steps:
                act = agent.sample_actions_masked(obs[None], env)[0]
                actions.append([act//N, act%N])
                obs, _, done, truncated, _ = env.step(act)
                steps+=1
                if truncated: break

            if not done: continue

            key = tuple(sum(initial, []))
            if key in seen: continue
            seen.add(key)

            results.append({
                "state":    initial,
                "ai_steps": steps,
                "solution": actions
            })
            if len(results)>=count: break

    if len(results)<count:
        raise RuntimeError(f"Собрано {len(results)}/{count} уровней после {attempts} попыток")

    return results
