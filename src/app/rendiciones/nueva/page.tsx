import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { FormNuevaRendicion } from "../_components/form-nueva";
import { DemoBadge } from "@/app/_components/demo-badge";

export const metadata = { title: "Nueva rendición de gasto" };

export default async function NuevaRendicionPage() {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva) redirect("/rendiciones");

  const supabase = await createClient();

  // El admin elige cualquier empleado; el empleado solo puede a su nombre.
  const { data: empleadosRaw } = await supabase
    .from("empleados")
    .select("id, nombre_completo, rut, user_id")
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .eq("activo", true)
    .order("nombre_completo");

  const todos = (empleadosRaw ?? []).map((p) => ({
    id: p.id as string,
    nombre: (p.nombre_completo as string | null) ?? "(sin nombre)",
    rut: (p.rut as string | null) ?? null,
    userId: (p.user_id as string | null) ?? null,
  }));

  // Si no es admin: solo puede rendir a su propio nombre.
  const empleados = ctx.esAdmin
    ? todos.map(({ id, nombre, rut }) => ({ id, nombre, rut }))
    : todos
        .filter((e) => e.id === ctx.empleadoId)
        .map(({ id, nombre, rut }) => ({ id, nombre, rut }));

  // Empleado sin ficha vinculada y sin ser admin: no puede crear.
  if (!ctx.esAdmin && empleados.length === 0) {
    return (
      <main className="bg-hub-mesh flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-dashed border-amber-200 bg-white p-10 text-center">
          <h1 className="text-lg font-bold text-amber-900">
            No tienes una ficha de empleado vinculada
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pídele a un administrador que cree tu ficha o que cree la rendición
            por ti.
          </p>
          <Link
            href="/rendiciones"
            className="mt-4 inline-block rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-4 py-3 shadow-md sm:px-5 sm:py-4">
          <Link
            href="/rendiciones"
            className="text-xs font-semibold uppercase tracking-widest text-emerald-200 hover:text-emerald-100"
          >
            ← Rendiciones
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Nueva rendición de gasto <DemoBadge />
          </h1>
        </header>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <FormNuevaRendicion
            empleados={empleados}
            empleadoPredeterminadoId={ctx.empleadoId}
            esAdmin={ctx.esAdmin}
          />
        </div>
      </div>
    </main>
  );
}
