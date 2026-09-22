import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanDigits,
  computeReconciliation,
  shouldRejectForGuard,
} from "../services/siesaSync.service.js";

// ---- cleanDigits ----

test("cleanDigits strips non-digit chars and trims", () => {
  assert.equal(cleanDigits(" 12.345.678 "), "12345678");
  assert.equal(cleanDigits("12-345-678"), "12345678");
  assert.equal(cleanDigits(null), "");
  assert.equal(cleanDigits(undefined), "");
});

// ---- computeReconciliation fixtures ----

function siesaRow(nit, overrides = {}) {
  return {
    nit,
    nombre_empleado: `Empleado ${nit}`,
    fecha_ingreso: "2024-01-01",
    fecha_fin_contrato_vigente: null,
    id_tercero: `T-${nit}`,
    ...overrides,
  };
}

function dotacionRow(id, documento, activo, overrides = {}) {
  return { id, documento, activo, ...overrides };
}

test("ghost employee: active in Dotacion but absent from SIESA payroll -> deactivated", () => {
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "111", true),
    dotacionRow(2, "999", true), // ghost
  ];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.desactivarIds, [2]);
  assert.deepEqual(result.reactivarIds, []);
});

test("wrongly inactive employee: inactive in Dotacion but present+active in SIESA -> reactivated", () => {
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [dotacionRow(1, "111", false)];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.reactivarIds, [1]);
  assert.deepEqual(result.desactivarIds, []);
});

test("duplicated documento is flagged in duplicados, but is still just a flag (not an exemption)", () => {
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "111", true),
    dotacionRow(2, "111", true),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.equal(result.duplicados.length, 1);
  assert.equal(result.duplicados[0].documento, "111");
  assert.deepEqual(result.duplicados[0].ids.sort(), [1, 2]);
  assert.equal(result.duplicados[0].cantidad, 2);
});

test("duplicated documento absent from SIESA: ALL its rows go to desactivarIds AND are listed in duplicados", () => {
  const siesaRows = [siesaRow("222")]; // documento 111 not present at all
  const dotacionRows = [
    dotacionRow(1, "111", true),
    dotacionRow(2, "111", true),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.desactivarIds.sort(), [1, 2]);
  assert.deepEqual(result.reactivarIds, []);
  assert.equal(result.duplicados.length, 1);
  assert.deepEqual(result.duplicados[0].ids.sort(), [1, 2]);
});

test("duplicated documento present in SIESA with one inactive row: that row is reactivated, still flagged as duplicado", () => {
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "111", true), // already active, no flip needed
    dotacionRow(2, "111", false), // inactive, must be reactivated
  ];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.reactivarIds, [2]);
  assert.deepEqual(result.desactivarIds, []);
  assert.equal(result.duplicados.length, 1);
  assert.deepEqual(result.duplicados[0].ids.sort(), [1, 2]);
});

test("invalid/empty documento rows are skipped: counted, never deactivated", () => {
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "111", true),
    dotacionRow(2, "", true),
    dotacionRow(3, null, true),
    dotacionRow(4, "abc", true),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.equal(result.documentoInvalido, 3);
  assert.deepEqual(result.desactivarIds, []);
  assert.deepEqual(result.reactivarIds, []);
});

test("idempotency: running reconciliation twice on unchanged state yields zero flips", () => {
  const siesaRows = [siesaRow("111"), siesaRow("222")];
  let dotacionRows = [
    dotacionRow(1, "111", true),
    dotacionRow(2, "222", false), // will be reactivated
    dotacionRow(3, "333", true), // will be deactivated (ghost)
  ];

  const first = computeReconciliation(siesaRows, dotacionRows);
  assert.deepEqual(first.reactivarIds, [2]);
  assert.deepEqual(first.desactivarIds, [3]);

  // apply the flips, as runSync would after a successful write
  dotacionRows = dotacionRows.map((row) => {
    if (first.reactivarIds.includes(row.id)) return { ...row, activo: true };
    if (first.desactivarIds.includes(row.id)) return { ...row, activo: false };
    return row;
  });

  const second = computeReconciliation(siesaRows, dotacionRows);
  assert.deepEqual(second.reactivarIds, []);
  assert.deepEqual(second.desactivarIds, []);
});

test("sin_dotacion: SIESA-active employee with no matching Dotacion row", () => {
  const siesaRows = [siesaRow("111"), siesaRow("222")];
  const dotacionRows = [dotacionRow(1, "111", true)];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.equal(result.sinDotacion.length, 1);
  assert.equal(result.sinDotacion[0].documento, "222");
  assert.equal(result.sinDotacion[0].nombre, "Empleado 222");
});

test("null fecha_fin_contrato_vigente is treated as active, not missing/expired", () => {
  const siesaRows = [siesaRow("111", { fecha_fin_contrato_vigente: null })];
  const dotacionRows = [dotacionRow(1, "111", false)];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.reactivarIds, [1]);
});

test("SIESA row with a past fecha_fin_contrato_vigente still counts as present (Connekta query already filters fecha_retiro)", () => {
  const siesaRows = [siesaRow("111", { fecha_fin_contrato_vigente: "2020-01-01" })];
  const dotacionRows = [dotacionRow(1, "111", false)];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.reactivarIds, [1]);
  assert.deepEqual(result.desactivarIds, []);
});

