import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { cargarRendicionDetalle } from "../_lib";
import { DetalleRendicion } from "../_components/detalle";
import { DemoBadge } from "@/app/_components/demo-badge";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Detalle de rendición" };

export default async function RendicionDetallePage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva) redirect("/rendiciones");

  const supabase = await createClient();
  const rendicion = await cargarRendicionDetalle(supabase, ctx.orgActiva.id, id);
  if (!rendicion) notFound();

  const esRendidor =
    !!ctx.empleadoId && rendicion.empleadoId === ctx.empleadoId;
  const puedeEditar = ctx.esAdmin || esRendidor;
  const puedeAprobar = ctx.esAdmin;

  // Categorías activas para los dropdowns.
  const { data: catsRaw } = await supabase
    .from("categorias")
    .select("id, nombre, codigo")
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .eq("activa", true)
    .order("nombre");
  const categorias = (catsRaw ?? []).map((c) => ({
    id: c.id as string,
    label: c.codigo
      ? `${c.codigo} · ${c.nombre as string}`
      : (c.nombre as string),
  }));

  // Empleados activos (para reasignar el rendidor al editar el encabezado).
  const { data: empsRaw } = await supabase
    .from("empleados")
    .select("id, nombre_completo")
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .eq("activo", true)
    .order("nombre_completo");
  const empleados = (empsRaw ?? []).map((e) => ({
    id: e.id as string,
    nombre: (e.nombre_completo as string | null) ?? "(sin nombre)",
  }));

  // Documentos pendientes para enlazar como línea.
  const { data: docsPend } = await supabase
    .from("documentos")
    .select("id, folio, tipo, fecha, monto_total, rut_emisor, emisor, estado_pago")
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .eq("estado_pago", "pendiente")
    .order("fecha", { ascending: false })
    .limit(500);

  const docsPendientes = (docsPend ?? []).map((d) => ({
    id: d.id as string,
    folio: (d.folio as string | null) ?? "—",
    tipo: (d.tipo as string | null) ?? "—",
    fecha: (d.fecha as string | null) ?? null,
    monto: Number(d.monto_total ?? 0),
    rut: (d.rut_emisor as string | null) ?? null,
    nombre: (d.emisor as string | null) ?? "(sin nombre)",
  }));

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-4 py-3 shadow-md sm:px-5 sm:py-4">
          <Link
            href="/rendiciones"
            className="text-xs font-semibold uppercase tracking-widest text-emerald-200 hover:text-emerald-100"
          >
            ← Rendiciones
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            <span>
              Rendición #{rendicion.numero}
              {rendicion.nombre ? ` — ${rendicion.nombre}` : ""}
            </span>
            <DemoBadge />
          </h1>
          <p className="mt-0.5 text-xs text-emerald-100">
            Rendidor: <b>{rendicion.empleadoNombre}</b>
            {rendicion.empleadoRut ? ` · ${rendicion.empleadoRut}` : ""}
          </p>
        </header>

        <DetalleRendicion
          rendicion={rendicion}
          categorias={categorias}
          empleados={empleados}
          docsPendientes={docsPendientes}
          puedeEscribir={puedeEditar}
          puedeAprobar={puedeAprobar}
          esRendidor={esRendidor}
          esAdmin={ctx.esAdmin}
        />
      </div>
    </main>
  );
}
