import { Op } from "sequelize";
import { Process } from "../models/Process.js";
import { Stakeholder } from "../models/Stakeholder.js";

// ============================================================================
// HELPERS - Validation & Transformation
// ============================================================================

/**
 * Validates and returns a UUID string.
 * Throws 400 error if invalid.
 */
function validateUuid(id) {
  if (!id || typeof id !== "string") {
    const err = new Error("Invalid id");
    err.statusCode = 400;
    throw err;
  }
  return id;
}

/**
 * Converts a Sequelize model instance to plain JSON.
 * Gracefully handles models and already-converted objects.
 */
function toJSON(model) {
  return model?.toJSON ? model.toJSON() : model;
}

/**
 * Transforms a process and its children into JSON format.
 * Recursively converts each child to JSON.
 */
function transformProcessWithChildren(process) {
  const json = toJSON(process);
  // Convert associated stakeholders objects to an array of names (front compatibility)
  if (Array.isArray(json.stakeholders)) {
    json.stakeholderIds = json.stakeholders.map((s) => s.id).filter(Boolean);
    json.stakeholders = json.stakeholders.map((s) => s.name).filter(Boolean);
  }
  if (Array.isArray(json.children)) {
    json.children = json.children.map(toJSON);
  }
  return json;
}

function processBaseIncludes() {
  return [
    {
      model: Stakeholder,
      as: "stakeholders",
      through: { attributes: [] },
      attributes: ["id", "name"],
    },
  ];
}

/**
 * Builds a Map of phase names -> rows, from a flat row array.
 * Ensures each row has a `phase` property set to its phase name.
 * Returns { phaseOrder, map }
 */
function buildPhaseMapFromRows(rows) {
  const phaseOrder = [];
  const map = new Map();

  for (const r of rows) {
    const phaseName = String(r?.phase || "Phase unique");
    if (!map.has(phaseName)) {
      map.set(phaseName, []);
      phaseOrder.push(phaseName);
    }
    map.get(phaseName).push({ ...r, phase: phaseName });
  }

  return { phaseOrder, map };
}

/**
 * Normalizes a SIPOC object to ensure it has both `phases` and `rows`.
 * - If phases are provided, uses them (ensuring each row has phase property).
 * - Otherwise, builds phases from row.phase property.
 * - Returns { phases, rows } where rows is flattened from phases.
 */
function normalizeSipoc(input) {
  const sipoc = input && typeof input === "object" ? input : {};
  const rows = Array.isArray(sipoc.rows) ? sipoc.rows : [];
  const phasesInput = Array.isArray(sipoc.phases) ? sipoc.phases : null;

  // Parse phases from input if provided
  if (phasesInput && phasesInput.length > 0) {
    const phases = phasesInput
      .map((p, idx) => {
        const name = String(p?.name || p?.label || `Phase ${idx + 1}`);
        const key = String(p?.key || p?.id || name);
        const phaseRows = Array.isArray(p?.rows) ? p.rows : [];
        return {
          key,
          name,
          rows: phaseRows.map((r) => ({ ...r, phase: r?.phase || name })),
        };
      })
      .filter((p) => p.name);

    const flattenedRows = phases.flatMap((p) => p.rows);
    return { phases, rows: flattenedRows };
  }

  // Build phases from row.phase if no phases were provided
  const { phaseOrder, map } = buildPhaseMapFromRows(rows);
  const phases = phaseOrder.map((name, idx) => ({
    key: `${idx + 1}`,
    name,
    rows: map.get(name) || [],
  }));

  return { phases, rows: phases.flatMap((p) => p.rows) };
}

// ============================================================================
// PUBLIC API - Cartography & Discovery
// ============================================================================

export async function getCartography(req, res) {
  const roots = await Process.findAll({
    where: { parentProcessId: null, isActive: true },
    order: [["orderInParent", "ASC"]],
    attributes: ["id", "code", "name", "title", "orderInParent", "isActive"],
  });
  res.json({ data: roots.map(toJSON) });
}

export async function listAll(req, res) {
  const items = await Process.findAll({
    order: [["parentProcessId", "ASC"], ["orderInParent", "ASC"], ["code", "ASC"]],
    attributes: ["id", "code", "name", "parentProcessId", "orderInParent", "isActive", "updatedAt", "createdAt"],
  });
  res.json({ data: items.map(toJSON) });
}

/**
 * Retrieves a process by code, including its direct children.
 */
