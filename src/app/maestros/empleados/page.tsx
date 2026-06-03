import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { MaestroHeader } from "../_components/header";
import { EmpleadosAdmin, type EmpleadoRow } from "./empleados-admin";

export const metadata = { title: "Empleados" };

export default async function EmpleadosPage() {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva || !ctx.esAdmin) redirect("/rendiciones");

  const supabase = await createClient();
  const { data } = await supabase
    .from("empleados")
    .select("id, nombre_completo, rut, email, user_id, activo")
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .order("nombre_completo");

  const empleados: EmpleadoRow[] = (data ?? []).map((e) => ({
    id: e.id as string,
    nombreCompleto: (e.nombre_completo as string | null) ?? "",
    rut: (e.rut as string | null) ?? null,
    email: (e.email as string | null) ?? null,
    vinculado: !!e.user_id,
    activo: !!e.activo,
  }));

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <MaestroHeader titulo="Empleados" />
        <EmpleadosAdmin empleados={empleados} />
      </div>
    </main>
  );
}
