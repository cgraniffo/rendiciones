import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { desglosaIva } from "../rendiciones/_lib";
import { OrgSwitcher } from "@/app/_components/org-switcher";
import { DemoBadge } from "@/app/_components/demo-badge";
import { InfoToggle } from "@/app/_components/info-toggle";

export const metadata = { title: "Dashboard" };

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

type SearchParams = Promise<{ categoria?: string; empleado?: string }>;

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borradores",
  presentada: "Presentadas",
  aprobada: "Aprobadas",
};
const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700",
  presentada: "bg-amber-100 text-amber-800",
  aprobada: "bg-emerald-100 text-emerald-800",
};

type Rend = {
  id: string;
  numero: number;
  nombre: string | null;
  estado: "borrador" | "presentada" | "aprobada";
  empleadoId: string;
  empleadoNombre: string;
  fechaEmision: string;
  anticipo: number;
  rendido: number;
  saldo: number;
  liquidada: boolean;
  /** Saldo aún pendiente de cierre (0 si ya se liquidó). */
  pendiente: number;
};

type Linea = {
  rendicionId: string;
  tipo: "documento" | "libre";
  glosa: string | null;
  emisor: string | null;
  folio: string | null;
  monto: number;
  neto: number;
  iva: number;
  cantidad: number;
  unidad: string | null;
  fecha: string | null;
  categoriaId: string | null;
  categoriaNombre: string;
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva) redirect("/rendiciones");

  const { categoria, empleado } = await searchParams;
  const supabase = await createClient();

  // Rendiciones visibles (RLS limita: admin todas, empleado las suyas).
  const { data: rRaw } = await supabase
    .from("rendiciones")
    .select(
      `id, numero, nombre, estado, empleado_id, fecha_emision,
       monto_anticipo, monto_rendido, saldo, liquidacion_tipo,
       empleado:empleados(nombre_completo)`,
    )
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .order("numero", { ascending: false });

  const rendiciones: Rend[] = (rRaw ?? []).map((r) => {
    const emp = Array.isArray(r.empleado) ? r.empleado[0] : r.empleado;
    return {
      id: r.id as string,
      numero: r.numero as number,
      nombre: (r.nombre as string | null) ?? null,
      estado: r.estado as Rend["estado"],
      empleadoId: r.empleado_id as string,
      empleadoNombre: (emp?.nombre_completo as string | null) ?? "—",
      fechaEmision: r.fecha_emision as string,
      anticipo: Number(r.monto_anticipo ?? 0),
      rendido: Number(r.monto_rendido ?? 0),
      saldo: Number(r.saldo ?? 0),
      liquidada: r.liquidacion_tipo != null,
      pendiente: r.liquidacion_tipo != null ? 0 : Number(r.saldo ?? 0),
    };
  });

  const rendById = new Map(rendiciones.map((r) => [r.id, r]));
  const ids = rendiciones.map((r) => r.id);

  // Líneas de esas rendiciones (para gasto por categoría y drill-down).
  let lineas: Linea[] = [];
  if (ids.length > 0) {
    const { data: lRaw } = await supabase
      .from("rendicion_lineas")
      .select(
        `rendicion_id, tipo, glosa, monto, fecha, categoria_id,
         cantidad, unidad, afecto_iva, tasa_iva,
         categoria:categorias(nombre, codigo),
         documento:documentos(emisor, folio)`,
      )
      .in("rendicion_id", ids);
    lineas = (lRaw ?? []).map((l) => {
      const cc = Array.isArray(l.categoria) ? l.categoria[0] : l.categoria;
      const doc = Array.isArray(l.documento) ? l.documento[0] : l.documento;
      const nombreCat = cc?.nombre
        ? cc.codigo
          ? `${cc.codigo} · ${cc.nombre}`
          : (cc.nombre as string)
        : "Sin categoría";
      const monto = Number(l.monto ?? 0);
      const { neto, iva } = desglosaIva(
        monto,
        !!l.afecto_iva,
        Number(l.tasa_iva ?? 19),
      );
      return {
        rendicionId: l.rendicion_id as string,
        tipo: l.tipo as "documento" | "libre",
        glosa: (l.glosa as string | null) ?? null,
        emisor: (doc?.emisor as string | null) ?? null,
        folio: (doc?.folio as string | null) ?? null,
        monto,
        neto,
        iva,
        cantidad: Number(l.cantidad ?? 1),
        unidad: (l.unidad as string | null) ?? null,
        fecha: (l.fecha as string | null) ?? null,
        categoriaId: (l.categoria_id as string | null) ?? null,
        categoriaNombre: nombreCat,
      };
    });
  }

  // ── KPIs ────────────────────────────────────────────────────────────
  const totalAnticipo = rendiciones.reduce((s, r) => s + r.anticipo, 0);
  const totalRendido = rendiciones.reduce((s, r) => s + r.rendido, 0);
  // Saldo pendiente = solo lo no liquidado.
  const totalSaldo = rendiciones.reduce((s, r) => s + r.pendiente, 0);

  // ── Por estado ──────────────────────────────────────────────────────
  const estados: Array<Rend["estado"]> = ["borrador", "presentada", "aprobada"];
  const porEstado = estados.map((k) => {
    const grupo = rendiciones.filter((r) => r.estado === k);
    return {
      k,
      count: grupo.length,
      anticipo: grupo.reduce((s, r) => s + r.anticipo, 0),
      rendido: grupo.reduce((s, r) => s + r.rendido, 0),
    };
  });

  // ── Gasto por categoría ─────────────────────────────────────────────
  const catMap = new Map<
    string,
    { id: string | null; nombre: string; monto: number; lineas: number }
  >();
  for (const l of lineas) {
    const key = l.categoriaId ?? "sin";
    const cur = catMap.get(key) ?? {
      id: l.categoriaId,
      nombre: l.categoriaNombre,
      monto: 0,
      lineas: 0,
    };
    cur.monto += l.monto;
    cur.lineas += 1;
    catMap.set(key, cur);
  }
  const porCategoria = [...catMap.values()].sort((a, b) => b.monto - a.monto);
  const totalLineasMonto = porCategoria.reduce((s, c) => s + c.monto, 0);

  // ── Por rendidor (solo admin: para empleado es solo él) ─────────────
  const empMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      count: number;
      anticipo: number;
      rendido: number;
      saldo: number;
    }
  >();
  for (const r of rendiciones) {
    const cur = empMap.get(r.empleadoId) ?? {
      id: r.empleadoId,
      nombre: r.empleadoNombre,
      count: 0,
      anticipo: 0,
      rendido: 0,
      saldo: 0,
    };
    cur.count += 1;
    cur.anticipo += r.anticipo;
    cur.rendido += r.rendido;
    cur.saldo += r.pendiente;
    empMap.set(r.empleadoId, cur);
  }
  const porRendidor = [...empMap.values()].sort((a, b) => b.rendido - a.rendido);

  // ── Evolución mensual (por fecha de emisión) ────────────────────────
  const mesMap = new Map<
    string,
    { key: string; count: number; rendido: number; anticipo: number }
  >();
  for (const r of rendiciones) {
    const key = (r.fechaEmision ?? "").slice(0, 7); // YYYY-MM
    if (key.length !== 7) continue;
    const cur = mesMap.get(key) ?? { key, count: 0, rendido: 0, anticipo: 0 };
    cur.count += 1;
    cur.rendido += r.rendido;
    cur.anticipo += r.anticipo;
    mesMap.set(key, cur);
  }
  const porMes = [...mesMap.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(-12);
  const maxMesRendido = Math.max(1, ...porMes.map((m) => m.rendido));

  function mesLabel(key: string) {
    const [y, m] = key.split("-");
    return `${MESES[Number(m) - 1] ?? m} ${y}`;
  }
  function mesRango(key: string) {
    const [y, m] = key.split("-").map(Number);
    const ult = new Date(y, m, 0).getDate();
    return { desde: `${key}-01`, hasta: `${key}-${String(ult).padStart(2, "0")}` };
  }

  // ── IVA y cantidades por unidad ─────────────────────────────────────
  const totalLineasNeto = lineas.reduce((s, l) => s + l.neto, 0);
  const totalLineasIva = lineas.reduce((s, l) => s + l.iva, 0);
  const totalLineasBruto = lineas.reduce((s, l) => s + l.monto, 0);

  const unidadMap = new Map<
    string,
    { unidad: string; cantidad: number; monto: number }
  >();
  for (const l of lineas) {
    if (!l.unidad) continue;
    const key = l.unidad.toLowerCase();
    const cur = unidadMap.get(key) ?? {
      unidad: l.unidad,
      cantidad: 0,
      monto: 0,
    };
    cur.cantidad += l.cantidad;
    cur.monto += l.monto;
    unidadMap.set(key, cur);
  }
  const porUnidad = [...unidadMap.values()].sort((a, b) => b.monto - a.monto);

  // ── Drill-down ──────────────────────────────────────────────────────
  const drillCategoria = categoria
    ? porCategoria.find((c) => (c.id ?? "sin") === categoria)
    : null;
  const lineasDrill = categoria
    ? lineas.filter((l) => (l.categoriaId ?? "sin") === categoria)
    : [];
  const drillEmpleado =
    empleado && ctx.esAdmin
      ? porRendidor.find((e) => e.id === empleado)
      : null;
  const rendsDrill = drillEmpleado
    ? rendiciones.filter((r) => r.empleadoId === empleado)
    : [];

  function concepto(l: Linea) {
    return l.tipo === "documento"
      ? `${l.emisor ?? "—"}${l.folio ? ` · folio ${l.folio}` : ""}`
      : (l.glosa ?? "Gasto");
  }

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-6 flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-4 py-3 shadow-md sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div>
            <div className="flex items-center gap-2">
              <OrgSwitcher orgs={ctx.orgs} activaId={ctx.orgActiva.id} />
              {ctx.esAdmin ? (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Admin
                </span>
              ) : (
                <span className="text-[10px] text-emerald-200">
                  solo tus rendiciones
                </span>
              )}
            </div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Dashboard <DemoBadge />
            </h1>
            <p className="text-xs text-emerald-100">
              Hola, {ctx.nombre} 👋
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/rendiciones"
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-800 shadow hover:bg-emerald-50"
            >
              Rendiciones
            </Link>
            <Link
              href="/manual"
              className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/40 hover:bg-white/20"
            >
              Manual
            </Link>
            {ctx.esAdmin && (
              <Link
                href="/maestros"
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/40 hover:bg-white/20"
              >
                Maestros
              </Link>
            )}
            <form action="/auth/logout" method="post">
              <button className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/40 hover:bg-white/20">
                Salir
              </button>
            </form>
          </div>
        </header>

        <div className="mb-4">
          <InfoToggle titulo="¿Qué muestra este dashboard? (Demo)">
            <p>
              Resumen de las rendiciones de tu organización. Los KPIs muestran
              cuánto se ha <b>anticipado</b>, cuánto se ha <b>rendido</b> y el{" "}
              <b>saldo pendiente</b> de cerrar.
            </p>
            <p>
              Todo es <b>navegable</b>: toca un estado, una categoría, un
              rendidor o un mes para bajar al detalle y, desde ahí, a la
              rendición específica. ¿Cómo se usa todo? Revisa el{" "}
              <a href="/manual" className="font-semibold text-emerald-700 underline">
                Manual de uso
              </a>
              . Recuerda que los datos son de ejemplo (demo).
            </p>
          </InfoToggle>
        </div>

        {/* KPIs */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Rendiciones" valor={String(rendiciones.length)} />
          <Kpi label="Anticipado" valor={CLP.format(totalAnticipo)} />
          <Kpi label="Rendido" valor={CLP.format(totalRendido)} />
          <Kpi
            label="Saldo pendiente"
            valor={CLP.format(totalSaldo)}
            hint={
              totalSaldo > 0
                ? "Por devolver a la empresa"
                : totalSaldo < 0
                  ? "Por reembolsar a empleados"
                  : "Cuadrado"
            }
            tono={totalSaldo > 0 ? "amber" : totalSaldo < 0 ? "rose" : "emerald"}
          />
        </section>

        {rendiciones.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-12 text-center text-sm text-slate-500">
            Aún no hay rendiciones para reportar.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Por estado */}
            <Panel titulo="Por estado">
              <ul className="divide-y divide-slate-100">
                {porEstado.map((e) => (
                  <li key={e.k}>
                    <Link
                      href={`/rendiciones?estado=${e.k}`}
                      className="flex items-center justify-between px-1 py-2 hover:bg-emerald-50/40"
                    >
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_BADGE[e.k]}`}
                      >
                        {ESTADO_LABELS[e.k]}
                      </span>
                      <span className="text-sm text-slate-600">
                        {e.count} ·{" "}
                        <span className="font-mono tabular-nums text-slate-800">
                          {CLP.format(e.rendido)}
                        </span>{" "}
                        rendido
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] italic text-slate-400">
                Toca un estado para ver el listado filtrado.
              </p>
            </Panel>

            {/* Por rendidor (solo admin) */}
            {ctx.esAdmin && (
              <Panel titulo="Por rendidor">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-1 py-1 text-left">Rendidor</th>
                      <th className="px-1 py-1 text-right">Rend.</th>
                      <th className="px-1 py-1 text-right">Rendido</th>
                      <th className="px-1 py-1 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porRendidor.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-1 py-1.5">
                          <Link
                            href={`/reportes?empleado=${e.id}`}
                            className="font-semibold text-emerald-700 hover:text-emerald-900"
                          >
                            {e.nombre}
                          </Link>
                        </td>
                        <td className="px-1 py-1.5 text-right text-slate-600">
                          {e.count}
                        </td>
                        <td className="px-1 py-1.5 text-right font-mono tabular-nums text-slate-800">
                          {CLP.format(e.rendido)}
                        </td>
                        <td
                          className={`px-1 py-1.5 text-right font-mono tabular-nums ${e.saldo > 0 ? "text-amber-700" : e.saldo < 0 ? "text-rose-700" : "text-emerald-700"}`}
                        >
                          {CLP.format(e.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {/* IVA recuperable */}
            <Panel titulo="IVA (recuperable)">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Neto</dt>
                  <dd className="font-mono tabular-nums text-slate-800">
                    {CLP.format(totalLineasNeto)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">IVA</dt>
                  <dd className="font-mono font-bold tabular-nums text-emerald-700">
                    {CLP.format(totalLineasIva)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <dt className="text-slate-500">Bruto</dt>
                  <dd className="font-mono tabular-nums text-slate-800">
                    {CLP.format(totalLineasBruto)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] italic text-slate-400">
                IVA de las líneas marcadas como afectas.
              </p>
            </Panel>

            {/* Cantidades por unidad */}
            <Panel titulo="Cantidades por unidad">
              {porUnidad.length === 0 ? (
                <p className="text-sm italic text-slate-500">
                  Sin gastos con cantidad/unidad aún.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {porUnidad.map((u) => (
                    <li
                      key={u.unidad}
                      className="flex items-center justify-between px-1 py-1.5 text-sm"
                    >
                      <span className="capitalize text-slate-700">
                        {u.unidad}
                      </span>
                      <span className="text-slate-600">
                        {u.cantidad.toLocaleString("es-CL")}{" "}
                        <span className="text-xs text-slate-400">
                          · {CLP.format(u.monto)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] italic text-slate-400">
                Ej. litros, peajes, noches.
              </p>
            </Panel>

            {/* Gasto por categoría */}
            <Panel titulo="Gasto por categoría" className="lg:col-span-2">
              {porCategoria.length === 0 ? (
                <p className="text-sm italic text-slate-500">Sin líneas aún.</p>
              ) : (
                <ul className="space-y-2">
                  {porCategoria.map((c) => {
                    const pct =
                      totalLineasMonto > 0
                        ? Math.round((c.monto / totalLineasMonto) * 100)
                        : 0;
                    return (
                      <li key={c.id ?? "sin"}>
                        <Link
                          href={`/reportes?categoria=${c.id ?? "sin"}`}
                          className="block rounded-lg px-1 py-1 hover:bg-emerald-50/40"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-800">
                              {c.nombre}
                            </span>
                            <span className="font-mono tabular-nums text-slate-700">
                              {CLP.format(c.monto)}{" "}
                              <span className="text-xs text-slate-400">
                                ({pct}% · {c.lineas} líneas)
                              </span>
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-[11px] italic text-slate-400">
                Toca una categoría para ver el detalle de sus líneas.
              </p>
            </Panel>

            {/* Evolución mensual */}
            <Panel titulo="Evolución mensual (rendido)" className="lg:col-span-2">
              {porMes.length === 0 ? (
                <p className="text-sm italic text-slate-500">Sin datos.</p>
              ) : (
                <ul className="space-y-2">
                  {porMes.map((m) => {
                    const pct = Math.round((m.rendido / maxMesRendido) * 100);
                    const { desde, hasta } = mesRango(m.key);
                    return (
                      <li key={m.key}>
                        <Link
                          href={`/rendiciones?desde=${desde}&hasta=${hasta}`}
                          className="block rounded-lg px-1 py-1 hover:bg-emerald-50/40"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold capitalize text-slate-800">
                              {mesLabel(m.key)}
                            </span>
                            <span className="font-mono tabular-nums text-slate-700">
                              {CLP.format(m.rendido)}{" "}
                              <span className="text-xs text-slate-400">
                                ({m.count} rend.)
                              </span>
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-[11px] italic text-slate-400">
                Toca un mes para ver sus rendiciones.
              </p>
            </Panel>
          </div>
        )}

        {/* ── Drill-down: líneas de una categoría ─────────────────────── */}
        {drillCategoria && (
          <DrillPanel
            titulo={`Detalle · ${drillCategoria.nombre}`}
            subtitulo={`${CLP.format(drillCategoria.monto)} en ${drillCategoria.lineas} líneas`}
          >
            {/* Móvil: tarjetas */}
            <div className="space-y-3 p-4 sm:hidden">
              {lineasDrill.map((l, i) => {
                const r = rendById.get(l.rendicionId);
                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {r ? (
                        <Link
                          href={`/rendiciones/${r.id}`}
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          #{r.numero} {r.nombre ?? ""}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      <span className="font-mono text-sm tabular-nums text-slate-800">
                        {CLP.format(l.monto)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {concepto(l)} · {l.fecha ?? "s/f"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: tabla */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Rendición</th>
                  <th className="px-3 py-2 text-left font-bold">Concepto</th>
                  <th className="px-3 py-2 text-left font-bold">Fecha</th>
                  <th className="px-3 py-2 text-right font-bold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {lineasDrill.map((l, i) => {
                  const r = rendById.get(l.rendicionId);
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        {r ? (
                          <Link
                            href={`/rendiciones/${r.id}`}
                            className="font-semibold text-emerald-700 hover:text-emerald-900"
                          >
                            #{r.numero} {r.nombre ?? ""}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{concepto(l)}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">
                        {l.fecha ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                        {CLP.format(l.monto)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DrillPanel>
        )}

        {/* ── Drill-down: rendiciones de un rendidor ──────────────────── */}
        {drillEmpleado && (
          <DrillPanel
            titulo={`Detalle · ${drillEmpleado.nombre}`}
            subtitulo={`${drillEmpleado.count} rendiciones · ${CLP.format(drillEmpleado.rendido)} rendido · saldo ${CLP.format(drillEmpleado.saldo)}`}
          >
            {/* Móvil: tarjetas */}
            <div className="space-y-3 p-4 sm:hidden">
              {rendsDrill.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/rendiciones/${r.id}`}
                      className="font-mono font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      #{r.numero}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_BADGE[r.estado]}`}
                    >
                      {ESTADO_LABELS[r.estado]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-slate-700">
                    {r.nombre ?? "—"}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        Anticipo
                      </p>
                      <p className="font-mono text-sm tabular-nums text-slate-700">
                        {CLP.format(r.anticipo)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        Rendido
                      </p>
                      <p className="font-mono text-sm tabular-nums text-slate-700">
                        {CLP.format(r.rendido)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        Saldo
                      </p>
                      <p
                        className={`font-mono text-sm font-bold tabular-nums ${r.saldo > 0 ? "text-amber-700" : r.saldo < 0 ? "text-rose-700" : "text-emerald-700"}`}
                      >
                        {CLP.format(r.saldo)}
                        {r.liquidada && (
                          <span
                            className="ml-1 text-[9px] text-emerald-600"
                            title="Saldo liquidado"
                          >
                            ✓
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabla */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">N°</th>
                  <th className="px-3 py-2 text-left font-bold">Nombre</th>
                  <th className="px-3 py-2 text-center font-bold">Estado</th>
                  <th className="px-3 py-2 text-right font-bold">Anticipo</th>
                  <th className="px-3 py-2 text-right font-bold">Rendido</th>
                  <th className="px-3 py-2 text-right font-bold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rendsDrill.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link
                        href={`/rendiciones/${r.id}`}
                        className="font-mono font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        #{r.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.nombre ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_BADGE[r.estado]}`}
                      >
                        {ESTADO_LABELS[r.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                      {CLP.format(r.anticipo)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                      {CLP.format(r.rendido)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${r.saldo > 0 ? "text-amber-700" : r.saldo < 0 ? "text-rose-700" : "text-emerald-700"}`}
                    >
                      {CLP.format(r.saldo)}
                      {r.liquidada && (
                        <span
                          className="ml-1 align-middle text-[9px] font-bold text-emerald-600"
                          title="Saldo liquidado"
                        >
                          ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DrillPanel>
        )}
      </div>
    </main>
  );
}

function Kpi({
  label,
  valor,
  hint,
  tono = "slate",
}: {
  label: string;
  valor: string;
  hint?: string;
  tono?: "slate" | "amber" | "rose" | "emerald";
}) {
  const color =
    tono === "amber"
      ? "text-amber-700"
      : tono === "rose"
        ? "text-rose-700"
        : tono === "emerald"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/60">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${color}`}>
        {valor}
      </p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm ${className}`}
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-emerald-900">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function DrillPanel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-up mt-6 overflow-x-auto rounded-3xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-emerald-900">{titulo}</h2>
          <p className="text-xs text-slate-500">{subtitulo}</p>
        </div>
        <Link
          href="/reportes"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ✕ Cerrar detalle
        </Link>
      </div>
      {children}
    </section>
  );
}
