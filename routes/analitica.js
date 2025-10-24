import { Router } from "express";
import { 
  obtenerTodosDatos, 
  obtenerEstadisticas, 
  obtenerPorEstado, 
  obtenerResumenDevoluciones 
} from "../controllers/Analitica.js";

const router = Router();

// Ruta para obtener todos los datos
router.get("/datos", obtenerTodosDatos);

// Ruta para obtener estadísticas generales
router.get("/estadisticas", obtenerEstadisticas);

// Ruta para obtener datos por estado (activo/inactivo)
router.get("/estado/:activo", obtenerPorEstado);

// Ruta para obtener resumen de devoluciones
router.get("/devoluciones", obtenerResumenDevoluciones);

export default router;
