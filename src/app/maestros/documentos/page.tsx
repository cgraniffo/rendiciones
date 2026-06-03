import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/auth";
import { MaestroHeader } from "../_components/header";
import { DocumentosAdmin, type DocumentoRow } from "./documentos-admin";

export const metadata = { title: "Documentos" };

export default async function DocumentosPage() {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva || !ctx.esAdmin) redirect("/rendiciones");

  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos")
    .select(
      "id, tipo, folio, emisor, rut_emisor, monto_total, fecha, archivo_url, estado_pago",
    )
    .eq("org_id", ctx.orgActiva.id)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .limit(500);

  const documentos: DocumentoRow[] = (data ?? []).map((d) => ({
    id: d.id as string,
    tipo: (d.tipo as string | null) ?? null,
    folio: (d.folio as string | null) ?? null,
    emisor: (d.emisor as string | null) ?? null,
    rutEmisor: (d.rut_emisor as string | null) ?? null,
    montoTotal: Number(d.monto_total ?? 0),
    fecha: (d.fecha as string | null) ?? null,
    archivoUrl: (d.archivo_url as string | null) ?? null,
    estadoPago: (d.estado_pago as "pendiente" | "pagado") ?? "pendiente",
  }));

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <MaestroHeader titulo="Documentos" />
        <DocumentosAdmin documentos={documentos} />
      </div>
    </main>
  );
}
