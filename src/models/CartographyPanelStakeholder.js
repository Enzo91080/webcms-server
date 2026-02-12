import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const CartographyPanelStakeholder = sequelize.define(
  "CartographyPanelStakeholder",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    panelKey: {
      type: DataTypes.ENUM("left_panel", "right_panel"),
      allowNull: false,
    },
    stakeholderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    panelOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "cartography_panel_stakeholders",
    indexes: [
      { fields: ["panelKey", "panelOrder"] },
      { fields: ["stakeholderId"] },
    ],
  }
);
