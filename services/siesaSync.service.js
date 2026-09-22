import supabase from "../supabase/cliente.js";
import { ejecutarConsulta } from "../config/connekta.js";

const CONSULTA = process.env.SIESA_CONSULTA_EMPLEADOS || "merkahorro_empleados_activos";
const TTL_MIN = Number(process.env.SIESA_SYNC_TTL_MIN) || 60;
const MIN_INTERVAL_SEC = Number(process.env.SIESA_SYNC_MIN_INTERVAL_SEC) || 60;
const MIN_EMPLEADOS = Number(process.env.SIESA_MIN_EMPLEADOS) || 200;
const GRACIA_DIAS = Number(process.env.SIESA_GRACIA_DIAS) || 30;
const CHUNK_SIZE = 200;
const MARCA_DESACTIVACION_SYNC = "Desactivado por sincronización SIESA";
/** Tabla de estado de sincronización (fila única). Ver supabase/siesa_sync_dotacion.sql */
const TABLA_SYNC = "siesa_sync_dotacion";

/** Normaliza un documento/nit a solo dígitos, sin espacios. */
export function cleanDigits(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\D/g, "");
}

/**
 * ¿Se debe rechazar la reconciliación por payload sospechosamente corto?
 * (guarda contra desactivación masiva por una respuesta degradada de SIESA)
 *
 * @param {number} count - filas activas recibidas de SIESA en este intento
 * @param {{ minEmpleados?: number, ultimoConteoOk?: number|null }} opts
 */
export function shouldRejectForGuard(count, { minEmpleados = MIN_EMPLEADOS, ultimoConteoOk = null } = {}) {
  if (count === 0) return true;
  if (count < minEmpleados) return true;
  if (ultimoConteoOk && count < 0.5 * ultimoConteoOk) return true;
  return false;
}

/**
 * ¿La fila está dentro del período de gracia? Un `created_at` ausente o
 * inválido se trata como registro establecido (fuera de gracia): el dato es
 * insuficiente para asumir que es un ingreso reciente.
 *
 * @param {string|null|undefined} createdAt
 * @param {Date} now
 * @param {number} graciaDias
 */
function estaEnGracia(createdAt, now, graciaDias) {
  if (!createdAt) return false;
  const fecha = new Date(createdAt);
  if (Number.isNaN(fecha.getTime())) return false;
  const edadDias = (now.getTime() - fecha.getTime()) / 86400000;
  return edadDias < graciaDias;
}

/**
 * Reconciliación pura: no toca Supabase ni Connekta.
 *
 * @param {Array<object>} siesaRows - filas crudas de SIESA (nit, nombre_empleado, fecha_ingreso, fecha_fin_contrato_vigente, id_tercero)
 * @param {Array<{id:*, documento:*, activo:boolean, created_at?:string, observacion_desactivacion?:string}>} dotacionRows - filas actuales de la tabla `dotaciones`
 * @param {Date} now - referencia de "ahora" para el período de gracia (parametrizable en tests)
 */