export async function getByCode(req, res) {
  const { code } = req.params;

  const process = await Process.findOne({
    where: { code },
    include: [
      ...processBaseIncludes(),
      {
      model: Process,
      as: "children",
      attributes: ["id", "code", "name", "title", "orderInParent", "isActive"],
      order: [["orderInParent", "ASC"]],
      },
    ],
  });

  if (!process) {
    return res.status(404).json({ error: "Not Found" });
  }

  res.json({ data: transformProcessWithChildren(process) });
}

/**
 * Retrieves a process by ID, including its direct children.
 */
export async function getById(req, res) {
  const id = validateUuid(req.params.id);

  const process = await Process.findByPk(id, {
    include: [
      ...processBaseIncludes(),
      {
      model: Process,
      as: "children",
      attributes: ["id", "code", "name", "title", "orderInParent", "isActive"],
      order: [["orderInParent", "ASC"]],
      },
    ],
  });

  if (!process) {
    return res.status(404).json({ error: "Not Found" });
  }

  res.json({ data: transformProcessWithChildren(process) });
}

/**
 * Retrieves the full hierarchy (descendants) of a process.
 * Uses recursive descent to build the tree.
 */
export async function getHierarchy(req, res) {
  const id = validateUuid(req.params.id);

  const result = await buildHierarchy(id);

  if (!result) {
    return res.status(404).json({ error: "Not Found" });
  }

  res.json({ data: result });
}

/**
 * Recursively builds the hierarchy for a process and all its descendants.
 */
async function buildHierarchy(processId) {
  const process = await Process.findByPk(processId, {
    attributes: ["id", "code", "name", "title", "parentProcessId", "orderInParent"],
  });

  if (!process) {
    return null;
  }

  const children = await Process.findAll({
    where: { parentProcessId: processId },
    attributes: ["id", "code", "name", "title", "parentProcessId", "orderInParent"],
    order: [["orderInParent", "ASC"]],
  });

  const descendants = await Promise.all(
    children.map((child) => buildHierarchy(child.id))
  );

  return {
    ...toJSON(process),
    descendants: descendants.filter(Boolean),
  };
}

/**
 * Retrieves the breadcrumb path from a process up to the root.
 * Returns path in order from root to process.
 */
export async function getPath(req, res) {
  const id = validateUuid(req.params.id);

  const path = await buildPath(id);

  if (path === null) {
    return res.status(404).json({ error: "Not Found" });
  }

  path.reverse(); // Reverse to get root-to-process order
  res.json({ data: path });
}

/**
 * Recursively builds the path from a process to the root.
 * Returns null if process not found.
 */
async function buildPath(processId) {
  const current = await Process.findByPk(processId, {
    attributes: ["id", "code", "name", "parentProcessId", "orderInParent"],
  });

  if (!current) {
    return null;
  }

  const pathItem = {
    id: current.id,
    code: current.code,
    name: current.name,
    parentProcessId: current.parentProcessId ?? null,
    orderInParent: current.orderInParent,
  };

  // Stop at root
  if (!current.parentProcessId) {
    return [pathItem];
  }

  // Recurse to parent
  const parentPath = await buildPath(current.parentProcessId);
  return parentPath ? [...parentPath, pathItem] : null;
}

// ============================================================================
// PUBLIC API - SIPOC & Logigramme
// ============================================================================

export async function getSipocRows(req, res) {
  const id = validateUuid(req.params.id);

  const process = await Process.findByPk(id, { attributes: ["id", "sipoc"] });

  if (!process) {
    return res.status(404).json({ error: "Not Found" });
  }

  const rows = process.sipoc?.rows || [];
  res.json({ data: rows });
}

export async function getLogigramme(req, res) {
  const id = validateUuid(req.params.id);

  const process = await Process.findByPk(id, {
    attributes: ["id", "code", "name", "logigramme"],
  });

  if (!process) {
    return res.status(404).json({ error: "Not Found" });
  }

  res.json({
    data: {
      code: process.code,
      name: process.name,
      logigramme: process.logigramme,
    },
  });
}

// ============================================================================
// PUBLIC API - Resolution & Lookup
// ============================================================================

/**
 * Given an array of process IDs, returns a map of id -> { code, name }.
 * Missing IDs are not included in the result.
 */
export async function resolveCodes(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

  if (ids.length === 0) {
    return res.json({ data: {} });
  }

  const docs = await Process.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "code", "name"],
  });

  const map = {};
  for (const doc of docs) {
    const json = toJSON(doc);
    map[json.id] = { code: json.code, name: json.name };
  }

  res.json({ data: map });
}

