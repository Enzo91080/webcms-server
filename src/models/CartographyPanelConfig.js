import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const CartographyPanelConfig = sequelize.define(
  "CartographyPanelConfig",
  {
    panelKey: {
      type: DataTypes.ENUM("left_panel", "right_panel"),
      primaryKey: true,
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM("all", "custom"),
      allowNull: false,
      defaultValue: "all",
    },
  },
  {
    tableName: "cartography_panel_configs",
  }
);
