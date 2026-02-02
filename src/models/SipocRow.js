import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const SipocRow = sequelize.define(
  "SipocRow",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sipocPhaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "sipoc_phases", key: "id" },
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ref: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phase: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    numero: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    processusFournisseur: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    entrees: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ressources: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sorties: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    processusClient: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sortiesProcessusVendre: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    designationProcessusClient: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sortiesProcessusClient: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // JSONB fields for complex objects
    designation: {
      type: DataTypes.JSONB,
      allowNull: true,
      // { name?: string, url?: string, target?: { type: "url" | "process", url?: string, processId?: string } }
    },
    designationProcessusVendre: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    activitePhase: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "sipoc_rows",
    timestamps: true,
    indexes: [
      { fields: ["sipocPhaseId"] },
      { fields: ["sipocPhaseId", "order"] },
    ],
  }
);