/**
 * Resolves a process ID by its code.
 * Returns { id, code, name } or 404 if not found.
 */
export async function resolveIdByCode(req, res) {
  const { code } = req.params;

  const process = await Process.findOne({
    where: { code },
    attributes: ["id", "code", "name"],
  });

  if (!process) {
    return res.status(404).json({ error: "Not Found" });
  }

  const json = toJSON(process);
  res.json({ data: { id: json.id, code: json.code, name: json.name } });
}

// ============================================================================
// PUBLIC API - CRUD Operations
// ============================================================================

export async function createProcess(req, res) {
  const { body, stakeholders } = normalizePatchBody(req.body);

  const created = await Process.create(body);

  if (stakeholders !== undefined) {
    await applyStakeholders(created, stakeholders);
  }

  const reloaded = await Process.findByPk(created.id, {
    include: processBaseIncludes(),
  });

  res.status(201).json({ data: transformProcessWithChildren(reloaded) });
}

/**
 * Patches a process by ID. Updates only provided fields.
 * Handles legacy _id field (converts to id).
 * Treats empty string parentProcessId as null (root process).
 */
export async function patchProcess(req, res) {
  const id = validateUuid(req.params.id);
  const { body, stakeholders } = normalizePatchBody(req.body);

  const [updated] = await Process.update(body, { where: { id } });

  if (!updated) {
    return res.status(404).json({ error: "Not Found" });
  }

  const process = await Process.findByPk(id);
  if (!process) return res.status(404).json({ error: "Not Found" });

  if (stakeholders !== undefined) {
    await applyStakeholders(process, stakeholders);
  }

  const reloaded = await Process.findByPk(id, {
    include: processBaseIncludes(),
  });

  res.json({ data: transformProcessWithChildren(reloaded) });
}

/**
 * Normalizes a PATCH body:
 * - Converts legacy _id to id
 * - Converts empty parentProcessId to null
 */
function normalizePatchBody(body) {
  const normalized = { ...(body || {}) };

  // Stakeholders are now managed via a reference table.
  // We accept legacy payloads (array of stakeholder names) for compatibility.
  const stakeholders = Object.prototype.hasOwnProperty.call(normalized, "stakeholders")
    ? normalized.stakeholders
    : undefined;
  delete normalized.stakeholders;

  if (normalized._id) {
    normalized.id = normalized._id;
    delete normalized._id;
  }

  if (normalized.parentProcessId === "") {
    normalized.parentProcessId = null;
  }

  return { body: normalized, stakeholders };
}

async function applyStakeholders(process, input) {
  const arr = Array.isArray(input) ? input : [];
  const names = [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];

  const instances = [];
  for (const name of names) {
    const [s] = await Stakeholder.findOrCreate({
      where: { name },
      defaults: { name, isActive: true },
    });
    instances.push(s);
  }

  // If empty array provided, this clears the relationship.
  await process.setStakeholders(instances);
}

// ============================================================================
// PUBLIC API - SIPOC & Logigramme Updates
// ============================================================================

/**
 * Replaces the SIPOC data for a process.
 * Normalizes the input to ensure consistent phase/rows structure.
 */
export async function replaceSipoc(req, res) {
  const id = validateUuid(req.params.id);
  const { sipoc } = req.body;

  const normalized = normalizeSipoc(sipoc);

  const [updated] = await Process.update({ sipoc: normalized }, { where: { id } });

  if (!updated) {
    return res.status(404).json({ error: "Not Found" });
  }

  const process = await Process.findByPk(id);
  res.json({ data: toJSON(process) });
}

/**
 * Replaces the logigramme data for a process.
 */
export async function replaceLogigramme(req, res) {
  const id = validateUuid(req.params.id);
  const { logigramme } = req.body;

  const [updated] = await Process.update({ logigramme }, { where: { id } });

  if (!updated) {
    return res.status(404).json({ error: "Not Found" });
  }

  const process = await Process.findByPk(id);
  res.json({ data: toJSON(process) });
}

// ============================================================================
// PUBLIC API - Deletion
// ============================================================================

export async function deleteProcess(req, res) {
  const id = validateUuid(req.params.id);

  const deleted = await Process.destroy({ where: { id } });

  if (!deleted) {
    return res.status(404).json({ error: "Not Found" });
  }

  res.json({ data: { ok: true } });
}
