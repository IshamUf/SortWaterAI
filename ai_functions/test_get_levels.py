#!/usr/bin/env python3
# test_get_levels.py

import os
from dotenv import load_dotenv
load_dotenv()

from get_generated_levels import get_generated_levels

def main():
    try:
        model = "5_2_4"
        count = 5
        levels = get_generated_levels(model, count)
        assert len(levels) == count, f"Ожидали {count}, получили {len(levels)}"
        print(f"✅ Получено {count} уровней модели {model}")
        print(levels)
        for lvl in levels:
            assert "state" in lvl and "ai_steps" in lvl and "solution" in lvl
        print("✅ Формат корректен.")
    except Exception as e:
        print("❌ Ошибка при генерации:", e)

if __name__ == "__main__":
    main()
