import express from 'express';
import processesRouter from './processes.js';

const router = express.Router();

router.use('/processes', processesRouter);

export default router;
