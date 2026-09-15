import express from "express";
import { sincronizar, obtenerEstado } from "../controllers/siesaSync.js";

const router = express.Router();

// POST /api/siesa/sincronizar?forzar=1&dryRun=1
router.post("/sincronizar", sincronizar);

// GET /api/siesa/estado — nunca llama a Connekta, solo sirve el último estado persistido
router.get("/estado", obtenerEstado);

export default router;
