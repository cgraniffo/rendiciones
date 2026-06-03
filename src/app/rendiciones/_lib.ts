import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

// =========================================================================
// Tipos
// =========================================================================

export type EstadoRendicion = "borrador" | "presentada" | "aprobada";

/** Desglosa un monto bruto en neto + IVA según afecto/tasa. CLP sin decimales. */
export function desglosaIva(
  monto: number,
  afecto: boolean,
  tasa: number,
): { neto: number; iva: number } {
  if (!afecto || tasa <= 0) return { neto: monto, iva: 0 };
  const neto = Math.round(monto / (1 + tasa / 100));
  return { neto, iva: monto - neto };
}

export type RendicionLineaDetalle = {
  id: string;
  orden: number;
  tipo: "documento" | "libre";
  documentoId: string | null;
  documentoFolio: string | null;
  documentoTipo: string | null;
  documentoEmisor: string | null;
  categoriaId: string | null;
  categoriaLabel: string;
  glosa: string | null;
  cantidad: number;
  precioUnitario: number | null;
  unidad: string | null;
  monto: number;
  afectoIva: boolean;
  tasaIva: number;
  neto: number;
  iva: number;
  fecha: string | null;
  notas: string | null;
  comprobanteUrl: string | null;
};

export type RendicionDetalle = {
  id: string;
  numero: number;
  nombre: string | null;
  empleadoId: string;
  empleadoNombre: string;
  empleadoRut: string | null;
  fechaEmision: string;
  fechaAprobacion: string | null;
  anticipoReferencia: string | null;
  anticipoFecha: string | null;
  estado: EstadoRendicion;
  montoAnticipo: number;
  montoRendido: number;
  saldo: number;
  notas: string | null;
  aprobadaPor: string | null;
  aprobadaAt: string | null;
  liquidacionTipo: "devolucion" | "reembolso" | null;
  liquidacionMonto: number | null;
  liquidacionFecha: string | null;
  liquidacionReferencia: string | null;
  createdAt: string;
  lineas: RendicionLineaDetalle[];
};

function categoriaLabel(
  cc: { nombre?: string | null; codigo?: string | null } | null,
): string {
  if (!cc) return "—";
  const nombre = cc.nombre ?? "Categoría";
  return cc.codigo ? `${cc.codigo} · ${nombre}` : nombre;
}

// =========================================================================
// Detalle (con líneas y joins)
// =========================================================================

export async function cargarRendicionDetalle(
  supabase: DB,
  orgId: string,
  rendicionId: string,
): Promise<RendicionDetalle | null> {
  const { data: r } = await supabase
    .from("rendiciones")
    .select(
      `
      id, numero, nombre, empleado_id, fecha_emision, fecha_aprobacion,
      anticipo_referencia, anticipo_fecha,
      estado, monto_anticipo, monto_rendido, saldo, notas,
      aprobada_por, aprobada_at, created_at,
      liquidacion_tipo, liquidacion_monto, liquidacion_fecha, liquidacion_referencia,
      empleado:empleados(id, nombre_completo, rut)
      `,
    )
    .eq("id", rendicionId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!r) return null;

  const { data: lineasRaw } = await supabase
    .from("rendicion_lineas")
    .select(
      `
      id, orden, tipo, documento_id, categoria_id, glosa,
      cantidad, precio_unitario, unidad, monto, afecto_iva, tasa_iva,
      fecha, notas, comprobante_url,
      documento:documentos(id, folio, tipo, emisor),
      categoria:categorias(id, nombre, codigo)
      `,
    )
    .eq("rendicion_id", rendicionId)
    .order("orden", { ascending: true });

  const empleado = Array.isArray(r.empleado) ? r.empleado[0] : r.empleado;

  const lineas: RendicionLineaDetalle[] = (lineasRaw ?? []).map((l) => {
    const doc = Array.isArray(l.documento) ? l.documento[0] : l.documento;
    const cc = Array.isArray(l.categoria) ? l.categoria[0] : l.categoria;
    const monto = Number(l.monto ?? 0);
    const afectoIva = !!l.afecto_iva;
    const tasaIva = Number(l.tasa_iva ?? 19);
    const { neto, iva } = desglosaIva(monto, afectoIva, tasaIva);
    return {
      id: l.id as string,
      orden: l.orden as number,
      tipo: l.tipo as "documento" | "libre",
      documentoId: (l.documento_id as string | null) ?? null,
      documentoFolio: (doc?.folio as string | null) ?? null,
      documentoTipo: (doc?.tipo as string | null) ?? null,
      documentoEmisor: (doc?.emisor as string | null) ?? null,
      categoriaId: (l.categoria_id as string | null) ?? null,
      categoriaLabel: categoriaLabel(cc),
      glosa: (l.glosa as string | null) ?? null,
      cantidad: Number(l.cantidad ?? 1),
      precioUnitario:
        l.precio_unitario != null ? Number(l.precio_unitario) : null,
      unidad: (l.unidad as string | null) ?? null,
      monto,
      afectoIva,
      tasaIva,
      neto,
      iva,
      fecha: (l.fecha as string | null) ?? null,
      notas: (l.notas as string | null) ?? null,
      comprobanteUrl: (l.comprobante_url as string | null) ?? null,
    };
  });

  return {
    id: r.id as string,
    numero: r.numero as number,
    nombre: (r.nombre as string | null) ?? null,
    empleadoId: r.empleado_id as string,
    empleadoNombre: (empleado?.nombre_completo as string | null) ?? "—",
    empleadoRut: (empleado?.rut as string | null) ?? null,
    fechaEmision: r.fecha_emision as string,
    fechaAprobacion: (r.fecha_aprobacion as string | null) ?? null,
    anticipoReferencia: (r.anticipo_referencia as string | null) ?? null,
    anticipoFecha: (r.anticipo_fecha as string | null) ?? null,
    estado: r.estado as EstadoRendicion,
    montoAnticipo: Number(r.monto_anticipo ?? 0),
    montoRendido: Number(r.monto_rendido ?? 0),
    saldo: Number(r.saldo ?? 0),
    notas: (r.notas as string | null) ?? null,
    aprobadaPor: (r.aprobada_por as string | null) ?? null,
    aprobadaAt: (r.aprobada_at as string | null) ?? null,
    liquidacionTipo:
      (r.liquidacion_tipo as "devolucion" | "reembolso" | null) ?? null,
    liquidacionMonto:
      r.liquidacion_monto != null ? Number(r.liquidacion_monto) : null,
    liquidacionFecha: (r.liquidacion_fecha as string | null) ?? null,
    liquidacionReferencia: (r.liquidacion_referencia as string | null) ?? null,
    createdAt: r.created_at as string,
    lineas,
  };
}
