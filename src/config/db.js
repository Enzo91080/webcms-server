import { Sequelize } from "sequelize";
import { env } from "./env.js";

export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: "postgres",
  logging: env.nodeEnv === "development" ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
  },
});

export async function connectDb() {
  try {
    // Ensure all models + associations are registered before syncing.
    // connectDb() is called before createApp(), so controllers/routes may not
    // have been imported yet.
    await import("../models/initModels.js");

    await sequelize.authenticate();
    console.log(`[db] ✅ Connected to PostgreSQL`);
    if (env.nodeEnv === "development") {
      // Note: alter: true va ajouter les nouvelles colonnes à process_stakeholders
      // Remettre à false après le premier démarrage si vous ne voulez pas de sync auto
      await sequelize.sync({ alter: true });
      console.log(`[db] ✅ Database synchronized`);
    }
  } catch (error) {
    console.error(`[db] ❌ Connection failed:`, error.message);
    throw error;
  }
}
