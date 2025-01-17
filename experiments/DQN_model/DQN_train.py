from game_interface import WaterSortGameEnv
from DQN import DQNAgent
import numpy as np


env = WaterSortGameEnv(6)
state_size = env.tubes * 4  # Размер состояния (например, 6 труб * 4 слоя = 24)
action_size = env.tubes * env.tubes  # Количество действий (6 труб * 6 труб = 36)
agent = DQNAgent(state_size, action_size)
episodes = 1000

# Основной цикл обучения
for e in range(episodes):
    state = env.reset()
    done = False
    total_reward = 0
    step = 0

    while not done and step < 500:
        action = agent.act(state)
        from_tube = action // env.tubes
        to_tube = action % env.tubes

        # Проверяем валидность действия
        if (
                from_tube == to_tube or
                len(env.tube_colors[from_tube]) == 0 or
                len(env.tube_colors[to_tube]) >= 4 or
                (len(env.tube_colors[to_tube]) > 0 and env.tube_colors[from_tube][-1] != env.tube_colors[to_tube][-1])
        ):
            reward = -10  # Наказываем за плохое действие
            next_state = state
            done = False
            # print("Действие плохое.", reward)
        else:
            # print(f"Эпизод {e + 1}, Шаг {step + 1}: Действие агента - перелить из трубы {from_tube} в трубу {to_tube}")
            next_state = env.perform_action(from_tube, to_tube)
            # print(f"{state}")
            # print(f"{next_state}")
            reward = env.get_reward()
            done = env.check_victory()
            # print("Действие выполнено.", reward)
            # env.render()

        agent.remember(state, action, reward, next_state, done)
        state = next_state
        total_reward += reward
        step += 1

        if done:
            print(f"Эпизод {e+1}/{episodes}, Шагов: {step}, Общая награда: {total_reward}, Epsilon: {agent.epsilon:.2f}")
            env.render()
            break

    agent.replay()  # Обучение модели
    agent.update_target_model()  # Периодическое обновление целевой сети

    # Сохранение модели каждые 50 эпизодов
    # if (e + 1) % 50 == 0:
    #     agent.save(f"water_sort_dqn_{e+1}.pth")
