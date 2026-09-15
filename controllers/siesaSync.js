import { runSync, getEstado } from "../services/siesaSync.service.js";

// Envuelve `runSync`/`getEstado` en la respuesta HTTP. Devuelve 200 para
// cualquier resultado manejado (ok/stale/error/guard_rejected/never) — el
// panel decide qué mostrar según `estado`. Solo un throw inesperado da 500.

export const sincronizar = async (req, res) => {
  try {
    const forzar = req.query.forzar === "1" || req.query.forzar === "true";
    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";

    const resultado = await runSync({ forzar, dryRun });
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("siesaSync.sincronizar error:", error);
    return res.status(500).json({ error: "Error interno al sincronizar con SIESA", details: error.message });
  }
};

export const obtenerEstado = async (req, res) => {
  try {
    const resultado = await getEstado();
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("siesaSync.obtenerEstado error:", error);
    return res.status(500).json({ error: "Error interno al obtener el estado de sincronización", details: error.message });
  }
};
