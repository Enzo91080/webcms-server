// Central place to register models and define associations.
// This module is imported by connectDb() BEFORE sequelize.sync() runs.

import { Process } from "./Process.js";
import { User } from "./User.js";
import { Stakeholder } from "./Stakeholder.js";
import { Sipoc } from "./Sipoc.js";
import { SipocPhase } from "./SipocPhase.js";
import { SipocRow } from "./SipocRow.js";

// Self-referential hierarchy (already used by controllers)
Process.hasMany(Process, { foreignKey: "parentProcessId", as: "children" });
Process.belongsTo(Process, { foreignKey: "parentProcessId", as: "parent" });

// Process <-> Stakeholder (many-to-many)
Process.belongsToMany(Stakeholder, {
  through: "process_stakeholders",
  as: "stakeholders",
  foreignKey: "processId",
  otherKey: "stakeholderId",
});

Stakeholder.belongsToMany(Process, {
  through: "process_stakeholders",
  as: "processes",
  foreignKey: "stakeholderId",
  otherKey: "processId",
});

// Process <-> Sipoc (one-to-one)
Process.hasOne(Sipoc, { as: "sipoc", foreignKey: "processId" });
Sipoc.belongsTo(Process, { as: "process", foreignKey: "processId" });

// Sipoc <-> SipocPhase (one-to-many)
Sipoc.hasMany(SipocPhase, { as: "phases", foreignKey: "sipocId", onDelete: "CASCADE" });
SipocPhase.belongsTo(Sipoc, { as: "sipoc", foreignKey: "sipocId" });

// SipocPhase <-> SipocRow (one-to-many)
SipocPhase.hasMany(SipocRow, { as: "rows", foreignKey: "sipocPhaseId", onDelete: "CASCADE" });
SipocRow.belongsTo(SipocPhase, { as: "sipocPhase", foreignKey: "sipocPhaseId" });

// Exporting models is optional here; the imports above are enough to register them.
export { Process, User, Stakeholder, Sipoc, SipocPhase, SipocRow };
