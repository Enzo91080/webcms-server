-- Migration: Ajouter les champs de lien à la table process_stakeholders
-- Ces champs étaient auparavant dans la table stakeholders, mais ils dépendent
-- du contexte process/stakeholder et doivent donc être dans la table de jointure.

-- Ajouter les colonnes si elles n'existent pas
DO $$
BEGIN
    -- needs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'needs') THEN
        ALTER TABLE process_stakeholders ADD COLUMN needs TEXT;
    END IF;

    -- expectations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'expectations') THEN
        ALTER TABLE process_stakeholders ADD COLUMN expectations TEXT;
    END IF;

    -- evaluationCriteria
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'evaluationCriteria') THEN
        ALTER TABLE process_stakeholders ADD COLUMN "evaluationCriteria" TEXT;
    END IF;

    -- requirements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'requirements') THEN
        ALTER TABLE process_stakeholders ADD COLUMN requirements TEXT;
    END IF;

    -- strengths
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'strengths') THEN
        ALTER TABLE process_stakeholders ADD COLUMN strengths TEXT;
    END IF;

    -- weaknesses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'weaknesses') THEN
        ALTER TABLE process_stakeholders ADD COLUMN weaknesses TEXT;
    END IF;

    -- opportunities
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'opportunities') THEN
        ALTER TABLE process_stakeholders ADD COLUMN opportunities TEXT;
    END IF;

    -- risks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'risks') THEN
        ALTER TABLE process_stakeholders ADD COLUMN risks TEXT;
    END IF;

    -- actionPlan
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'actionPlan') THEN
        ALTER TABLE process_stakeholders ADD COLUMN "actionPlan" TEXT;
    END IF;

    -- timestamps (createdAt, updatedAt)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'createdAt') THEN
        ALTER TABLE process_stakeholders ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'process_stakeholders' AND column_name = 'updatedAt') THEN
        ALTER TABLE process_stakeholders ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Créer les index si ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_process_stakeholders_processId ON process_stakeholders ("processId");
CREATE INDEX IF NOT EXISTS idx_process_stakeholders_stakeholderId ON process_stakeholders ("stakeholderId");
