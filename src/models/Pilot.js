import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Pilots are a reusable reference list ("Pilotes").
// They are NOT stored as embedded JSON in a process.
export const Pilot = sequelize.define(
  "Pilot",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { notEmpty: true },
      set(value) {
        this.setDataValue("name", String(value || "").trim());
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "pilots",
    timestamps: true,
    indexes: [{ unique: true, fields: ["name"] }, { fields: ["isActive"] }],
  }
);
