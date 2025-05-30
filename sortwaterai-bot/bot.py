#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import logging
import asyncio
import subprocess
import psycopg2
import json
from pathlib import Path
from aiogram import Bot, Dispatcher, executor, types
from dotenv import load_dotenv
import httpx

# ─── Конфиг ────────────────────────────────────────────────────────────────
load_dotenv()
TOKEN     = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_ID  = int(os.getenv("ADMIN_ID", "0"))
AI_FUNC_URL   = os.getenv("AI_FUNC_URL", "http://ai_func:8001")

if not TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN не задан в .env")
if not ADMIN_ID:
    raise RuntimeError("ADMIN_ID не задан в .env")

# Папка с ботом внутри контейнера (/app)
BASE_DIR      = Path(__file__).resolve().parent
# Папка с AI‑функциями (монтируется из корня проекта)
AI_FUNC_DIR   = BASE_DIR / "ai_functions"
AI_MODELS_DIR = AI_FUNC_DIR / "ai_models"

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN)
dp  = Dispatcher(bot)

# ─── Хелперы ───────────────────────────────────────────────────────────────
def get_db_config():
    return {
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", 5432)),
    }

# ─── Команды бота ─────────────────────────────────────────────────────────
@dp.message_handler(commands=["start"])
async def cmd_start(msg: types.Message):
    await msg.reply(
        "Добро пожаловать! Нажмите PLAY внутри Web‑App.\n"
        "Команда /delete – удалить свой аккаунт.\n"
        "Админ‑команда /add_levels <n> – кол-во уровней."
    )

@dp.message_handler(commands=["help"])
async def cmd_help(msg: types.Message):
    await msg.reply("Служба поддержки: напишите @YourSupport.")

@dp.message_handler(commands=["delete"])
async def cmd_delete(msg: types.Message):
    tel_id = str(msg.from_user.id)
    db_cfg = get_db_config()
    try:
        with psycopg2.connect(**db_cfg) as conn, conn.cursor() as cur:
            cur.execute('SELECT id FROM "Users" WHERE telegram_id=%s', (tel_id,))
            row = cur.fetchone()
            if not row:
                return await msg.reply("Аккаунт не найден.")
            user_id = row[0]
            cur.execute('DELETE FROM "Progress" WHERE "userId"=%s', (user_id,))
            cur.execute('DELETE FROM "Users"    WHERE id=%s',      (user_id,))
            await msg.reply("Ваши данные удалены.")
    except Exception:
        logging.exception("delete error")
        await msg.reply("Произошла ошибка, попробуйте позже.")

@dp.message_handler(commands=["add_levels"])
async def cmd_add_levels(msg: types.Message):
    # доступ только админу
    if msg.from_user.id != ADMIN_ID:
        return await msg.reply("⛔ Команда доступна только администратору.")

    args = msg.get_args().split()
    if len(args) != 2:
        # список доступных моделей
        models = [p.stem for p in (*AI_MODELS_DIR.glob("*.pt"), *AI_MODELS_DIR.glob("*.pth"))]
        pretty = ", ".join(models) or "—папка пуста—"
        return await msg.reply(
            "Формат: /add_levels <model_name> <count>\n"
            f"Доступные модели: {pretty}"
        )

    model_name, count_str = args
    if not count_str.isdigit():
        return await msg.reply("Вторым аргументом должно быть число уровней.")

    count = int(count_str)
    await msg.reply(f"⏳ Генерирую {count} уровней…", parse_mode="Markdown")

    # делаем POST к FastAPI
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{AI_FUNC_URL}/add_levels",
                json={"model_name": model_name, "count": count},
                timeout=60.0
            )
        except httpx.RequestError as e:
            return await msg.reply(f"🚫 Ошибка связи с AI‑сервисом: {e}")

    if resp.status_code == 200:
        data = resp.json()
        return await msg.reply(
            f"✅ Уровни добавлены:\n"
            f"- модель: `{data['model_name']}`\n"
            f"- запрос на создание: {data['requested_count']}",
            parse_mode="Markdown"
        )
    else:
        # если FastAPI вернул ошибку
        detail = resp.json().get("detail", resp.text)
        return await msg.reply(f"🚫 AI‑сервис ответил ошибкой {resp.status_code}:\n```\n{detail}\n```", parse_mode="Markdown")

# ─── Старт ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    executor.start_polling(dp, skip_updates=True)
