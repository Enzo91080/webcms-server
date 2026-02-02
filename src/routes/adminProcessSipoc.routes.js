import { Router } from "express";
import { Sipoc, SipocPhase, SipocRow, Process } from "../models/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminProcessSipocRoutes = Router();

adminProcessSipocRoutes.use(requireAuth, requireAdmin);

// ============================================================================
// HELPERS - Validation & Transformation
// ============================================================================

function validateUuid(id) {
  if (!id || typeof id !== "string") {
    const err = new Error("Invalid processId");
    err.statusCode = 400;
    throw err;
  }
  return id;
}

/**
 * Maps a SipocRow model instance to the DTO format expected by the frontend.
 */
function rowToDto(row) {
  return {
    ref: row.ref ?? undefined,
    phase: row.phase ?? undefined,
    numero: row.numero ?? undefined,
    processusFournisseur: row.processusFournisseur ?? undefined,
    entrees: row.entrees ?? undefined,
    ressources: row.ressources ?? undefined,
    designation: row.designation ?? undefined,
    sorties: row.sorties ?? undefined,
    processusClient: row.processusClient ?? undefined,
    designationProcessusVendre: row.designationProcessusVendre ?? undefined,
    activitePhase: row.activitePhase ?? undefined,
    sortiesProcessusVendre: row.sortiesProcessusVendre ?? undefined,
    designationProcessusClient: row.designationProcessusClient ?? undefined,
    sortiesProcessusClient: row.sortiesProcessusClient ?? undefined,
  };
}

/**
 * Maps a SipocPhase model instance (with rows) to the DTO format.
 */
function phaseToDto(phase) {
  return {
    key: phase.key ?? undefined,
    name: phase.name ?? undefined,
    rows: (phase.rows || []).map(rowToDto),
  };
}

/**
 * Maps a DTO row to the database fields.
 */
function dtoToRowFields(dto) {
  return {
    ref: dto.ref ?? null,
    phase: dto.phase ?? null,
    numero: dto.numero != null ? String(dto.numero) : null,
    processusFournisseur: dto.processusFournisseur ?? null,
    entrees: dto.entrees ?? null,
    ressources: dto.ressources ?? null,
    designation: dto.designation ?? null,
    sorties: dto.sorties ?? null,
    processusClient: dto.processusClient ?? null,
    designationProcessusVendre: dto.designationProcessusVendre ?? null,
    activitePhase: dto.activitePhase ?? null,
    sortiesProcessusVendre: dto.sortiesProcessusVendre ?? null,
    designationProcessusClient: dto.designationProcessusClient ?? null,
    sortiesProcessusClient: dto.sortiesProcessusClient ?? null,
  };
}

// ============================================================================
// GET /api/admin/processes/:processId/sipoc
// ============================================================================

async function getSipoc(req, res) {
  const processId = validateUuid(req.params.processId);

  // Verify process exists
  const process = await Process.findByPk(processId, { attributes: ["id"] });
  if (!process) {
    return res.status(404).json({ error: "Process not found" });
  }

  // Find Sipoc with phases and rows, ordered
  const sipoc = await Sipoc.findOne({
    where: { processId },
    include: [
      {
        model: SipocPhase,
        as: "phases",
        include: [
          {
            model: SipocRow,
            as: "rows",
          },
        ],
      },
    ],
    order: [
      [{ model: SipocPhase, as: "phases" }, "order", "ASC"],
      [{ model: SipocPhase, as: "phases" }, { model: SipocRow, as: "rows" }, "order", "ASC"],
    ],
  });

  // If no SIPOC exists, return empty phases
  if (!sipoc) {
    return res.json({ processId, phases: [] });
  }

  const phases = (sipoc.phases || []).map(phaseToDto);
  res.json({ processId, phases });
}

// ============================================================================
// PUT /api/admin/processes/:processId/sipoc
// ============================================================================

async function upsertSipoc(req, res) {
  const processId = validateUuid(req.params.processId);
  const { phases } = req.body;

  // Validation: phases must be an array
  if (!Array.isArray(phases)) {
    return res.status(400).json({ error: "phases must be an array" });
  }

  // Verify process exists
  const process = await Process.findByPk(processId, { attributes: ["id"] });
  if (!process) {
    return res.status(404).json({ error: "Process not found" });
  }

  // Find or create Sipoc
  const [sipoc] = await Sipoc.findOrCreate({
    where: { processId },
    defaults: { processId },
  });

  // Delete existing phases (cascade will delete rows)
  await SipocPhase.destroy({ where: { sipocId: sipoc.id } });

  // Create new phases and rows
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
    const phaseDto = phases[phaseIndex];

    const newPhase = await SipocPhase.create({
      sipocId: sipoc.id,
      key: phaseDto.key ?? null,
      name: phaseDto.name ?? null,
      order: phaseIndex,
    });

    const rows = Array.isArray(phaseDto.rows) ? phaseDto.rows : [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const rowDto = rows[rowIndex];
      await SipocRow.create({
        sipocPhaseId: newPhase.id,
        order: rowIndex,
        ...dtoToRowFields(rowDto),
      });
    }
  }

  // Reload and return
  const reloaded = await Sipoc.findOne({
    where: { processId },
    include: [
      {
        model: SipocPhase,
        as: "phases",
        include: [
          {
            model: SipocRow,
            as: "rows",
          },
        ],
      },
    ],
    order: [
      [{ model: SipocPhase, as: "phases" }, "order", "ASC"],
      [{ model: SipocPhase, as: "phases" }, { model: SipocRow, as: "rows" }, "order", "ASC"],
    ],
  });

  const resultPhases = (reloaded.phases || []).map(phaseToDto);
  res.json({ processId, phases: resultPhases });
}

// ============================================================================
// ROUTES
// ============================================================================

adminProcessSipocRoutes.get("/:processId/sipoc", asyncHandler(getSipoc));
adminProcessSipocRoutes.put("/:processId/sipoc", asyncHandler(upsertSipoc));
