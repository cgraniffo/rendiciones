-- ════════════════════════════════════════════════════════════════════════
-- Maestros: vinculación empleado↔login + bucket de archivos de documentos
-- ════════════════════════════════════════════════════════════════════════

-- Vincula un empleado a un usuario de auth por coincidencia de email.
-- SECURITY DEFINER: corre como owner (puede leer auth.users) y se auto-restringe
-- a admins de la organización del empleado. Evita necesitar service-role en la app.
-- Devuelve el user_id vinculado (o null si no hay usuario con ese email).
create or replace function vincular_empleado_por_email(p_empleado_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_org   uuid;
  v_uid   uuid;
begin
  select email, org_id into v_email, v_org
    from empleados where id = p_empleado_id and deleted_at is null;
  if v_org is null then
    raise exception 'Empleado no encontrado.';
  end if;
  if not is_org_admin(v_org) then
    raise exception 'No autorizado.';
  end if;
  if v_email is null or length(trim(v_email)) = 0 then
    update empleados set user_id = null where id = p_empleado_id;
    return null;
  end if;

  select id into v_uid
    from auth.users
   where lower(email) = lower(trim(v_email))
   limit 1;

  update empleados set user_id = v_uid where id = p_empleado_id;
  return v_uid;
end;
$$;

-- Bucket para archivos (PDF/foto) de documentos cargados manualmente.
insert into storage.buckets (id, name, public)
values ('documentos-archivos', 'documentos-archivos', true)
on conflict (id) do nothing;

create policy documentos_archivos_read on storage.objects
  for select using (bucket_id = 'documentos-archivos');
create policy documentos_archivos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-archivos');
