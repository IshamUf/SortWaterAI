// backend/models/Level.mjs
import { DataTypes } from "sequelize";
import sequelize      from "../config/database.mjs";

const Level = sequelize.define(
  "Level",
  {
    /* JSON‑строка с состоянием колб  */
    level_data: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    /* Сложность теперь ХРАНИМ СЛОВОМ (easy / medium / hard …) */
    difficulty: {
      type: DataTypes.STRING,   // ← было INTEGER
      allowNull: true,
    },

    /* Для будущего: сколько ходов делает ИИ‑solver */
    ai_steps: {
      type: DataTypes.INTEGER,
      allowNull: true,          // пока не используем
    },
  },
  {
    tableName: "Levels",
  }
);

export default Level;
