import { Stakeholder } from "../models/Stakeholder.js";
import { Process } from "../models/Process.js";
import { ProcessStakeholder } from "../models/ProcessStakeholder.js";

// Champs de la table de jointure
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

// Note: Les champs métier (needs, expectations, etc.) sont maintenant stockés
// dans la table de jointure process_stakeholders, pas dans stakeholders.
// Ils ne sont plus retournés ici.
const STAKEHOLDER_ATTRS = [
  "id",
  "name",
  "isActive",
  "createdAt",
  "updatedAt",
];

export async function adminListStakeholders(req, res) {
  try {
    const items = await Stakeholder.findAll({
      order: [["name", "ASC"]],
      attributes: STAKEHOLDER_ATTRS,
      include: [
        {
          model: Process,
          as: "processes",
          attributes: ["id", "code", "name"],
          through: { attributes: LINK_FIELDS },
        },
      ],
    });

    const data = items.map((item) => {
      const json = toJSON(item);
      // Format: processes: [{ id, code, name, link: { needs, ... } }]
      json.processes = (json.processes || []).map((p) => {
        const linkData = p.ProcessStakeholder || {};
        const link = {};
        for (const field of LINK_FIELDS) {
          link[field] = linkData[field] ?? null;
        }
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          link,
        };
      });
      json.processIds = json.processes.map((p) => p.id);
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

  // Note: Les champs métier sont maintenant dans la table de jointure process_stakeholders
  const defaults = {
    name,
    isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : true,
  };

  const [item, created] = await Stakeholder.findOrCreate({
    where: { name },
    defaults,
  });

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

  // Note: Les champs métier sont maintenant dans la table de jointure process_stakeholders
  // Ils ne sont plus gérés ici.

  if (Object.keys(patch).length === 0) {
    // Rien à mettre à jour, retourner l'item actuel
    const item = await Stakeholder.findByPk(id, { attributes: STAKEHOLDER_ATTRS });
    if (!item) return res.status(404).json({ error: "Not Found" });
    return res.json({ data: toJSON(item) });
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

/**
 * Sets the processes for a stakeholder with enriched link fields.
 * PUT /api/admin/stakeholders/:id/processes
 *
 * Accepte deux formats de body :
 * - Legacy: { processIds: string[] } - juste les IDs sans champs de lien
 * - New: { items: [{ processId, needs, expectations, ... }] } - avec champs de lien
 *
 * Behavior: "replace" - deletes missing links, upserts present ones.
 */
export async function adminSetStakeholderProcesses(req, res) {
  const id = validateUuid(req.params.id);

  const stakeholder = await Stakeholder.findByPk(id);
  if (!stakeholder) {
    return res.status(404).json({ error: "Stakeholder not found" });
  }

  // Support legacy format (processIds array) and new format (items array)
  let items = [];
  if (Array.isArray(req.body?.items)) {
    items = req.body.items;
  } else if (Array.isArray(req.body?.processIds)) {
    // Legacy format: convert to items without link fields
    items = req.body.processIds.map((processId) => ({ processId }));
  } else {
    return res.status(400).json({ error: "items or processIds must be an array" });
  }

  // Validate all processIds exist
  const processIds = items.map((item) => item.processId).filter(Boolean);
  const uniqueIds = [...new Set(processIds)];

  if (uniqueIds.length > 0) {
    const existingProcesses = await Process.findAll({
      where: { id: uniqueIds },
      attributes: ["id"],
    });
    const existingIds = new Set(existingProcesses.map((p) => p.id));
    const invalidIds = uniqueIds.filter((pid) => !existingIds.has(pid));
    if (invalidIds.length > 0) {
      return res
        .status(400)
        .json({ error: `Invalid process IDs: ${invalidIds.join(", ")}` });
    }
  }

  // Delete all existing links for this stakeholder
  await ProcessStakeholder.destroy({ where: { stakeholderId: id } });

  // Create new links with enriched fields
  const createdLinks = [];
  for (const item of items) {
    if (!item.processId) continue;

    const linkData = {
      processId: item.processId,
      stakeholderId: id,
      needs: normalizeText(item.needs),
      expectations: normalizeText(item.expectations),
      evaluationCriteria: normalizeText(item.evaluationCriteria),
      requirements: normalizeText(item.requirements),
      strengths: normalizeText(item.strengths),
      weaknesses: normalizeText(item.weaknesses),
      opportunities: normalizeText(item.opportunities),
      risks: normalizeText(item.risks),
      actionPlan: normalizeText(item.actionPlan),
    };

    const created = await ProcessStakeholder.create(linkData);
    createdLinks.push(created);
  }

  res.json({ data: { ok: true, count: createdLinks.length } });
}
