-- ════════════════════════════════════════════════════════════════════════
-- Liquidación de la rendición: cierre del saldo.
-- saldo > 0 → devolución (el empleado reintegra el sobrante).
-- saldo < 0 → reembolso  (la empresa paga el sobregasto al empleado).
-- Un solo cierre por rendición (monto = saldo al momento de liquidar).
-- ════════════════════════════════════════════════════════════════════════

alter table rendiciones
  add column liquidacion_tipo       text
    check (liquidacion_tipo in ('devolucion', 'reembolso')),
  add column liquidacion_monto      numeric(14,2),
  add column liquidacion_fecha      date,
  add column liquidacion_referencia text,
  add column liquidacion_at         timestamptz,
  add column liquidacion_por        uuid references auth.users(id) on delete set null;
