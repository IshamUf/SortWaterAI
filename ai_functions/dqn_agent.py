import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import copy

class MaskedDQNAgent(nn.Module):
    def __init__(self, state_dim, action_dim, net_arch=[256,256], lr=1e-4, device='cpu'):
        super().__init__()
        self.device = device
        # Q-сеть
        layers = []
        input_dim = state_dim
        for units in net_arch:
            layers.append(nn.Linear(input_dim, units))
            layers.append(nn.ReLU())
            input_dim = units
        layers.append(nn.Linear(input_dim, action_dim))
        self.q_net = nn.Sequential(*layers).to(device)

        # Target-сеть
        self.q_net_target = copy.deepcopy(self.q_net).to(device)
        for p in self.q_net_target.parameters():
            p.requires_grad = False

        self.epsilon = 1.0
        self.optimizer = optim.Adam(self.q_net.parameters(), lr=lr)
        self.to(device)

    def forward(self, x):
        return self.q_net(x)

    def predict_qvalues(self, obs: np.ndarray) -> np.ndarray:
        """
        Текущее Q(s,a) (numpy).
        """
        if isinstance(obs, np.ndarray):
            obs = torch.FloatTensor(obs).to(self.device)
        with torch.no_grad():
            qvals = self.q_net(obs).cpu().numpy()
        return qvals

    def predict_qvalues_target(self, obs_t: torch.Tensor) -> torch.Tensor:
        """
        Q(s,a) от target сети, возвращаем PyTorch-тензор (batch_size, action_dim).
        """
        # obs_t уже на нужном устройстве
        with torch.no_grad():
            qvals = self.q_net_target(obs_t)
        return qvals

    def sample_actions_masked(self, obs: np.ndarray, env) -> np.ndarray:
        """
        Epsilon-greedy + маскируем недопустимые действия при выборе действия.
        """
        qvals = self.predict_qvalues(obs)  # (batch_size, action_dim)
        batch_size, action_dim = qvals.shape
        actions = []
        for i in range(batch_size):
            valid_acts = env.get_valid_actions(obs[i])  # список индексов
            if len(valid_acts) == 0:
                valid_acts = list(range(action_dim))  # fallback
            masked_q = qvals[i].copy()
            invalid_acts = set(range(action_dim)) - set(valid_acts)
            for inv_a in invalid_acts:
                masked_q[inv_a] = -1e9
            if random.random() < self.epsilon:
                # случайный выбор среди valid_acts
                actions.append(random.choice(valid_acts))
            else:
                actions.append(np.argmax(masked_q))
        return np.array(actions)

    def update_target(self):
        self.q_net_target.load_state_dict(self.q_net.state_dict())