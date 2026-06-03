import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type RolOrg = "empleado" | "admin";

export type OrgRef = {
  id: string;
  nombre: string;
  slug: string;
  rol: RolOrg;
};

export type Contexto = {
  userId: string;
  email: string | null;
  /** Nombre para saludar: del empleado vinculado, o la parte local del correo. */
  nombre: string;
  /** Todas las organizaciones a las que pertenece el usuario. */
  orgs: OrgRef[];
  /** Organización activa (cookie `org_activa`, o la primera disponible). */
  orgActiva: OrgRef | null;
  /** Id del empleado vinculado al usuario dentro de la org activa (o null). */
  empleadoId: string | null;
  /** ¿Es admin en la org activa? */
  esAdmin: boolean;
};

export const COOKIE_ORG = "org_activa";

/**
 * Resuelve el contexto del usuario actual: sus organizaciones, la activa
 * (por sesión, vía cookie), su rol y el empleado vinculado.
 * Devuelve null si no hay sesión.
 */
export async function getContexto(): Promise<Contexto | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("org_users")
    .select("rol, organizaciones(id, nombre, slug)")
    .eq("user_id", user.id);

  const orgs: OrgRef[] = (rows ?? [])
    .map((r) => {
      const o = Array.isArray(r.organizaciones)
        ? r.organizaciones[0]
        : r.organizaciones;
      if (!o) return null;
      return {
        id: o.id as string,
        nombre: o.nombre as string,
        slug: o.slug as string,
        rol: r.rol as RolOrg,
      };
    })
    .filter((o): o is OrgRef => o !== null);

  const cookieStore = await cookies();
  const preferida = cookieStore.get(COOKIE_ORG)?.value;
  const orgActiva =
    orgs.find((o) => o.id === preferida) ?? orgs[0] ?? null;

  let empleadoId: string | null = null;
  let empleadoNombre: string | null = null;
  if (orgActiva) {
    const { data: emp } = await supabase
      .from("empleados")
      .select("id, nombre_completo")
      .eq("org_id", orgActiva.id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    empleadoId = (emp?.id as string | undefined) ?? null;
    empleadoNombre = (emp?.nombre_completo as string | undefined) ?? null;
  }

  const nombre =
    empleadoNombre ??
    (user.email ? user.email.split("@")[0] : "Usuario");

  return {
    userId: user.id,
    email: user.email ?? null,
    nombre,
    orgs,
    orgActiva,
    empleadoId,
    esAdmin: orgActiva?.rol === "admin",
  };
}
