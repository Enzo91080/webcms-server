import { sequelize } from "../config/db.js";
import { env } from "../config/env.js";
import { Process } from "../models/Process.js";
import { User } from "../models/User.js";
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
 * Découpe une liste "plate" en phases, et garde aussi un rows flat (compat).
 * Ici, par défaut : on utilise la propriété row.phase si elle existe, sinon "Phase unique".
 */
function toSipocPhases(rows, { defaultPhaseName = "Phase unique" } = {}) {
  const safe = Array.isArray(rows) ? rows : [];
  const map = new Map();

  for (const r of safe) {
    const phaseName = String(r?.phase || defaultPhaseName);
    if (!map.has(phaseName)) map.set(phaseName, []);
    map.get(phaseName).push(r);
  }

  const phases = [...map.entries()].map(([name, phaseRows], idx) => ({
    key: `PH-${idx + 1}`,
    name,
    rows: phaseRows,
  }));

  return { phases, rows: safe };
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

  await Process.destroy({ where: {} });

  // --- Racines (ordre imposé) ---
  const roots = await Process.bulkCreate(
    [
      {
        code: "P01",
        name: "Manager l'entreprise",
        title: "Définir la stratégie, piloter l'entreprise et assurer la conformité.",
        parentProcessId: null,
        orderInParent: 1,
        objectives: md([
          "1. Définir la stratégie de l'entreprise, c'est définir :",
          "   - l'OP",
          "   - la Politique qualité",
          "   - les objectifs de la société",
          "   - la Communication",
          "   - l'adéquation charge/capacité des Ressources Humaines",
          "2. Piloter les finances",
          "3. Piloter les Ressources Humaines",
          "4. Mettre en œuvre la communication",
          "5. Piloter l'amélioration et la réalisation des objectifs",
          "6. S'assurer de la disponibilité des moyens",
          "7. Assurer la gestion de la documentation",
          "8. Maintenir la licence opérateur (répondre aux prescriptions annuelles)",
          "9. Piloter la chaîne de valeur",
        ]),
        stakeholders: ["Direction", "Qualité", "Finance", "RH"],
        referenceDocuments: [
          {
            code: "DOC-MAN-001",
            title: "Revue de direction — trame",
            type: "DOCX",
            url: urlDoc("docs/revue-direction.docx"),
          },
          {
            code: "DOC-MAN-002",
            title: "Politique qualité — modèle",
            type: "PDF",
            url: urlDoc("docs/politique-qualite.pdf"),
          },
        ],
      },
      {
        code: "P02",
        name: "Vendre",
        title: "Transformer des opportunités en contrats et commandes.",
        parentProcessId: null,
        orderInParent: 2,
        objectives: md([
          "- Prospecter et qualifier les opportunités.",
          "- Construire une offre conforme au besoin.",
          "- Négocier et contractualiser.",
          "- Transmettre à la planification / exécution.",
        ]),
        stakeholders: ["Commercial", "Avant-vente", "ADV", "Finance"],
        referenceDocuments: [
          { code: "DOC-VEN-001", title: "Guide de qualification", type: "PDF", url: urlDoc("docs/qualification.pdf") },
          { code: "DOC-VEN-002", title: "Modèle de contrat", type: "DOCX", url: urlDoc("docs/contrat.docx") },
        ],
      },
      {
        code: "P03",
        name: "Planifier",
        title: "Organiser la charge, la capacité et le planning.",
        parentProcessId: null,
        orderInParent: 3,
        objectives: md(["- Collecter les besoins.", "- Allouer les ressources.", "- Publier un planning validé."]),
        stakeholders: ["Programme", "Opérations", "RH"],
        referenceDocuments: [{ code: "DOC-PLA-001", title: "Règles de planification", type: "PDF", url: urlDoc("docs/regles-planification.pdf") }],
      },
      {
        code: "P04",
        name: "Manager le Programme",
        title: "Gouverner, piloter la performance et les risques.",
        parentProcessId: null,
        orderInParent: 4,
        objectives: md(["- Assurer la gouvernance.", "- Suivre les KPI.", "- Gérer les risques et arbitrages."]),
        stakeholders: ["PMO", "Direction", "Qualité"],
        referenceDocuments: [{ code: "DOC-PROG-001", title: "Plan de management programme", type: "PDF", url: urlDoc("docs/pmp.pdf") }],
      },
      {
        code: "P05",
        name: "Réaliser",
        title: "Exécuter les activités, contrôler la qualité et livrer.",
        parentProcessId: null,
        orderInParent: 5,
        objectives: md(["- Exécuter les tâches.", "- Contrôler la qualité.", "- Livrer conformément aux engagements."]),
        stakeholders: ["Opérations", "Qualité", "Client"],
        referenceDocuments: [{ code: "DOC-REA-001", title: "Instruction de travail — modèle", type: "DOCX", url: urlDoc("docs/instruction-travail.docx") }],
      },
      {
        code: "P06",
        name: "Valider",
        title: "Recetter, valider et clôturer.",
        parentProcessId: null,
        orderInParent: 6,
        objectives: md(["- Préparer et exécuter la recette.", "- Valider la conformité.", "- Capitaliser et clôturer."]),
        stakeholders: ["Qualité", "Client", "Programme"],
        referenceDocuments: [
          { code: "DOC-VAL-001", title: "PV de recette — modèle", type: "DOCX", url: urlDoc("docs/pv-recette.docx") },
          { code: "DOC-VAL-002", title: "RETEX — modèle", type: "DOCX", url: urlDoc("docs/retex.docx") },
        ],
      },
    ],
    { returning: true }
  );

  const byCode = (list, code) => list.find((x) => x.code === code);

  const P01 = byCode(roots, "P01");
  const P02 = byCode(roots, "P02");
  const P03 = byCode(roots, "P03");
  const P04 = byCode(roots, "P04");
  const P05 = byCode(roots, "P05");
  const P06 = byCode(roots, "P06");

  // Debug: vérifier que les IDs sont bien récupérés
  console.log("[seed] IDs des processus racines:");
  console.log(`  P01: ${P01?.id} (type: ${typeof P01?.id})`);
  console.log(`  P02: ${P02?.id} (type: ${typeof P02?.id})`);
  console.log(`  P03: ${P03?.id} (type: ${typeof P03?.id})`);
  console.log(`  P04: ${P04?.id} (type: ${typeof P04?.id})`);
  console.log(`  P05: ${P05?.id} (type: ${typeof P05?.id})`);
  console.log(`  P06: ${P06?.id} (type: ${typeof P06?.id})`);

  // S'assurer que les IDs sont bien des UUIDs (strings)
  const getParentId = (process) => {
    if (!process) {
      console.error("[seed] Processus parent non trouvé!");
      return null;
    }
    const id = process.id || process.dataValues?.id || process.get?.("id");
    if (!id) {
      console.error(`[seed] Impossible de récupérer l'ID pour ${process.code}`);
      return null;
    }
    return String(id);
  };

  // --- Sous-processus (cohérents) ---
  const subs = await Process.bulkCreate(
    [
      { code: "SP0101", name: "Définir la stratégie", title: "Formaliser la stratégie et les objectifs.", parentProcessId: getParentId(P01), orderInParent: 1, stakeholders: ["Direction"] },
      { code: "SP0102", name: "Piloter les finances", title: "Suivre le budget, trésorerie, investissements.", parentProcessId: getParentId(P01), orderInParent: 2, stakeholders: ["Finance"] },
      { code: "SP0103", name: "Piloter les Ressources Humaines", title: "Gérer les effectifs, compétences, charge/capacité.", parentProcessId: getParentId(P01), orderInParent: 3, stakeholders: ["RH"] },
      { code: "SP0201", name: "Prospecter", title: "Identifier et contacter des prospects.", parentProcessId: getParentId(P02), orderInParent: 1, stakeholders: ["Commercial"] },
      { code: "SP0202", name: "Qualifier", title: "Qualifier les besoins et la faisabilité.", parentProcessId: getParentId(P02), orderInParent: 2, stakeholders: ["Commercial", "Avant-vente"] },
      { code: "SP0203", name: "Contractualiser", title: "Négocier et finaliser le contrat.", parentProcessId: getParentId(P02), orderInParent: 3, stakeholders: ["Commercial", "ADV", "Juridique"] },
      { code: "SP0301", name: "Collecter les demandes", title: "Collecter et consolider les besoins.", parentProcessId: getParentId(P03), orderInParent: 1, stakeholders: ["Programme"] },
      { code: "SP0302", name: "Allouer les ressources", title: "Allouer capacité et moyens.", parentProcessId: getParentId(P03), orderInParent: 2, stakeholders: ["RH", "Opérations"] },
      { code: "SP0303", name: "Valider le planning", title: "Arbitrer et publier un planning.", parentProcessId: getParentId(P03), orderInParent: 3, stakeholders: ["Direction", "Programme"] },
      { code: "SP0401", name: "Gouvernance", title: "Organiser comités et décisions.", parentProcessId: getParentId(P04), orderInParent: 1, stakeholders: ["PMO", "Direction"] },
      { code: "SP0402", name: "Suivi KPI", title: "Suivre indicateurs et performance.", parentProcessId: getParentId(P04), orderInParent: 2, stakeholders: ["PMO", "Qualité"] },
      { code: "SP0403", name: "Gestion des risques", title: "Identifier, traiter et suivre les risques.", parentProcessId: getParentId(P04), orderInParent: 3, stakeholders: ["PMO", "Opérations"] },
      { code: "SP0501", name: "Exécuter", title: "Réaliser les activités prévues.", parentProcessId: getParentId(P05), orderInParent: 1, stakeholders: ["Opérations"] },
      { code: "SP0502", name: "Contrôler la qualité", title: "Contrôler conformité et traiter non-conformités.", parentProcessId: getParentId(P05), orderInParent: 2, stakeholders: ["Qualité", "Opérations"] },
      { code: "SP0503", name: "Livrer", title: "Préparer et livrer le résultat.", parentProcessId: getParentId(P05), orderInParent: 3, stakeholders: ["Opérations", "Client"] },
      { code: "SP0601", name: "Recetter", title: "Préparer et exécuter la recette.", parentProcessId: getParentId(P06), orderInParent: 1, stakeholders: ["Qualité", "Client"] },
      { code: "SP0602", name: "Valider conformité", title: "Valider conformité et accepter.", parentProcessId: getParentId(P06), orderInParent: 2, stakeholders: ["Qualité", "Client"] },
      { code: "SP0603", name: "Clôturer", title: "Clôturer et capitaliser.", parentProcessId: getParentId(P06), orderInParent: 3, stakeholders: ["Programme", "Qualité"] },
    ],
    { returning: true }
  );

  // Debug: vérifier les parentProcessId créés
  console.log("[seed] Vérification des parentProcessId des sous-processus:");
  subs.forEach((sub) => {
    console.log(`  ${sub.code}: parentProcessId=${sub.parentProcessId} (type: ${typeof sub.parentProcessId})`);
  });

  const get = (code) => [...roots, ...subs].find((p) => p.code === code);

  // --- SIPOC (par phases, mais compatible rows flat) ---
  // IMPORTANT: ici j'ai choisi des phases "logiques" pour découper. Tu peux renommer les phases sans impact.
  const SIPOC = {
    P01: {
      phases: [
        {
          key: "P01-PH1",
          name: "Phase 1 — Cadrer",
          rows: [
            { ref: "MAN-01", phase: "Phase 1 — Cadrer", processusFournisseur: "Direction", entrees: "Contexte / données", numero: "1", ressources: "Tableaux de bord", designation: { name: "Analyser le contexte", url: urlDoc("sipoc/manager/analyser") }, sorties: "Diagnostic", processusClient: "Direction" },
            { ref: "MAN-02", phase: "Phase 1 — Cadrer", processusFournisseur: "Direction", entrees: "Diagnostic", numero: "2", ressources: "Ateliers", designation: { name: "Définir la stratégie", url: urlProcess("SP0101") }, sorties: "Stratégie", processusClient: "Direction" },
            { ref: "MAN-03", phase: "Phase 1 — Cadrer", processusFournisseur: "Direction", entrees: "Stratégie", numero: "3", ressources: "OKR", designation: { name: "Fixer objectifs", url: urlDoc("sipoc/manager/objectifs") }, sorties: "Objectifs", processusClient: "Programme" },
          ],
        },
        {
          key: "P01-PH2",
          name: "Phase 2 — Piloter",
          rows: [
            { ref: "MAN-04", phase: "Phase 2 — Piloter", processusFournisseur: "RH", entrees: "Objectifs", numero: "4", ressources: "Plan de charge", designation: { name: "Ajuster charge/capacité", url: urlProcess("SP0103") }, sorties: "Capacité validée", processusClient: "Opérations" },
            { ref: "MAN-05", phase: "Phase 2 — Piloter", processusFournisseur: "Finance", entrees: "Objectifs", numero: "5", ressources: "Budget", designation: { name: "Piloter finances", url: urlProcess("SP0102") }, sorties: "Budget suivi", processusClient: "Direction" },
            { ref: "MAN-06", phase: "Phase 2 — Piloter", processusFournisseur: "Qualité", entrees: "Indicateurs", numero: "6", ressources: "Revue", designation: { name: "Revue de direction", url: urlDoc("sipoc/manager/revue") }, sorties: "Décisions", processusClient: "Direction" },
          ],
        },
        {
          key: "P01-PH3",
          name: "Phase 3 — Améliorer & Conformer",
          rows: [
            { ref: "MAN-07", phase: "Phase 3 — Améliorer & Conformer", processusFournisseur: "Qualité", entrees: "Décisions", numero: "7", ressources: "Plan d'actions", designation: { name: "Amélioration continue", url: urlDoc("sipoc/manager/amelioration") }, sorties: "Actions", processusClient: "Tous" },
            { ref: "MAN-08", phase: "Phase 3 — Améliorer & Conformer", processusFournisseur: "Qualité", entrees: "Docs", numero: "8", ressources: "GED", designation: { name: "Gérer la documentation", url: urlDoc("sipoc/manager/docs") }, sorties: "Docs à jour", processusClient: "Tous" },
            { ref: "MAN-09", phase: "Phase 3 — Améliorer & Conformer", processusFournisseur: "Direction", entrees: "Prescriptions", numero: "9", ressources: "Dossier licence", designation: { name: "Maintenir la licence", url: urlDoc("sipoc/manager/licence") }, sorties: "Conformité", processusClient: "Autorité" },
          ],
        },
      ],
    },

    P02: {
      phases: [
        {
          key: "P02-PH1",
          name: "Phase 1 — Prospection",
          rows: [{ ref: "VEN-01", phase: "Phase 1 — Prospection", processusFournisseur: "Marketing", entrees: "Leads", numero: "1", ressources: "CRM", designation: { name: "Prospecter", url: urlProcess("SP0201") }, sorties: "Leads qualifiés", processusClient: "Commercial" }],
        },
        {
          key: "P02-PH2",
          name: "Phase 2 — Qualification & Offre",
          rows: [
            { ref: "VEN-02", phase: "Phase 2 — Qualification & Offre", processusFournisseur: "Commercial", entrees: "Leads qualifiés", numero: "2", ressources: "Script / Email", designation: { name: "Qualifier", url: urlProcess("SP0202") }, sorties: "Besoin clarifié", processusClient: "Avant-vente" },
            { ref: "VEN-03", phase: "Phase 2 — Qualification & Offre", processusFournisseur: "Avant-vente", entrees: "Besoin clarifié", numero: "3", ressources: "Catalogue", designation: { name: "Construire l'offre", url: urlDoc("sipoc/vendre/offre") }, sorties: "Offre envoyée", processusClient: "Client" },
          ],
        },
        {
          key: "P02-PH3",
          name: "Phase 3 — Négociation & Contrat",
          rows: [
            { ref: "VEN-04", phase: "Phase 3 — Négociation & Contrat", processusFournisseur: "Client", entrees: "Offre envoyée", numero: "4", ressources: "Réunions", designation: { name: "Négocier", url: urlDoc("sipoc/vendre/negocier") }, sorties: "Accord", processusClient: "Commercial" },
            { ref: "VEN-05", phase: "Phase 3 — Négociation & Contrat", processusFournisseur: "Commercial", entrees: "Accord", numero: "5", ressources: "Contrat", designation: { name: "Contractualiser", url: urlProcess("SP0203") }, sorties: "Contrat signé", processusClient: "ADV" },
            { ref: "VEN-06", phase: "Phase 3 — Négociation & Contrat", processusFournisseur: "ADV", entrees: "Contrat signé", numero: "6", ressources: "ERP", designation: { name: "Créer la commande", url: urlDoc("sipoc/vendre/commande") }, sorties: "Commande créée", processusClient: "Planification" },
          ],
        },
      ],
    },

    P03: {
      phases: [
        {
          key: "P03-PH1",
          name: "Phase 1 — Collecter & Estimer",
          rows: [
            { ref: "PLA-01", phase: "Phase 1 — Collecter & Estimer", processusFournisseur: "Ventes", entrees: "Commande / Contrat", numero: "1", ressources: "CRM/ERP", designation: { name: "Collecter les demandes", url: urlProcess("SP0301") }, sorties: "Backlog consolidé", processusClient: "Programme" },
            { ref: "PLA-02", phase: "Phase 1 — Collecter & Estimer", processusFournisseur: "Programme", entrees: "Backlog", numero: "2", ressources: "Roadmap", designation: { name: "Estimer la charge", url: urlDoc("sipoc/planifier/estimer") }, sorties: "Charge estimée", processusClient: "RH/Opérations" },
          ],
        },
        {
          key: "P03-PH2",
          name: "Phase 2 — Allouer",
          rows: [{ ref: "PLA-03", phase: "Phase 2 — Allouer", processusFournisseur: "RH", entrees: "Charge estimée", numero: "3", ressources: "Capacité", designation: { name: "Allouer les ressources", url: urlProcess("SP0302") }, sorties: "Capacité allouée", processusClient: "Programme" }],
        },
        {
          key: "P03-PH3",
          name: "Phase 3 — Construire & Valider",
          rows: [
            { ref: "PLA-04", phase: "Phase 3 — Construire & Valider", processusFournisseur: "Programme", entrees: "Capacité allouée", numero: "4", ressources: "Planning", designation: { name: "Construire le planning", url: urlDoc("sipoc/planifier/planning") }, sorties: "Planning proposé", processusClient: "Direction" },
            { ref: "PLA-05", phase: "Phase 3 — Construire & Valider", processusFournisseur: "Direction", entrees: "Planning proposé", numero: "5", ressources: "Comité", designation: { name: "Valider le planning", url: urlProcess("SP0303") }, sorties: "Planning validé", processusClient: "Tous" },
          ],
        },
      ],
    },

    P04: {
      phases: [
        {
          key: "P04-PH1",
          name: "Phase 1 — Gouvernance",
          rows: [{ ref: "PROG-01", phase: "Phase 1 — Gouvernance", processusFournisseur: "Direction", entrees: "Objectifs", numero: "1", ressources: "Comités", designation: { name: "Mettre en place la gouvernance", url: urlProcess("SP0401") }, sorties: "Rituels", processusClient: "Programme" }],
        },
        {
          key: "P04-PH2",
          name: "Phase 2 — Pilotage",
          rows: [
            { ref: "PROG-02", phase: "Phase 2 — Pilotage", processusFournisseur: "Programme", entrees: "Rituels", numero: "2", ressources: "Tableaux", designation: { name: "Suivre les KPI", url: urlProcess("SP0402") }, sorties: "KPI à jour", processusClient: "Direction" },
            { ref: "PROG-03", phase: "Phase 2 — Pilotage", processusFournisseur: "Programme", entrees: "KPI", numero: "3", ressources: "Registre", designation: { name: "Gérer les risques", url: urlProcess("SP0403") }, sorties: "Risques traités", processusClient: "Direction" },
          ],
        },
        {
          key: "P04-PH3",
          name: "Phase 3 — Arbitrage",
          rows: [{ ref: "PROG-04", phase: "Phase 3 — Arbitrage", processusFournisseur: "Direction", entrees: "Risques", numero: "4", ressources: "Arbitrage", designation: { name: "Décider / arbitrer", url: urlDoc("sipoc/programme/arbitrer") }, sorties: "Décisions", processusClient: "Tous" }],
        },
      ],
    },

    P05: {
      phases: [
        {
          key: "P05-PH1",
          name: "Phase 1 — Lancer",
          rows: [{ ref: "REA-01", phase: "Phase 1 — Lancer", processusFournisseur: "Planification", entrees: "Planning validé", numero: "1", ressources: "Ordre de travail", designation: { name: "Lancer l'exécution", url: urlProcess("SP0501") }, sorties: "Travaux lancés", processusClient: "Opérations" }],
        },
        {
          key: "P05-PH2",
          name: "Phase 2 — Produire",
          rows: [{ ref: "REA-02", phase: "Phase 2 — Produire", processusFournisseur: "Opérations", entrees: "Travaux", numero: "2", ressources: "Procédures", designation: { name: "Réaliser", url: urlDoc("sipoc/realiser/realiser") }, sorties: "Résultat produit", processusClient: "Qualité" }],
        },
        {
          key: "P05-PH3",
          name: "Phase 3 — Contrôler & Livrer",
          rows: [
            { ref: "REA-03", phase: "Phase 3 — Contrôler & Livrer", processusFournisseur: "Qualité", entrees: "Résultat", numero: "3", ressources: "Plan de contrôle", designation: { name: "Contrôler la qualité", url: urlProcess("SP0502") }, sorties: "Conformité", processusClient: "Client" },
            { ref: "REA-04", phase: "Phase 3 — Contrôler & Livrer", processusFournisseur: "Opérations", entrees: "Conformité", numero: "4", ressources: "Checklists", designation: { name: "Préparer la livraison", url: urlDoc("sipoc/realiser/livraison") }, sorties: "Livrable prêt", processusClient: "Client" },
            { ref: "REA-05", phase: "Phase 3 — Contrôler & Livrer", processusFournisseur: "Opérations", entrees: "Livrable prêt", numero: "5", ressources: "Transport", designation: { name: "Livrer", url: urlProcess("SP0503") }, sorties: "Livré", processusClient: "Valider" },
          ],
        },
      ],
    },

    P06: {
      phases: [
        {
          key: "P06-PH1",
          name: "Phase 1 — Préparer",
          rows: [{ ref: "VAL-01", phase: "Phase 1 — Préparer", processusFournisseur: "Réalisation", entrees: "Livré", numero: "1", ressources: "Plan de recette", designation: { name: "Préparer la recette", url: urlProcess("SP0601") }, sorties: "Recette prête", processusClient: "Client" }],
        },
        {
          key: "P06-PH2",
          name: "Phase 2 — Exécuter",
          rows: [{ ref: "VAL-02", phase: "Phase 2 — Exécuter", processusFournisseur: "Client", entrees: "Recette prête", numero: "2", ressources: "Cas de test", designation: { name: "Exécuter la recette", url: urlDoc("sipoc/valider/executer") }, sorties: "Résultats", processusClient: "Qualité" }],
        },
        {
          key: "P06-PH3",
          name: "Phase 3 — Valider & Clôturer",
          rows: [
            { ref: "VAL-03", phase: "Phase 3 — Valider & Clôturer", processusFournisseur: "Qualité", entrees: "Résultats", numero: "3", ressources: "PV", designation: { name: "Valider conformité", url: urlProcess("SP0602") }, sorties: "Acceptation", processusClient: "Programme" },
            { ref: "VAL-04", phase: "Phase 3 — Valider & Clôturer", processusFournisseur: "Programme", entrees: "Acceptation", numero: "4", ressources: "RETEX", designation: { name: "Clôturer / Capitaliser", url: urlProcess("SP0603") }, sorties: "Clôturé", processusClient: "Direction" },
          ],
        },
      ],
    },
  };

  // 1) Appliquer SIPOC + logigramme auto pour chaque racine
  for (const root of roots) {
    const conf = SIPOC[root.code];
    const phases = conf?.phases || [];
    const rows = phases.flatMap((p) => (p.rows || []).map((r) => ({ ...r, phase: r.phase || p.name })));

    await root.update({
      sipoc: { phases, rows }, // <- phases + compat rows
      logigramme: buildLogigrammeFromSipoc(rows),
    });
  }

  // 1.b) Exemple "Visio-like" : logigramme avancé pour P04
  const p04 = roots.find((p) => p.code === "P04");
  if (p04) {
    const conf = SIPOC["P04"];
    const phases = conf?.phases || [];
    const rows = phases.flatMap((p) => (p.rows || []).map((r) => ({ ...r, phase: r.phase || p.name })));

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
        { key: "5.", label: "Réaliser", bg: "#d1d5db", color: "#111827" },
        { key: "6.", label: "Valider", bg: "#dcfce7", color: "#111827" },
      ];

      await p04.update({ logigramme: lg });
    }
  }

  // 2) Ajouter des SIPOC simples aux sous-processus (inchangé, mais stockés aussi en phases)
  const subSipoc = [
    ["SP0201", ["Spros-01", "Identifier des cibles", urlDoc("sipoc/sp0201/cibles")], ["Spros-02", "Contacter", urlDoc("sipoc/sp0201/contacter")], ["Spros-03", "Qualifier rapidement", urlProcess("SP0202")]],
    ["SP0202", ["Squal-01", "Prendre contact", urlDoc("sipoc/sp0202/contact")], ["Squal-02", "Comprendre le besoin", urlDoc("sipoc/sp0202/besoin")], ["Squal-03", "Décider GO/NOGO", urlDoc("sipoc/sp0202/go")]],
    ["SP0203", ["Scont-01", "Préparer le contrat", urlDoc("sipoc/sp0203/preparer")], ["Scont-02", "Négocier clauses", urlDoc("sipoc/sp0203/negocier")], ["Scont-03", "Signer", urlDoc("sipoc/sp0203/signer")]],
    ["SP0301", ["Spla-01", "Collecter demandes", urlDoc("sipoc/sp0301/collecter")], ["Spla-02", "Consolider", urlDoc("sipoc/sp0301/consolider")], ["Spla-03", "Prioriser", urlDoc("sipoc/sp0301/prioriser")]],
    ["SP0302", ["Sres-01", "Lister capacités", urlDoc("sipoc/sp0302/capacites")], ["Sres-02", "Allouer", urlDoc("sipoc/sp0302/allouer")], ["Sres-03", "Confirmer", urlDoc("sipoc/sp0302/confirmer")]],
    ["SP0303", ["Svar-01", "Préparer arbitrage", urlDoc("sipoc/sp0303/preparer")], ["Svar-02", "Valider", urlDoc("sipoc/sp0303/valider")], ["Svar-03", "Publier", urlDoc("sipoc/sp0303/publier")]],
    ["SP0501", ["Sexe-01", "Préparer ordre", urlDoc("sipoc/sp0501/ordre")], ["Sexe-02", "Exécuter", urlDoc("sipoc/sp0501/executer")], ["Sexe-03", "Remonter avancement", urlDoc("sipoc/sp0501/avancement")]],
    ["SP0502", ["Squa-01", "Contrôler", urlDoc("sipoc/sp0502/controler")], ["Squa-02", "Traiter NC", urlDoc("sipoc/sp0502/nc")], ["Squa-03", "Valider", urlDoc("sipoc/sp0502/valider")]],
    ["SP0503", ["Sliv-01", "Préparer", urlDoc("sipoc/sp0503/preparer")], ["Sliv-02", "Livrer", urlDoc("sipoc/sp0503/livrer")], ["Sliv-03", "Accuser réception", urlDoc("sipoc/sp0503/reception")]],
  ];

  for (const [code, a, b, c] of subSipoc) {
    const p = get(code);
    if (!p) continue;

    const rows = [
      { ref: a[0], phase: "Phase unique", processusFournisseur: "Amont", entrees: "Entrée", numero: "1", ressources: "Ressource", designation: { name: a[1], url: a[2] }, sorties: "Sortie", processusClient: "Aval" },
      { ref: b[0], phase: "Phase unique", processusFournisseur: "Amont", entrees: "Entrée", numero: "2", ressources: "Ressource", designation: { name: b[1], url: b[2] }, sorties: "Sortie", processusClient: "Aval" },
      { ref: c[0], phase: "Phase unique", processusFournisseur: "Amont", entrees: "Entrée", numero: "3", ressources: "Ressource", designation: { name: c[1], url: c[2] }, sorties: "Sortie", processusClient: "Aval" },
    ];

    const { phases } = toSipocPhases(rows);

    await p.update({
      sipoc: { phases, rows },
      logigramme: buildLogigrammeFromSipoc(rows, { wrapAt: 3 }),
    });
  }

  console.log("[seed] done");
  await sequelize.close();
}

run().catch(async (e) => {
  console.error("[seed] error", e);
  try {
    await sequelize.close();
  } catch { }
  process.exit(1);
});
