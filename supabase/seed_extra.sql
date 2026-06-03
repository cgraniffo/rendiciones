-- ════════════════════════════════════════════════════════════════════════
-- Demo extendida (5 rendiciones) que ejercita TODAS las funcionalidades:
-- P×Q + unidad, IVA afecto/exento, factura + libre, multi-línea, 3 estados,
-- liquidación por devolución y por reembolso (sobregasto).
-- Numera dinámicamente (max+1) para no chocar con rendiciones ya creadas.
-- Idempotente: si ya existe la marcada 'Viaje a terreno sur', no hace nada.
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  v_org uuid;
  v_admin uuid;
  v_base integer;
  e_ana uuid; e_juan uuid; e_maria uuid; e_chris uuid;
  c_comb uuid; c_alim uuid; c_hosp uuid; c_ofi uuid; c_otros uuid;
  d_dimerc uuid; d_hotel uuid;
  r4 uuid; r5 uuid; r6 uuid; r7 uuid; r8 uuid;
begin
  select id into v_org from organizaciones where slug = 'bdata' and deleted_at is null;
  if v_org is null then raise exception 'No existe org bdata.'; end if;
  if exists (select 1 from rendiciones where org_id = v_org and nombre = 'Viaje a terreno sur') then
    raise notice 'Demo extra ya cargada; no se inserta de nuevo.';
    return;
  end if;

  select coalesce(max(numero), 0) into v_base from rendiciones where org_id = v_org;
  select user_id into v_admin from org_users where org_id = v_org and rol = 'admin' limit 1;

  select id into e_ana   from empleados where org_id=v_org and lower(email)='ana@bdata.cl';
  select id into e_juan  from empleados where org_id=v_org and lower(email)='juan@bdata.cl';
  select id into e_maria from empleados where org_id=v_org and lower(email)='maria@bdata.cl';
  select id into e_chris from empleados where org_id=v_org and lower(email)='christian@bdata.cl';

  select id into c_comb  from categorias where org_id=v_org and codigo='CC-01';
  select id into c_alim  from categorias where org_id=v_org and codigo='CC-02';
  select id into c_hosp  from categorias where org_id=v_org and codigo='CC-03';
  select id into c_ofi   from categorias where org_id=v_org and codigo='CC-04';
  select id into c_otros from categorias where org_id=v_org and codigo='CC-99';

  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha)
    values (v_org,'Factura','9100','Dimerc','96.670.000-8',47600,'2026-05-26') returning id into d_dimerc;
  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha)
    values (v_org,'Factura','5521','Hotel Plaza','76.999.000-5',89250,'2026-04-12') returning id into d_hotel;

  -- BORRADOR · P×Q + IVA mixto (peaje exento, combustible/comida afecto)
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha, estado, notas)
    values (v_org, v_base+1, 'Viaje a terreno sur', e_chris, '2026-06-01',
            200000, 'Transferencia #5001', '2026-06-01', 'borrador',
            'Incluye peajes, combustible y comida.')
    returning id into r4;
  insert into rendicion_lineas (rendicion_id, orden, tipo, categoria_id, glosa, cantidad, precio_unitario, unidad, monto, afecto_iva, tasa_iva, fecha) values
    (r4, 1, 'libre', c_otros, 'Peajes ruta sur',  6, 1200, 'peaje',  7200,  false, 19, '2026-06-01'),
    (r4, 2, 'libre', c_comb,  'Combustible',      40, 1000, 'litro',  40000, true,  19, '2026-06-01'),
    (r4, 3, 'libre', c_alim,  'Comida equipo',     1, null, null,     25000, true,  19, '2026-06-01');

  -- PRESENTADA · factura + libre (afecto)
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha, estado)
    values (v_org, v_base+2, 'Compras de oficina', e_juan, '2026-05-28',
            80000, 'Efectivo caja', '2026-05-28', 'presentada')
    returning id into r5;
  insert into rendicion_lineas (rendicion_id, orden, tipo, documento_id, categoria_id, glosa, monto, afecto_iva, tasa_iva, fecha) values
    (r5, 1, 'documento', d_dimerc, c_ofi, null, 47600, true, 19, '2026-05-26'),
    (r5, 2, 'libre',     null,     c_ofi, 'Artículos de aseo', 20000, true, 19, '2026-05-27');

  -- APROBADA + DEVOLUCIÓN · factura + libre + P×Q (taxi exento). saldo +10.750
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha,
                           estado, fecha_aprobacion, aprobada_por, aprobada_at,
                           liquidacion_tipo, liquidacion_monto, liquidacion_fecha,
                           liquidacion_referencia, liquidacion_at, liquidacion_por)
    values (v_org, v_base+3, 'Viaje Santiago (capacitación)', e_maria, '2026-04-15',
            150000, 'Transferencia #4810', '2026-04-15',
            'aprobada', '2026-04-25', v_admin, '2026-04-25T15:00:00Z',
            'devolucion', 10750, '2026-04-28', 'Depósito #771',
            '2026-04-28T10:00:00Z', v_admin)
    returning id into r6;
  insert into rendicion_lineas (rendicion_id, orden, tipo, documento_id, categoria_id, glosa, cantidad, precio_unitario, unidad, monto, afecto_iva, tasa_iva, fecha) values
    (r6, 1, 'documento', d_hotel, c_hosp, null,           1, null, null,    89250, true,  19, '2026-04-12'),
    (r6, 2, 'libre',     null,    c_otros,'Pasaje avión', 1, null, null,    35000, true,  19, '2026-04-14'),
    (r6, 3, 'libre',     null,    c_otros,'Taxis',        3, 5000, 'viaje', 15000, false, 19, '2026-04-16');
  update documentos set estado_pago='pagado', fecha_pago='2026-04-25' where id = d_hotel;

  -- APROBADA + REEMBOLSO · sobregasto. saldo -10.000
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha,
                           estado, fecha_aprobacion, aprobada_por, aprobada_at,
                           liquidacion_tipo, liquidacion_monto, liquidacion_fecha,
                           liquidacion_referencia, liquidacion_at, liquidacion_por)
    values (v_org, v_base+4, 'Curso certificación', e_ana, '2026-04-22',
            50000, 'Efectivo', '2026-04-22',
            'aprobada', '2026-05-02', v_admin, '2026-05-02T11:00:00Z',
            'reembolso', 10000, '2026-05-05', 'Transferencia #4905',
            '2026-05-05T09:30:00Z', v_admin)
    returning id into r7;
  insert into rendicion_lineas (rendicion_id, orden, tipo, categoria_id, glosa, monto, afecto_iva, tasa_iva, fecha) values
    (r7, 1, 'libre', c_otros, 'Inscripción curso', 60000, true, 19, '2026-04-21');

  -- APROBADA · cuadrada (saldo 0, sin liquidación)
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha,
                           estado, fecha_aprobacion, aprobada_por, aprobada_at)
    values (v_org, v_base+5, 'Caja chica junio', e_chris, '2026-06-02',
            30000, 'Efectivo', '2026-06-02', 'aprobada', '2026-06-02',
            v_admin, '2026-06-02T12:00:00Z')
    returning id into r8;
  insert into rendicion_lineas (rendicion_id, orden, tipo, categoria_id, glosa, monto, afecto_iva, tasa_iva, fecha) values
    (r8, 1, 'libre', c_alim, 'Café y galletas reunión', 30000, false, 19, '2026-06-02');

  raise notice 'Demo extra cargada (5 rendiciones a partir de #%).', v_base+1;
end $$;
