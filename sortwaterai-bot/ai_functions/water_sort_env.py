import numpy as np
import gymnasium as gym
from gymnasium import spaces
from collections import deque
# from scipy.stats import entropy

class WaterSortEnvFixed(gym.Env):
    """
    Окружение (environment) WaterSortEnvFixed для игры "Water Sort Puzzle"
    с ФИКСИРОВАННЫМ числом пробирок (N) и максимальным числом слоёв (K).

    Используемые обозначения:
      - N: число пробирок (tube)
      - K: макс. число слоёв (layers) в одной пробирке
      - num_colors: количество различных цветов

    Формат состояния (observation):
      - Матрица размера (N, K) (типа np.array, dtype=int),
      - Каждая строка соответствует одной пробирке.
      - Значение -1 означает "пустой слой",
        а неотрицательные числа (0..num_colors-1) — индекс цвета.

    Пример: state[2][0] = 3 означает,
      что в пробирке #2 верхний слой цвета 3 (если вы считаете индекс 0 верхом).

    Пространство действий (action_space):
      - MultiDiscrete([N, N]),
      - Действие (i, j) означает: "перелить жидкость из пробирки i в пробирку j".
      - При этом i может совпадать с j, но мы будем считать такое действие невалидным
        (можно штрафовать или игнорировать).

    Примечание: Для упрощения считаем,
      что все пробирки имеют одинаковый объём K, и мы не меняем N во время работы.

    Важно: логику корректного переливания (_can_pour, _pour)
    можно модифицировать под точные правила вашей версии Water Sort Puzzle.
    """

    def __init__(self, num_tubes=4, max_layers=4, num_colors=3, max_steps=300):
        """
        Конструктор окружения WaterSortEnvFixed.

        Параметры:
          num_tubes (int): Число пробирок, N.
          max_layers (int): Максимальное число слоёв в каждой пробирке, K.
          num_colors (int): Число возможных цветов (0..num_colors-1).

        Внутренние переменные:
          self.num_tubes (int): Сохраняем N.
          self.max_layers (int): Сохраняем K.
          self.num_colors (int): Количество цветов.
          self.action_space (gym.spaces.MultiDiscrete): Все пары (i, j),
            i,j из [0..N-1].
          self.observation_space (gym.spaces.Box):
            матрица (N, K), значения в диапазоне [-1, num_colors-1].
          self.state (np.array): Текущее состояние игры (размер N*K).
        """
        super().__init__()
        self.num_tubes = num_tubes     # Число пробирок (N)
        self.max_layers = max_layers   # Число слоёв (K)
        self.num_colors = num_colors   # Кол-во цветов
        self.max_steps = max_steps     # Максимальное число шагов одной игры

        # Пространство действий:
        # Каждое действие -- пара (from_tube, to_tube).
        # Допустимые значения: [0..N-1] для каждой координаты
        self.action_space = spaces.MultiDiscrete([self.num_tubes, self.num_tubes])

        # Пространство наблюдений:
        # Матрица (N, K) с целочисленными значениями от -1 до num_colors-1
        self.observation_space = spaces.Box(
            low=-1,
            high=self.num_colors - 1,
            shape=(self.num_tubes, self.max_layers),
            dtype=int
        )

        # Внутреннее состояние (инициализируется в reset)
        self.state = None

        self.steps = 0  # Счётчик шагов

        self.prev_action = 0, 0

        self.prev_state = None

        self.recent_states = deque(maxlen=10)

    def reset(self, seed=None, options=None, previous=False):
        """
        Сброс окружения (начало нового эпизода).
        Возвращает кортеж (observation, info).

        Шаги:
          1) Инициализируем генератор случайных чисел (super().reset(seed=seed)).
          2) Создаем self.state размером (N,K), заполненный -1 (пустыми).
          3) Случайно генерируем какую-то расстановку цветов
             (можно усложнить логику, чтобы гарантировать выполнимость).
          4) Возвращаем текущий observation и пустой словарь info.
        """
        super().reset(seed=seed)

        # Очистим недавние состояния при новом эпизоде
        self.recent_states.clear()

        max_tries = 100
        num_attempts = 0

        if previous and (self.prev_state is not None):
          self.state = self.prev_state
        else:
          while True:
            # Создаём пустую матрицу (N,K)
            self.state = np.full((self.num_tubes, self.max_layers), -1, dtype=int)

            # Заполняем только первые (num_tubes - 1) трубок.
            total_filled_tubes = self.num_colors
            total_slots = total_filled_tubes * self.max_layers


            # Проверяем, что общее число слотов корректно делится на число цветов.
            if total_slots % self.num_colors != 0:
                raise ValueError("Общее число слотов заполненных трубок должно делиться на число цветов.")

            count_per_color = total_slots // self.num_colors  # Количество экземпляров каждого цвета

            # Формируем массив фиксированного количества каждого цвета.
            colors = np.repeat(np.arange(self.num_colors), count_per_color)

            # Перемешиваем массив цветов с использованием генератора случайных чисел окружения.
            self.np_random.shuffle(colors)

            # Заполняем первые (num_tubes - 1) трубок перемешанными цветами.
            idx = 0
            for tube_idx in range(total_filled_tubes):
                for layer_idx in range(self.max_layers):
                    self.state[tube_idx, layer_idx] = colors[idx]
                    idx += 1

            if not self._is_solved():
              # Если НЕ решённая, прерываем цикл
              break

            num_attempts += 1

            if num_attempts >= max_tries:
              # Если слишком много раз попадаем на решённую конфигурацию —
              # прекращаем пытаться и оставляем как есть (пусть будет решённая).
              print("Warning: Could not generate unsolved puzzle. Using solved puzzle.")
              break

        self.steps = 0  # Сброс счетчика шагов для нового эпизода

        observation = self._get_obs()
        self.prev_state = observation
        info = {}
        return observation, info


    def _count_sorted_tubes(self):
        """
        Считает, сколько колб полностью заполнены и одноцветны,
        игнорируя полностью пустые (все -1).
        """
        count = 0
        for tube_idx in range(self.num_tubes):
            tube = self.state[tube_idx]
            # Если трубка содержит хотя бы один -1 => частично пустая => не считаем
            if np.any(tube == -1):
                continue
            # Если все элементы одного цвета:
            if len(set(tube)) == 1:
                count += 1
        return count


    def step(self, action): # Потом убрать проверки плохих ходов так как их быть не может
        """
        Шаг среды (environment step).
        Принимает действие (i, j) — перелить жидкость из пробирки i в j.
        Возвращает (observation, reward, terminated, truncated, info).

        Логика:
          1) Проверить валидность (i != j, i,j < N и т.д.).
          2) Если переливание возможно (_can_pour), то применяем _pour.
          3) Проверяем, решена ли игра (_is_solved).
             - если да, terminated = True и даём награду (reward=1.0).
          4) Иначе reward = 0 или небольшой штраф, если действие было невалидно.
        """
        from_tube, to_tube = action
        reward = -1
        info = {}
        # Проверка: i не должен совпадать с j, индексы должны быть в диапазоне
        if self.prev_action == action:
          reward -= 0.1
          info['Качество хода'] = f"Ход повторился from_tube = {from_tube}, to_tube = {to_tube}"
        else:
          if (from_tube < 0 or from_tube >= self.num_tubes or
              to_tube < 0 or to_tube >= self.num_tubes or
              from_tube == to_tube):
              reward -= 0.05
              info['Качество хода'] = f"Проблема с индексами from_tube = {from_tube}, to_tube = {to_tube}"
          else:
              # Проверяем, можно ли переливать
              if self._can_pour(from_tube, to_tube):
                  sorted_before = self._count_sorted_tubes()
                  self._pour(from_tube, to_tube)
                  sorted_after = self._count_sorted_tubes()
                  if sorted_after > sorted_before:
                    # reward += 0.5 * (sorted_after - sorted_before)
                    reward += 1
                    info['Качество хода'] = f"ход Из = {from_tube}, В = {to_tube}, плюс балл за сортировку"
                  else:
                    info['Качество хода'] = f"ход Из = {from_tube}, В = {to_tube}, обычный ход"
              else:
                  reward -= 0.05
                  info['Качество хода'] = f"Нельзя переливать from_tube = {from_tube}, to_tube = {to_tube}"

        # Нужно сохранять прошлый ход
        self.prev_action = action

        # Проверяем, решена ли игра

        # print(" Насильный рендер перед проверкой")
        # self.render()

        terminated = self._is_solved()
        # if terminated:
            # reward += 10


        # Увеличиваем счётчик шагов
        self.steps += 1

        observation = self._get_obs()
        # Проверяем, достигнут ли лимит шагов или не осталось доступных действий
        truncated = (self.steps >= self.max_steps) or (len(self.get_valid_actions(observation)) == 0)





        # штраф за повтор recent_states
        obs_tuple = tuple(observation.flatten())
        if obs_tuple in self.recent_states:
            reward -= 3.0
            info['repeated_state'] = True
        else:
            info['repeated_state'] = False

        self.recent_states.append(obs_tuple)

        return observation, reward, terminated, truncated, info


    def render(self):
        """
        Визуализация текущего состояния в виде таблицы:
        - Ось X: номера трубок.
        - Ось Y: номера слоёв.
        """
        for layer in range(self.max_layers):
            row = f"Layer {layer:>2}: " + " ".join(f"{self.state[tube, layer]:>3}" for tube in range(self.num_tubes))
            print(row)
        print()

    # =============================================================================
    # -------------------------- Вспомогательные методы ---------------------------
    # =============================================================================

    def _get_obs(self):
        """
        Возвращает копию текущего состояния (self.state) в формате np.array,
        чтобы не было побочных эффектов.
        """
        return np.array(self.state, copy=True)


    def _is_solved(self):
        for tube_idx in range(self.num_tubes):
            tube = self.state[tube_idx]

            # Если трубка вся пустая, ок
            if np.all(tube == -1):
                continue

            # Иначе проверим, что нет -1 и только один цвет
            if np.any(tube == -1):
                # Есть смесь пустых и заполненных -> не решено
                return False

            # Проверяем, что единственный цвет
            unique_colors = set(tube)  # без [tube != -1]
            if len(unique_colors) != 1:
                # более одного цвета -> не решено
                return False

        return True

    def _can_pour(self, from_tube, to_tube):
        """
        Проверяем, можно ли переливать жидкость из пробирки from_tube в to_tube
        по правилам Water Sort. Упрощённый вариант:
          1) from_tube не пустая (есть хотя бы один слой != -1).
          2) to_tube не переполнена (есть хотя бы один -1).
          3) Цвет верхнего слоя from_tube совпадает с цветом верхнего слоя to_tube
             (или to_tube пустая).
        """
        # Найдём индекс верхнего слоя from_tube
        from_top = self._find_top(from_tube)
        if from_top == -1:
            return False  # from_tube пустая

        # Аналогично для to_tube
        to_top = self._find_top(to_tube)

        # Если to_tube полностью заполнена -> нельзя
        if to_top == 0:
            return False

        from_color = self.state[from_tube, from_top]
        if to_top == -1:
            # Значит to_tube вообще пустая (все -1),
            # по упрощённым правилам: переливать можно
            return True
        else:
            to_color = self.state[to_tube, to_top]
            # Разрешаем переливать только если цвета совпадают
            return (from_color == to_color)

    def _pour(self, from_tube, to_tube):
        """
        Логика переливания жидкости (упрощённая):
          - Определяем, какой слой является верхним в from_tube.
          - Смотрим, сколько подряд слоёв такого же цвета над ним (вверх).
          - Переносим максимально возможное количество слоёв в to_tube,
            пока не кончится место или не сменится цвет.

        """
        from_idx = self._find_top(from_tube)
        # if from_idx == -1:
        #     return  # Нечего переливать, эта проверка есть в _can_pour, не знаю может ее удалить

        color = self.state[from_tube, from_idx]

        # Считаем, сколько подряд слоёв этого цвета "сверху"
        count = 1
        check_idx = from_idx + 1
        while check_idx < self.max_layers and self.state[from_tube, check_idx] == color:
            count += 1
            check_idx += 1

        # Найдём, куда "наливать" в to_tube:
        to_idx = self._find_top(to_tube)
        if to_idx == -1:
            # Пустая пробирка, начинаем заливать снизу вверх
            to_idx = self.max_layers - 1
        else:
            # Если to_idx уже занят, мы начинаем наливать "выше" — на to_idx+1
            to_idx -= 1

        # Переливаем послойно
        while count > 0 and to_idx >= 0:
            # Проверяем, что to_idx ещё пуст
            if self.state[to_tube, to_idx] == -1:
                # Переливаем цвет
                self.state[to_tube, to_idx] = color
                # Убираем из from
                self.state[from_tube, from_idx] = -1

                # Сдвигаемся дальше
                from_idx += 1
                to_idx -= 1
                count -= 1
            else:
                break  # to_tube заполнена или цвет не подходит

    def _find_top(self, tube_idx):
        """
        Находим "верхний слой" в пробирке tube_idx.
        Предположим, что индекс 0 - это самый верх, а индекс K-1 - самый низ.
        Возвращаем индекс слоя (int) или -1, если пробирка пустая.

        Логика: ищем первый индекс i с 0 до K-1,
        где self.state[tube_idx, i] != -1.
        Если не нашли, значит пусто -> -1.
        """
        tube = self.state[tube_idx]
        for i in range(self.max_layers):
            if tube[i] != -1:
                return i
        return -1


    def _can_pour_obs(self, obs_2d, from_tube, to_tube):
        from_top = self._find_top_obs(obs_2d, from_tube)
        if from_top == -1:
            return False
        to_top = self._find_top_obs(obs_2d, to_tube)
        if to_top == 0:
            return False
        from_color = obs_2d[from_tube, from_top]
        if to_top == -1:
            return True
        else:
            to_color = obs_2d[to_tube, to_top]
            return (from_color == to_color)


    def _find_top_obs(self, obs_2d, tube_idx):
        for i in range(self.max_layers):
            if obs_2d[tube_idx, i] != -1:
                return i
        return -1


    def get_valid_actions(self, flat_obs):
        obs_2d = flat_obs.reshape(self.num_tubes, self.max_layers)
        valid_acts = []
        N = self.num_tubes
        for a in range(N*N):
            from_tube = a // N
            to_tube   = a % N
            if from_tube != to_tube and self._can_pour_obs(obs_2d, from_tube, to_tube) and (from_tube, to_tube) != self.prev_action:
                valid_acts.append(a)
        return valid_acts


class DiscreteActionWrapper(gym.Wrapper):
    """
    Превращаем MultiDiscrete(N,N) -> Discrete(N*N).
    Разворачиваем наблюдение (N,K) в вектор (N*K).
    """
    def __init__(self, env):
        super().__init__(env)
        self.env = env
        N = env.num_tubes
        self.action_space = gym.spaces.Discrete(N * N)
        self.observation_space = gym.spaces.Box(
            low=-1,
            high=self.env.num_colors - 1,
            shape=(self.env.num_tubes * self.env.max_layers,),
            dtype=int
        )

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        return obs.flatten(), info

    def step(self, action):
        N = self.env.num_tubes
        from_tube = action // N
        to_tube = action % N
        obs, reward, done, truncated, info = self.env.step((from_tube, to_tube))
        return obs.flatten(), reward, done, truncated, info

    def get_valid_actions(self, flat_obs):
        """
        Проброс к базовому окружению (необёрнутому).
        """
        return self.env.get_valid_actions(flat_obs)
