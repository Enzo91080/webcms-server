import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const SipocPhase = sequelize.define(
  "SipocPhase",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sipocId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "sipocs", key: "id" },
    },
    key: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "sipoc_phases",
    timestamps: true,
    indexes: [
      { fields: ["sipocId"] },
      { fields: ["sipocId", "order"] },
    ],
  }
);
