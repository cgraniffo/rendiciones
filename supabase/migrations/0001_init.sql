-- ════════════════════════════════════════════════════════════════════════
-- Rendición de Gastos — esquema inicial (MVP)
-- Multi-tenant por org_id + RLS. Stack: Supabase (Postgres + Auth + Storage).
-- Ver SCOPE.md para el alcance.
-- ════════════════════════════════════════════════════════════════════════

-- Enums ------------------------------------------------------------------
create type rol_org as enum ('empleado', 'admin');
create type estado_rendicion as enum ('borrador', 'presentada', 'aprobada');
create type tipo_linea as enum ('documento', 'libre');
create type estado_pago_doc as enum ('pendiente', 'pagado');

-- ════════════════════════════════════════════════════════════════════════
-- Tablas
-- ════════════════════════════════════════════════════════════════════════

-- Organización (tenant) --------------------------------------------------
create table organizaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text unique not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Pertenencia usuario ↔ organización + rol -------------------------------
create table org_users (
  org_id      uuid not null references organizaciones(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rol         rol_org not null default 'empleado',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on org_users (user_id);

-- Empleados (personas que rinden) ----------------------------------------
-- user_id opcional: vincula al empleado con un login para que rinda lo suyo.
create table empleados (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizaciones(id) on delete cascade,
  nombre_completo text not null,
  rut             text,
  email           text,
  user_id         uuid references auth.users(id) on delete set null,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index on empleados (org_id);
create index on empleados (user_id);

-- Categorías de gasto (≈ centro de costo) --------------------------------
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizaciones(id) on delete cascade,
  nombre      text not null,
  codigo      text,
  activa       boolean not null default true,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index on categorias (org_id);

-- Documentos (facturas/boletas de carga manual) -------------------------
create table documentos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizaciones(id) on delete cascade,
  tipo          text,                       -- 'factura' | 'boleta' | ...
  folio         text,
  emisor        text,
  rut_emisor    text,
  monto_total   numeric(14,2) not null default 0,
  fecha         date,
  archivo_url   text,
  estado_pago   estado_pago_doc not null default 'pendiente',
  fecha_pago    date,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on documentos (org_id);
create index on documentos (org_id, estado_pago);

-- Rendiciones (encabezado) -----------------------------------------------
create table rendiciones (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizaciones(id) on delete cascade,
  numero              integer not null,         -- correlativo por organización
  nombre              text,
  empleado_id         uuid not null references empleados(id),
  fecha_emision       date not null default current_date,
  -- "Banca" simple: referencia textual del traspaso del anticipo, sin conciliación.
  anticipo_referencia text,
  anticipo_fecha      date,
  monto_anticipo      numeric(14,2) not null default 0,
  monto_rendido       numeric(14,2) not null default 0,  -- mantenido por trigger
  saldo               numeric(14,2)
                        generated always as (monto_anticipo - monto_rendido) stored,
  estado              estado_rendicion not null default 'borrador',
  notas               text,
  fecha_aprobacion    date,
  aprobada_por        uuid references auth.users(id) on delete set null,
  aprobada_at         timestamptz,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (org_id, numero)
);
create index on rendiciones (org_id);
create index on rendiciones (org_id, estado);
create index on rendiciones (empleado_id);

-- Líneas de rendición (detalle) ------------------------------------------
create table rendicion_lineas (
  id              uuid primary key default gen_random_uuid(),
  rendicion_id    uuid not null references rendiciones(id) on delete cascade,
  orden           integer not null default 1,
  tipo            tipo_linea not null,
  documento_id    uuid references documentos(id),  -- solo tipo='documento'
  categoria_id    uuid references categorias(id),
  glosa           text,                            -- solo tipo='libre'
  monto           numeric(14,2) not null default 0,
  fecha           date,
  notas           text,
  comprobante_url text,
  created_at      timestamptz not null default now(),
  -- Coherencia por tipo: documento ⇒ documento_id; libre ⇒ glosa.
  constraint linea_tipo_coherente check (
    (tipo = 'documento' and documento_id is not null) or
    (tipo = 'libre'      and glosa is not null)
  )
);
create index on rendicion_lineas (rendicion_id);

-- ════════════════════════════════════════════════════════════════════════
-- Trigger: recalcular rendiciones.monto_rendido = Σ líneas
-- (saldo se deriva solo, por ser columna generada).
-- ════════════════════════════════════════════════════════════════════════

create or replace function recalc_monto_rendido() returns trigger
language plpgsql set search_path = public as $$
declare
  v_rendicion_id uuid := coalesce(new.rendicion_id, old.rendicion_id);
begin
  update rendiciones r
     set monto_rendido = coalesce(
       (select sum(l.monto) from rendicion_lineas l
         where l.rendicion_id = v_rendicion_id), 0)
   where r.id = v_rendicion_id;
  return null;  -- AFTER trigger
end;
$$;

create trigger trg_recalc_rendido
  after insert or update or delete on rendicion_lineas
  for each row execute function recalc_monto_rendido();

-- ════════════════════════════════════════════════════════════════════════
-- Numeración correlativa por organización (con bloqueo para evitar carreras)
-- ════════════════════════════════════════════════════════════════════════

create or replace function siguiente_numero_rendicion(p_org_id uuid)
returns integer
language plpgsql set search_path = public as $$
declare
  v_next integer;
begin
  -- Lock por org para serializar la asignación del correlativo.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));
  select coalesce(max(numero), 0) + 1 into v_next
    from rendiciones where org_id = p_org_id;
  return v_next;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- Helpers de RLS (SECURITY DEFINER para evitar recursión de políticas)
-- ════════════════════════════════════════════════════════════════════════

create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_users
     where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_users
     where org_id = p_org_id and user_id = auth.uid() and rol = 'admin'
  );
