import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Sipoc = sequelize.define(
  "Sipoc",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    processId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: "processes", key: "id" },
    },
  },
  {
    tableName: "sipocs",
    timestamps: true,
  }
);
