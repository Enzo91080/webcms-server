import { Router } from "express";
import {
  adminCreateStakeholder,
  adminDeleteStakeholder,
  adminListStakeholders,
  adminPatchStakeholder,
} from "../controllers/stakeholder.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminStakeholderRoutes = Router();

adminStakeholderRoutes.use(requireAuth, requireAdmin);

adminStakeholderRoutes.get("/", asyncHandler(adminListStakeholders));
adminStakeholderRoutes.post("/", asyncHandler(adminCreateStakeholder));
adminStakeholderRoutes.patch("/:id", asyncHandler(adminPatchStakeholder));
adminStakeholderRoutes.delete("/:id", asyncHandler(adminDeleteStakeholder));
