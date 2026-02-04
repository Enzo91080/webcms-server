import { Stakeholder } from "../models/Stakeholder.js";
import { Process } from "../models/Process.js";

function validateUuid(id) {
  if (!id || typeof id !== "string") {
    const err = new Error("Invalid id");
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function toJSON(model) {
  return model?.toJSON ? model.toJSON() : model;
}

function normalizeText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

const STAKEHOLDER_ATTRS = [
  "id",
  "name",
  "isActive",
  "needs",
  "expectations",
  "evaluationCriteria",
  "requirements",
  "strengths",
  "weaknesses",
  "opportunities",
  "risks",
  "actionPlan",
  "createdAt",
  "updatedAt",
];

export async function adminListStakeholders(req, res) {
  try {
    const items = await Stakeholder.findAll({
      order: [["name", "ASC"]],
      attributes: STAKEHOLDER_ATTRS,
      include: [
        { model: Process, as: "processes", attributes: ["id"], through: { attributes: [] } },
      ],
    });

    const data = items.map((item) => {
      const json = toJSON(item);
      json.processIds = (json.processes || []).map((p) => p.id);
      delete json.processes;
      return json;
    });

    res.json({ data });
  } catch (e) {
    console.error("adminListStakeholders error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


export async function adminCreateStakeholder(req, res) {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  // Optional fields
  const defaults = {
    name,
    isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : true,

    needs: normalizeText(req.body?.needs),
    expectations: normalizeText(req.body?.expectations),
    evaluationCriteria: normalizeText(req.body?.evaluationCriteria),
    requirements: normalizeText(req.body?.requirements),
    strengths: normalizeText(req.body?.strengths),
    weaknesses: normalizeText(req.body?.weaknesses),
    opportunities: normalizeText(req.body?.opportunities),
    risks: normalizeText(req.body?.risks),
    actionPlan: normalizeText(req.body?.actionPlan),
  };

  const [item, created] = await Stakeholder.findOrCreate({
    where: { name },
    defaults,
  });

  // If it already exists, we keep behavior minimal: return existing record (no overwrite).
  // If you WANT to update existing when findOrCreate hits, do it explicitly here.

  const fresh = await Stakeholder.findByPk(item.id, { attributes: STAKEHOLDER_ATTRS });
  res.status(created ? 201 : 200).json({ data: toJSON(fresh) });
}

export async function adminPatchStakeholder(req, res) {
  const id = validateUuid(req.params.id);
  const patch = {};

  if (typeof req.body?.name === "string") {
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({ error: "name cannot be empty" });
    patch.name = name;
  }

  if (typeof req.body?.isActive === "boolean") {
    patch.isActive = req.body.isActive;
  }

  // New text fields (accept string OR null to clear)
  const textFields = [
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

  for (const key of textFields) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
      const v = req.body[key];
      if (v === null) patch[key] = null;
      else if (typeof v === "string") patch[key] = normalizeText(v);
      else {
        return res.status(400).json({ error: `${key} must be a string or null` });
      }
    }
  }

  const [updated] = await Stakeholder.update(patch, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });

  const item = await Stakeholder.findByPk(id, { attributes: STAKEHOLDER_ATTRS });
  res.json({ data: toJSON(item) });
}

export async function adminDeleteStakeholder(req, res) {
  const id = validateUuid(req.params.id);
  const deleted = await Stakeholder.destroy({ where: { id } });
  if (!deleted) return res.status(404).json({ error: "Not Found" });
  res.json({ data: { ok: true } });
}

export async function adminSetStakeholderProcesses(req, res) {
  const id = validateUuid(req.params.id);

  const processIds = req.body?.processIds;
  if (!Array.isArray(processIds)) {
    return res.status(400).json({ error: "processIds must be an array" });
  }

  const stakeholder = await Stakeholder.findByPk(id);
  if (!stakeholder) {
    return res.status(404).json({ error: "Stakeholder not found" });
  }

  // Validate that all processIds exist
  if (processIds.length > 0) {
    const existingProcesses = await Process.findAll({
      where: { id: processIds },
      attributes: ["id"],
    });
    const existingIds = new Set(existingProcesses.map((p) => p.id));
    const invalidIds = processIds.filter((pid) => !existingIds.has(pid));
    if (invalidIds.length > 0) {
      return res
        .status(400)
        .json({ error: `Invalid process IDs: ${invalidIds.join(", ")}` });
    }
  }

  await stakeholder.setProcesses(processIds);

  res.json({ data: { ok: true, processIds } });
}
