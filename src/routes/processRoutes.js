import { Router } from "express";
import {
  createProcess,
  deleteProcess,
  getByCode,
  getById,
  getCartography,
  getHierarchy,
  getLogigramme,
  getPath,
  getSipocRows,
  patchProcess,
  replaceLogigramme,
  replaceSipoc,
  resolveCodes,
  resolveIdByCode
} from "../controllers/processController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const processRoutes = Router();

processRoutes.get("/cartography", asyncHandler(getCartography));
processRoutes.post("/resolve-codes", asyncHandler(resolveCodes));
processRoutes.get("/resolve-id/:code", asyncHandler(resolveIdByCode));
processRoutes.get("/by-code/:code", asyncHandler(getByCode));

processRoutes.get("/:id/path", asyncHandler(getPath));
processRoutes.get("/:id/hierarchy", asyncHandler(getHierarchy));
processRoutes.get("/:id/sipoc/rows", asyncHandler(getSipocRows));
processRoutes.get("/:id/logigramme", asyncHandler(getLogigramme));

processRoutes.get("/:id", asyncHandler(getById));

processRoutes.post("/", requireAuth, requireAdmin, asyncHandler(createProcess));
processRoutes.patch("/:id", requireAuth, requireAdmin, asyncHandler(patchProcess));
processRoutes.put("/:id/sipoc", requireAuth, requireAdmin, asyncHandler(replaceSipoc));
processRoutes.put("/:id/logigramme", requireAuth, requireAdmin, asyncHandler(replaceLogigramme));

processRoutes.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteProcess));
