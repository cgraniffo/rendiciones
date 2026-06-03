import { redirect } from "next/navigation";
import { getContexto } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const ctx = await getContexto();
  if (ctx) redirect("/reportes");

  return (
    <main className="bg-hub-mesh flex min-h-screen items-center justify-center px-4">
      <div className="animate-fade-up w-full max-w-sm rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-extrabold tracking-tight text-emerald-900">
          Rendiciones de gasto
        </h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">
          Ingresa con tu correo para gestionar tus rendiciones.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
