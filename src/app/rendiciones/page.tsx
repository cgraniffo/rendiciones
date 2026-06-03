import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { OrgSwitcher } from "@/app/_components/org-switcher";

export const metadata = { title: "Rendiciones de gasto" };

type SearchParams = Promise<{
  estado?: string;
  empleado?: string;
  desde?: string;
  hasta?: string;
}>;

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  presentada: "Presentada",
  aprobada: "Aprobada",
};

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700",
  presentada: "bg-amber-100 text-amber-800",
  aprobada: "bg-emerald-100 text-emerald-800",
};

export default async function RendicionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");

  if (!ctx.orgActiva) {
    return (
      <main className="bg-hub-mesh flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <h1 className="text-lg font-bold text-emerald-950">
            Aún no perteneces a ninguna organización
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pídele a un administrador que te agregue. Sesión: <b>{ctx.email}</b>
          </p>
          <form action="/auth/logout" method="post" className="mt-4">
            <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { estado, empleado, desde, hasta } = await searchParams;
  const supabase = await createClient();

  // RLS restringe automáticamente: un empleado solo ve sus rendiciones; el
  // admin ve todas las de la organización.
  let query = supabase
    .from("rendiciones")
    .select(
      `id, numero, nombre, fecha_emision, estado, monto_anticipo, monto_rendido, saldo,
       empleado:empleados(nombre_completo),
       lineas:rendicion_lineas(count)`,
    )
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .order("numero", { ascending: false });

  if (estado && ESTADO_LABELS[estado]) query = query.eq("estado", estado);
  if (ctx.esAdmin && empleado) query = query.eq("empleado_id", empleado);
  if (desde) query = query.gte("fecha_emision", desde);
  if (hasta) query = query.lte("fecha_emision", hasta);

  const { data: rendiciones } = await query;
  const filas = rendiciones ?? [];

  // Selector de empleado (solo admin).
  const opcionesEmpleado: Array<{ id: string; nombre: string }> = [];
  if (ctx.esAdmin) {
    const { data: emps } = await supabase
      .from("empleados")
      .select("id, nombre_completo")
      .eq("org_id", ctx.orgActiva.id)
      .is("deleted_at", null)
      .order("nombre_completo");
    for (const e of emps ?? []) {
      opcionesEmpleado.push({
        id: e.id as string,
        nombre: (e.nombre_completo as string | null) ?? "(sin nombre)",
      });
    }
  }

  const ESTADOS_FILTRO: Array<{ k: string | undefined; label: string }> = [
    { k: undefined, label: "Todas" },
    { k: "borrador", label: "Borradores" },
    { k: "presentada", label: "Presentadas" },
    { k: "aprobada", label: "Aprobadas" },
  ];

  function hrefConParams(over: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { estado, empleado, desde, hasta, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/rendiciones${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="animate-fade-up mb-6 flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-4 py-3 shadow-md sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div>
            <div className="flex items-center gap-2">
              <OrgSwitcher orgs={ctx.orgs} activaId={ctx.orgActiva.id} />
              {ctx.esAdmin && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Admin
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Rendiciones de gasto
            </h1>
            <p className="text-xs text-emerald-100">Hola, {ctx.nombre} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/reportes"
              className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/40 hover:bg-white/20"
            >
              Dashboard
            </Link>
            {ctx.esAdmin && (
              <Link
                href="/maestros"
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/40 hover:bg-white/20"
              >
                Maestros
              </Link>
            )}
            <Link
              href="/rendiciones/nueva"
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-800 shadow hover:bg-emerald-50"
            >
              + Nueva rendición
            </Link>
            <form action="/auth/logout" method="post">
              <button className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/40 hover:bg-white/20">
                Salir
              </button>
            </form>
          </div>
        </header>

        {/* Filtros */}
        <form
          method="get"
          action="/rendiciones"
          className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          {estado && <input type="hidden" name="estado" value={estado} />}
          {ctx.esAdmin && (
            <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Rendidor
              <select
                name="empleado"
                defaultValue={empleado ?? ""}
                className="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
              >
                <option value="">Todos</option>
                {opcionesEmpleado.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Desde
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
            />
          </label>
          <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Hasta
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow hover:bg-emerald-800"
          >
            Filtrar
          </button>
          {(empleado || desde || hasta) && (
            <Link
              href={estado ? `/rendiciones?estado=${estado}` : "/rendiciones"}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpiar
            </Link>
          )}
        </form>

        {/* Chips de estado */}
        <div className="mb-3 flex flex-wrap gap-2">
          {ESTADOS_FILTRO.map((f) => {
            const activa = f.k === estado || (!f.k && !estado);
            return (
              <Link
                key={f.label}
                href={hrefConParams({ estado: f.k })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  activa
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {filas.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-12 text-center">
            <h2 className="text-lg font-semibold text-emerald-950">
              Sin rendiciones{" "}
              {estado ? `en estado "${ESTADO_LABELS[estado]}"` : "cargadas"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Empieza creando una con &quot;+ Nueva rendición&quot;.
            </p>
          </div>
        ) : (
          <>
            {/* Móvil: tarjetas */}
            <div className="animate-fade-up space-y-3 sm:hidden">
              {filas.map((r) => {
                const lineasCount =
                  Array.isArray(r.lineas) && r.lineas[0]?.count
                    ? Number(r.lineas[0].count)
                    : 0;
                const empleado = Array.isArray(r.empleado)
                  ? r.empleado[0]
                  : r.empleado;
                const saldoNum = Number(r.saldo ?? 0);
                return (
                  <Link
                    key={r.id}
                    href={`/rendiciones/${r.id}`}
                    className="block rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm active:bg-emerald-50/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold tabular-nums text-slate-700">
                        #{r.numero}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_BADGE[r.estado]}`}
                      >
                        {ESTADO_LABELS[r.estado]}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {r.nombre ?? `Rendición #${r.numero}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {empleado?.nombre_completo ?? "—"} · {r.fecha_emision} ·{" "}
                      {lineasCount} líneas
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Anticipo
                        </p>
                        <p className="font-mono text-sm tabular-nums text-slate-700">
                          {CLP.format(Number(r.monto_anticipo))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Rendido
                        </p>
                        <p className="font-mono text-sm tabular-nums text-slate-700">
                          {CLP.format(Number(r.monto_rendido))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Saldo
                        </p>
                        <p
                          className={`font-mono text-sm font-bold tabular-nums ${saldoNum > 0 ? "text-amber-700" : saldoNum < 0 ? "text-rose-700" : "text-emerald-700"}`}
                        >
                          {CLP.format(saldoNum)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: tabla */}
            <div className="animate-fade-up hidden overflow-x-auto rounded-3xl border border-slate-200/70 bg-white shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">N°</th>
                  <th className="px-3 py-2 text-left font-bold">Nombre</th>
                  <th className="px-3 py-2 text-left font-bold">Rendidor</th>
                  <th className="px-3 py-2 text-left font-bold">Fecha</th>
                  <th className="px-3 py-2 text-right font-bold">Líneas</th>
                  <th className="px-3 py-2 text-right font-bold">Anticipo</th>
                  <th className="px-3 py-2 text-right font-bold">Rendido</th>
                  <th className="px-3 py-2 text-right font-bold">Saldo</th>
                  <th className="px-3 py-2 text-center font-bold">Estado</th>
                  <th className="px-3 py-2 text-right font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => {
                  const lineasCount =
                    Array.isArray(r.lineas) && r.lineas[0]?.count
                      ? Number(r.lineas[0].count)
                      : 0;
                  const empleado = Array.isArray(r.empleado)
                    ? r.empleado[0]
                    : r.empleado;
                  const saldoNum = Number(r.saldo ?? 0);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-slate-100 hover:bg-emerald-50/30"
                    >
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-700">
                        #{r.numero}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {r.nombre ?? `Rendición #${r.numero}`}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {empleado?.nombre_completo ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">
                        {r.fecha_emision}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {lineasCount}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                        {CLP.format(Number(r.monto_anticipo))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                        {CLP.format(Number(r.monto_rendido))}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold tabular-nums ${saldoNum > 0 ? "text-amber-700" : saldoNum < 0 ? "text-rose-700" : "text-emerald-700"}`}
                      >
                        {CLP.format(saldoNum)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_BADGE[r.estado]}`}
                        >
                          {ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/rendiciones/${r.id}`}
                          className="text-emerald-700 hover:text-emerald-900"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
