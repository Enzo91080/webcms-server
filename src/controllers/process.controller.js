import { Op } from "sequelize";
import { Process } from "../models/Process.js";
import { Stakeholder } from "../models/Stakeholder.js";
import { ProcessStakeholder } from "../models/ProcessStakeholder.js";
import { Pilot } from "../models/Pilot.js";
import { Sipoc } from "../models/Sipoc.js";
import { SipocPhase } from "../models/SipocPhase.js";
import { SipocRow } from "../models/SipocRow.js";
import { CartographyLayout } from "../models/CartographyLayout.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const LINK_FIELDS = [
  "needs",
  "expectations",
  "evaluationCriteria",
  "requirements",
  "strengths",
  "weaknesses",
  "opportunities",
  "risks",
  "actionPlan",
];

// ============================================================================
// SMALL UTILS
// ============================================================================

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function validateUuid(id) {
  if (!id || typeof id !== "string") throw httpError(400, "Invalid id");
  return id;
}

function toJSON(model) {
  return model?.toJSON ? model.toJSON() : model;
}

function pickLink(linkData) {
  const out = {};
  for (const f of LINK_FIELDS) out[f] = linkData?.[f] ?? null;
  return out;
}

function normalizeText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function ensureArray(value, errorMsg) {
  if (!Array.isArray(value)) throw httpError(400, errorMsg);
  return value;
}

async function findProcessOr404(id, opts = {}) {
  const doc = await Process.findByPk(id, opts);
  if (!doc) throw httpError(404, "Not Found");
  return doc;
}

async function ensureAllExist(Model, ids, label) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return;

  const rows = await Model.findAll({ where: { id: uniq }, attributes: ["id"] });
  const ok = new Set(rows.map((r) => r.id));
  const invalid = uniq.filter((x) => !ok.has(x));
  if (invalid.length) throw httpError(400, `Invalid ${label} IDs: ${invalid.join(", ")}`);
}

// ============================================================================
// INCLUDES / TRANSFORMS
// ============================================================================

function processBaseIncludes() {
  return [
    {
      model: Stakeholder,
      as: "stakeholders",
      through: { attributes: LINK_FIELDS },
      attributes: ["id", "name", "isActive"],
    },
    {
      model: Pilot,
      as: "pilots",
      through: { attributes: [] },
      attributes: ["id", "name", "isActive"],
    },
  ];
}

function transformProcess(process, sipocData = null) {
  const json = toJSON(process);

  if (Array.isArray(json.stakeholders)) {
    json.stakeholderIds = json.stakeholders.map((s) => s.id).filter(Boolean);
    json.stakeholders = json.stakeholders.map((s) => ({
      id: s.id,
      name: s.name,
      isActive: s.isActive,
      link: pickLink(s.ProcessStakeholder),
    }));
  }

  if (Array.isArray(json.pilots)) {
    json.pilotIds = json.pilots.map((p) => p.id).filter(Boolean);
    // on conserve `pilots` tel quel pour affichage (id, name, isActive)
  }

  if (Array.isArray(json.children)) json.children = json.children.map(toJSON);
  if (sipocData) json.sipoc = sipocData;

  return json;
}

// ============================================================================
// SIPOC (normalized tables) -> DTO
// ============================================================================

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
}

function serializeArray(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val.length ? JSON.stringify(val) : null;
  return JSON.stringify([val]);
}

function sipocRowToDto(row) {
  return {
    ref: row.ref ?? undefined,
    phase: row.phase ?? undefined,
    numero: row.numero ?? undefined,
    processusFournisseur: parseJsonArray(row.processusFournisseur),
    entrees: row.entrees ?? undefined,
    ressources: row.ressources ?? undefined,
    raciR: row.raciR ?? undefined,
    raciA: row.raciA ?? undefined,
    raciC: row.raciC ?? undefined,
    raciI: row.raciI ?? undefined,
    designation: row.designation ?? undefined,
    sorties: row.sorties ?? undefined,
    processusClient: parseJsonArray(row.processusClient),
    activitePhase: row.activitePhase ?? undefined,
    designationProcessusClient: parseJsonArray(row.designationProcessusClient),
    sortiesProcessusClient: row.sortiesProcessusClient ?? undefined,
  };
}

function sipocPhaseToDto(phase) {
  return {
    key: phase.key ?? undefined,
    name: phase.name ?? undefined,
    rows: (phase.rows || []).map(sipocRowToDto),
  };
}

