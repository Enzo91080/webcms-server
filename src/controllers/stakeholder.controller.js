import { Stakeholder } from "../models/Stakeholder.js";

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

export async function adminListStakeholders(req, res) {
  const items = await Stakeholder.findAll({
    order: [["name", "ASC"]],
    attributes: ["id", "name", "isActive", "createdAt", "updatedAt"],
  });
  res.json({ data: items.map(toJSON) });
}

export async function adminCreateStakeholder(req, res) {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const [item] = await Stakeholder.findOrCreate({
    where: { name },
    defaults: { name, isActive: true },
  });

  res.status(201).json({ data: toJSON(item) });
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

  const [updated] = await Stakeholder.update(patch, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });

  const item = await Stakeholder.findByPk(id, {
    attributes: ["id", "name", "isActive", "createdAt", "updatedAt"],
  });
  res.json({ data: toJSON(item) });
}

export async function adminDeleteStakeholder(req, res) {
  const id = validateUuid(req.params.id);
  const deleted = await Stakeholder.destroy({ where: { id } });
  if (!deleted) return res.status(404).json({ error: "Not Found" });
  res.json({ data: { ok: true } });
}
