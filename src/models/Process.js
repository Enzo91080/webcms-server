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
    pilots: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    stakeholders: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    referenceDocuments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    sipoc: {
      type: DataTypes.JSONB,
      // Always store both phases + rows (UI can render grouped phases)
      defaultValue: { phases: [], rows: [] },
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

Process.hasMany(Process, { foreignKey: "parentProcessId", as: "children" });
Process.belongsTo(Process, { foreignKey: "parentProcessId", as: "parent" });
