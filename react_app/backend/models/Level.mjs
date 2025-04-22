import { DataTypes } from "sequelize";
import sequelize from "../config/database.mjs";

const Level = sequelize.define(
  "Level",
  {
    // JSON-строка с состоянием колб
    level_data: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Формат уровня (имя модели без .pth)
    level_format: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Сложность, хранимая словом (easy / medium / hard …)
    difficulty: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Для будущего: сколько ходов сделал ИИ-solver
    ai_steps: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Ходы решения: массив пар [from, to]
    solution: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "Levels",
    // Отключаем автоматическое удаление столбцов при sync
    timestamps: true,
  }
);

export default Level;
