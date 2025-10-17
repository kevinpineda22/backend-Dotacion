import express from 'express';
import { desactivarPersonal } from '../controllers/ActasDotacion.js';

const router = express.Router();

// Ruta para desactivar personal y registrar devolución/observación
router.put('/dotaciones/:id/desactivar', desactivarPersonal);

export default router;
