import { redirect } from "next/navigation";
import { getContexto } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { DemoBadge } from "@/app/_components/demo-badge";

export const metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const ctx = await getContexto();
  if (ctx) redirect("/reportes");

  return (
    <main className="bg-hub-mesh flex min-h-screen items-center justify-center px-4">
      <div className="animate-fade-up w-full max-w-sm rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-emerald-900">
          Rendiciones de gasto <DemoBadge />
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ingresa con tu correo para gestionar tus rendiciones.
        </p>
        <p className="mb-5 mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Esta es una <b>DEMO</b> con datos de ejemplo. Mira el{" "}
          <a href="/manual" className="font-semibold underline">
            Manual de uso
          </a>
          .
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
