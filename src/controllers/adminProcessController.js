import { Process } from "../models/Process.js";

function toUuid(id) {
  if (!id || typeof id !== "string") {
    const err = new Error("Invalid id");
    err.statusCode = 400;
    throw err;
  }
  return id;
}

export async function listAll(req, res) {
  const items = await Process.findAll({
    order: [["parentProcessId", "ASC"], ["orderInParent", "ASC"], ["code", "ASC"]],
    attributes: ["id", "code", "name", "parentProcessId", "orderInParent", "isActive", "updatedAt", "createdAt"],
  });
  res.json({ data: items.map(item => item.toJSON()) });
}

export async function getOne(req, res) {
  const id = toUuid(req.params.id);
  const item = await Process.findByPk(id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  res.json({ data: item.toJSON() });
}

export async function createOne(req, res) {
  const body = { ...req.body };
  if (body._id) {
    body.id = body._id;
    delete body._id;
  }
  const created = await Process.create(body);
  res.status(201).json({ data: created.toJSON() });
}

export async function patchOne(req, res) {
  const id = toUuid(req.params.id);
  const body = { ...req.body };
  if (body._id) {
    body.id = body._id;
    delete body._id;
  }
  if (body.parentProcessId === "") body.parentProcessId = null;

  const [updated] = await Process.update(body, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });
  const process = await Process.findByPk(id);
  res.json({ data: process.toJSON() });
}

export async function deleteOne(req, res) {
  const id = toUuid(req.params.id);
  const deleted = await Process.destroy({ where: { id } });
  if (!deleted) return res.status(404).json({ error: "Not Found" });
  res.json({ data: { ok: true } });
}