async function fetchSipocForProcess(processId) {
  const sipoc = await Sipoc.findOne({
    where: { processId },
    include: [
      {
        model: SipocPhase,
        as: "phases",
        include: [{ model: SipocRow, as: "rows" }],
      },
    ],
    order: [
      [{ model: SipocPhase, as: "phases" }, "order", "ASC"],
      [{ model: SipocPhase, as: "phases" }, { model: SipocRow, as: "rows" }, "order", "ASC"],
    ],
  });

  if (!sipoc) return { phases: [], rows: [] };

  const phases = (sipoc.phases || []).map(sipocPhaseToDto);
  return { phases, rows: phases.flatMap((p) => p.rows || []) };
}

// ============================================================================
// PUBLIC API - Cartography & Discovery
// ============================================================================
export async function getCartography(req, res) {
  const items = await CartographyLayout.findAll({
    where: { isActive: true },
    include: [
      {
        model: Process,
        as: "process",
        attributes: ["id", "code", "name", "color"],
      },
    ],
    order: [
      ["slotKey", "ASC"],
      ["slotOrder", "ASC"],
    ],
  });

  const rows = items.map(toJSON);

  const pickOne = (slot) => rows.find((r) => r.slotKey === slot) || null;
  const pickMany = (slot) => rows.filter((r) => r.slotKey === slot);

  res.json({
    data: {
      manager: pickOne("manager"),
      valueChain: pickMany("value_chain"),
      leftPanel: pickMany("left_panel"),
      rightPanel: pickMany("right_panel"),
      leftBox: pickMany("left_box"),
      rightBox: pickMany("right_box"),
    },
  });
}



export async function listLite(req, res) {
  const items = await Process.findAll({
    attributes: ["id", "code", "name", "processType", "parentProcessId", "color"],
    order: [["code", "ASC"]],
  });
  res.json({ data: items.map(toJSON) });
}

export async function listAll(req, res) {
  const items = await Process.findAll({
    include: processBaseIncludes(),
    order: [["parentProcessId", "ASC"], ["orderInParent", "ASC"], ["code", "ASC"]],
    attributes: ["id", "code", "name", "parentProcessId", "orderInParent", "isActive", "processType", "color", "showAdvancedStakeholders", "updatedAt", "createdAt"],
  });

  res.json({ data: items.map(toJSON) });
}

async function getProcessWithChildren(where) {
  const process = await Process.findOne({
    where,
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

  if (!process) throw httpError(404, "Not Found");
  const sipocData = await fetchSipocForProcess(process.id);
  return transformProcess(process, sipocData);
}

export async function getByCode(req, res) {
  const { code } = req.params;
  const data = await getProcessWithChildren({ code });
  res.json({ data });
}

export async function getById(req, res) {
  const id = validateUuid(req.params.id);
  const data = await getProcessWithChildren({ id });
  res.json({ data });
}

// ============================================================================
// PUBLIC API - Hierarchy / Path
// ============================================================================

export async function getHierarchy(req, res) {
  const id = validateUuid(req.params.id);
  const result = await buildHierarchy(id);
  if (!result) return res.status(404).json({ error: "Not Found" });
  res.json({ data: result });
}

async function buildHierarchy(processId) {
  const process = await Process.findByPk(processId, {
    attributes: ["id", "code", "name", "title", "parentProcessId", "orderInParent"],
  });
  if (!process) return null;

  const children = await Process.findAll({
    where: { parentProcessId: processId },
    attributes: ["id", "code", "name", "title", "parentProcessId", "orderInParent"],
    order: [["orderInParent", "ASC"]],
  });

  const descendants = await Promise.all(children.map((child) => buildHierarchy(child.id)));

  return { ...toJSON(process), descendants: descendants.filter(Boolean) };
}

export async function getPath(req, res) {
  const id = validateUuid(req.params.id);
  const path = await buildPath(id);
  if (path === null) return res.status(404).json({ error: "Not Found" });
  path.reverse();
  res.json({ data: path });
}

async function buildPath(processId) {
  const current = await Process.findByPk(processId, {
    attributes: ["id", "code", "name", "parentProcessId", "orderInParent"],
  });
  if (!current) return null;

  const pathItem = {
    id: current.id,
    code: current.code,
    name: current.name,
    parentProcessId: current.parentProcessId ?? null,
    orderInParent: current.orderInParent,
  };

  if (!current.parentProcessId) return [pathItem];

  const parentPath = await buildPath(current.parentProcessId);
  return parentPath ? [...parentPath, pathItem] : null;
}

// ============================================================================
// PUBLIC API - SIPOC & Logigramme
// ============================================================================

export async function getSipocRows(req, res) {
  const id = validateUuid(req.params.id);
  await findProcessOr404(id, { attributes: ["id"] });

  const sipocData = await fetchSipocForProcess(id);
  res.json({ data: sipocData.rows });
}

export async function getLogigramme(req, res) {
  const id = validateUuid(req.params.id);

  const process = await findProcessOr404(id, {
    attributes: ["id", "code", "name", "logigramme"],
  });

  res.json({ data: { code: process.code, name: process.name, logigramme: process.logigramme } });
}

// ============================================================================
// PUBLIC API - Resolution & Lookup
// ============================================================================

export async function resolveCodes(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.json({ data: {} });

  const docs = await Process.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "code", "name"],
  });

  const map = Object.fromEntries(docs.map((d) => {
    const j = toJSON(d);
    return [j.id, { code: j.code, name: j.name }];
  }));

  res.json({ data: map });
}

