import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque
import random


class DQNAgent:
    def __init__(self, state_size, action_size):
        self.state_size = state_size  # Размер вектора состояния
        self.action_size = action_size  # Количество возможных действий
        self.memory = deque(maxlen=2000)  # Буфер воспроизведения
        self.gamma = 0.99  # Коэффициент дисконтирования
        self.epsilon = 1.0  # Начальное значение ε
        self.epsilon_min = 0.01  # Минимальное значение ε
        self.epsilon_decay = 0.995  # Скорость уменьшения ε
        self.learning_rate = 0.001  # Скорость обучения
        self.batch_size = 64  # Размер мини-пакета
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Определение основной и целевой нейронных сетей
        self.model = self._build_model().to(self.device)
        self.target_model = self._build_model().to(self.device)
        self.update_target_model()  # Инициализация целевой сети
        self.criterion = nn.MSELoss()
        self.optimizer = optim.Adam(self.model.parameters(), lr=self.learning_rate)

    def _build_model(self):
        # Простая нейронная сеть с двумя скрытыми слоями
        return nn.Sequential(
            nn.Linear(self.state_size, 128),
            nn.ReLU(),
            nn.Linear(128, 128),
            nn.ReLU(),
            nn.Linear(128, self.action_size)
        )

    def update_target_model(self):
        # Обновление весов целевой сети
        self.target_model.load_state_dict(self.model.state_dict())

    def remember(self, state, action, reward, next_state, done):
        # Сохранение опыта в буфер
        self.memory.append((state, action, reward, next_state, done))

    def act(self, state):
        # Выбор действия на основе ε-жадной стратегии
        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)
        state = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        act_values = self.model(state)
        return torch.argmax(act_values[0]).item()

    def replay(self):
        # Обучение модели на мини-пакете из буфера воспроизведения
        if len(self.memory) < self.batch_size:
            return
        minibatch = random.sample(self.memory, self.batch_size)

        states = np.vstack([e[0] for e in minibatch])
        actions = np.array([e[1] for e in minibatch])
        rewards = np.array([e[2] for e in minibatch])
        next_states = np.vstack([e[3] for e in minibatch])
        dones = np.array([e[4] for e in minibatch])
        states = torch.FloatTensor(states).to(self.device)
        actions = torch.LongTensor(actions).unsqueeze(1).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(next_states).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)

        # Вычисление целевых Q-значений
        q_values = self.model(states).gather(1, actions)
        next_q_values = self.target_model(next_states).max(1)[0].detach()
        target_q_values = rewards + (self.gamma * next_q_values * (1 - dones))

        # Обновление модели
        loss = self.criterion(q_values.squeeze(), target_q_values)
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        # Обновление ε
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

    def save(self, name):
        torch.save(self.model.state_dict(), name)