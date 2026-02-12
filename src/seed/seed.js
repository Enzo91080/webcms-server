import { sequelize } from "../config/db.js";
import { env } from "../config/env.js";
import "../models/initModels.js";
import { Process } from "../models/Process.js";
import { User } from "../models/User.js";
import { Stakeholder } from "../models/Stakeholder.js";
import { Pilot } from "../models/Pilot.js";
import { Sipoc } from "../models/Sipoc.js";
import { SipocPhase } from "../models/SipocPhase.js";
import { SipocRow } from "../models/SipocRow.js";
import { ProcessStakeholder } from "../models/ProcessStakeholder.js";
import { CartographyLayout } from "../models/CartographyLayout.js";
import { CartographyPanelConfig } from "../models/CartographyPanelConfig.js";
import { hashPassword } from "../utils/auth.js";

function md(lines) {
  return lines.join("\n");
}

function urlDoc(slug) {
  return `https://example.com/${slug}`;
}

function urlProcess(code) {
  return `/process/${code}`;
}

function buildLogigrammeFromSipoc(
  rows,
  { startX = 80, startY = 40, colWidth = 360, rowHeight = 120, wrapAt = 6 } = {}
) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const nodes = safeRows.map((r, i) => {
    const ref = String(r.ref || `STEP-${i + 1}`);
    const label = String(r?.designation?.name || ref);
    const col = Math.floor(i / wrapAt);
    const row = i % wrapAt;

    return {
      id: ref,
      sipocRef: ref,
      shape: "rectangle",
      label,
      position: { x: startX + col * colWidth, y: startY + row * rowHeight },
    };
  });

  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `e${i + 1}`,
    from: n.id,
    to: nodes[i + 1].id,
    label: "",
  }));

  const legend = [
    { key: "1", label: "Manager l'entreprise", color: "#64748b" },
    { key: "2", label: "Vendre", color: "#f59e0b" },
    { key: "3", label: "Planifier", color: "#e879f9" },
    { key: "4", label: "Manager le Programme", color: "#0ea5e9" },
    { key: "5", label: "Réaliser", color: "#475569" },
    { key: "6", label: "Valider", color: "#84cc16" },
  ];

  return {
    entryNodeId: nodes[0]?.id || null,
    nodes,
    edges: edges.map((e) => ({
      ...e,
      kind: "orthogonal",
      width: 2,
      color: "#f59ad5",
    })),
    legend,
  };
}

/**
 * Creates SIPOC entries in the normalized tables (Sipoc, SipocPhase, SipocRow)
 */
async function createSipocForProcess(processId, phasesData) {
  const existingSipoc = await Sipoc.findOne({ where: { processId } });
  if (existingSipoc) {
    await SipocPhase.destroy({ where: { sipocId: existingSipoc.id } });
    await existingSipoc.destroy();
  }

  const sipoc = await Sipoc.create({ processId });

  for (let phaseIndex = 0; phaseIndex < phasesData.length; phaseIndex++) {
    const phaseData = phasesData[phaseIndex];

    const phase = await SipocPhase.create({
      sipocId: sipoc.id,
      key: phaseData.key || `PH-${phaseIndex + 1}`,
      name: phaseData.name || `Phase ${phaseIndex + 1}`,
      order: phaseIndex,
    });

    const rows = phaseData.rows || [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const rowData = rows[rowIndex];

      await SipocRow.create({
        sipocPhaseId: phase.id,
        order: rowIndex,
        ref: rowData.ref || null,
        phase: rowData.phase || phaseData.name || null,
        numero: rowData.numero != null ? String(rowData.numero) : null,
        processusFournisseur: rowData.processusFournisseur || null,
        entrees: rowData.entrees || null,
        ressources: rowData.ressources || null,
        designation: rowData.designation || null,
        sorties: rowData.sorties || null,
        processusClient: rowData.processusClient || null,
        designationProcessusVendre: rowData.designationProcessusVendre || rowData.designation || null,
        activitePhase: rowData.activitePhase || rowData.designation || null,
        designationProcessusClient: rowData.designationProcessusClient || rowData.processusClient || null,
        sortiesProcessusClient: rowData.sortiesProcessusClient || null,
        raci_r: rowData.raci_r || null,
        raci_a: rowData.raci_a || null,
        raci_c: rowData.raci_c || null,
        raci_i: rowData.raci_i || null,
      });
    }
  }

  return sipoc;
}

