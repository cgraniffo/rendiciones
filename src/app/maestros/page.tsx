import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/auth";
import { MaestroHeader } from "./_components/header";

export const metadata = { title: "Maestros" };

const TARJETAS = [
  {
    href: "/maestros/empleados",
    titulo: "Empleados",
    desc: "Personas que rinden. Vincúlalas a un login por correo.",
    emoji: "👤",
  },
  {
    href: "/maestros/categorias",
    titulo: "Categorías",
    desc: "Clasificación del gasto (centro de costo).",
    emoji: "🏷️",
  },
  {
    href: "/maestros/documentos",
    titulo: "Documentos",
    desc: "Facturas / boletas de carga manual para enlazar.",
    emoji: "🧾",
  },
];

export default async function MaestrosPage() {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  if (!ctx.orgActiva || !ctx.esAdmin) redirect("/rendiciones");

  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <MaestroHeader
          titulo="Maestros"
          volverHref="/rendiciones"
          volverLabel="Rendiciones"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TARJETAS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-3xl">{t.emoji}</div>
              <h2 className="mt-2 text-lg font-bold text-emerald-950">
                {t.titulo}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
