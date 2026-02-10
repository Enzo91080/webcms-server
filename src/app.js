import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRoutes, processRoutes, adminProcessRoutes, adminStakeholderRoutes, adminPilotRoutes, adminProcessSipocRoutes, adminCartographyRoutes } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/index.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "5mb" }));
  app.use(cors({ origin: env.corsOrigin }));
  app.use(morgan("dev"));

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/processes", processRoutes);
  app.use("/api/admin/processes", adminProcessRoutes);
  app.use("/api/admin/processes", adminProcessSipocRoutes);
  app.use("/api/admin/stakeholders", adminStakeholderRoutes);
  app.use("/api/admin/pilots", adminPilotRoutes);
  app.use("/api/admin/cartography", adminCartographyRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
