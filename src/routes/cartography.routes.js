import { Router } from "express";
import { CartographyLayout } from "../models/CartographyLayout.js";
import { Process } from "../models/Process.js";
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
