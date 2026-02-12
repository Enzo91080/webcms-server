import { Router } from "express";
import {
  listStakeholders,
  adminCreateStakeholder,
  adminDeleteStakeholder,
  adminListStakeholders,
  adminPatchStakeholder,
  adminSetStakeholderProcesses,
} from "../controllers/stakeholder.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Public
export const stakeholderRoutes = Router();
stakeholderRoutes.get("/", asyncHandler(listStakeholders));

// Admin
export const adminStakeholderRoutes = Router();

adminStakeholderRoutes.use(requireAuth, requireAdmin);

adminStakeholderRoutes.get("/", asyncHandler(adminListStakeholders));
adminStakeholderRoutes.post("/", asyncHandler(adminCreateStakeholder));
adminStakeholderRoutes.patch("/:id", asyncHandler(adminPatchStakeholder));
adminStakeholderRoutes.delete("/:id", asyncHandler(adminDeleteStakeholder));
adminStakeholderRoutes.put("/:id/processes", asyncHandler(adminSetStakeholderProcesses));
