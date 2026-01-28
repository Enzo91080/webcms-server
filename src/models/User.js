import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue("email", value?.toLowerCase()?.trim());
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin"),
      defaultValue: "admin",
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      defaultValue: "Administrateur",
    },
  },
  {
    tableName: "users",
    timestamps: true,
  }
);
