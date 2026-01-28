import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { listAll, getOne, createOne, patchOne, deleteOne } from "../controllers/adminProcessController.js";

export const adminProcessRoutes = Router();

adminProcessRoutes.use(requireAuth, requireAdmin);

adminProcessRoutes.get("/", asyncHandler(listAll));
adminProcessRoutes.get("/:id", asyncHandler(getOne));
adminProcessRoutes.post("/", asyncHandler(createOne));
adminProcessRoutes.patch("/:id", asyncHandler(patchOne));
adminProcessRoutes.delete("/:id", asyncHandler(deleteOne));
