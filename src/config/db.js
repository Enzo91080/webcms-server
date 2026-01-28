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
    await sequelize.authenticate();
    console.log(`[db] ✅ Connected to PostgreSQL`);
    if (env.nodeEnv === "development") {
      await sequelize.sync({ alter: false });
      console.log(`[db] ✅ Database synchronized`);
    }
  } catch (error) {
    console.error(`[db] ❌ Connection failed:`, error.message);
    throw error;
  }
}
