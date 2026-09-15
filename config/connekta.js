import axios from "axios";
import "dotenv/config";

/* ─── Validación de entorno ──────────────────────────────────────────────────
   A diferencia del cliente original (Backend-traslados), acá NO validamos en
   tiempo de import: en Vercel todas las rutas del backend corren dentro de la
   misma función serverless, así que un `process.exit` acá tumbaría también
   `/api/dotaciones`, `/api/actas`, etc. La validación se hace de forma lazy,
   dentro de `ejecutarConsulta`, así que una env var faltante solo degrada
   `/api/siesa` (lanza un Error que el controller convierte en `estado:'error'`).
   ────────────────────────────────────────────────────────────────────────── */

function getConfig() {
  const BASE_URL = process.env.CONNEKTA_BASE_URL;
  const ID_COMPANIA = process.env.CONNEKTA_ID_COMPANIA;
  const CONNI_KEY = process.env.CONNI_KEY;
  const CONNI_TOKEN = process.env.CONNI_TOKEN;

  if (!BASE_URL || !ID_COMPANIA) {
    throw new Error("Connekta no configurado: faltan CONNEKTA_BASE_URL o CONNEKTA_ID_COMPANIA");
  }
  if (!CONNI_KEY || !CONNI_TOKEN) {
    throw new Error("Connekta no configurado: faltan CONNI_KEY o CONNI_TOKEN");
  }

  return {
    BASE_URL,
    ID_COMPANIA,
    AUTH_HEADERS: { conniKey: CONNI_KEY, conniToken: CONNI_TOKEN },
  };
}

/* ─── Reintentos ────────────────────────────────────────────────────────────
   Misma lógica que Backend-traslados/src/config/connekta.js: reintentamos
   429 (rate limit) y 5xx (incluye deadlocks de SQL Server), no reintentamos
   4xx que no sea 429 (culpa nuestra, no tiene sentido reintentar).
   ────────────────────────────────────────────────────────────────────────── */

const MAX_INTENTOS = Number(process.env.CONNEKTA_MAX_INTENTOS) || 4;
const BACKOFF_BASE_MS = 800;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const esDeadlock = (detalle) => /deadlock/i.test(String(detalle || ""));

function esReintentable(error) {
  const status = error?.response?.status;
  if (!status) return true;
  if (status === 429) return true;
  return status >= 500;
}

function esperaAntesDeReintentar(error, intento) {
  const reset = error?.response?.headers?.["connekta-rate-limit-reset"];
  if (error?.response?.status === 429 && typeof reset === "string") {
    const [mm, ss] = reset.split(":").map(Number);
    if (Number.isFinite(mm) && Number.isFinite(ss)) {
      return Math.min((mm * 60 + ss) * 1000 + 500, 60_000);
    }
  }
  const exponencial = BACKOFF_BASE_MS * 2 ** (intento - 1);
  return Math.min(exponencial, 15_000) + Math.random() * 500;
}

/**
 * Ejecutar una consulta registrada en Connekta, reintentando fallos transitorios.
 *
 * @param {string} descripcion - Nombre del query registrado
 * @param {number} pagina - Número de página (default: 1)
 * @param {number} tamPag - Tamaño de página (default: 100)
 * @returns {Promise<{ datos: object[], total: number, pagina: number, totalPaginas: number }>}
 */
export async function ejecutarConsulta(descripcion, pagina = 1, tamPag = 100) {
  const { BASE_URL, ID_COMPANIA, AUTH_HEADERS } = getConfig();
  let ultimoError;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const response = await axios.get(`${BASE_URL}/ejecutarconsulta`, {
        headers: AUTH_HEADERS,
        params: {
          idCompania: ID_COMPANIA,
          descripcion,
          paginacion: `numPag=${pagina}|tamPag=${tamPag}`,
        },
        timeout: 60_000,
      });

      const body = response.data;

      if (body.codigo !== 0) {
        throw new Error(
          `Connekta error [${body.codigo}]: ${body.mensaje || ""} — ${body.detalle || ""}`,
        );
      }

      return {
        datos: body.detalle?.Datos || [],
        total: body.detalle?.total_registros || 0,
        pagina: body.detalle?.página_actual || pagina,
        totalPaginas: body.detalle?.total_páginas || 1,
      };
    } catch (error) {
      ultimoError = error;
      if (!esReintentable(error) || intento === MAX_INTENTOS) break;

      const espera = esperaAntesDeReintentar(error, intento);
      const causa = esDeadlock(error?.response?.data?.detalle)
        ? "deadlock"
        : error?.response?.status || error.code || "error de red";
      console.warn(
        `[connekta] pág ${pagina} falló (${causa}) — reintento ${intento}/${MAX_INTENTOS - 1} en ${Math.round(espera)}ms`,
      );
      await dormir(espera);
    }
  }

  const detalle = ultimoError?.response?.data?.detalle;
  const status = ultimoError?.response?.status;
  throw new Error(
    `Connekta falló en pág ${pagina} tras ${MAX_INTENTOS} intentos` +
      `${status ? ` [HTTP ${status}]` : ""}: ${detalle || ultimoError?.message || "error desconocido"}`,
    { cause: ultimoError },
  );
}