export async function resolveIdByCode(req, res) {
  const { code } = req.params;

  const process = await Process.findOne({
    where: { code },
    attributes: ["id", "code", "name"],
  });

  if (!process) return res.status(404).json({ error: "Not Found" });

  const json = toJSON(process);
  res.json({ data: { id: json.id, code: json.code, name: json.name } });
}

// ============================================================================
// PUBLIC API - CRUD
// ============================================================================

function normalizePatchBody(body) {
  const normalized = { ...(body || {}) };

  const stakeholders = Object.prototype.hasOwnProperty.call(normalized, "stakeholders")
    ? normalized.stakeholders
    : undefined;
  delete normalized.stakeholders;

  if (normalized._id) {
    normalized.id = normalized._id;
    delete normalized._id;
  }

  if (normalized.parentProcessId === "") normalized.parentProcessId = null;

  return { body: normalized, stakeholders };
}

async function applyStakeholders(process, input) {
  const arr = Array.isArray(input) ? input : [];
  const names = [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];

  const instances = await Promise.all(names.map(async (name) => {
    const [s] = await Stakeholder.findOrCreate({
      where: { name },
      defaults: { name, isActive: true },
    });
    return s;
  }));

  await process.setStakeholders(instances);
}

export async function createProcess(req, res) {
  const { body, stakeholders } = normalizePatchBody(req.body);

  const created = await Process.create(body);
  if (stakeholders !== undefined) await applyStakeholders(created, stakeholders);

  const reloaded = await Process.findByPk(created.id, { include: processBaseIncludes() });
  res.status(201).json({ data: transformProcess(reloaded) });
}

export async function patchProcess(req, res) {
  const id = validateUuid(req.params.id);
  const { body, stakeholders } = normalizePatchBody(req.body);

  const [updated] = await Process.update(body, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });

  const process = await Process.findByPk(id);
  if (!process) return res.status(404).json({ error: "Not Found" });

  if (stakeholders !== undefined) await applyStakeholders(process, stakeholders);

  const reloaded = await Process.findByPk(id, { include: processBaseIncludes() });
  res.json({ data: transformProcess(reloaded) });
}

// ============================================================================
// PUBLIC API - SIPOC & Logigramme Updates
// ============================================================================

