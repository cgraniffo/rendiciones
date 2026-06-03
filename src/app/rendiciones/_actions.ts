"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════════

type LineaCampos = {
  categoriaId: string;
  monto: number;
  /** P×Q opcional: si precioUnitario está, monto = cantidad × precioUnitario. */
  cantidad?: number;
  precioUnitario?: number | null;
  unidad?: string | null;
  /** IVA: si afecto, neto/IVA se derivan del monto y la tasa. */
  afectoIva?: boolean;
  tasaIva?: number;
  fecha?: string;
  notas?: string;
  comprobanteUrl?: string | null;
};

export type LineaRendicionInput =
  | ({ tipo: "documento"; documentoId: string } & LineaCampos)
  | ({ tipo: "libre"; glosa: string } & LineaCampos);

/** Construye la fila de BD de una línea, calculando el monto desde P×Q. */
function filaLinea(l: LineaRendicionInput) {
  const cantidad = l.cantidad ?? 1;
  const precio = l.precioUnitario ?? null;
  const monto = precio != null ? Math.round(cantidad * precio) : l.monto;
  return {
    tipo: l.tipo,
    documento_id: l.tipo === "documento" ? l.documentoId : null,
    categoria_id: l.categoriaId,
    glosa: l.tipo === "libre" ? l.glosa : null,
    cantidad,
    precio_unitario: precio,
    unidad: l.unidad ?? null,
    monto,
    afecto_iva: l.afectoIva ?? false,
    tasa_iva: l.tasaIva ?? 19,
    fecha: l.fecha ?? null,
    notas: l.notas ?? null,
    comprobante_url: l.comprobanteUrl ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function revalRendiciones(id?: string) {
  revalidatePath(`/rendiciones`);
  if (id) revalidatePath(`/rendiciones/${id}`);
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getContexto>>> & {
  orgActiva: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getContexto>>>["orgActiva"]
  >;
};

/** Contexto con organización activa garantizada, o error. */
async function requireCtx(): Promise<Ctx> {
  const ctx = await getContexto();
  if (!ctx || !ctx.orgActiva) {
    throw new Error("No hay organización activa en la sesión.");
  }
  return ctx as Ctx;
}

/**
 * Carga una rendición de la org activa y resuelve si el usuario puede editarla.
 * Admin: cualquiera. Empleado: solo las suyas (empleado_id == su empleadoId).
 */
async function cargarParaEditar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Ctx,
  rendicionId: string,
  columnas: string,
) {
  const { data: ren } = await supabase
    .from("rendiciones")
    .select(columnas)
    .eq("id", rendicionId)
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!ren) return { ren: null, puede: false };

  const r = ren as unknown as Record<string, unknown>;
  const esRendidor =
    !!ctx.empleadoId && r.empleado_id === ctx.empleadoId;
  const puede = ctx.esAdmin || esRendidor;
  return { ren: r, puede, esRendidor };
}

// ═══════════════════════════════════════════════════════════════════
// CREAR  (estado inicial: borrador)
// ═══════════════════════════════════════════════════════════════════

export async function crearRendicionAction(args: {
  nombre?: string;
  empleadoId: string;
  fechaEmision?: string;
  anticipoReferencia?: string;
  anticipoFecha?: string;
  montoAnticipo: number;
  notas?: string;
  lineas?: LineaRendicionInput[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    // Empleado (no-admin) solo puede crear a su propio nombre.
    if (!ctx.esAdmin && args.empleadoId !== ctx.empleadoId) {
      return {
        ok: false,
        error:
          "Solo puedes crear una rendición a tu propio nombre. Pide a un administrador que la cree por ti.",
      };
    }

    const { data: numData, error: numErr } = await supabase.rpc(
      "siguiente_numero_rendicion",
      { p_org_id: ctx.orgActiva.id },
    );
    if (numErr) return { ok: false, error: numErr.message };
    const numero = numData as number;

    const { data: ren, error: e1 } = await supabase
      .from("rendiciones")
      .insert({
        org_id: ctx.orgActiva.id,
        numero,
        nombre: args.nombre ?? null,
        empleado_id: args.empleadoId,
        fecha_emision:
          args.fechaEmision ?? new Date().toISOString().slice(0, 10),
        anticipo_referencia: args.anticipoReferencia ?? null,
        anticipo_fecha: args.anticipoFecha ?? null,
        monto_anticipo: args.montoAnticipo,
        notas: args.notas ?? null,
        estado: "borrador",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (e1 || !ren) return { ok: false, error: e1?.message ?? "Error" };

    if (args.lineas && args.lineas.length > 0) {
      const filas = args.lineas.map((l, i) => ({
        rendicion_id: ren.id,
        orden: i + 1,
        ...filaLinea(l),
      }));
      const { error: e2 } = await supabase
        .from("rendicion_lineas")
        .insert(filas);
      if (e2) {
        await supabase.from("rendiciones").delete().eq("id", ren.id);
        return { ok: false, error: e2.message };
      }
    }

    revalRendiciones(ren.id);
    return { ok: true, id: ren.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACTUALIZAR encabezado (solo borradores)
// ═══════════════════════════════════════════════════════════════════

export async function actualizarRendicionAction(args: {
  rendicionId: string;
  nombre?: string;
  empleadoId?: string;
  fechaEmision?: string;
  anticipoReferencia?: string | null;
  anticipoFecha?: string | null;
  montoAnticipo?: number;
  notas?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    const { ren, puede, esRendidor } = await cargarParaEditar(
      supabase,
      ctx,
      args.rendicionId,
      "estado, monto_rendido",
    );
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (!puede) {
      return {
        ok: false,
        error: "No tienes permisos para editar esta rendición.",
      };
    }
    // El rendidor (no-admin) no cambia la persona ni el monto del anticipo.
    if (esRendidor && !ctx.esAdmin) {
      if (args.empleadoId !== undefined || args.montoAnticipo !== undefined) {
        return {
          ok: false,
          error:
            "Solo el administrador puede cambiar la persona o el monto del anticipo.",
        };
      }
    }
    if (ren.estado !== "borrador") {
      return { ok: false, error: "Solo se editan rendiciones en borrador." };
    }

    const patch: Record<string, unknown> = {};
    if (args.nombre !== undefined) patch.nombre = args.nombre || null;
    if (args.empleadoId !== undefined) patch.empleado_id = args.empleadoId;
    if (args.fechaEmision !== undefined) patch.fecha_emision = args.fechaEmision;
    if (args.anticipoReferencia !== undefined)
      patch.anticipo_referencia = args.anticipoReferencia || null;
    if (args.anticipoFecha !== undefined)
      patch.anticipo_fecha = args.anticipoFecha || null;
    if (args.montoAnticipo !== undefined)
      patch.monto_anticipo = args.montoAnticipo;
    if (args.notas !== undefined) patch.notas = args.notas || null;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase
      .from("rendiciones")
      .update(patch)
      .eq("id", args.rendicionId);
    if (error) return { ok: false, error: error.message };

    revalRendiciones(args.rendicionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// LÍNEAS: agregar, actualizar y quitar  (solo borradores)
// ═══════════════════════════════════════════════════════════════════

export async function agregarLineaAction(args: {
  rendicionId: string;
  linea: LineaRendicionInput;
}): Promise<{ ok: boolean; lineaId?: string; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    const { ren, puede } = await cargarParaEditar(
      supabase,
      ctx,
      args.rendicionId,
      "estado, monto_anticipo, monto_rendido",
    );
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (!puede) {
      return {
        ok: false,
        error: "No tienes permisos para editar esta rendición.",
      };
    }
    if (ren.estado !== "borrador") {
      return { ok: false, error: "Solo se agregan líneas en borrador." };
    }

    // Se permite rendir más que el anticipo (queda saldo negativo =
    // "empresa debe reembolsar", que luego se liquida). Solo validamos > 0.
    if (Number(args.linea.monto ?? 0) <= 0) {
      return { ok: false, error: "El monto debe ser mayor a 0." };
    }

    // orden = max + 1
    const { data: maxRow } = await supabase
      .from("rendicion_lineas")
      .select("orden")
      .eq("rendicion_id", args.rendicionId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = (maxRow?.orden ?? 0) + 1;

    const { data: nueva, error } = await supabase
      .from("rendicion_lineas")
      .insert({
        rendicion_id: args.rendicionId,
        orden: nextOrden,
        ...filaLinea(args.linea),
      })
      .select("id")
      .single();
    if (error || !nueva) return { ok: false, error: error?.message ?? "Error" };

    revalRendiciones(args.rendicionId);
    return { ok: true, lineaId: nueva.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function actualizarLineaAction(args: {
  rendicionId: string;
  lineaId: string;
  monto?: number;
  glosa?: string;
  categoriaId?: string;
  cantidad?: number;
  precioUnitario?: number | null;
  unidad?: string | null;
  afectoIva?: boolean;
  tasaIva?: number;
  fecha?: string | null;
  notas?: string;
  comprobanteUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    const { ren, puede } = await cargarParaEditar(
      supabase,
      ctx,
      args.rendicionId,
      "estado, monto_anticipo, monto_rendido",
    );
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (!puede) {
      return {
        ok: false,
        error: "No tienes permisos para editar esta rendición.",
      };
    }
    if (ren.estado !== "borrador") {
      return { ok: false, error: "Solo se editan líneas en borrador." };
    }

    // Se permite que el total exceda el anticipo (saldo negativo). Solo > 0.
    if (args.monto !== undefined && Number(args.monto) <= 0) {
      return { ok: false, error: "El monto debe ser mayor a 0." };
    }

    const patch: Record<string, unknown> = {};
    if (args.monto !== undefined) patch.monto = args.monto;
    if (args.glosa !== undefined) patch.glosa = args.glosa || null;
    if (args.categoriaId !== undefined) patch.categoria_id = args.categoriaId;
    if (args.cantidad !== undefined) patch.cantidad = args.cantidad;
    if (args.precioUnitario !== undefined)
      patch.precio_unitario = args.precioUnitario;
    if (args.unidad !== undefined) patch.unidad = args.unidad || null;
    if (args.afectoIva !== undefined) patch.afecto_iva = args.afectoIva;
    if (args.tasaIva !== undefined) patch.tasa_iva = args.tasaIva;
    if (args.fecha !== undefined) patch.fecha = args.fecha;
    if (args.notas !== undefined) patch.notas = args.notas || null;
    if (args.comprobanteUrl !== undefined)
      patch.comprobante_url = args.comprobanteUrl;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase
      .from("rendicion_lineas")
      .update(patch)
      .eq("id", args.lineaId)
      .eq("rendicion_id", args.rendicionId);
    if (error) return { ok: false, error: error.message };

    revalRendiciones(args.rendicionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function quitarLineaAction(args: {
  rendicionId: string;
  lineaId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    const { ren, puede } = await cargarParaEditar(
      supabase,
      ctx,
      args.rendicionId,
      "estado",
    );
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (!puede) {
      return {
        ok: false,
        error: "No tienes permisos para editar esta rendición.",
      };
    }
    if (ren.estado !== "borrador") {
      return { ok: false, error: "Solo se quitan líneas en borrador." };
    }

    const { error } = await supabase
      .from("rendicion_lineas")
      .delete()
      .eq("id", args.lineaId)
      .eq("rendicion_id", args.rendicionId);
    if (error) return { ok: false, error: error.message };

    revalRendiciones(args.rendicionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TRANSICIONES: presentar y aprobar
// ═══════════════════════════════════════════════════════════════════

/** borrador → presentada. Sella la rendición (no se editan líneas). */
export async function presentarRendicionAction(args: {
  rendicionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    const { ren, puede } = await cargarParaEditar(
      supabase,
      ctx,
      args.rendicionId,
      "estado",
    );
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (!puede) {
      return {
        ok: false,
        error: "No tienes permisos para presentar esta rendición.",
      };
    }

    const { count } = await supabase
      .from("rendicion_lineas")
      .select("id", { count: "exact", head: true })
      .eq("rendicion_id", args.rendicionId);
    if (!count || count === 0) {
      return {
        ok: false,
        error: "Agrega al menos una línea antes de presentar.",
      };
    }

    const { error } = await supabase
      .from("rendiciones")
      .update({ estado: "presentada" })
      .eq("id", args.rendicionId)
      .eq("estado", "borrador");
    if (error) return { ok: false, error: error.message };

    revalRendiciones(args.rendicionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** presentada → aprobada. Solo admin. Marca documentos de las líneas como pagados. */
export async function aprobarRendicionAction(args: {
  rendicionId: string;
  fechaAprobacion?: string;
}): Promise<{ ok: boolean; error?: string; documentosActualizados?: number }> {
  try {
    const ctx = await requireCtx();
    if (!ctx.esAdmin) {
      return {
        ok: false,
        error: "Solo el administrador puede aprobar rendiciones.",
      };
    }
    const supabase = await createClient();

    // Verifica pertenencia a la org y estado.
    const { data: ren } = await supabase
      .from("rendiciones")
      .select("estado")
      .eq("id", args.rendicionId)
      .eq("org_id", ctx.orgActiva.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ren) return { ok: false, error: "Rendición no encontrada." };

    const fechaAprobacion =
      args.fechaAprobacion ?? new Date().toISOString().slice(0, 10);

    const { error: eUpd } = await supabase
      .from("rendiciones")
      .update({
        estado: "aprobada",
        fecha_aprobacion: fechaAprobacion,
        aprobada_por: ctx.userId,
        aprobada_at: new Date().toISOString(),
      })
      .eq("id", args.rendicionId)
      .eq("estado", "presentada");
    if (eUpd) return { ok: false, error: eUpd.message };

    // Marca documentos enlazados como pagados.
    const { data: lineas } = await supabase
      .from("rendicion_lineas")
      .select("documento_id")
      .eq("rendicion_id", args.rendicionId)
      .eq("tipo", "documento");

    const docIds = (lineas ?? [])
      .map((l) => l.documento_id)
      .filter((id): id is string => !!id);

    let actualizados = 0;
    if (docIds.length > 0) {
      const { error: eDocs } = await supabase
        .from("documentos")
        .update({ estado_pago: "pagado", fecha_pago: fechaAprobacion })
        .in("id", docIds)
        .eq("org_id", ctx.orgActiva.id);
      if (!eDocs) actualizados = docIds.length;
    }

    revalRendiciones(args.rendicionId);
    revalidatePath(`/documentos`);
    return { ok: true, documentosActualizados: actualizados };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// LIQUIDACIÓN: cierre del saldo (solo admin, sobre rendiciones aprobadas)
//   saldo > 0 → devolución (empleado reintegra el sobrante)
//   saldo < 0 → reembolso  (empresa paga el sobregasto)
// ═══════════════════════════════════════════════════════════════════

export async function registrarLiquidacionAction(args: {
  rendicionId: string;
  fecha?: string;
  referencia?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  tipo?: "devolucion" | "reembolso";
  monto?: number;
}> {
  try {
    const ctx = await requireCtx();
    if (!ctx.esAdmin) {
      return {
        ok: false,
        error: "Solo el administrador registra la liquidación.",
      };
    }
    const supabase = await createClient();

    const { data: ren } = await supabase
      .from("rendiciones")
      .select("estado, saldo, liquidacion_tipo")
      .eq("id", args.rendicionId)
      .eq("org_id", ctx.orgActiva.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (ren.estado !== "aprobada") {
      return { ok: false, error: "Solo se liquida una rendición aprobada." };
    }
    if (ren.liquidacion_tipo) {
      return {
        ok: false,
        error: "Esta rendición ya tiene una liquidación registrada.",
      };
    }

    const saldo = Number(ren.saldo ?? 0);
    if (Math.abs(saldo) < 0.5) {
      return { ok: false, error: "No hay saldo que liquidar (está cuadrada)." };
    }
    const tipo: "devolucion" | "reembolso" =
      saldo > 0 ? "devolucion" : "reembolso";
    const monto = Math.abs(saldo);
    const fecha = args.fecha ?? new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("rendiciones")
      .update({
        liquidacion_tipo: tipo,
        liquidacion_monto: monto,
        liquidacion_fecha: fecha,
        liquidacion_referencia: args.referencia?.trim() || null,
        liquidacion_at: new Date().toISOString(),
        liquidacion_por: ctx.userId,
      })
      .eq("id", args.rendicionId)
      .eq("estado", "aprobada");
    if (error) return { ok: false, error: error.message };

    revalRendiciones(args.rendicionId);
    return { ok: true, tipo, monto };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function anularLiquidacionAction(args: {
  rendicionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireCtx();
    if (!ctx.esAdmin) {
      return { ok: false, error: "Solo el administrador anula la liquidación." };
    }
    const supabase = await createClient();

    const { data: ren } = await supabase
      .from("rendiciones")
      .select("id")
      .eq("id", args.rendicionId)
      .eq("org_id", ctx.orgActiva.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ren) return { ok: false, error: "Rendición no encontrada." };

    const { error } = await supabase
      .from("rendiciones")
      .update({
        liquidacion_tipo: null,
        liquidacion_monto: null,
        liquidacion_fecha: null,
        liquidacion_referencia: null,
        liquidacion_at: null,
        liquidacion_por: null,
      })
      .eq("id", args.rendicionId);
    if (error) return { ok: false, error: error.message };

    revalRendiciones(args.rendicionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// BORRAR (soft delete, no aprobadas)
// ═══════════════════════════════════════════════════════════════════

export async function borrarRendicionAction(
  rendicionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireCtx();
    const supabase = await createClient();

    const { ren, puede } = await cargarParaEditar(
      supabase,
      ctx,
      rendicionId,
      "estado",
    );
    if (!ren) return { ok: false, error: "Rendición no encontrada." };
    if (!puede) {
      return {
        ok: false,
        error: "No tienes permisos para eliminar esta rendición.",
      };
    }

    const { error } = await supabase
      .from("rendiciones")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", rendicionId)
      .neq("estado", "aprobada");
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
  revalidatePath(`/rendiciones`);
  redirect(`/rendiciones`);
}
