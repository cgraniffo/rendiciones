-- ════════════════════════════════════════════════════════════════════════
-- Líneas: cantidad × precio unitario (opcional) + IVA (afecto/exento).
--   monto sigue siendo el TOTAL bruto de la línea (fuente del saldo).
--   Si precio_unitario está, monto = cantidad × precio_unitario.
--   neto / IVA se derivan de monto + afecto_iva + tasa_iva (no se almacenan).
-- ════════════════════════════════════════════════════════════════════════

alter table rendicion_lineas
  add column cantidad        numeric(14,2) not null default 1,
  add column precio_unitario numeric(14,2),
  add column unidad          text,
  add column afecto_iva      boolean not null default false,
  add column tasa_iva        numeric(5,2) not null default 19;