test("matching uses nit trimmed, not id_tercero", () => {
  const siesaRows = [siesaRow("111", { id_tercero: "  T-XYZ  " })];
  const dotacionRows = [dotacionRow(1, "111", true)];

  const result = computeReconciliation(siesaRows, dotacionRows);

  assert.deepEqual(result.desactivarIds, []);
  assert.equal(result.sinDotacion.length, 0);
});

// ---- Mass-deactivation guard: pure threshold check used by runSync before any write ----

test("guard rejects when SIESA payload has 0 rows", () => {
  assert.equal(shouldRejectForGuard(0, { minEmpleados: 200, ultimoConteoOk: 400 }), true);
});

test("guard rejects when SIESA payload is below SIESA_MIN_EMPLEADOS", () => {
  assert.equal(shouldRejectForGuard(150, { minEmpleados: 200, ultimoConteoOk: 400 }), true);
});

test("guard rejects when SIESA payload is below 50% of last known-good count", () => {
  assert.equal(shouldRejectForGuard(190, { minEmpleados: 100, ultimoConteoOk: 500 }), true);
});

test("guard allows a normal payload", () => {
  assert.equal(shouldRejectForGuard(416, { minEmpleados: 200, ultimoConteoOk: 400 }), false);
});

test("activo null counts as active: ghost with null activo -> deactivated, not reactivated when present", () => {
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "111", null), // present in SIESA, legacy null -> no flip
    dotacionRow(2, "999", null), // ghost with legacy null -> deactivate
  ];
  const r = computeReconciliation(siesaRows, dotacionRows);
  assert.deepEqual(r.desactivarIds, [2]);
  assert.deepEqual(r.reactivarIds, []);
});

test("sinDotacion rows carry the SIESA employee name (nombre_empleado)", () => {
  const r = computeReconciliation([siesaRow("555")], []);
  assert.equal(r.sinDotacion.length, 1);
  assert.equal(r.sinDotacion[0].nombre, "Empleado 555");
});

// ---- Grace period: brand-new dotaciones must not be auto-deactivated ----

function isoDaysAgo(days, now) {
  const ref = new Date(now);
  ref.setUTCDate(ref.getUTCDate() - days);
  return ref.toISOString();
}

test("grace period: row created 2 days ago, absent from SIESA -> NOT deactivated, counted in enGracia", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "999", true, { created_at: isoDaysAgo(2, now) }), // ghost, but brand new
  ];

  const result = computeReconciliation(siesaRows, dotacionRows, now);

  assert.deepEqual(result.desactivarIds, []);
  assert.equal(result.enGracia, 1);
});

test("grace period regression guard: row created 60 days ago, absent from SIESA -> still deactivated", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [dotacionRow(1, "999", true, { created_at: isoDaysAgo(60, now) })];

  const result = computeReconciliation(siesaRows, dotacionRows, now);

  assert.deepEqual(result.desactivarIds, [1]);
  assert.equal(result.enGracia, 0);
});

test("self-healing: row in grace period, inactive due to OUR OWN sync, absent from SIESA -> reactivated", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "999", false, {
      created_at: isoDaysAgo(5, now),
      observacion_desactivacion: "Desactivado por sincronización SIESA 2026-09-21T08:00:00.000Z",
    }),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows, now);

  assert.deepEqual(result.reactivarIds, [1]);
  assert.deepEqual(result.desactivarIds, []);
});

test("self-healing does NOT touch a row deactivated by a human", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "999", false, {
      created_at: isoDaysAgo(5, now),
      observacion_desactivacion: "Se retiró, entregó dotación",
    }),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows, now);

  assert.deepEqual(result.reactivarIds, []);
  assert.deepEqual(result.desactivarIds, []);
});

test("self-healing does NOT apply once the row is outside the grace period", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "999", false, {
      created_at: isoDaysAgo(90, now),
      observacion_desactivacion: "Desactivado por sincronización SIESA 2026-06-20T08:00:00.000Z",
    }),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows, now);

  assert.deepEqual(result.reactivarIds, []);
  assert.deepEqual(result.desactivarIds, []);
});

test("missing/invalid created_at is treated as OUTSIDE grace period (established record)", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  const dotacionRows = [
    dotacionRow(1, "999", true, { created_at: null }),
    dotacionRow(2, "888", true, { created_at: "not-a-date" }),
  ];

  const result = computeReconciliation(siesaRows, dotacionRows, now);

  assert.deepEqual(result.desactivarIds.sort(), [1, 2]);
  assert.equal(result.enGracia, 0);
});

test("grace period idempotency: applying the self-heal flip once yields zero flips on the next run", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const siesaRows = [siesaRow("111")];
  let dotacionRows = [
    dotacionRow(1, "999", false, {
      created_at: isoDaysAgo(5, now),
      observacion_desactivacion: "Desactivado por sincronización SIESA 2026-09-21T08:00:00.000Z",
    }),
  ];

  const first = computeReconciliation(siesaRows, dotacionRows, now);
  assert.deepEqual(first.reactivarIds, [1]);

  dotacionRows = dotacionRows.map((row) =>
    first.reactivarIds.includes(row.id) ? { ...row, activo: true } : row,
  );

  const second = computeReconciliation(siesaRows, dotacionRows, now);
  assert.deepEqual(second.reactivarIds, []);
  assert.deepEqual(second.desactivarIds, []);
});