export async function replaceSipoc(req, res) {
  const id = validateUuid(req.params.id);
  const { sipoc } = req.body;

  await findProcessOr404(id, { attributes: ["id"] });

  let phasesInput = [];
  if (Array.isArray(sipoc?.phases)) phasesInput = sipoc.phases;
  else if (Array.isArray(sipoc?.rows)) phasesInput = [{ key: "default", name: "Phase unique", rows: sipoc.rows }];

  const [sipocRecord] = await Sipoc.findOrCreate({
    where: { processId: id },
    defaults: { processId: id },
  });

  await SipocPhase.destroy({ where: { sipocId: sipocRecord.id } });

  for (let phaseIndex = 0; phaseIndex < phasesInput.length; phaseIndex++) {
    const phaseDto = phasesInput[phaseIndex];

    const newPhase = await SipocPhase.create({
      sipocId: sipocRecord.id,
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
        ref: rowDto.ref ?? null,
        phase: rowDto.phase ?? phaseDto.name ?? null,
        numero: rowDto.numero != null ? String(rowDto.numero) : null,
        processusFournisseur: serializeArray(rowDto.processusFournisseur),
        entrees: rowDto.entrees ?? null,
        ressources: rowDto.ressources ?? null,
        raciR: rowDto.raciR ?? null,
        raciA: rowDto.raciA ?? null,
        raciC: rowDto.raciC ?? null,
        raciI: rowDto.raciI ?? null,
        designation: rowDto.designation ?? null,
        sorties: rowDto.sorties ?? null,
        processusClient: serializeArray(rowDto.processusClient),
        designationProcessusVendre: rowDto.designationProcessusVendre ?? null,
        activitePhase: rowDto.activitePhase ?? null,
        designationProcessusClient: serializeArray(rowDto.designationProcessusClient),
        sortiesProcessusClient: rowDto.sortiesProcessusClient ?? null,
      });
    }
  }

  const sipocData = await fetchSipocForProcess(id);
  res.json({ data: { id, sipoc: sipocData } });
}

export async function replaceLogigramme(req, res) {
  const id = validateUuid(req.params.id);
  const { logigramme } = req.body;

  const [updated] = await Process.update({ logigramme }, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });

  const process = await Process.findByPk(id);
  res.json({ data: toJSON(process) });
}

// ============================================================================
// PUBLIC API - Deletion
// ============================================================================

export async function deleteProcess(req, res) {
  const id = validateUuid(req.params.id);

  const deleted = await Process.destroy({ where: { id } });
  if (!deleted) return res.status(404).json({ error: "Not Found" });

  // Clean up SIPOC references to this deleted process
  await cleanSipocReferences(id);

  res.json({ data: { ok: true } });
}

/**
 * Remove a process ID from all SIPOC rows that reference it
 * in processusFournisseur, processusClient, or designationProcessusClient.
 */
async function cleanSipocReferences(processId) {
  const fields = ["processusFournisseur", "processusClient", "designationProcessusClient"];
  const rows = await SipocRow.findAll({
    where: {
      [Op.or]: fields.map((f) => ({
        [f]: { [Op.like]: `%${processId}%` },
      })),
    },
  });

  for (const row of rows) {
    let changed = false;
    for (const field of fields) {
      const arr = parseJsonArray(row[field]);
      const filtered = arr.filter((v) => v !== processId);
      if (filtered.length !== arr.length) {
        row[field] = filtered.length ? JSON.stringify(filtered) : null;
        changed = true;
      }
    }
    if (changed) await row.save();
  }
}

// ============================================================================
// ADMIN API - Process Pilots Management
// ============================================================================

export async function adminSetProcessPilots(req, res) {
  const id = validateUuid(req.params.id);
  const pilotIds = ensureArray(req.body?.pilotIds, "pilotIds must be an array");

  const process = await findProcessOr404(id);
  await ensureAllExist(Pilot, pilotIds, "pilot");

  await process.setPilots(pilotIds);
  res.json({ data: { ok: true, pilotIds } });
}

// ============================================================================
// ADMIN API - Process Stakeholders Management (with link fields)
// ============================================================================

export async function adminSetProcessStakeholders(req, res) {
  const id = validateUuid(req.params.id);
  const items = ensureArray(req.body?.items, "items must be an array");

  await findProcessOr404(id);

  const stakeholderIds = items.map((x) => x?.stakeholderId).filter(Boolean);
  await ensureAllExist(Stakeholder, stakeholderIds, "stakeholder");

  await ProcessStakeholder.destroy({ where: { processId: id } });

  const rows = items
    .filter((x) => x?.stakeholderId)
    .map((item) => ({
      processId: id,
      stakeholderId: item.stakeholderId,
      needs: normalizeText(item.needs),
      expectations: normalizeText(item.expectations),
      evaluationCriteria: normalizeText(item.evaluationCriteria),
      requirements: normalizeText(item.requirements),
      strengths: normalizeText(item.strengths),
      weaknesses: normalizeText(item.weaknesses),
      opportunities: normalizeText(item.opportunities),
      risks: normalizeText(item.risks),
      actionPlan: normalizeText(item.actionPlan),
    }));

  if (rows.length) await ProcessStakeholder.bulkCreate(rows);

  res.json({ data: { ok: true, count: rows.length } });
}
