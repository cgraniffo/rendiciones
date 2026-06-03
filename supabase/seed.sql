-- ════════════════════════════════════════════════════════════════════════
-- Datos de demo para la organización 'bdata'.
-- Idempotente: si la org ya tiene rendiciones, no hace nada.
-- Ejecutar con la org 'bdata' ya creada en `organizaciones`.
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  v_org uuid;
  e_ana uuid; e_juan uuid; e_maria uuid;
  c_comb uuid; c_alim uuid; c_hosp uuid; c_ofi uuid; c_otros uuid;
  d_copec uuid; d_shell uuid; d_hotel uuid; d_dimerc uuid; d_lider uuid;
  r1 uuid; r2 uuid; r3 uuid;
begin
  select id into v_org from organizaciones where slug = 'bdata' and deleted_at is null;
  if v_org is null then
    raise exception 'No existe la organización con slug bdata.';
  end if;
  if exists (select 1 from rendiciones where org_id = v_org) then
    raise notice 'La org ya tiene rendiciones; no se insertan datos de demo.';
    return;
  end if;

  -- Empleados (sin login vinculado; el admin rinde por ellos) ---------------
  insert into empleados (org_id, nombre_completo, rut, email) values
    (v_org, 'Ana Pérez',  '11.111.111-1', 'ana@bdata.cl')   returning id into e_ana;
  insert into empleados (org_id, nombre_completo, rut, email) values
    (v_org, 'Juan Soto',  '12.222.222-2', 'juan@bdata.cl')  returning id into e_juan;
  insert into empleados (org_id, nombre_completo, rut, email) values
    (v_org, 'María Rojas','13.333.333-3', 'maria@bdata.cl') returning id into e_maria;

  -- Categorías --------------------------------------------------------------
  insert into categorias (org_id, nombre, codigo) values (v_org,'Combustible','CC-01')     returning id into c_comb;
  insert into categorias (org_id, nombre, codigo) values (v_org,'Alimentación','CC-02')    returning id into c_alim;
  insert into categorias (org_id, nombre, codigo) values (v_org,'Hospedaje','CC-03')       returning id into c_hosp;
  insert into categorias (org_id, nombre, codigo) values (v_org,'Insumos oficina','CC-04') returning id into c_ofi;
  insert into categorias (org_id, nombre, codigo) values (v_org,'Otros','CC-99')           returning id into c_otros;

  -- Documentos (facturas/boletas de carga manual) --------------------------
  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha) values
    (v_org,'Factura','1234','Copec S.A.','99.500.000-1',45000,current_date - 20) returning id into d_copec;
  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha) values
    (v_org,'Factura','5567','Shell Chile','96.800.000-2',30000,current_date - 15) returning id into d_shell;
  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha) values
    (v_org,'Boleta','889','Hotel Diego de Almagro','76.123.456-7',78000,current_date - 10) returning id into d_hotel;
  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha) values
    (v_org,'Factura','9001','Dimerc','96.670.000-8',25000,current_date - 8) returning id into d_dimerc;
  insert into documentos (org_id, tipo, folio, emisor, rut_emisor, monto_total, fecha) values
    (v_org,'Factura','9002','Lider','97.100.000-3',18000,current_date - 5) returning id into d_lider;

  -- Rendición 1 — BORRADOR (Ana). Saldo +35.000 (debe devolver) ------------
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha, estado, notas)
    values (v_org, 1, 'Viaje terreno norte', e_ana, current_date - 18,
            100000, 'Transferencia #4471', current_date - 18, 'borrador',
            'Pendiente de cargar más boletas.')
    returning id into r1;
  insert into rendicion_lineas (rendicion_id, orden, tipo, categoria_id, glosa, monto, fecha) values
    (r1, 1, 'libre', c_alim, 'Almuerzos equipo en ruta', 20000, current_date - 17);
  insert into rendicion_lineas (rendicion_id, orden, tipo, documento_id, categoria_id, monto, fecha) values
    (r1, 2, 'documento', d_copec, c_comb, 45000, current_date - 20);

  -- Rendición 2 — PRESENTADA (Juan). Saldo 0 (cuadrada) --------------------
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha, estado)
    values (v_org, 2, 'Caja chica oficina', e_juan, current_date - 12,
            50000, 'Efectivo', current_date - 12, 'presentada')
    returning id into r2;
  insert into rendicion_lineas (rendicion_id, orden, tipo, documento_id, categoria_id, monto, fecha) values
    (r2, 1, 'documento', d_dimerc, c_ofi, 25000, current_date - 8);
  insert into rendicion_lineas (rendicion_id, orden, tipo, documento_id, categoria_id, monto, fecha) values
    (r2, 2, 'documento', d_shell, c_comb, 25000, current_date - 15);

  -- Rendición 3 — APROBADA (María). Saldo +2.000. Documento marcado pagado -
  insert into rendiciones (org_id, numero, nombre, empleado_id, fecha_emision,
                           monto_anticipo, anticipo_referencia, anticipo_fecha,
                           estado, fecha_aprobacion)
    values (v_org, 3, 'Viaje Santiago', e_maria, current_date - 9,
            80000, 'Transferencia #4480', current_date - 9, 'aprobada', current_date - 2)
    returning id into r3;
  insert into rendicion_lineas (rendicion_id, orden, tipo, documento_id, categoria_id, monto, fecha) values
    (r3, 1, 'documento', d_hotel, c_hosp, 78000, current_date - 10);
  update documentos set estado_pago = 'pagado', fecha_pago = current_date - 2 where id = d_hotel;

  raise notice 'Datos de demo insertados para la org bdata.';
end $$;
