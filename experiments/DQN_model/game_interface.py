import random
import copy
import numpy as np
from vis_pygame import visualize_tubes

class WaterSortGameEnv:
    def __init__(self, tubes_number):
        self.color_choices = ['red', 'orange', 'light blue', 'dark blue', 'dark green', 'pink', 'purple', 'dark gray',
                             'brown', 'light green', 'yellow', 'white']
        self.tubes = []
        self.tube_colors = []
        self.initial_colors = []
        # self.selected = False
        self.select_rect = 100
        self.win = False
        self.generate_start(tubes_number)

    def generate_start(self, tubes_number):
        """Инициализация игры: создание случайных цветов для труб."""
        tubes_colors = []
        available_colors = []
        for i in range(tubes_number):
            tubes_colors.append([])
            if i < tubes_number - 2:
                for j in range(4):
                    available_colors.append(i)  # получаем i = 2: available_colors = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]
        for i in range(tubes_number - 2):  # два последних не заполняем
            for j in range(4):
                color = random.choice(available_colors)
                tubes_colors[i].append(color)  # рандомно заполняем массивы
                available_colors.remove(color)
        self.tubes = tubes_number
        self.tube_colors = tubes_colors
        self.initial_colors = copy.deepcopy(tubes_colors)

    def reset(self):
        """Сброс игры, возвращаем начальное состояние."""
        self.tube_colors = copy.deepcopy(self.initial_colors)
        # self.selected = False
        self.select_rect = 100
        self.win = False
        return self.get_state()

    def get_state(self):
        """Возвращаем текущее состояние игры, состоящее из цветов в трубах."""
        # return self.tube_colors
        state = []
        for tube in self.tube_colors:
            tube_state = tube.copy()
            # Заполняем трубу значением -1, чтобы ее длина была ровно 4
            while len(tube_state) < 4:
                tube_state.append(-1)
            state.extend(tube_state)
        return np.array(state)

    def perform_action(self, from_tube, to_tube):
        """Выполнение действия: перемещение жидкости между трубами."""
        if from_tube != to_tube:
            self.calc_move(from_tube, to_tube)
        return self.get_state()

    def calc_move(self, selected_rect, destination):
        """Перемещаем жидкость между трубами, если это возможно."""
        chain = True
        color_on_top = 100
        length = 1
        color_to_move = 100
        if len(self.tube_colors[selected_rect]) > 0:
            color_to_move = self.tube_colors[selected_rect][-1]
            for i in range(1, len(self.tube_colors[selected_rect])):
                if chain:
                    if self.tube_colors[selected_rect][-1 - i] == color_to_move:
                        length += 1
                    else:
                        chain = False
        if 4 > len(self.tube_colors[destination]):
            if len(self.tube_colors[destination]) == 0:
                color_on_top = color_to_move
            else:
                color_on_top = self.tube_colors[destination][-1]
        if color_on_top == color_to_move:
            for i in range(length):
                if len(self.tube_colors[destination]) < 4:
                    if len(self.tube_colors[selected_rect]) > 0:
                        self.tube_colors[destination].append(color_on_top)
                        self.tube_colors[selected_rect].pop(-1)
        # return self.tube_colors

    def get_reward(self):
        """Баллы"""
        if self.check_victory():
            return 10  # вознаграждение
        return 0.1  # минус за каждый дополнительный шаг

    def check_victory(self):
        """Проверяем, не выиграл ли агент."""
        won = True
        for tube in self.tube_colors:
            if len(tube) > 0:
                if len(tube) != 4:
                    won = False
                else:
                    if len(set(tube)) != 1:
                        won = False
        return won

    def render(self):
        """Визуал"""
        print(self.tube_colors)
        # visualize_tubes(len(self.tube_colors), self.tube_colors, self.color_choices)
        # pass



# # Инициализируем игру
# env = WaterSortGameEnv(4)
#
# # Основной игровой цикл
# game_over = False
# while not game_over:
#     # Отображаем текущее состояние игры
#     env.render()
#     # Проверяем, выиграна ли игра
#     if env.check_victory():
#         print("\nПоздравляем! Вы решили головоломку!")
#         game_over = True
#         break
#
#     # Запрашиваем у пользователя действие
#     try:
#         from_tube = int(input("\nВыберите номер трубы, из которой переливать (или -1 для выхода): "))
#         if from_tube == -1:
#             print("Игра завершена пользователем.")
#             break
#         to_tube = int(input("Выберите номер трубы, в которую переливать: "))
#         if from_tube < 0 or from_tube >= env.tubes or to_tube < 0 or to_tube >= env.tubes:
#             print("Неверные номера труб. Пожалуйста, введите корректные номера труб.")
#             continue
#         env.perform_action(from_tube, to_tube)
#     except ValueError:
#         print("Пожалуйста, введите целые числа.")
#         continue
#
#     # Выполняем действие
#     env.perform_action(from_tube, to_tube)

#     [[], [3, 3, 3, 3], [2, 2, 2, 2], [], [0, 0, 0, 0], [1, 1, 1, 1]]