export function computeReconciliation(siesaRows, dotacionRows, now = new Date()) {
  // La consulta Connekta (`merkahorro_empleados_activos`) ya filtra
  // `fecha_retiro IS NULL`: toda fila que llega acá cuenta como presente,
  // sin importar `fecha_fin_contrato_vigente` (una prórroga sin registrar no
  // debe desactivar a nadie).
  const siesaActivosPorNit = new Map();
  for (const row of siesaRows) {
    const nit = cleanDigits(row.nit);
    if (!nit) continue;
    if (!siesaActivosPorNit.has(nit)) siesaActivosPorNit.set(nit, row);
  }

  const desactivarIds = [];
  const reactivarIds = [];
  let documentoInvalido = 0;
  let enGracia = 0;

  // documento (limpio) -> filas de dotación que lo comparten
  const porDocumento = new Map();
  for (const row of dotacionRows) {
    const documento = cleanDigits(row.documento);
    if (!documento) {
      documentoInvalido += 1;
      continue;
    }
    if (!porDocumento.has(documento)) porDocumento.set(documento, []);
    porDocumento.get(documento).push(row);
  }

  const duplicados = [];
  const documentosUsadosEnSiesa = new Set();

  for (const [documento, rows] of porDocumento.entries()) {
    const enSiesa = siesaActivosPorNit.has(documento);
    if (enSiesa) documentosUsadosEnSiesa.add(documento);

    if (rows.length > 1) {
      // Documento duplicado: se reporta para revisión manual (nunca se
      // auto-mergea), PERO `activo` sigue siendo función pura de la
      // presencia en SIESA — la duplicación solo agrega el flag, nunca
      // exime a la fila del flip.
      duplicados.push({ documento, ids: rows.map((r) => r.id), cantidad: rows.length });
    }

    // Semántica de `activo` en toda la app: solo `false` es inactivo.
    // Los registros históricos tienen `null` (la columna se agregó después)
    // y el frontend los trata como activos; acá igual.
    for (const row of rows) {
      const estaActivo = row.activo !== false;
      const enGraciaRow = estaEnGracia(row.created_at, now, GRACIA_DIAS);

      if (enSiesa && !estaActivo) {
        reactivarIds.push(row.id);
        continue;
      }

      if (!enSiesa && estaActivo) {
        if (enGraciaRow) {
          // Ingreso reciente: SIESA/RRHH aún no registró el contrato. No es
          // un fantasma, es la ventana ciega documentada — no se desactiva.
          enGracia += 1;
          continue;
        }
        desactivarIds.push(row.id);
        continue;
      }

      if (!enSiesa && !estaActivo && enGraciaRow) {
        // Self-healing: solo se deshace una desactivación que HICIMOS
        // nosotros mismos en un sync anterior (misma marca). Una
        // desactivación humana (marca distinta o ausente) nunca se toca.
        const marca = row.observacion_desactivacion || "";
        if (marca.startsWith(MARCA_DESACTIVACION_SYNC)) {
          reactivarIds.push(row.id);
        }
      }
    }
  }

  const sinDotacion = [];
  for (const [nit, row] of siesaActivosPorNit.entries()) {
    if (documentosUsadosEnSiesa.has(nit) || porDocumento.has(nit)) continue;
    sinDotacion.push({
      documento: nit,
      nombre: row.nombre_empleado,
      fechaIngreso: row.fecha_ingreso,
      idTercero: row.id_tercero,
    });
  }

  return { desactivarIds, reactivarIds, sinDotacion, duplicados, documentoInvalido, enGracia };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function leerEstadoActual() {
  const { data, error } = await supabase.from(TABLA_SYNC).select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`No se pudo leer ${TABLA_SYNC}: ${error.message}`);
  return data || null;
}

function esFresco(estado) {
  if (!estado?.ultima_sync_ok) return false;
  const edadMin = (Date.now() - new Date(estado.ultima_sync_ok).getTime()) / 60000;
  return edadMin < TTL_MIN;
}

function respuestaDesdeEstado(estado, origen) {
  if (!estado) {
    return {
      estado: "never",
      origen,
      ultimaSync: null,
      ultimaSyncOk: null,
      error: null,
      siesa: { total: estado?.conteo_siesa ?? 0 },
      resumen: estado?.resumen ?? { desactivados: 0, reactivados: 0, documentoInvalido: 0, desactivadosIds: [], reactivadosIds: [], enGracia: 0 },
      sinDotacion: estado?.sin_dotacion ?? [],
      duplicados: estado?.duplicados ?? [],
    };
  }
  return {
    estado: estado.estado,
    origen,
    ultimaSync: estado.ultima_sync,
    ultimaSyncOk: estado.ultima_sync_ok,
    error: estado.error,
    siesa: { total: estado.conteo_siesa ?? 0 },
    resumen: estado.resumen ?? { desactivados: 0, reactivados: 0, documentoInvalido: 0, desactivadosIds: [], reactivadosIds: [], enGracia: 0 },
    sinDotacion: estado.sin_dotacion ?? [],
    duplicados: estado.duplicados ?? [],
  };
}

/** Lee el último estado persistido sin llamar a Connekta. */
export async function getEstado() {
  const estado = await leerEstadoActual();
  return respuestaDesdeEstado(estado, "cache");
}

/**
 * Ejecuta (o simula, si dryRun) la sincronización SIESA -> dotaciones.
 *
 * @param {{ forzar?: boolean, dryRun?: boolean }} opts
 */
