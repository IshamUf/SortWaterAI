// backend/models/Progress.mjs
import { DataTypes } from "sequelize";
import sequelize     from "../config/database.mjs";
import User          from "./User.mjs";
import Level         from "./Level.mjs";

const Progress = sequelize.define(
  "Progress",
  {
    status:  { type: DataTypes.STRING,  defaultValue: "in_progress" },
    state:   { type: DataTypes.JSON,    allowNull: false },
    moves:   { type: DataTypes.INTEGER, defaultValue: 0 },   // ← новое поле
  },
  {
    tableName: "Progress",
    indexes: [{ unique: true, fields: ["userId", "levelId"] }],
  }
);

Progress.belongsTo(User,  { foreignKey: "userId"  });
Progress.belongsTo(Level, { foreignKey: "levelId" });
User.hasMany(    Progress, { foreignKey: "userId"  });
Level.hasMany(   Progress, { foreignKey: "levelId" });

export default Progress;
