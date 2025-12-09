import express from 'express';
import { crearDotacion, obtenerDotaciones,obtenerDotacionPorDocumento,confirmarDotacion,actualizarDotacion,appendEntrega,updateEntrega,subirFactura,validarDocumento, actualizarNombre, desactivarDotacion} from '../controllers/FormularioDotacion.js';

const router = express.Router();

// ---- CREACIÓN (incluye entrega inicial) ----
router.post('/dotacion', crearDotacion);

// ---- VALIDACIÓN DE DOCUMENTO ----
// Ruta para validar si un documento ya existe en el sistema
router.get('/dotacion/validar-documento/:documento', validarDocumento);

// ---- LECTURAS ----
// Ruta para obtener todas las dotaciones
router.get('/dotaciones', obtenerDotaciones);
// Ruta para obtener una dotación por número de cédula
router.get('/dotacion/:documento', obtenerDotacionPorDocumento);

// ---- ACTUALIZACIÓN GENÉRICA (opcional) ----
// Soporta mode: 'appendEntrega' y 'updateEntregaById' en el body (según la versión que te pasé)
// Ruta para actualizar una dotación por ID
router.put('/dotaciones/:id', actualizarDotacion); // Actulizar tallas y unidades de la dotación

// ---- ACTUALIZAR NOMBRE ----
router.put('/dotaciones/:id/nombre', actualizarNombre);

// ---- DESACTIVAR DOTACIÓN ----
router.put('/dotaciones/:id/desactivar', desactivarDotacion);

// ---- HISTORIAL: APPEND y UPDATE POR ENTREGA ----
router.post('/dotaciones/:id/entregas', appendEntrega);
router.put('/dotaciones/:id/entregas/:entregaId', updateEntrega);

// ---- CONFIRMAR DOTACIÓN (firma) ----
// Confirmar entrega de dotación (firma y factura por entrega)
router.post('/dotacion/confirmada', confirmarDotacion)

// Subir factura de bono calzado
router.post('/dotacion/factura', subirFactura);



export default router;