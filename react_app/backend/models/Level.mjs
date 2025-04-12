import { DataTypes } from 'sequelize';
import sequelize from '../config/database.mjs';

const Level = sequelize.define('Level', {
  // Для базы, где level_data хранится как текст с JSON-строкой
  level_data: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  difficulty: DataTypes.INTEGER,
}, {
  tableName: 'Levels',
});

export default Level;
