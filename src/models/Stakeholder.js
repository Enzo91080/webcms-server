import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Stakeholders are a reusable reference list ("Parties intéressées").
// They are NOT stored as embedded JSON in a process.
export const Stakeholder = sequelize.define(
  "Stakeholder",
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

    // --- New fields (English) ---
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

    // Option A (recommended): structured action plan
    actionPlan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Option B (if you prefer plain text instead of JSON):
    // actionPlan: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "stakeholders",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["name"] },
      { fields: ["isActive"] },
    ],
  }
);
