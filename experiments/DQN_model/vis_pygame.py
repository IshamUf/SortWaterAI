import pygame

def visualize_tubes(tubes_num, tube_cols, color_choices):
    """
    Функция для визуализации трубок с помощью Pygame.
    :param tubes_num: Количество трубок.
    :param tube_cols: Список списков с индексами цветов для каждой трубки.
    :param color_choices: Список доступных цветов.
    """
    # Инициализация Pygame
    pygame.init()
    # Параметры экрана
    WIDTH = 500
    HEIGHT = 550
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Tube Visualization")
    clock = pygame.time.Clock()

    # Локальная функция для рисования трубок
    def draw_tubes(tubes_num, tube_cols, color_choices):
        tube_boxes = []
        if tubes_num % 2 == 0:
            tubes_per_row = tubes_num // 2
            offset = False
        else:
            tubes_per_row = tubes_num // 2 + 1
            offset = True
        spacing = WIDTH / tubes_per_row
        for i in range(tubes_per_row):
            for j in range(len(tube_cols[i])):
                pygame.draw.rect(screen, color_choices[tube_cols[i][j]], [5 + spacing * i, 200 - (50 * j), 65, 50], 0,
                                 3)
            box = pygame.draw.rect(screen, 'blue', [5 + spacing * i, 50, 65, 200], 5, 5)
            tube_boxes.append(box)
        if offset:
            for i in range(tubes_per_row - 1):
                for j in range(len(tube_cols[i + tubes_per_row])):
                    pygame.draw.rect(screen, color_choices[tube_cols[i + tubes_per_row][j]],
                                     [(spacing * 0.5) + 5 + spacing * i, 450 - (50 * j), 65, 50], 0, 3)
                box = pygame.draw.rect(screen, 'blue', [(spacing * 0.5) + 5 + spacing * i, 300, 65, 200], 5, 5)
                tube_boxes.append(box)
        else:
            for i in range(tubes_per_row):
                for j in range(len(tube_cols[i + tubes_per_row])):
                    pygame.draw.rect(screen, color_choices[tube_cols[i + tubes_per_row][j]],
                                     [5 + spacing * i, 450 - (50 * j), 65, 50], 0, 3)
                box = pygame.draw.rect(screen, 'blue', [5 + spacing * i, 300, 65, 200], 5, 5)
                tube_boxes.append(box)
        return tube_boxes

    # Основной цикл визуализации
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        screen.fill('black')  # Очистка экрана
        draw_tubes(tubes_num, tube_cols)  # Вызов функции рисования

        pygame.display.flip()  # Обновление экрана
        clock.tick(60)  # Ограничение FPS

    pygame.quit()

# # Пример использования функции
# if __name__ == "__main__":
#     # Цвета
#     color_choices = ['red', 'orange', 'light blue', 'dark blue', 'dark green', 'pink', 'purple', 'dark gray',
#                      'brown', 'light green', 'yellow', 'white']
#
#     # Данные для визуализации
#     tubes_num = 5
#     tube_cols = [[2, 1, 1, 1], [0, 2, 2, 0], [1, 0, 2, 0], [1, 0, 2, 0], [1, 0, 2, 0]]
#
#     # Вызов функции визуализации
#     visualize_tubes(tubes_num, tube_cols, color_choices)

