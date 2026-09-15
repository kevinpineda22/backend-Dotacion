import express from 'express';
import { reactivarPersonal } from '../controllers/ActasDotacion.js';

const router = express.Router();

router.put('/dotaciones/:id/reactivar', reactivarPersonal);

export default router;
