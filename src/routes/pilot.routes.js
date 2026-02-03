import { Router } from "express";
import {
  adminCreatePilot,
  adminDeletePilot,
  adminListPilots,
  adminPatchPilot,
  adminSetPilotProcesses,
} from "../controllers/pilot.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminPilotRoutes = Router();

adminPilotRoutes.use(requireAuth, requireAdmin);

adminPilotRoutes.get("/", asyncHandler(adminListPilots));
adminPilotRoutes.post("/", asyncHandler(adminCreatePilot));
adminPilotRoutes.patch("/:id", asyncHandler(adminPatchPilot));
adminPilotRoutes.delete("/:id", asyncHandler(adminDeletePilot));
adminPilotRoutes.put("/:id/processes", asyncHandler(adminSetPilotProcesses));
