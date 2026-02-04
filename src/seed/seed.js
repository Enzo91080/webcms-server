import { sequelize } from "../config/db.js";
import { env } from "../config/env.js";
import "../models/initModels.js";
import { Process } from "../models/Process.js";
import { User } from "../models/User.js";
import { Stakeholder } from "../models/Stakeholder.js";
import { Sipoc } from "../models/Sipoc.js";
import { SipocPhase } from "../models/SipocPhase.js";
import { SipocRow } from "../models/SipocRow.js";
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
 * Creates SIPOC entries in the new normalized tables (Sipoc, SipocPhase, SipocRow)
 */
async function createSipocForProcess(processId, phasesData) {
  // Delete existing SIPOC for this process (if any)
  const existingSipoc = await Sipoc.findOne({ where: { processId } });
  if (existingSipoc) {
    await SipocPhase.destroy({ where: { sipocId: existingSipoc.id } });
    await existingSipoc.destroy();
  }

  // Create new Sipoc
  const sipoc = await Sipoc.create({ processId });

  // Create phases and rows
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

  // --- Admin user (unique) ---
  await User.destroy({ where: {} });
  const adminEmail = env.adminEmail;
  const adminPassword = env.adminPassword;
  const passwordHash = await hashPassword(adminPassword);
  await User.create({
    email: adminEmail,
    passwordHash,
    role: "admin",
    name: "Administrateur",
  });
  console.log(`[seed] admin created: ${adminEmail} / ${adminPassword}`);

  // Clean up existing data
  await SipocRow.destroy({ where: {} });
  await SipocPhase.destroy({ where: {} });
  await Sipoc.destroy({ where: {} });
  await Process.destroy({ where: {} });
  console.log("[seed] cleaned existing data");

  async function setStakeholders(process, names) {
    const arr = Array.isArray(names) ? names : [];
    const unique = [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
    const instances = [];
    for (const name of unique) {
      const [s] = await Stakeholder.findOrCreate({
        where: { name },
        defaults: { name, isActive: true },
      });
      instances.push(s);
    }
    await process.setStakeholders(instances);
  }

  // --- Racines (ordre impose) ---
  const rootsPayload = [
    {
      code: "P01",
      name: "Manager l'entreprise",
      title: "Definir la strategie, piloter l'entreprise et assurer la conformite.",
      parentProcessId: null,
      orderInParent: 1,
      objectives: md([
        "1. Definir la strategie de l'entreprise, c'est definir :",
        "   - l'OP",
        "   - la Politique qualite",
        "   - les objectifs de la societe",
        "   - la Communication",
        "   - l'adequation charge/capacite des Ressources Humaines",
        "2. Piloter les finances",
        "3. Piloter les Ressources Humaines",
        "4. Mettre en oeuvre la communication",
        "5. Piloter l'amelioration et la realisation des objectifs",
        "6. S'assurer de la disponibilite des moyens",
        "7. Assurer la gestion de la documentation",
        "8. Maintenir la licence operateur (repondre aux prescriptions annuelles)",
        "9. Piloter la chaine de valeur",
      ]),
      stakeholders: ["Direction", "Qualite", "Finance", "RH"],
      referenceDocuments: [
        {
          code: "DOC-MAN-001",
          title: "Revue de direction - trame",
          type: "DOCX",
          url: urlDoc("docs/revue-direction.docx"),
        },
        {
          code: "DOC-MAN-002",
          title: "Politique qualite - modele",
          type: "PDF",
          url: urlDoc("docs/politique-qualite.pdf"),
        },
      ],
    },
    {
      code: "P02",
      name: "Vendre",
      title: "Transformer des opportunites en contrats et commandes.",
      parentProcessId: null,
      orderInParent: 2,
      objectives: md([
        "- Prospecter et qualifier les opportunites.",
        "- Construire une offre conforme au besoin.",
        "- Negocier et contractualiser.",
        "- Transmettre a la planification / execution.",
      ]),
      stakeholders: ["Commercial", "Avant-vente", "ADV", "Finance"],
      referenceDocuments: [
        { code: "DOC-VEN-001", title: "Guide de qualification", type: "PDF", url: urlDoc("docs/qualification.pdf") },
        { code: "DOC-VEN-002", title: "Modele de contrat", type: "DOCX", url: urlDoc("docs/contrat.docx") },
      ],
    },
    {
      code: "P03",
      name: "Planifier",
      title: "Organiser la charge, la capacite et le planning.",
      parentProcessId: null,
      orderInParent: 3,
      objectives: md(["- Collecter les besoins.", "- Allouer les ressources.", "- Publier un planning valide."]),
      stakeholders: ["Programme", "Operations", "RH"],
      referenceDocuments: [{ code: "DOC-PLA-001", title: "Regles de planification", type: "PDF", url: urlDoc("docs/regles-planification.pdf") }],
    },
    {
      code: "P04",
      name: "Manager le Programme",
      title: "Gouverner, piloter la performance et les risques.",
      parentProcessId: null,
      orderInParent: 4,
      objectives: md(["- Assurer la gouvernance.", "- Suivre les KPI.", "- Gerer les risques et arbitrages."]),
      stakeholders: ["PMO", "Direction", "Qualite"],
      referenceDocuments: [{ code: "DOC-PROG-001", title: "Plan de management programme", type: "PDF", url: urlDoc("docs/pmp.pdf") }],
    },
    {
      code: "P05",
      name: "Realiser",
      title: "Executer les activites, controler la qualite et livrer.",
      parentProcessId: null,
      orderInParent: 5,
      objectives: md(["- Executer les taches.", "- Controler la qualite.", "- Livrer conformement aux engagements."]),
      stakeholders: ["Operations", "Qualite", "Client"],
      referenceDocuments: [{ code: "DOC-REA-001", title: "Instruction de travail - modele", type: "DOCX", url: urlDoc("docs/instruction-travail.docx") }],
    },
    {
      code: "P06",
      name: "Valider",
      title: "Recetter, valider et cloturer.",
      parentProcessId: null,
      orderInParent: 6,
      objectives: md(["- Preparer et executer la recette.", "- Valider la conformite.", "- Capitaliser et cloturer."]),
      stakeholders: ["Qualite", "Client", "Programme"],
      referenceDocuments: [
        { code: "DOC-VAL-001", title: "PV de recette - modele", type: "DOCX", url: urlDoc("docs/pv-recette.docx") },
        { code: "DOC-VAL-002", title: "RETEX - modele", type: "DOCX", url: urlDoc("docs/retex.docx") },
      ],
    },
  ];

  const roots = await Process.bulkCreate(
    rootsPayload.map(({ stakeholders, ...p }) => p),
    { returning: true }
  );

  // Attach stakeholders
  for (const p of rootsPayload) {
    const created = roots.find((x) => x.code === p.code);
    if (created) await setStakeholders(created, p.stakeholders);
  }

  const byCode = (list, code) => list.find((x) => x.code === code);

  const P01 = byCode(roots, "P01");
  const P02 = byCode(roots, "P02");
  const P03 = byCode(roots, "P03");
  const P04 = byCode(roots, "P04");
  const P05 = byCode(roots, "P05");
  const P06 = byCode(roots, "P06");

  console.log("[seed] root processes created");

  const getParentId = (process) => {
    if (!process) {
      console.error("[seed] Parent process not found!");
      return null;
    }
    const id = process.id || process.dataValues?.id || process.get?.("id");
    if (!id) {
      console.error(`[seed] Cannot get ID for ${process.code}`);
      return null;
    }
    return String(id);
  };

  // --- Sous-processus ---
  const subsPayload = [
    { code: "SP0101", name: "Definir la strategie", title: "Formaliser la strategie et les objectifs.", parentProcessId: getParentId(P01), orderInParent: 1, stakeholders: ["Direction"] },
    { code: "SP0102", name: "Piloter les finances", title: "Suivre le budget, tresorerie, investissements.", parentProcessId: getParentId(P01), orderInParent: 2, stakeholders: ["Finance"] },
    { code: "SP0103", name: "Piloter les Ressources Humaines", title: "Gerer les effectifs, competences, charge/capacite.", parentProcessId: getParentId(P01), orderInParent: 3, stakeholders: ["RH"] },
    { code: "SP0201", name: "Prospecter", title: "Identifier et contacter des prospects.", parentProcessId: getParentId(P02), orderInParent: 1, stakeholders: ["Commercial"] },
    { code: "SP0202", name: "Qualifier", title: "Qualifier les besoins et la faisabilite.", parentProcessId: getParentId(P02), orderInParent: 2, stakeholders: ["Commercial", "Avant-vente"] },
    { code: "SP0203", name: "Contractualiser", title: "Negocier et finaliser le contrat.", parentProcessId: getParentId(P02), orderInParent: 3, stakeholders: ["Commercial", "ADV", "Juridique"] },
    { code: "SP0301", name: "Collecter les demandes", title: "Collecter et consolider les besoins.", parentProcessId: getParentId(P03), orderInParent: 1, stakeholders: ["Programme"] },
    { code: "SP0302", name: "Allouer les ressources", title: "Allouer capacite et moyens.", parentProcessId: getParentId(P03), orderInParent: 2, stakeholders: ["RH", "Operations"] },
    { code: "SP0303", name: "Valider le planning", title: "Arbitrer et publier un planning.", parentProcessId: getParentId(P03), orderInParent: 3, stakeholders: ["Direction", "Programme"] },
    { code: "SP0401", name: "Gouvernance", title: "Organiser comites et decisions.", parentProcessId: getParentId(P04), orderInParent: 1, stakeholders: ["PMO", "Direction"] },
    { code: "SP0402", name: "Suivi KPI", title: "Suivre indicateurs et performance.", parentProcessId: getParentId(P04), orderInParent: 2, stakeholders: ["PMO", "Qualite"] },
    { code: "SP0403", name: "Gestion des risques", title: "Identifier, traiter et suivre les risques.", parentProcessId: getParentId(P04), orderInParent: 3, stakeholders: ["PMO", "Operations"] },
    { code: "SP0501", name: "Executer", title: "Realiser les activites prevues.", parentProcessId: getParentId(P05), orderInParent: 1, stakeholders: ["Operations"] },
    { code: "SP0502", name: "Controler la qualite", title: "Controler conformite et traiter non-conformites.", parentProcessId: getParentId(P05), orderInParent: 2, stakeholders: ["Qualite", "Operations"] },
    { code: "SP0503", name: "Livrer", title: "Preparer et livrer le resultat.", parentProcessId: getParentId(P05), orderInParent: 3, stakeholders: ["Operations", "Client"] },
    { code: "SP0601", name: "Recetter", title: "Preparer et executer la recette.", parentProcessId: getParentId(P06), orderInParent: 1, stakeholders: ["Qualite", "Client"] },
    { code: "SP0602", name: "Valider conformite", title: "Valider conformite et accepter.", parentProcessId: getParentId(P06), orderInParent: 2, stakeholders: ["Qualite", "Client"] },
    { code: "SP0603", name: "Cloturer", title: "Cloturer et capitaliser.", parentProcessId: getParentId(P06), orderInParent: 3, stakeholders: ["Programme", "Qualite"] },
  ];

  const subs = await Process.bulkCreate(
    subsPayload.map(({ stakeholders, ...p }) => p),
    { returning: true }
  );

  for (const p of subsPayload) {
    const created = subs.find((x) => x.code === p.code);
    if (created) await setStakeholders(created, p.stakeholders);
  }

  console.log("[seed] sub-processes created");

  const get = (code) => [...roots, ...subs].find((p) => p.code === code);

  // --- SIPOC Data (by phases) ---
  const SIPOC_DATA = {
    P01: {
      phases: [
        {
          key: "P01-PH1",
          name: "Phase 1 - Cadrer",
          rows: [
            { ref: "MAN-01", phase: "Phase 1 - Cadrer", processusFournisseur: "Direction", entrees: "Contexte / donnees", numero: "1", ressources: "Tableaux de bord", designation: { name: "Analyser le contexte", url: urlDoc("sipoc/manager/analyser") }, sorties: "Diagnostic", processusClient: "Direction" },
            { ref: "MAN-02", phase: "Phase 1 - Cadrer", processusFournisseur: "Direction", entrees: "Diagnostic", numero: "2", ressources: "Ateliers", designation: { name: "Definir la strategie", url: urlProcess("SP0101") }, sorties: "Strategie", processusClient: "Direction" },
            { ref: "MAN-03", phase: "Phase 1 - Cadrer", processusFournisseur: "Direction", entrees: "Strategie", numero: "3", ressources: "OKR", designation: { name: "Fixer objectifs", url: urlDoc("sipoc/manager/objectifs") }, sorties: "Objectifs", processusClient: "Programme" },
          ],
        },
        {
          key: "P01-PH2",
          name: "Phase 2 - Piloter",
          rows: [
            { ref: "MAN-04", phase: "Phase 2 - Piloter", processusFournisseur: "RH", entrees: "Objectifs", numero: "4", ressources: "Plan de charge", designation: { name: "Ajuster charge/capacite", url: urlProcess("SP0103") }, sorties: "Capacite validee", processusClient: "Operations" },
            { ref: "MAN-05", phase: "Phase 2 - Piloter", processusFournisseur: "Finance", entrees: "Objectifs", numero: "5", ressources: "Budget", designation: { name: "Piloter finances", url: urlProcess("SP0102") }, sorties: "Budget suivi", processusClient: "Direction" },
            { ref: "MAN-06", phase: "Phase 2 - Piloter", processusFournisseur: "Qualite", entrees: "Indicateurs", numero: "6", ressources: "Revue", designation: { name: "Revue de direction", url: urlDoc("sipoc/manager/revue") }, sorties: "Decisions", processusClient: "Direction" },
          ],
        },
        {
          key: "P01-PH3",
          name: "Phase 3 - Ameliorer & Conformer",
          rows: [
            { ref: "MAN-07", phase: "Phase 3 - Ameliorer & Conformer", processusFournisseur: "Qualite", entrees: "Decisions", numero: "7", ressources: "Plan d'actions", designation: { name: "Amelioration continue", url: urlDoc("sipoc/manager/amelioration") }, sorties: "Actions", processusClient: "Tous" },
            { ref: "MAN-08", phase: "Phase 3 - Ameliorer & Conformer", processusFournisseur: "Qualite", entrees: "Docs", numero: "8", ressources: "GED", designation: { name: "Gerer la documentation", url: urlDoc("sipoc/manager/docs") }, sorties: "Docs a jour", processusClient: "Tous" },
            { ref: "MAN-09", phase: "Phase 3 - Ameliorer & Conformer", processusFournisseur: "Direction", entrees: "Prescriptions", numero: "9", ressources: "Dossier licence", designation: { name: "Maintenir la licence", url: urlDoc("sipoc/manager/licence") }, sorties: "Conformite", processusClient: "Autorite" },
          ],
        },
      ],
    },

    P02: {
      phases: [
        {
          key: "P02-PH1",
          name: "Phase 1 - Prospection",
          rows: [
            { ref: "VEN-01", phase: "Phase 1 - Prospection", processusFournisseur: "Marketing", entrees: "Leads", numero: "1", ressources: "CRM", designation: { name: "Prospecter", url: urlProcess("SP0201") }, sorties: "Leads qualifies", processusClient: "Commercial" },
          ],
        },
        {
          key: "P02-PH2",
          name: "Phase 2 - Qualification & Offre",
          rows: [
            { ref: "VEN-02", phase: "Phase 2 - Qualification & Offre", processusFournisseur: "Commercial", entrees: "Leads qualifies", numero: "2", ressources: "Script / Email", designation: { name: "Qualifier", url: urlProcess("SP0202") }, sorties: "Besoin clarifie", processusClient: "Avant-vente" },
            { ref: "VEN-03", phase: "Phase 2 - Qualification & Offre", processusFournisseur: "Avant-vente", entrees: "Besoin clarifie", numero: "3", ressources: "Catalogue", designation: { name: "Construire l'offre", url: urlDoc("sipoc/vendre/offre") }, sorties: "Offre envoyee", processusClient: "Client" },
          ],
        },
        {
          key: "P02-PH3",
          name: "Phase 3 - Negociation & Contrat",
          rows: [
            { ref: "VEN-04", phase: "Phase 3 - Negociation & Contrat", processusFournisseur: "Client", entrees: "Offre envoyee", numero: "4", ressources: "Reunions", designation: { name: "Negocier", url: urlDoc("sipoc/vendre/negocier") }, sorties: "Accord", processusClient: "Commercial" },
            { ref: "VEN-05", phase: "Phase 3 - Negociation & Contrat", processusFournisseur: "Commercial", entrees: "Accord", numero: "5", ressources: "Contrat", designation: { name: "Contractualiser", url: urlProcess("SP0203") }, sorties: "Contrat signe", processusClient: "ADV" },
            { ref: "VEN-06", phase: "Phase 3 - Negociation & Contrat", processusFournisseur: "ADV", entrees: "Contrat signe", numero: "6", ressources: "ERP", designation: { name: "Creer la commande", url: urlDoc("sipoc/vendre/commande") }, sorties: "Commande creee", processusClient: "Planification" },
          ],
        },
      ],
    },

    P03: {
      phases: [
        {
          key: "P03-PH1",
          name: "Phase 1 - Collecter & Estimer",
          rows: [
            { ref: "PLA-01", phase: "Phase 1 - Collecter & Estimer", processusFournisseur: "Ventes", entrees: "Commande / Contrat", numero: "1", ressources: "CRM/ERP", designation: { name: "Collecter les demandes", url: urlProcess("SP0301") }, sorties: "Backlog consolide", processusClient: "Programme" },
            { ref: "PLA-02", phase: "Phase 1 - Collecter & Estimer", processusFournisseur: "Programme", entrees: "Backlog", numero: "2", ressources: "Roadmap", designation: { name: "Estimer la charge", url: urlDoc("sipoc/planifier/estimer") }, sorties: "Charge estimee", processusClient: "RH/Operations" },
          ],
        },
        {
          key: "P03-PH2",
          name: "Phase 2 - Allouer",
          rows: [
            { ref: "PLA-03", phase: "Phase 2 - Allouer", processusFournisseur: "RH", entrees: "Charge estimee", numero: "3", ressources: "Capacite", designation: { name: "Allouer les ressources", url: urlProcess("SP0302") }, sorties: "Capacite allouee", processusClient: "Programme" },
          ],
        },
        {
          key: "P03-PH3",
          name: "Phase 3 - Construire & Valider",
          rows: [
            { ref: "PLA-04", phase: "Phase 3 - Construire & Valider", processusFournisseur: "Programme", entrees: "Capacite allouee", numero: "4", ressources: "Planning", designation: { name: "Construire le planning", url: urlDoc("sipoc/planifier/planning") }, sorties: "Planning propose", processusClient: "Direction" },
            { ref: "PLA-05", phase: "Phase 3 - Construire & Valider", processusFournisseur: "Direction", entrees: "Planning propose", numero: "5", ressources: "Comite", designation: { name: "Valider le planning", url: urlProcess("SP0303") }, sorties: "Planning valide", processusClient: "Tous" },
          ],
        },
      ],
    },

    P04: {
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

    P05: {
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

    P06: {
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

  // --- SIPOC for sub-processes ---
  const SUB_SIPOC_DATA = {
    SP0201: {
      phases: [
        {
          key: "SP0201-PH1",
          name: "Prospection",
          rows: [
            { ref: "Spros-01", processusFournisseur: "Marketing", entrees: "Cibles", numero: "1", ressources: "CRM", designation: { name: "Identifier des cibles", url: urlDoc("sipoc/sp0201/cibles") }, sorties: "Liste cibles", processusClient: "Commercial" },
            { ref: "Spros-02", processusFournisseur: "Commercial", entrees: "Liste cibles", numero: "2", ressources: "Email/Tel", designation: { name: "Contacter", url: urlDoc("sipoc/sp0201/contacter") }, sorties: "Contact etabli", processusClient: "Commercial" },
            { ref: "Spros-03", processusFournisseur: "Commercial", entrees: "Contact", numero: "3", ressources: "Script", designation: { name: "Qualifier rapidement", url: urlProcess("SP0202") }, sorties: "Lead qualifie", processusClient: "Avant-vente" },
          ],
        },
      ],
    },
    SP0202: {
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
    SP0203: {
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
    SP0301: {
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
    SP0302: {
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
    SP0303: {
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

  // 1) Create SIPOC + logigramme for root processes
  console.log("[seed] creating SIPOC for root processes...");
  for (const root of roots) {
    const conf = SIPOC_DATA[root.code];
    if (!conf) continue;

    const phases = conf.phases || [];
    const flatRows = phases.flatMap((p) => p.rows || []);

    // Create SIPOC in normalized tables
    await createSipocForProcess(root.id, phases);

    // Update logigramme
    await root.update({
      logigramme: buildLogigrammeFromSipoc(flatRows),
    });

    console.log(`  [seed] SIPOC created for ${root.code} (${phases.length} phases, ${flatRows.length} rows)`);
  }

  // 1.b) Custom logigramme for P04 (Visio-like)
  const p04 = roots.find((p) => p.code === "P04");
  if (p04) {
    const conf = SIPOC_DATA["P04"];
    const phases = conf?.phases || [];
    const rows = phases.flatMap((p) => p.rows || []);

    if (rows.length) {
      const lg = buildLogigrammeFromSipoc(rows, { startX: 120, startY: 80, colWidth: 320, rowHeight: 140, wrapAt: 4 });

      const pos = {
        "PROG-01": { x: 520, y: 20 },
        "PROG-02": { x: 160, y: 190 },
        "PROG-03": { x: 520, y: 190 },
        "PROG-04": { x: 880, y: 190 },
      };

      lg.nodes = (lg.nodes || []).map((n) => {
        const id = String(n.id);
        const p = pos[id] || n.position || { x: 0, y: 0 };
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

      await p04.update({ logigramme: lg });
    }
  }

  // 2) Create SIPOC for sub-processes
  console.log("[seed] creating SIPOC for sub-processes...");
  for (const sub of subs) {
    const conf = SUB_SIPOC_DATA[sub.code];
    if (!conf) continue;

    const phases = conf.phases || [];
    const flatRows = phases.flatMap((p) => p.rows || []);

    // Create SIPOC in normalized tables
    await createSipocForProcess(sub.id, phases);

    // Update logigramme
    await sub.update({
      logigramme: buildLogigrammeFromSipoc(flatRows, { wrapAt: 3 }),
    });

    console.log(`  [seed] SIPOC created for ${sub.code} (${phases.length} phases, ${flatRows.length} rows)`);
  }

  // Summary
  const totalSipocs = await Sipoc.count();
  const totalPhases = await SipocPhase.count();
  const totalRows = await SipocRow.count();

  console.log("\n[seed] SUMMARY:");
  console.log(`  - Processes: ${roots.length + subs.length}`);
  console.log(`  - SIPOCs: ${totalSipocs}`);
  console.log(`  - SIPOC Phases: ${totalPhases}`);
  console.log(`  - SIPOC Rows: ${totalRows}`);
  console.log(`  - Stakeholders: ${await Stakeholder.count()}`);

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
