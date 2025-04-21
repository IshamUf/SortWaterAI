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
    // Сложность теперь ХРАНИМ СЛОВОМ (easy / medium / hard …)
    difficulty: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Для будущего: сколько ходов делает ИИ-solver
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

