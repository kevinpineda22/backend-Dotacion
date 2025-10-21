import express from 'express';
import { desactivarPersonal,reactivarPersonal } from '../controllers/ActasDotacion.js';

const router = express.Router();

// Ruta para desactivar personal y registrar devolución/observación
router.put('/dotaciones/:id/desactivar', desactivarPersonal);
router.put('/dotaciones/:id/reactivar', reactivarPersonal);

export default router;
