import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

/**
 * ProcessStakeholder - Join table enrichie entre Process et Stakeholder.
 * Les champs métier (needs, expectations, etc.) dépendent du contexte process/stakeholder.
 * Utilise une clé primaire composite (processId, stakeholderId).
 */
export const ProcessStakeholder = sequelize.define(
  "ProcessStakeholder",
  {
    processId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "processes",
        key: "id",
      },
      onDelete: "CASCADE",
    },

    stakeholderId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "stakeholders",
        key: "id",
      },
      onDelete: "CASCADE",
    },

    // --- Champs métier (contextualisés au process) ---
    needs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expectations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    evaluationCriteria: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requirements: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    strengths: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    weaknesses: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    opportunities: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    risks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actionPlan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "process_stakeholders",
    timestamps: true,
    indexes: [
      { fields: ["processId"] },
      { fields: ["stakeholderId"] },
    ],
  }
);
