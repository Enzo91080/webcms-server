import { Op } from "sequelize";
import { Process } from "../models/Process.js";

function normalizeSipoc(input) {
  const sipoc = input && typeof input === "object" ? input : {};
  const rows = Array.isArray(sipoc.rows) ? sipoc.rows : [];
  const phasesInput = Array.isArray(sipoc.phases) ? sipoc.phases : null;

  // If phases are provided and look valid, keep them but ensure each row has phase.
  if (phasesInput) {
    const phases = phasesInput
      .map((p, idx) => {
        const name = String(p?.name || p?.label || `Phase ${idx + 1}`);
        const key = String(p?.key || p?.id || name);
        const pr = Array.isArray(p?.rows) ? p.rows : [];
        return { key, name, rows: pr.map((r) => ({ ...r, phase: r?.phase || name })) };
      })
      .filter((p) => p.name);
    const flat = phases.flatMap((p) => p.rows);
    return { phases, rows: flat };
  }

  // Otherwise build phases from row.phase (or fallback)
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

  const phases = phaseOrder.map((name, idx) => ({
    key: `${idx + 1}`,
    name,
    rows: map.get(name) || [],
  }));

  return { phases, rows: phases.flatMap((p) => p.rows) };
}


function toUuid(id) {
  if (!id || typeof id !== "string") {
    const err = new Error("Invalid id");
    err.statusCode = 400;
    throw err;
  }
  return id;
}

export async function getCartography(req, res) {
  const roots = await Process.findAll({
    where: { parentProcessId: null, isActive: true },
    order: [["orderInParent", "ASC"]],
    attributes: ["id", "code", "name", "title", "orderInParent", "isActive"],
  });
  res.json({ data: roots.map(item => item.toJSON()) });
}

export async function getByCode(req, res) {
  const { code } = req.params;
  const p = await Process.findOne({
    where: { code },
    include: [{
      model: Process,
      as: "children",
      attributes: ["id", "code", "name", "title", "orderInParent", "isActive"],
      order: [["orderInParent", "ASC"]],
    }],
  });
  if (!p) return res.status(404).json({ error: "Not Found" });

  const json = p.toJSON();
  if (json.children) {
    json.children = json.children.map(child => child.toJSON ? child.toJSON() : child);
  }
  res.json({ data: json });
}

export async function getById(req, res) {
  const id = toUuid(req.params.id);
  const p = await Process.findByPk(id, {
    include: [{
      model: Process,
      as: "children",
      attributes: ["id", "code", "name", "title", "orderInParent", "isActive"],
      order: [["orderInParent", "ASC"]],
    }],
  });
  if (!p) return res.status(404).json({ error: "Not Found" });

  const json = p.toJSON();
  if (json.children) {
    json.children = json.children.map(child => child.toJSON ? child.toJSON() : child);
  }
  res.json({ data: json });
}

export async function getHierarchy(req, res) {
  const id = toUuid(req.params.id);

  async function getDescendants(processId) {
    const process = await Process.findByPk(processId, {
      attributes: ["id", "code", "name", "title", "parentProcessId", "orderInParent"],
    });
    if (!process) return null;

    const children = await Process.findAll({
      where: { parentProcessId: processId },
      attributes: ["id", "code", "name", "title", "parentProcessId", "orderInParent"],
      order: [["orderInParent", "ASC"]],
    });

    const descendants = await Promise.all(children.map((child) => getDescendants(child.id)));
    const json = process.toJSON();
    return {
      ...json,
      descendants: descendants.filter(Boolean).map(d => d.toJSON ? d.toJSON() : d),
    };
  }

  const result = await getDescendants(id);
  if (!result) return res.status(404).json({ error: "Not Found" });
  res.json({ data: result });
}

export async function getPath(req, res) {
  const id = toUuid(req.params.id);
  const path = [];
  let current = await Process.findByPk(id, {
    attributes: ["id", "code", "name", "parentProcessId", "orderInParent"],
  });
  if (!current) return res.status(404).json({ error: "Not Found" });

  while (current) {
    path.push({
      id: current.id,
      code: current.code,
      name: current.name,
      parentProcessId: current.parentProcessId ?? null,
      orderInParent: current.orderInParent,
    });
    if (!current.parentProcessId) break;
    current = await Process.findByPk(current.parentProcessId, {
      attributes: ["id", "code", "name", "parentProcessId", "orderInParent"],
    });
  }

  path.reverse();
  res.json({ data: path });
}

export async function getSipocRows(req, res) {
  const id = toUuid(req.params.id);
  const p = await Process.findByPk(id, { attributes: ["id", "sipoc"] });
  if (!p) return res.status(404).json({ error: "Not Found" });
  const rows = p.sipoc?.rows || [];
  res.json({ data: rows });
}

export async function getLogigramme(req, res) {
  const id = toUuid(req.params.id);
  const p = await Process.findByPk(id, { attributes: ["id", "code", "name", "logigramme"] });
  if (!p) return res.status(404).json({ error: "Not Found" });
  res.json({ data: { code: p.code, name: p.name, logigramme: p.logigramme } });
}

export async function resolveCodes(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const docs = await Process.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "code", "name"],
  });
  const map = {};
  for (const d of docs) {
    const json = d.toJSON();
    map[json.id] = { code: json.code, name: json.name };
  }
  res.json({ data: map });
}

export async function resolveIdByCode(req, res) {
  const { code } = req.params;
  const p = await Process.findOne({ where: { code }, attributes: ["id", "code", "name"] });
  if (!p) return res.status(404).json({ error: "Not Found" });
  const json = p.toJSON();
  res.json({ data: { id: json.id, code: json.code, name: json.name } });
}

export async function createProcess(req, res) {
  const body = { ...req.body };
  if (body._id) {
    body.id = body._id;
    delete body._id;
  }
  const created = await Process.create(body);
  res.status(201).json({ data: created.toJSON() });
}

export async function patchProcess(req, res) {
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

export async function replaceSipoc(req, res) {
  const id = toUuid(req.params.id);
  const { sipoc } = req.body;
  const normalized = normalizeSipoc(sipoc);
  const [updated] = await Process.update({ sipoc: normalized }, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });
  const process = await Process.findByPk(id);
  res.json({ data: process.toJSON() });
}

export async function replaceLogigramme(req, res) {
  const id = toUuid(req.params.id);
  const { logigramme } = req.body;
  const [updated] = await Process.update({ logigramme }, { where: { id } });
  if (!updated) return res.status(404).json({ error: "Not Found" });
  const process = await Process.findByPk(id);
  res.json({ data: process.toJSON() });
}

export async function deleteProcess(req, res) {
  const id = toUuid(req.params.id);
  const deleted = await Process.destroy({ where: { id } });
  if (!deleted) return res.status(404).json({ error: "Not Found" });
  res.json({ data: { ok: true } });
}
