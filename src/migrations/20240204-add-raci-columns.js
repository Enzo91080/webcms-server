/**
 * Migration: Add RACI columns to sipoc_rows table
 *
 * This migration:
 * 1. Adds 4 new columns: raci_r, raci_a, raci_c, raci_i
 * 2. Copies existing 'ressources' data to 'raci_r'
 *
 * Run manually in production: node src/migrations/20240204-add-raci-columns.js
 */

import { sequelize } from "../config/db.js";

export async function up() {
  const queryInterface = sequelize.getQueryInterface();
  const { DataTypes } = await import("sequelize");

  // Check if columns already exist
  const tableInfo = await queryInterface.describeTable("sipoc_rows");

  if (!tableInfo.raci_r) {
    await queryInterface.addColumn("sipoc_rows", "raci_r", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    console.log("[migration] Added column raci_r");
  }

  if (!tableInfo.raci_a) {
    await queryInterface.addColumn("sipoc_rows", "raci_a", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    console.log("[migration] Added column raci_a");
  }

  if (!tableInfo.raci_c) {
    await queryInterface.addColumn("sipoc_rows", "raci_c", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    console.log("[migration] Added column raci_c");
  }

  if (!tableInfo.raci_i) {
    await queryInterface.addColumn("sipoc_rows", "raci_i", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    console.log("[migration] Added column raci_i");
  }

  // Copy existing ressources data to raci_r (only if raci_r is empty)
  await sequelize.query(`
    UPDATE sipoc_rows
    SET raci_r = ressources
    WHERE ressources IS NOT NULL
      AND ressources != ''
      AND (raci_r IS NULL OR raci_r = '')
  `);
  console.log("[migration] Copied ressources to raci_r");

  console.log("[migration] RACI columns migration completed successfully");
}

export async function down() {
  const queryInterface = sequelize.getQueryInterface();

  // Copy raci_r back to ressources before dropping columns (safety measure)
  await sequelize.query(`
    UPDATE sipoc_rows
    SET ressources = raci_r
    WHERE raci_r IS NOT NULL
      AND raci_r != ''
      AND (ressources IS NULL OR ressources = '')
  `);

  await queryInterface.removeColumn("sipoc_rows", "raci_r");
  await queryInterface.removeColumn("sipoc_rows", "raci_a");
  await queryInterface.removeColumn("sipoc_rows", "raci_c");
  await queryInterface.removeColumn("sipoc_rows", "raci_i");

  console.log("[migration] RACI columns removed");
}

// Run migration if executed directly
if (process.argv[1].includes("20240204-add-raci-columns")) {
  const action = process.argv[2] || "up";

  (async () => {
    try {
      await sequelize.authenticate();
      console.log("[migration] Connected to database");

      if (action === "down") {
        await down();
      } else {
        await up();
      }

      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error("[migration] Error:", error);
      process.exit(1);
    }
  })();
}
