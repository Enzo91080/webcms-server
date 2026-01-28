import express from 'express';
import Process from '../../models/Process.js';

const router = express.Router();

/**
 * GET /api/admin/processes
 * Renvoie une liste plate de tous les processus
 */
router.get('/', async (req, res) => {
  try {
    const processes = await Process.findAll({
      order: [['orderInParent', 'ASC'], ['code', 'ASC']],
    });

    // Renvoyer les données telles quelles (avec id)
    const flatList = processes.map(process => {
      const plain = process.get({ plain: true });
      return {
        id: plain.id,
        code: plain.code,
        name: plain.name,
        parentProcessId: plain.parentProcessId,
        orderInParent: plain.orderInParent,
        isActive: plain.isActive,
        title: plain.title,
        objectives: plain.objectives,
        stakeholders: plain.stakeholders || [],
        referenceDocuments: plain.referenceDocuments || [],
        sipoc: plain.sipoc,
        logigramme: plain.logigramme,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      };
    });

    res.json({ data: flatList });
  } catch (error) {
    console.error('Error fetching processes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/processes/:id
 * Renvoie un processus complet par son ID
 */
router.get('/:id', async (req, res) => {
  try {
    const process = await Process.findByPk(req.params.id);

    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    const plain = process.get({ plain: true });
    const result = {
      id: plain.id,
      code: plain.code,
      name: plain.name,
      parentProcessId: plain.parentProcessId,
      orderInParent: plain.orderInParent,
      isActive: plain.isActive,
      title: plain.title,
      objectives: plain.objectives,
      stakeholders: plain.stakeholders || [],
      referenceDocuments: plain.referenceDocuments || [],
      sipoc: plain.sipoc,
      logigramme: plain.logigramme,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };

    res.json({ data: result });
  } catch (error) {
    console.error('Error fetching process:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/processes
 * Crée un nouveau processus
 */
router.post('/', async (req, res) => {
  try {
    const {
      code,
      name,
      parentProcessId,
      orderInParent,
      isActive,
      title,
      objectives,
      stakeholders,
      referenceDocuments,
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }

    const process = await Process.create({
      code: code.trim(),
      name: name.trim(),
      parentProcessId: parentProcessId || null,
      orderInParent: orderInParent || 1,
      isActive: isActive !== undefined ? isActive : true,
      title: title || null,
      objectives: objectives || null,
      stakeholders: Array.isArray(stakeholders) ? stakeholders : [],
      referenceDocuments: Array.isArray(referenceDocuments) ? referenceDocuments : [],
    });

    const plain = process.get({ plain: true });
    const result = {
      id: plain.id,
      code: plain.code,
      name: plain.name,
      parentProcessId: plain.parentProcessId,
      orderInParent: plain.orderInParent,
      isActive: plain.isActive,
      title: plain.title,
      objectives: plain.objectives,
      stakeholders: plain.stakeholders || [],
      referenceDocuments: plain.referenceDocuments || [],
      sipoc: plain.sipoc,
      logigramme: plain.logigramme,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };

    res.status(201).json({ data: result });
  } catch (error) {
    console.error('Error creating process:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'A process with this code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/processes/:id
 * Met à jour un processus
 */
router.patch('/:id', async (req, res) => {
  try {
    const process = await Process.findByPk(req.params.id);

    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    const {
      code,
      name,
      parentProcessId,
      orderInParent,
      isActive,
      title,
      objectives,
      stakeholders,
      referenceDocuments,
    } = req.body;

    // Préparer les champs à mettre à jour
    const updateData = {};
    if (code !== undefined) updateData.code = code.trim();
    if (name !== undefined) updateData.name = name.trim();
    if (parentProcessId !== undefined) updateData.parentProcessId = parentProcessId || null;
    if (orderInParent !== undefined) updateData.orderInParent = orderInParent;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (title !== undefined) updateData.title = title || null;
    if (objectives !== undefined) updateData.objectives = objectives || null;
    if (stakeholders !== undefined) updateData.stakeholders = Array.isArray(stakeholders) ? stakeholders : [];
    if (referenceDocuments !== undefined) updateData.referenceDocuments = Array.isArray(referenceDocuments) ? referenceDocuments : [];

    await process.update(updateData);

    const plain = process.get({ plain: true });
    const result = {
      id: plain.id,
      code: plain.code,
      name: plain.name,
      parentProcessId: plain.parentProcessId,
      orderInParent: plain.orderInParent,
      isActive: plain.isActive,
      title: plain.title,
      objectives: plain.objectives,
      stakeholders: plain.stakeholders || [],
      referenceDocuments: plain.referenceDocuments || [],
      sipoc: plain.sipoc,
      logigramme: plain.logigramme,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };

    res.json({ data: result });
  } catch (error) {
    console.error('Error updating process:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'A process with this code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/processes/:id
 * Supprime un processus
 */
router.delete('/:id', async (req, res) => {
  try {
    const process = await Process.findByPk(req.params.id);

    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    await process.destroy();

    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting process:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