$$;

-- ¿La rendición pertenece a un empleado vinculado al usuario actual?
create or replace function soy_rendidor(p_rendicion_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from rendiciones r
      join empleados e on e.id = r.empleado_id
     where r.id = p_rendicion_id and e.user_id = auth.uid()
  );
$$;

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- Regla general: aislamiento por org. Maestros: admin escribe, miembros leen.
-- Rendiciones: admin todo; empleado solo las suyas y solo en borrador.
-- (Las server actions aplican reglas finas adicionales encima de RLS.)
-- ════════════════════════════════════════════════════════════════════════

alter table organizaciones    enable row level security;
alter table org_users         enable row level security;
alter table empleados         enable row level security;
alter table categorias        enable row level security;
alter table documentos        enable row level security;
alter table rendiciones       enable row level security;
alter table rendicion_lineas  enable row level security;

-- organizaciones: el miembro ve la suya; el admin la edita -----------------
create policy org_select on organizaciones
  for select using (is_org_member(id));
create policy org_update on organizaciones
  for update using (is_org_admin(id)) with check (is_org_admin(id));

-- org_users: el usuario ve su propia membresía; el admin gestiona ----------
create policy orgusers_select on org_users
  for select using (user_id = auth.uid() or is_org_admin(org_id));
create policy orgusers_admin_all on org_users
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- empleados / categorías / documentos: miembros leen, admins escriben ------
create policy empleados_select on empleados
  for select using (is_org_member(org_id));
create policy empleados_admin_write on empleados
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

create policy categorias_select on categorias
  for select using (is_org_member(org_id));
create policy categorias_admin_write on categorias
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

create policy documentos_select on documentos
  for select using (is_org_member(org_id));
create policy documentos_member_write on documentos
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- rendiciones --------------------------------------------------------------
-- SELECT: admin ve todas; empleado solo las suyas.
create policy rendiciones_select on rendiciones
  for select using (
    is_org_member(org_id) and (
      is_org_admin(org_id) or
      empleado_id in (select id from empleados where user_id = auth.uid())
    )
  );
-- INSERT: admin para cualquiera; empleado solo a su propio nombre.
create policy rendiciones_insert on rendiciones
  for insert with check (
    is_org_admin(org_id) or
    empleado_id in (select id from empleados where user_id = auth.uid())
  );
-- UPDATE: admin siempre; empleado solo las suyas (la action exige borrador).
create policy rendiciones_update on rendiciones
  for update using (
    is_org_admin(org_id) or soy_rendidor(id)
  ) with check (
    is_org_admin(org_id) or soy_rendidor(id)
  );
-- DELETE: misma regla (soft delete real lo hace un UPDATE; este DELETE duro
-- queda solo para admins por si acaso).
create policy rendiciones_delete on rendiciones
  for delete using (is_org_admin(org_id));

-- rendicion_lineas: hereda permisos de la rendición padre ------------------
create policy lineas_select on rendicion_lineas
  for select using (
    exists (select 1 from rendiciones r where r.id = rendicion_id
            and is_org_member(r.org_id)
            and (is_org_admin(r.org_id) or soy_rendidor(r.id)))
  );
create policy lineas_write on rendicion_lineas
  for all using (
    exists (select 1 from rendiciones r where r.id = rendicion_id
            and (is_org_admin(r.org_id) or soy_rendidor(r.id)))
  ) with check (
    exists (select 1 from rendiciones r where r.id = rendicion_id
            and (is_org_admin(r.org_id) or soy_rendidor(r.id)))
  );

-- ════════════════════════════════════════════════════════════════════════
-- Storage: bucket de comprobantes (fotos de boletas/tickets)
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('rendiciones-comprobantes', 'rendiciones-comprobantes', true)
on conflict (id) do nothing;

-- Subida/lectura para usuarios autenticados (refinar por org si se requiere).
create policy comprobantes_read on storage.objects
  for select using (bucket_id = 'rendiciones-comprobantes');
create policy comprobantes_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rendiciones-comprobantes');
