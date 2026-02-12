import { Router } from "express";
import { CartographyLayout } from "../models/CartographyLayout.js";
import { CartographyPanelStakeholder } from "../models/CartographyPanelStakeholder.js";
import { CartographyPanelConfig } from "../models/CartographyPanelConfig.js";
import { Process } from "../models/Process.js";
import { Stakeholder } from "../models/Stakeholder.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sequelize } from "../config/db.js";

export const adminCartographyRoutes = Router();

adminCartographyRoutes.use(requireAuth, requireAdmin);

// GET /api/admin/cartography — all layout items with their process
adminCartographyRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await CartographyLayout.findAll({
      include: [
        {
          model: Process,
          as: "process",
          attributes: ["id", "code", "name", "color"],
        },
      ],
      order: [
        ["slotKey", "ASC"],
        ["slotOrder", "ASC"],
      ],
    });

    res.json({ data: items.map((i) => i.toJSON()) });
  })
);

// PUT /api/admin/cartography — replace all layout items
adminCartographyRoutes.put(
  "/",
  asyncHandler(async (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    await sequelize.transaction(async (t) => {
      await CartographyLayout.destroy({ where: {}, transaction: t });

      for (const item of items) {
        await CartographyLayout.create(
          {
            slotKey: item.slotKey,
            slotOrder: item.slotOrder ?? 0,
            processId: item.processId,
            label: item.label || null,
            isActive: item.isActive ?? true,
          },
          { transaction: t }
        );
      }
    });

    // Return the freshly saved layout
    const saved = await CartographyLayout.findAll({
      include: [
        {
          model: Process,
          as: "process",
          attributes: ["id", "code", "name", "color"],
        },
      ],
      order: [
        ["slotKey", "ASC"],
        ["slotOrder", "ASC"],
      ],
    });

    res.json({ data: saved.map((i) => i.toJSON()) });
  })
);

// GET /api/admin/cartography/panels — panel config + stakeholders
adminCartographyRoutes.get(
  "/panels",
  asyncHandler(async (req, res) => {
    const [items, configs] = await Promise.all([
      CartographyPanelStakeholder.findAll({
        include: [
          { model: Stakeholder, as: "stakeholder", attributes: ["id", "name"] },
        ],
        order: [
          ["panelKey", "ASC"],
          ["panelOrder", "ASC"],
        ],
      }),
      CartographyPanelConfig.findAll(),
    ]);

    const configMap = {};
    for (const c of configs) {
      configMap[c.panelKey] = c.mode;
    }

    res.json({
      data: items.map((i) => i.toJSON()),
      config: {
        left_panel: configMap["left_panel"] || "all",
        right_panel: configMap["right_panel"] || "all",
      },
    });
  })
);

// PUT /api/admin/cartography/panels — replace panel config + stakeholders
adminCartographyRoutes.put(
  "/panels",
  asyncHandler(async (req, res) => {
    const { items = [], config = {} } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    await sequelize.transaction(async (t) => {
      // Save config (mode per panel)
      for (const panelKey of ["left_panel", "right_panel"]) {
        const mode = config[panelKey] === "custom" ? "custom" : "all";
        await CartographyPanelConfig.upsert(
          { panelKey, mode },
          { transaction: t }
        );
      }

      // Save stakeholders
      await CartographyPanelStakeholder.destroy({ where: {}, transaction: t });
      for (const item of items) {
        await CartographyPanelStakeholder.create(
          {
            panelKey: item.panelKey,
            stakeholderId: item.stakeholderId,
            panelOrder: item.panelOrder ?? 0,
          },
          { transaction: t }
        );
      }
    });

    const [saved, configs] = await Promise.all([
      CartographyPanelStakeholder.findAll({
        include: [
          { model: Stakeholder, as: "stakeholder", attributes: ["id", "name"] },
        ],
        order: [["panelKey", "ASC"], ["panelOrder", "ASC"]],
      }),
      CartographyPanelConfig.findAll(),
    ]);

    const configMap = {};
    for (const c of configs) {
      configMap[c.panelKey] = c.mode;
    }

    res.json({
      data: saved.map((i) => i.toJSON()),
      config: {
        left_panel: configMap["left_panel"] || "all",
        right_panel: configMap["right_panel"] || "all",
      },
    });
  })
);
