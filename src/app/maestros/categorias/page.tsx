import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { MaestroHeader } from "../_components/header";
import { CategoriasAdmin, type CategoriaRow } from "./categorias-admin";

export const metadata = { title: "Categorías" };

export default async function CategoriasPage() {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva || !ctx.esAdmin) redirect("/rendiciones");

  const supabase = await createClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre, codigo, activa")
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .order("nombre");

  const categorias: CategoriaRow[] = (data ?? []).map((c) => ({
    id: c.id as string,
    nombre: (c.nombre as string | null) ?? "",
    codigo: (c.codigo as string | null) ?? null,
    activa: !!c.activa,
  }));

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <MaestroHeader titulo="Categorías" />
        <CategoriasAdmin categorias={categorias} />
      </div>
    </main>
  );
}
