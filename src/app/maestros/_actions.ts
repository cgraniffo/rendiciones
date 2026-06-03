"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";

type OkErr = { ok: boolean; error?: string };

type Ctx = NonNullable<Awaited<ReturnType<typeof getContexto>>> & {
  orgActiva: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getContexto>>>["orgActiva"]
  >;
};

/** Contexto con org activa y rol admin garantizados, o error. */
async function requireAdmin(): Promise<
  { ctx: Ctx; error: null } | { ctx: null; error: string }
> {
  const ctx = await getContexto();
  if (!ctx || !ctx.orgActiva) {
    return { ctx: null, error: "No hay organización activa en la sesión." };
  }
  if (!ctx.esAdmin) {
    return { ctx: null, error: "Solo el administrador gestiona los maestros." };
  }
  return { ctx: ctx as Ctx, error: null };
}

// ═══════════════════════════════════════════════════════════════════
// EMPLEADOS
// ═══════════════════════════════════════════════════════════════════

export async function guardarEmpleadoAction(args: {
  id?: string;
  nombreCompleto: string;
  rut?: string;
  email?: string;
  activo?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { ctx, error } = await requireAdmin();
    if (!ctx) return { ok: false, error: error! };
    const supabase = await createClient();

    if (!args.nombreCompleto.trim()) {
      return { ok: false, error: "El nombre es obligatorio." };
    }

    const fila = {
      org_id: ctx.orgActiva.id,
      nombre_completo: args.nombreCompleto.trim(),
      rut: args.rut?.trim() || null,
      email: args.email?.trim() || null,
      activo: args.activo ?? true,
    };

    let id = args.id;
    if (id) {
      const { error: e } = await supabase
        .from("empleados")
        .update(fila)
        .eq("id", id)
        .eq("org_id", ctx.orgActiva.id);
      if (e) return { ok: false, error: e.message };
    } else {
      const { data, error: e } = await supabase
        .from("empleados")
        .insert(fila)
        .select("id")
        .single();
      if (e || !data) return { ok: false, error: e?.message ?? "Error" };
      id = data.id as string;
    }

    // Intenta vincular con un login por email (no es bloqueante).
    if (id) {
      await supabase.rpc("vincular_empleado_por_email", { p_empleado_id: id });
    }

    revalidatePath("/maestros/empleados");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function eliminarEmpleadoAction(id: string): Promise<OkErr> {
  try {
    const { ctx, error } = await requireAdmin();
    if (!ctx) return { ok: false, error: error! };
    const supabase = await createClient();

    const { error: e } = await supabase
      .from("empleados")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgActiva.id);
    if (e) return { ok: false, error: e.message };

    revalidatePath("/maestros/empleados");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════

export async function guardarCategoriaAction(args: {
  id?: string;
  nombre: string;
  codigo?: string;
  activa?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { ctx, error } = await requireAdmin();
    if (!ctx) return { ok: false, error: error! };
    const supabase = await createClient();

    if (!args.nombre.trim()) {
      return { ok: false, error: "El nombre es obligatorio." };
    }

    const fila = {
      org_id: ctx.orgActiva.id,
      nombre: args.nombre.trim(),
      codigo: args.codigo?.trim() || null,
      activa: args.activa ?? true,
    };

    if (args.id) {
      const { error: e } = await supabase
        .from("categorias")
        .update(fila)
        .eq("id", args.id)
        .eq("org_id", ctx.orgActiva.id);
      if (e) return { ok: false, error: e.message };
      revalidatePath("/maestros/categorias");
      return { ok: true, id: args.id };
    }

    const { data, error: e } = await supabase
      .from("categorias")
      .insert(fila)
      .select("id")
      .single();
    if (e || !data) return { ok: false, error: e?.message ?? "Error" };

    revalidatePath("/maestros/categorias");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function eliminarCategoriaAction(id: string): Promise<OkErr> {
  try {
    const { ctx, error } = await requireAdmin();
    if (!ctx) return { ok: false, error: error! };
    const supabase = await createClient();

    const { error: e } = await supabase
      .from("categorias")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgActiva.id);
    if (e) return { ok: false, error: e.message };

    revalidatePath("/maestros/categorias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// DOCUMENTOS (carga manual)
// ═══════════════════════════════════════════════════════════════════

export async function guardarDocumentoAction(args: {
  id?: string;
  tipo?: string;
  folio?: string;
  emisor?: string;
  rutEmisor?: string;
  montoTotal: number;
  fecha?: string;
  archivoUrl?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { ctx, error } = await requireAdmin();
    if (!ctx) return { ok: false, error: error! };
    const supabase = await createClient();

    if (!Number.isFinite(args.montoTotal) || args.montoTotal <= 0) {
      return { ok: false, error: "El monto total debe ser mayor a 0." };
    }

    const fila = {
      org_id: ctx.orgActiva.id,
      tipo: args.tipo?.trim() || null,
      folio: args.folio?.trim() || null,
      emisor: args.emisor?.trim() || null,
      rut_emisor: args.rutEmisor?.trim() || null,
      monto_total: args.montoTotal,
      fecha: args.fecha || null,
      archivo_url: args.archivoUrl ?? null,
    };

    if (args.id) {
      const { error: e } = await supabase
        .from("documentos")
        .update(fila)
        .eq("id", args.id)
        .eq("org_id", ctx.orgActiva.id);
      if (e) return { ok: false, error: e.message };
      revalidatePath("/maestros/documentos");
      return { ok: true, id: args.id };
    }

    const { data, error: e } = await supabase
      .from("documentos")
      .insert({ ...fila, created_by: ctx.userId })
      .select("id")
      .single();
    if (e || !data) return { ok: false, error: e?.message ?? "Error" };

    revalidatePath("/maestros/documentos");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function eliminarDocumentoAction(id: string): Promise<OkErr> {
  try {
    const { ctx, error } = await requireAdmin();
    if (!ctx) return { ok: false, error: error! };
    const supabase = await createClient();

    const { error: e } = await supabase
      .from("documentos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgActiva.id);
    if (e) return { ok: false, error: e.message };

    revalidatePath("/maestros/documentos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
