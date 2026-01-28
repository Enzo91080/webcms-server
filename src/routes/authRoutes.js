import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { login, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

export const authRoutes = Router();

authRoutes.post("/login", asyncHandler(login));
authRoutes.get("/me", requireAuth, asyncHandler(me));
