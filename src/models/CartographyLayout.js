import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const CartographyLayout = sequelize.define(
  "CartographyLayout",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    slotKey: {
      type: DataTypes.ENUM(
        "manager",
        "value_chain",
        "left_panel",
        "right_panel",
        "left_box",
        "right_box"
      ),
      allowNull: false,
    },
    slotOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    processId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "processes", key: "id" },
    },
    label: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "cartography_layouts",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["slotKey", "slotOrder"] },
      { fields: ["processId"] },
    ],
  }
);