export async function runSync({ forzar = false, dryRun = false } = {}) {
  const estadoPrevio = await leerEstadoActual();

  if (!forzar && !dryRun && esFresco(estadoPrevio)) {
    return respuestaDesdeEstado(estadoPrevio, "cache");
  }

  if (forzar && estadoPrevio?.ultima_sync) {
    const segundosDesdeUltima = (Date.now() - new Date(estadoPrevio.ultima_sync).getTime()) / 1000;
    if (segundosDesdeUltima < MIN_INTERVAL_SEC) {
      return respuestaDesdeEstado(estadoPrevio, "cache");
    }
  }

  const ahoraISO = new Date().toISOString();
  let siesaRows;
  try {
    const { datos, total, totalPaginas } = await ejecutarConsulta(CONSULTA, 1, 1000);
    if (totalPaginas > 1) {
      throw new Error(
        `SIESA devolvió ${totalPaginas} páginas para ${CONSULTA}; esta sincronización asume una sola página (tamPag=1000)`,
      );
    }
    siesaRows = datos;
    void total;
  } catch (error) {
    const fallo = {
      id: 1,
      ultima_sync: ahoraISO,
      ultima_sync_ok: estadoPrevio?.ultima_sync_ok ?? null,
      estado: "error",
      error: error.message,
      conteo_siesa: estadoPrevio?.conteo_siesa ?? null,
      payload: estadoPrevio?.payload ?? null,
      resumen: estadoPrevio?.resumen ?? null,
      sin_dotacion: estadoPrevio?.sin_dotacion ?? null,
      duplicados: estadoPrevio?.duplicados ?? null,
    };
    if (!dryRun) await supabase.from(TABLA_SYNC).upsert(fallo);
    return respuestaDesdeEstado(fallo, "connekta");
  }

  // Toda fila que Connekta devuelve ya es "activa" (la consulta filtra
  // `fecha_retiro IS NULL`); no se re-filtra por `fecha_fin_contrato_vigente`.
  const conteoActivos = siesaRows.length;

  if (shouldRejectForGuard(conteoActivos, { minEmpleados: MIN_EMPLEADOS, ultimoConteoOk: estadoPrevio?.conteo_siesa ?? null })) {
    const rechazo = {
      id: 1,
      ultima_sync: ahoraISO,
      ultima_sync_ok: estadoPrevio?.ultima_sync_ok ?? null,
      estado: "guard_rejected",
      error: `Guarda de desactivación masiva: ${conteoActivos} filas activas recibidas (mínimo ${MIN_EMPLEADOS}, referencia previa ${estadoPrevio?.conteo_siesa ?? "n/a"})`,
      conteo_siesa: estadoPrevio?.conteo_siesa ?? null,
      payload: estadoPrevio?.payload ?? null,
      resumen: estadoPrevio?.resumen ?? null,
      sin_dotacion: estadoPrevio?.sin_dotacion ?? null,
      duplicados: estadoPrevio?.duplicados ?? null,
    };
    if (!dryRun) await supabase.from(TABLA_SYNC).upsert(rechazo);
    return respuestaDesdeEstado(rechazo, "connekta");
  }

  const { data: dotacionRows, error: selError } = await supabase
    .from("dotaciones")
    .select("id, documento, activo, created_at, observacion_desactivacion");
  if (selError) throw new Error(`No se pudo leer dotaciones: ${selError.message}`);

  const reconciliacion = computeReconciliation(siesaRows, dotacionRows || []);

  if (!dryRun) {
    for (const grupo of chunk(reconciliacion.desactivarIds, CHUNK_SIZE)) {
      if (grupo.length === 0) continue;
      const { error } = await supabase
        .from("dotaciones")
        .update({ activo: false, observacion_desactivacion: `${MARCA_DESACTIVACION_SYNC} ${ahoraISO}` })
        .in("id", grupo);
      if (error) throw new Error(`No se pudo desactivar dotaciones: ${error.message}`);
    }
    for (const grupo of chunk(reconciliacion.reactivarIds, CHUNK_SIZE)) {
      if (grupo.length === 0) continue;
      const { error } = await supabase
        .from("dotaciones")
        .update({ activo: true, observacion_reactivacion: `Reactivado por sincronización SIESA ${ahoraISO}` })
        .in("id", grupo);
      if (error) throw new Error(`No se pudo reactivar dotaciones: ${error.message}`);
    }
  }

  const resumen = {
    desactivados: reconciliacion.desactivarIds.length,
    reactivados: reconciliacion.reactivarIds.length,
    documentoInvalido: reconciliacion.documentoInvalido,
    desactivadosIds: reconciliacion.desactivarIds,
    reactivadosIds: reconciliacion.reactivarIds,
    enGracia: reconciliacion.enGracia,
  };

  const nuevoEstado = {
    id: 1,
    ultima_sync: ahoraISO,
    ultima_sync_ok: dryRun ? estadoPrevio?.ultima_sync_ok ?? null : ahoraISO,
    estado: "ok",
    error: null,
    conteo_siesa: conteoActivos,
    payload: dryRun ? estadoPrevio?.payload ?? null : siesaRows,
    resumen,
    sin_dotacion: reconciliacion.sinDotacion,
    duplicados: reconciliacion.duplicados,
  };

  if (!dryRun) {
    const { error: upsertError } = await supabase.from(TABLA_SYNC).upsert(nuevoEstado);
    if (upsertError) throw new Error(`No se pudo guardar ${TABLA_SYNC}: ${upsertError.message}`);
  }

  return respuestaDesdeEstado(nuevoEstado, dryRun ? "dry-run" : "connekta");
}
