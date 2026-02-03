import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Process = sequelize.define(
  "Process",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    parentProcessId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "processes", key: "id" },
    },
    orderInParent: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { notEmpty: true },
      set(value) {
        this.setDataValue("code", value?.trim());
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
      set(value) {
        this.setDataValue("name", value?.trim());
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    title: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    objectives: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    objectivesBlocks: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // pilots: ancien champ JSONB supprimé, remplacé par relation many-to-many (process_pilots)
    referenceDocuments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    logigramme: {
      type: DataTypes.JSONB,
      defaultValue: {
        entryNodeId: "",
        nodes: [],
        edges: [],
        legend: [],
      },
    },
  },
  {
    tableName: "processes",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["parentProcessId", "orderInParent"] },
      { fields: ["parentProcessId"] },
      { fields: ["code"] },
      { fields: ["isActive"] },
    ],
  }
);
