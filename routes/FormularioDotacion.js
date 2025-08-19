import express from 'express';
import { crearDotacion, obtenerDotaciones,obtenerDotacionPorDocumento } from '../controllers/FormularioDotacion.js';

const router = express.Router();

// Ruta para crear una nueva dotación
router.post('/dotacion', crearDotacion);
// Ruta para obtener todas las dotaciones
router.get('/dotaciones', obtenerDotaciones);

// Ruta para obtener una dotación por número de cédula
router.get('/dotacion/:documento', obtenerDotacionPorDocumento);

export default router;