async function run() {
  await sequelize.authenticate();
  console.log("[seed] connected");

  await sequelize.sync({ force: false });
  console.log("[seed] database synchronized");

  // ─── USERS ──────────────────────────────────────────────────
  await User.destroy({ where: {} });
  const adminPassword = await hashPassword(env.adminPassword);
  await User.bulkCreate([
    {
      email: env.adminEmail,
      passwordHash: adminPassword,
      role: "admin",
      name: "Administrateur",
    },
    {
      email: "enzo.aime91@gmail.com",
      passwordHash: await hashPassword("Admin123!"),
      role: "admin",
      name: "Enzo",
    },
  ]);
  console.log("[seed] users created");

  // ─── PILOTS ─────────────────────────────────────────────────
  await sequelize.models.Pilot.destroy({ where: {}, truncate: true, cascade: true }).catch(() =>
    Pilot.destroy({ where: {} })
  );
  const pilots = await Pilot.bulkCreate(
    [
      { name: "Enzo AIME" },
      { name: "Gérard Philippe" },
    ],
    { returning: true }
  );
  console.log("[seed] pilots created");

  const pilotByName = (name) => pilots.find((p) => p.name === name);

  // ─── STAKEHOLDERS ──────────────────────────────────────────
  await ProcessStakeholder.destroy({ where: {} });
  await Stakeholder.destroy({ where: {} });

  const stakeholderNames = [
    "Direction",
    "Finance",
    "RH",
    "Commercial",
    "Avant-vente",
    "Programme",
    "Operations",
    "PMO",
    "Client",
    "Juridique",
    "Qualité",
    "ADV",
  ];

  const stakeholders = await Stakeholder.bulkCreate(
    stakeholderNames.map((name) => ({ name, isActive: true })),
    { returning: true }
  );
  console.log("[seed] stakeholders created");

  const stk = (name) => stakeholders.find((s) => s.name === name);

  // ─── CLEAN PROCESSES & SIPOC ────────────────────────────────
  await SipocRow.destroy({ where: {} });
  await SipocPhase.destroy({ where: {} });
  await Sipoc.destroy({ where: {} });
  await CartographyLayout.destroy({ where: {} });
  await Process.destroy({ where: {} });
  console.log("[seed] cleaned existing data");

  // ─── ROOT PROCESSES ─────────────────────────────────────────
  const rootsPayload = [
    {
      code: "MNGT",
      name: "Manager l'entreprise",
      title: "Définir la strategie, piloter l'entreprise et assurer la conformite.",
      orderInParent: 1,
      processType: "internal",
      objectives: md([
        "1. Definir la strategie de l'entreprise, c'est definir :",
        "2. l'OP",
        "3. la Politique qualite",
        "4. Les objectifs de la societe",
        "5. La Communication",
        "6. L'adequation charge/capacite des Ressources Humaines",
        "7. Piloter les finances",
        "8.Piloter les Ressources Humaines",
        "9. Mettre en oeuvre la communication",
        "10. Piloter l'amelioration et la realisation des objectifs",
        "11. S'assurer de la disponibilite des moyens",
        "12. Assurer la gestion de la documentation",
        "13. Maintenir la licence operateur (repondre aux prescriptions annuelles)",
        "14. Piloter la chaine de valeur",
      ]),
      objectivesBlocks: [
        { text: "Definir la strategie de l'entreprise, c'est definir :", type: "text" },
        {
          type: "numbered",
          items: [
            "l'OP",
            "la Politique qualite",
            "les objectifs de la societe",
            "la Communication",
            "l'adequation charge/capacite des Ressources Humaines",
            "Piloter les Ressources Humaines",
            "Mettre en oeuvre la communication",
            "Piloter l'amelioration et la realisation des objectifs",
            "S'assurer de la disponibilite des moyens",
            "Assurer la gestion de la documentation",
            "Maintenir la licence operateur (repondre aux prescriptions annuelles)",
            "Piloter la chaine de valeur",
          ],
        },
      ],
      referenceDocuments: [],
      cartoSlot: "manager",
      cartoOrder: 1,
      stakeholderNames: ["Direction", "Client", "Qualité", "ADV"],
      pilotNames: ["Enzo AIME"],
    },
    {
      code: "VEN",
      name: "Vendre",
      title: "Transformer des opportunites en contrats et commandes.",
      orderInParent: 2,
      processType: "internal",
      objectives: md([
        "- Prospecter et qualifier les opportunites.",
        "- Construire une offre conforme au besoin.",
        "- Negocier et contractualiser.",
        "- Transmettre a la planification / execution.",
      ]),
      objectivesBlocks: [],
      referenceDocuments: [],
      cartoSlot: "value_chain",
      cartoOrder: 2,
      stakeholderNames: ["Finance", "Commercial", "Avant-vente", "ADV"],
    },
    {
      code: "PLA",
      name: "Planifier",
      title: "Organiser la charge, la capacite et le planning.",
      orderInParent: 3,
      processType: "internal",
      objectives: md(["- Collecter les besoins.", "- Allouer les ressources.", "- Publier un planning valide."]),
      objectivesBlocks: [],
      referenceDocuments: [],
      cartoSlot: "value_chain",
      cartoOrder: 3,
      stakeholderNames: ["RH", "Programme", "Operations"],
    },
    {
      code: "PROG",
      name: "Manager le Programme",
      title: "Gouverner, piloter la performance et les risques.",
      orderInParent: 4,
      processType: "internal",
      objectives: md(["- Assurer la gouvernance.", "- Suivre les KPI.", "- Gerer les risques et arbitrages."]),
      objectivesBlocks: [],
      referenceDocuments: [],
      cartoSlot: "value_chain",
      cartoOrder: 4,
      stakeholderNames: ["Direction", "PMO"],
    },
    {
      code: "MIS",
      name: "Realiser",
      title: "Executer les activites, controler la qualite et livrer.",
      orderInParent: 5,
      processType: "internal",
      objectives: md(["- Executer les taches.", "- Controler la qualite.", "- Livrer conformement aux engagements."]),
      objectivesBlocks: [],
      referenceDocuments: [],
      cartoSlot: "value_chain",
      cartoOrder: 5,
      stakeholderNames: ["Operations", "Client"],
    },
    {
      code: "VLD",
      name: "Valider",
      title: "Recetter, valider et cloturer.",
      orderInParent: 6,
      processType: "internal",
      objectives: md(["- Preparer et executer la recette.", "- Valider la conformite.", "- Capitaliser et cloturer."]),
      objectivesBlocks: [],
      referenceDocuments: [],
      cartoSlot: "value_chain",
      cartoOrder: 6,
      stakeholderNames: ["Programme", "Client"],
    },
  ];

  const roots = await Process.bulkCreate(
    rootsPayload.map(({ stakeholderNames: _s, pilotNames: _p, cartoSlot: _cs, cartoOrder: _co, ...p }) => p),
    { returning: true }
  );

  // Create CartographyLayout entries
  for (const rp of rootsPayload) {
    const proc = roots.find((r) => r.code === rp.code);
    if (proc && rp.cartoSlot) {
      await CartographyLayout.create({
        slotKey: rp.cartoSlot,
        slotOrder: rp.cartoOrder,
        processId: proc.id,
        isActive: true,
      });
    }
  }

  // Create CartographyPanelConfig (mode: "all" = show all stakeholders)
  await CartographyPanelConfig.destroy({ where: {} }).catch(() => {});
  await CartographyPanelConfig.bulkCreate([
    { panelKey: "left_panel", mode: "all" },
    { panelKey: "right_panel", mode: "all" },
  ]).catch(() => {});

  // Attach stakeholders to root processes
  for (const rp of rootsPayload) {
    const proc = roots.find((r) => r.code === rp.code);
    if (!proc) continue;
    for (const sName of rp.stakeholderNames || []) {
      const s = stk(sName);
      if (s) await ProcessStakeholder.create({ processId: proc.id, stakeholderId: s.id });
    }
    // Attach pilots
    for (const pName of rp.pilotNames || []) {
      const p = pilotByName(pName);
      if (p) await proc.addPilot(p);
    }
  }

  const byCode = (list, code) => list.find((x) => x.code === code);
  const MNGT = byCode(roots, "MNGT");
  const VEN = byCode(roots, "VEN");
  const PLA = byCode(roots, "PLA");
  const PROG = byCode(roots, "PROG");
  const MIS = byCode(roots, "MIS");
  const VLD = byCode(roots, "VLD");

  console.log("[seed] root processes + cartography layout created");

  const getParentId = (process) => {
    if (!process) return null;
    return String(process.id || process.dataValues?.id || process.get?.("id"));
  };

  // ─── SUB-PROCESSES ──────────────────────────────────────────
  const subsPayload = [
    // MNGT children
    { code: "MNGT-SP01", name: "Definir la strategie", title: "Formaliser la strategie et les objectifs.", parentProcessId: getParentId(MNGT), orderInParent: 1, processType: "internal", stakeholderNames: ["Direction"] },
    { code: "MNGT-SP02", name: "Piloter les finances", title: "Suivre le budget, tresorerie, investissements.", parentProcessId: getParentId(MNGT), orderInParent: 2, processType: "internal", stakeholderNames: ["Finance"] },
    { code: "MNGT-SP03", name: "Piloter les Ressources Humaines", title: "Gerer les effectifs, competences, charge/capacite.", parentProcessId: getParentId(MNGT), orderInParent: 3, processType: "internal", stakeholderNames: ["RH"] },
    // VEN children
    { code: "VEN-SP0201", name: "Prospecter", title: "Identifier et contacter des prospects.", parentProcessId: getParentId(VEN), orderInParent: 1, processType: "internal", stakeholderNames: ["Commercial"] },
    { code: "VEN-SP0202", name: "Qualifier", title: "Qualifier les besoins et la faisabilite.", parentProcessId: getParentId(VEN), orderInParent: 2, processType: "internal", stakeholderNames: ["Commercial", "Avant-vente"] },
    { code: "VEN-SP0203", name: "Contractualiser", title: "Negocier et finaliser le contrat.", parentProcessId: getParentId(VEN), orderInParent: 3, processType: "internal", stakeholderNames: ["Commercial", "Juridique", "ADV"] },
    // PLA children
    { code: "PLA-SP0301", name: "Collecter les demandes", title: "Collecter et consolider les besoins.", parentProcessId: getParentId(PLA), orderInParent: 1, processType: "internal", stakeholderNames: ["Programme"] },
    { code: "PLA-SP0302", name: "Allouer les ressources", title: "Allouer capacite et moyens.", parentProcessId: getParentId(PLA), orderInParent: 2, processType: "internal", stakeholderNames: ["RH", "Operations"] },
    { code: "PLA-SP0303", name: "Valider le planning", title: "Arbitrer et publier un planning.", parentProcessId: getParentId(PLA), orderInParent: 3, processType: "internal", stakeholderNames: ["Direction", "Programme"] },
    // PROG children
    { code: "SP0401", name: "Gouvernance", title: "Organiser comites et decisions.", parentProcessId: getParentId(PROG), orderInParent: 1, processType: "internal", stakeholderNames: ["Direction", "PMO"], pilotNames: ["Enzo AIME"] },
    { code: "SP0402", name: "Suivi KPI", title: "Suivre indicateurs et performance.", parentProcessId: getParentId(PROG), orderInParent: 2, processType: "internal", stakeholderNames: ["PMO"] },
    { code: "SP0403", name: "Gestion des risques", title: "Identifier, traiter et suivre les risques.", parentProcessId: getParentId(PROG), orderInParent: 3, processType: "internal", stakeholderNames: ["PMO", "Operations"] },
    // MIS children
    { code: "SP0501", name: "Executer", title: "Realiser les activites prevues.", parentProcessId: getParentId(MIS), orderInParent: 1, processType: "internal", stakeholderNames: ["Operations"] },
    { code: "SP0502", name: "Controler la qualite", title: "Controler conformite et traiter non-conformites.", parentProcessId: getParentId(MIS), orderInParent: 2, processType: "internal", stakeholderNames: ["Operations"] },
    { code: "SP0503", name: "Livrer", title: "Preparer et livrer le resultat.", parentProcessId: getParentId(MIS), orderInParent: 3, processType: "internal", stakeholderNames: ["Operations", "Client"] },
    // VLD children
    { code: "SP0601", name: "Recetter", title: "Preparer et executer la recette.", parentProcessId: getParentId(VLD), orderInParent: 1, processType: "internal", stakeholderNames: ["Client"], pilotNames: ["Gérard Philippe"] },
    { code: "SP0602", name: "Valider conformite", title: "Valider conformite et accepter.", parentProcessId: getParentId(VLD), orderInParent: 2, processType: "internal", stakeholderNames: ["Client"] },
    { code: "SP0603", name: "Cloturer", title: "Cloturer et capitaliser.", parentProcessId: getParentId(VLD), orderInParent: 3, processType: "internal", stakeholderNames: ["Programme"] },
  ];

  const subs = await Process.bulkCreate(
    subsPayload.map(({ stakeholderNames: _s, pilotNames: _p, ...p }) => p),
    { returning: true }
  );

  // Attach stakeholders & pilots to sub-processes
  for (const sp of subsPayload) {
    const proc = subs.find((x) => x.code === sp.code);
    if (!proc) continue;
    for (const sName of sp.stakeholderNames || []) {
      const s = stk(sName);
      if (s) await ProcessStakeholder.create({ processId: proc.id, stakeholderId: s.id });
    }
    for (const pName of sp.pilotNames || []) {
      const p = pilotByName(pName);
      if (p) await proc.addPilot(p);
    }
  }

  console.log("[seed] sub-processes created");

  const get = (code) => [...roots, ...subs].find((p) => p.code === code);

  // ─── SIPOC DATA ─────────────────────────────────────────────
  const SIPOC_DATA = {
    MNGT: {
      phases: [
        {
          key: "P01-PH1",
          name: "Phase 1 - Cadrer",
          rows: [
            { ref: "MAN-01", phase: "Phase 1 - Cadrer", processusFournisseur: "Direction", entrees: "Contexte / données", numero: "1", ressources: "Tableaux de bord", designation: { name: "Analyser le contexte", url: urlDoc("sipoc/manager/analyser") }, sorties: "Diagnostic", processusClient: "Direction", raci_r: "Essai 1", raci_a: "Essai 2", raci_c: "Essai 3", raci_i: "Essai 4" },
            { ref: "MAN-02", phase: "Phase 1 - Cadrer", processusFournisseur: "Direction", entrees: "Diagnostic", numero: "2", ressources: "Ateliers", designation: { name: "Definir la strategie", url: urlProcess("MNGT-SP01") }, sorties: "Strategie", processusClient: "Direction", raci_r: "Essai 1", raci_a: "Essai 2", raci_c: "Essai 3", raci_i: "Essai 4" },
            { ref: "MAN-03", phase: "Phase 1 - Cadrer", processusFournisseur: "Direction", entrees: "Stratégie", numero: "3", ressources: "OKR", designation: { name: "Fixer objectifs", url: urlDoc("sipoc/manager/objectifs") }, sorties: "Objectifs", processusClient: "Programme", raci_r: "Essai 1", raci_a: "Essai 2", raci_c: "Essai 3", raci_i: "Essai 4" },
          ],
        },
      ],
    },

    VEN: {
      phases: [
        {
          key: "P02-PH1",
          name: "Phase 1 - Prospection",
          rows: [
            { ref: "VEN-01", phase: "Phase 1 - Prospection", processusFournisseur: "Marketing", entrees: "Leads", numero: "1", ressources: "CRM", designation: { name: "Prospecter", url: urlProcess("VEN-SP0201") }, sorties: "Leads qualifies", processusClient: "Commercial" },
          ],
        },
        {
          key: "P02-PH2",
          name: "Phase 2 - Qualification & Offre",
          rows: [
            { ref: "VEN-02", phase: "Phase 2 - Qualification & Offre", processusFournisseur: "Commercial", entrees: "Leads qualifiés", numero: "2", ressources: "Script / Email", designation: { name: "Qualifier", url: urlProcess("VEN-SP0202") }, sorties: "Besoin clarifie", processusClient: "Avant-vente" },
            { ref: "VEN-03", phase: "Phase 2 - Qualification & Offre", processusFournisseur: "Avant-vente", entrees: "Besoin clarifié", numero: "3", ressources: "Catalogue", designation: { name: "Construire l'offre", url: urlDoc("sipoc/vendre/offre") }, sorties: "Offre envoyee", processusClient: "Client" },
          ],
        },
        {
          key: "P02-PH3",
          name: "Phase 3 - Negociation & Contrat",
          rows: [
            { ref: "VEN-04", phase: "Phase 3 - Negociation & Contrat", processusFournisseur: "Client", entrees: "Offre envoyée", numero: "4", ressources: "Reunions", designation: { name: "Negocier", url: urlDoc("sipoc/vendre/negocier") }, sorties: "Accord", processusClient: "Commercial" },
            { ref: "VEN-05", phase: "Phase 3 - Negociation & Contrat", processusFournisseur: "Commercial", entrees: "Accord", numero: "5", ressources: "Contrat", designation: { name: "Contractualiser", url: urlProcess("VEN-SP0203") }, sorties: "Contrat signe", processusClient: "ADV" },
            { ref: "VEN-06", phase: "Phase 3 - Negociation & Contrat", processusFournisseur: "ADV", entrees: "Contrat signe", numero: "6", ressources: "ERP", designation: { name: "Creer la commande", url: urlDoc("sipoc/vendre/commande") }, sorties: "Commande creee", processusClient: "Planification" },
          ],
        },
      ],
    },

    PLA: {
      phases: [
        {
          key: "P03-PH1",
          name: "Phase 1 - Collecter & Estimer",
          rows: [
            { ref: "PLA-01", phase: "Phase 1 - Collecter & Estimer", processusFournisseur: "Ventes", entrees: "Commande / Contrat", numero: "1", ressources: "CRM/ERP", designation: { name: "Collecter les demandes", url: urlProcess("PLA-SP0301") }, sorties: "Backlog consolide", processusClient: "Programme" },
            { ref: "PLA-02", phase: "Phase 1 - Collecter & Estimer", processusFournisseur: "Programme", entrees: "Backlog", numero: "2", ressources: "Roadmap", designation: { name: "Estimer la charge", url: urlDoc("sipoc/planifier/estimer") }, sorties: "Charge estimee", processusClient: "RH/Operations" },
          ],
        },
        {
          key: "P03-PH2",
          name: "Phase 2 - Allouer",
          rows: [
            { ref: "PLA-03", phase: "Phase 2 - Allouer", processusFournisseur: "RH", entrees: "Charge estimee", numero: "3", ressources: "Capacite", designation: { name: "Allouer les ressources", url: urlProcess("PLA-SP0302") }, sorties: "Capacite allouee", processusClient: "Programme" },
          ],
        },
        {
          key: "P03-PH3",
          name: "Phase 3 - Construire & Valider",
          rows: [
            { ref: "PLA-04", phase: "Phase 3 - Construire & Valider", processusFournisseur: "Programme", entrees: "Capacite allouee", numero: "4", ressources: "Planning", designation: { name: "Construire le planning", url: urlDoc("sipoc/planifier/planning") }, sorties: "Planning propose", processusClient: "Direction" },
            { ref: "PLA-05", phase: "Phase 3 - Construire & Valider", processusFournisseur: "Direction", entrees: "Planning propose", numero: "5", ressources: "Comite", designation: { name: "Valider le planning", url: urlProcess("PLA-SP0303") }, sorties: "Planning valide", processusClient: "Tous" },
          ],
        },
      ],
    },

    PROG: {
      phases: [
        {
          key: "P04-PH1",
          name: "Phase 1 - Gouvernance",
          rows: [
            { ref: "PROG-01", phase: "Phase 1 - Gouvernance", processusFournisseur: "Direction", entrees: "Objectifs", numero: "1", ressources: "Comites", designation: { name: "Mettre en place la gouvernance", url: urlProcess("SP0401") }, sorties: "Rituels", processusClient: "Programme" },
          ],
        },
        {
          key: "P04-PH2",
          name: "Phase 2 - Pilotage",
          rows: [
            { ref: "PROG-02", phase: "Phase 2 - Pilotage", processusFournisseur: "Programme", entrees: "Rituels", numero: "2", ressources: "Tableaux", designation: { name: "Suivre les KPI", url: urlProcess("SP0402") }, sorties: "KPI a jour", processusClient: "Direction" },
            { ref: "PROG-03", phase: "Phase 2 - Pilotage", processusFournisseur: "Programme", entrees: "KPI", numero: "3", ressources: "Registre", designation: { name: "Gerer les risques", url: urlProcess("SP0403") }, sorties: "Risques traites", processusClient: "Direction" },
          ],
        },
        {
          key: "P04-PH3",
          name: "Phase 3 - Arbitrage",
          rows: [
            { ref: "PROG-04", phase: "Phase 3 - Arbitrage", processusFournisseur: "Direction", entrees: "Risques", numero: "4", ressources: "Arbitrage", designation: { name: "Decider / arbitrer", url: urlDoc("sipoc/programme/arbitrer") }, sorties: "Decisions", processusClient: "Tous" },
          ],
        },
      ],
    },

    MIS: {
      phases: [
        {
          key: "P05-PH1",
          name: "Phase 1 - Lancer",
          rows: [
            { ref: "REA-01", phase: "Phase 1 - Lancer", processusFournisseur: "Planification", entrees: "Planning valide", numero: "1", ressources: "Ordre de travail", designation: { name: "Lancer l'execution", url: urlProcess("SP0501") }, sorties: "Travaux lances", processusClient: "Operations" },
          ],
        },
        {
          key: "P05-PH2",
          name: "Phase 2 - Produire",
          rows: [
            { ref: "REA-02", phase: "Phase 2 - Produire", processusFournisseur: "Operations", entrees: "Travaux", numero: "2", ressources: "Procedures", designation: { name: "Realiser", url: urlDoc("sipoc/realiser/realiser") }, sorties: "Resultat produit", processusClient: "Qualite" },
          ],
        },
        {
          key: "P05-PH3",
          name: "Phase 3 - Controler & Livrer",
          rows: [
            { ref: "REA-03", phase: "Phase 3 - Controler & Livrer", processusFournisseur: "Qualite", entrees: "Resultat", numero: "3", ressources: "Plan de controle", designation: { name: "Controler la qualite", url: urlProcess("SP0502") }, sorties: "Conformite", processusClient: "Client" },
            { ref: "REA-04", phase: "Phase 3 - Controler & Livrer", processusFournisseur: "Operations", entrees: "Conformite", numero: "4", ressources: "Checklists", designation: { name: "Preparer la livraison", url: urlDoc("sipoc/realiser/livraison") }, sorties: "Livrable pret", processusClient: "Client" },
            { ref: "REA-05", phase: "Phase 3 - Controler & Livrer", processusFournisseur: "Operations", entrees: "Livrable pret", numero: "5", ressources: "Transport", designation: { name: "Livrer", url: urlProcess("SP0503") }, sorties: "Livre", processusClient: "Valider" },
          ],
        },
      ],
    },

    VLD: {
      phases: [
        {
          key: "P06-PH1",
          name: "Phase 1 - Preparer",
          rows: [
            { ref: "VAL-01", phase: "Phase 1 - Preparer", processusFournisseur: "Realisation", entrees: "Livre", numero: "1", ressources: "Plan de recette", designation: { name: "Preparer la recette", url: urlProcess("SP0601") }, sorties: "Recette prete", processusClient: "Client" },
          ],
        },
        {
          key: "P06-PH2",
          name: "Phase 2 - Executer",
          rows: [
            { ref: "VAL-02", phase: "Phase 2 - Executer", processusFournisseur: "Client", entrees: "Recette prete", numero: "2", ressources: "Cas de test", designation: { name: "Executer la recette", url: urlDoc("sipoc/valider/executer") }, sorties: "Resultats", processusClient: "Qualite" },
          ],
        },
        {
          key: "P06-PH3",
          name: "Phase 3 - Valider & Cloturer",
          rows: [
            { ref: "VAL-03", phase: "Phase 3 - Valider & Cloturer", processusFournisseur: "Qualite", entrees: "Resultats", numero: "3", ressources: "PV", designation: { name: "Valider conformite", url: urlProcess("SP0602") }, sorties: "Acceptation", processusClient: "Programme" },
            { ref: "VAL-04", phase: "Phase 3 - Valider & Cloturer", processusFournisseur: "Programme", entrees: "Acceptation", numero: "4", ressources: "RETEX", designation: { name: "Cloturer / Capitaliser", url: urlProcess("SP0603") }, sorties: "Cloture", processusClient: "Direction" },
          ],
        },
      ],
    },
  };

  // ─── SUB-PROCESS SIPOC DATA ──────────────────────────────────
  const SUB_SIPOC_DATA = {
    "VEN-SP0201": {
      phases: [
        {
          key: "SP0201-PH1",
          name: "Prospection",
          rows: [
            { ref: "Spros-01", processusFournisseur: "Marketing", entrees: "Cibles", numero: "1", ressources: "CRM", designation: { name: "Identifier des cibles", url: urlDoc("sipoc/sp0201/cibles") }, sorties: "Liste cibles", processusClient: "Commercial" },
            { ref: "Spros-02", processusFournisseur: "Commercial", entrees: "Liste cibles", numero: "2", ressources: "Email/Tel", designation: { name: "Contacter", url: urlDoc("sipoc/sp0201/contacter") }, sorties: "Contact etabli", processusClient: "Commercial" },
            { ref: "Spros-03", processusFournisseur: "Commercial", entrees: "Contact", numero: "3", ressources: "Script", designation: { name: "Qualifier rapidement", url: urlProcess("VEN-SP0202") }, sorties: "Lead qualifie", processusClient: "Avant-vente" },
          ],
        },
      ],
    },
    "VEN-SP0202": {
      phases: [
        {
          key: "SP0202-PH1",
          name: "Qualification",
          rows: [
            { ref: "Squal-01", processusFournisseur: "Commercial", entrees: "Lead", numero: "1", ressources: "CRM", designation: { name: "Prendre contact", url: urlDoc("sipoc/sp0202/contact") }, sorties: "RDV planifie", processusClient: "Client" },
            { ref: "Squal-02", processusFournisseur: "Avant-vente", entrees: "RDV", numero: "2", ressources: "Questionnaire", designation: { name: "Comprendre le besoin", url: urlDoc("sipoc/sp0202/besoin") }, sorties: "Besoin documente", processusClient: "Commercial" },
            { ref: "Squal-03", processusFournisseur: "Commercial", entrees: "Besoin", numero: "3", ressources: "Grille GO/NOGO", designation: { name: "Decider GO/NOGO", url: urlDoc("sipoc/sp0202/go") }, sorties: "Decision", processusClient: "Direction" },
          ],
        },
      ],
    },
    "VEN-SP0203": {
      phases: [
        {
          key: "SP0203-PH1",
          name: "Contractualisation",
          rows: [
            { ref: "Scont-01", processusFournisseur: "Commercial", entrees: "Accord", numero: "1", ressources: "Modele contrat", designation: { name: "Preparer le contrat", url: urlDoc("sipoc/sp0203/preparer") }, sorties: "Draft contrat", processusClient: "Juridique" },
            { ref: "Scont-02", processusFournisseur: "Juridique", entrees: "Draft", numero: "2", ressources: "Clauses", designation: { name: "Negocier clauses", url: urlDoc("sipoc/sp0203/negocier") }, sorties: "Contrat negocie", processusClient: "Client" },
            { ref: "Scont-03", processusFournisseur: "Client", entrees: "Contrat final", numero: "3", ressources: "Signature", designation: { name: "Signer", url: urlDoc("sipoc/sp0203/signer") }, sorties: "Contrat signe", processusClient: "ADV" },
          ],
        },
      ],
    },
    "PLA-SP0301": {
      phases: [
        {
          key: "SP0301-PH1",
          name: "Collecte demandes",
          rows: [
            { ref: "Scol-01", processusFournisseur: "Ventes", entrees: "Commandes", numero: "1", ressources: "ERP", designation: { name: "Collecter demandes", url: urlDoc("sipoc/sp0301/collecter") }, sorties: "Liste demandes", processusClient: "Programme" },
            { ref: "Scol-02", processusFournisseur: "Programme", entrees: "Demandes", numero: "2", ressources: "Tableau", designation: { name: "Consolider", url: urlDoc("sipoc/sp0301/consolider") }, sorties: "Backlog", processusClient: "Programme" },
            { ref: "Scol-03", processusFournisseur: "Direction", entrees: "Backlog", numero: "3", ressources: "Criteres", designation: { name: "Prioriser", url: urlDoc("sipoc/sp0301/prioriser") }, sorties: "Backlog priorise", processusClient: "Planification" },
          ],
        },
      ],
    },
    "PLA-SP0302": {
      phases: [
        {
          key: "SP0302-PH1",
          name: "Allocation ressources",
          rows: [
            { ref: "Sres-01", processusFournisseur: "RH", entrees: "Effectifs", numero: "1", ressources: "SIRH", designation: { name: "Lister capacites", url: urlDoc("sipoc/sp0302/capacites") }, sorties: "Capacite dispo", processusClient: "Programme" },
            { ref: "Sres-02", processusFournisseur: "Programme", entrees: "Charge + Capacite", numero: "2", ressources: "Planning", designation: { name: "Allouer", url: urlDoc("sipoc/sp0302/allouer") }, sorties: "Allocation", processusClient: "Operations" },
            { ref: "Sres-03", processusFournisseur: "Operations", entrees: "Allocation", numero: "3", ressources: "Validation", designation: { name: "Confirmer", url: urlDoc("sipoc/sp0302/confirmer") }, sorties: "Allocation confirmee", processusClient: "Programme" },
          ],
        },
      ],
    },
    "PLA-SP0303": {
      phases: [
        {
          key: "SP0303-PH1",
          name: "Validation planning",
          rows: [
            { ref: "Sval-01", processusFournisseur: "Programme", entrees: "Planning draft", numero: "1", ressources: "Dossier", designation: { name: "Preparer arbitrage", url: urlDoc("sipoc/sp0303/preparer") }, sorties: "Dossier arbitrage", processusClient: "Direction" },
            { ref: "Sval-02", processusFournisseur: "Direction", entrees: "Dossier", numero: "2", ressources: "Comite", designation: { name: "Valider", url: urlDoc("sipoc/sp0303/valider") }, sorties: "Planning valide", processusClient: "Programme" },
            { ref: "Sval-03", processusFournisseur: "Programme", entrees: "Planning valide", numero: "3", ressources: "Communication", designation: { name: "Publier", url: urlDoc("sipoc/sp0303/publier") }, sorties: "Planning publie", processusClient: "Tous" },
          ],
        },
      ],
    },
    SP0501: {
      phases: [
        {
          key: "SP0501-PH1",
          name: "Execution",
          rows: [
            { ref: "Sexe-01", processusFournisseur: "Planification", entrees: "Planning", numero: "1", ressources: "OT", designation: { name: "Preparer ordre", url: urlDoc("sipoc/sp0501/ordre") }, sorties: "OT emis", processusClient: "Operations" },
            { ref: "Sexe-02", processusFournisseur: "Operations", entrees: "OT", numero: "2", ressources: "Procedures", designation: { name: "Executer", url: urlDoc("sipoc/sp0501/executer") }, sorties: "Travail realise", processusClient: "Qualite" },
            { ref: "Sexe-03", processusFournisseur: "Operations", entrees: "Avancement", numero: "3", ressources: "Reporting", designation: { name: "Remonter avancement", url: urlDoc("sipoc/sp0501/avancement") }, sorties: "Rapport", processusClient: "Programme" },
          ],
        },
      ],
    },
    SP0502: {
      phases: [
        {
          key: "SP0502-PH1",
          name: "Controle qualite",
          rows: [
            { ref: "Squa-01", processusFournisseur: "Operations", entrees: "Livrable", numero: "1", ressources: "Check-list", designation: { name: "Controler", url: urlDoc("sipoc/sp0502/controler") }, sorties: "Resultat controle", processusClient: "Qualite" },
            { ref: "Squa-02", processusFournisseur: "Qualite", entrees: "NC detectee", numero: "2", ressources: "Fiche NC", designation: { name: "Traiter NC", url: urlDoc("sipoc/sp0502/nc") }, sorties: "NC traitee", processusClient: "Operations" },
            { ref: "Squa-03", processusFournisseur: "Qualite", entrees: "Controle OK", numero: "3", ressources: "PV", designation: { name: "Valider", url: urlDoc("sipoc/sp0502/valider") }, sorties: "Validation", processusClient: "Client" },
          ],
        },
      ],
    },
    SP0503: {
      phases: [
        {
          key: "SP0503-PH1",
          name: "Livraison",
          rows: [
            { ref: "Sliv-01", processusFournisseur: "Operations", entrees: "Livrable valide", numero: "1", ressources: "Emballage", designation: { name: "Preparer", url: urlDoc("sipoc/sp0503/preparer") }, sorties: "Colis pret", processusClient: "Logistique" },
            { ref: "Sliv-02", processusFournisseur: "Logistique", entrees: "Colis", numero: "2", ressources: "Transport", designation: { name: "Livrer", url: urlDoc("sipoc/sp0503/livrer") }, sorties: "Livre", processusClient: "Client" },
            { ref: "Sliv-03", processusFournisseur: "Client", entrees: "Livraison", numero: "3", ressources: "AR", designation: { name: "Accuser reception", url: urlDoc("sipoc/sp0503/reception") }, sorties: "AR signe", processusClient: "ADV" },
          ],
        },
      ],
    },
  };

  // ─── CREATE SIPOC + LOGIGRAMME FOR ROOT PROCESSES ────────────
  console.log("[seed] creating SIPOC for root processes...");
  for (const root of roots) {
    const conf = SIPOC_DATA[root.code];
    if (!conf) continue;

    const phases = conf.phases || [];
    const flatRows = phases.flatMap((p) => p.rows || []);

    await createSipocForProcess(root.id, phases);
    await root.update({
      logigramme: buildLogigrammeFromSipoc(flatRows),
    });

    console.log(`  [seed] SIPOC created for ${root.code} (${phases.length} phases, ${flatRows.length} rows)`);
  }

  // Custom logigramme for MNGT (positions éditées manuellement)
  const mngt = roots.find((p) => p.code === "MNGT");
  if (mngt) {
    const conf = SIPOC_DATA["MNGT"];
    const rows = (conf?.phases || []).flatMap((p) => p.rows || []);
    if (rows.length) {
      const lg = buildLogigrammeFromSipoc(rows);
      // Apply custom positions matching user's edited logigramme
      const positions = {
        "MAN-01": { x: -220, y: 160 },
        "MAN-02": { x: -220, y: 500 },
        "MAN-03": { x: 80, y: 280 },
      };
      lg.nodes = lg.nodes.map((n) => ({
        ...n,
        position: positions[n.id] || n.position,
        interaction: null,
      }));
      await mngt.update({ logigramme: lg });
    }
  }

  // Custom logigramme for PROG (Visio-like with diamond)
  const prog = roots.find((p) => p.code === "PROG");
  if (prog) {
    const conf = SIPOC_DATA["PROG"];
    const rows = (conf?.phases || []).flatMap((p) => p.rows || []);
    if (rows.length) {
      const lg = buildLogigrammeFromSipoc(rows);

      const pos = {
        "PROG-01": { x: 520, y: 20 },
        "PROG-02": { x: 160, y: 190 },
        "PROG-03": { x: 520, y: 190 },
        "PROG-04": { x: 880, y: 190 },
      };

      lg.nodes = (lg.nodes || []).map((n) => {
        const id = String(n.id);
        const p = pos[id] || n.position;
        const isTop = id === "PROG-01";
        return {
          ...n,
          position: p,
          shape: isTop ? "diamond" : "rectangle",
          style: {
            fill: "#ffffff",
            stroke: "rgba(245,154,213,0.65)",
            text: "#0f172a",
            width: isTop ? 160 : 240,
            height: isTop ? 160 : 70,
            fontSize: 13,
          },
        };
      });

      lg.edges = [
        { id: "e1", from: "PROG-01", to: "PROG-02", kind: "orthogonal", color: "#f59ad5", width: 2, badgeText: "2", badgeColor: "#fb923c", badgeBg: "#ffffff" },
        { id: "e2", from: "PROG-01", to: "PROG-03", kind: "orthogonal", color: "#f59ad5", width: 2, badgeText: "4", badgeColor: "#0ea5e9", badgeBg: "#ffffff" },
        { id: "e3", from: "PROG-03", to: "PROG-04", kind: "orthogonal", color: "#f59ad5", width: 2, badgeText: "5", badgeColor: "#64748b", badgeBg: "#ffffff" },
        { id: "e4", from: "PROG-04", to: "PROG-01", kind: "orthogonal", color: "#0ea5e9", width: 2, badgeText: "4", badgeColor: "#0ea5e9", badgeBg: "#ffffff" },
        { id: "e5", from: "PROG-02", to: "PROG-03", kind: "orthogonal", color: "#64748b", width: 2, badgeText: "", badgeColor: "#64748b", badgeBg: "#ffffff" },
      ];

      lg.legend = [
        { key: "1.", label: "Manager l'entreprise", bg: "#e5e7eb", color: "#111827" },
        { key: "2.", label: "Vendre", bg: "#ffe4c7", color: "#111827" },
        { key: "3.", label: "Planifier", bg: "#f5d0fe", color: "#111827" },
        { key: "4.", label: "Manager le Programme", bg: "#a5f3fc", color: "#0ea5e9" },
        { key: "5.", label: "Realiser", bg: "#d1d5db", color: "#111827" },
        { key: "6.", label: "Valider", bg: "#dcfce7", color: "#111827" },
      ];

      await prog.update({ logigramme: lg });
    }
  }

  // ─── CREATE SIPOC + LOGIGRAMME FOR SUB-PROCESSES ─────────────
  console.log("[seed] creating SIPOC for sub-processes...");
  for (const sub of subs) {
    const conf = SUB_SIPOC_DATA[sub.code];
    if (!conf) continue;

    const phases = conf.phases || [];
    const flatRows = phases.flatMap((p) => p.rows || []);

    await createSipocForProcess(sub.id, phases);
    await sub.update({
      logigramme: buildLogigrammeFromSipoc(flatRows, { wrapAt: 3 }),
    });

    console.log(`  [seed] SIPOC created for ${sub.code} (${phases.length} phases, ${flatRows.length} rows)`);
  }

  // ─── SUMMARY ────────────────────────────────────────────────
  const totalSipocs = await Sipoc.count();
  const totalPhases = await SipocPhase.count();
  const totalRows = await SipocRow.count();

  console.log("\n[seed] SUMMARY:");
  console.log(`  - Users: ${await User.count()}`);
  console.log(`  - Pilots: ${await Pilot.count()}`);
  console.log(`  - Processes: ${roots.length + subs.length}`);
  console.log(`  - SIPOCs: ${totalSipocs}`);
  console.log(`  - SIPOC Phases: ${totalPhases}`);
  console.log(`  - SIPOC Rows: ${totalRows}`);
  console.log(`  - Stakeholders: ${await Stakeholder.count()}`);
  console.log(`  - CartographyLayouts: ${await CartographyLayout.count()}`);

  console.log("\n[seed] done");
  await sequelize.close();
}

run().catch(async (e) => {
  console.error("[seed] error", e);
  try {
    await sequelize.close();
  } catch {}
  process.exit(1);
});
