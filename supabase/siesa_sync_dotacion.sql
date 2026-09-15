-- Tabla de estado de sincronización SIESA <-> dotaciones (módulo Dotación).
-- Fila única (id=1): guarda el último resultado (ok, error o guard_rejected)
-- para servir "último bueno conocido" cuando Connekta falla o la guarda
-- rechaza un payload sospechosamente corto.
--
-- Ejecutar manualmente en el editor SQL de Supabase (no hay tooling de
-- migraciones en este repo).

create table if not exists siesa_sync_dotacion (
  id int primary key default 1 check (id = 1),
  ultima_sync timestamptz,
  ultima_sync_ok timestamptz,
  estado text,
  error text,
  conteo_siesa int,
  payload jsonb,
  resumen jsonb,
  sin_dotacion jsonb,
  duplicados jsonb
);
