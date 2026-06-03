"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Modo = "ingresar" | "registrar";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<Modo>("ingresar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    const supabase = createClient();

    startTransition(async () => {
      if (modo === "ingresar") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(error.message);
          return;
        }
        router.replace("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        setAviso(
          "Cuenta creada. Si la confirmación por correo está activa, revisa tu bandeja antes de ingresar.",
        );
        setModo("ingresar");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Correo
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Contraseña
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={modo === "ingresar" ? "current-password" : "new-password"}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {aviso}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending
          ? "Procesando…"
          : modo === "ingresar"
            ? "Ingresar"
            : "Crear cuenta"}
      </button>

      <button
        type="button"
        onClick={() => {
          setModo(modo === "ingresar" ? "registrar" : "ingresar");
          setError(null);
          setAviso(null);
        }}
        className="w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-900"
      >
        {modo === "ingresar"
          ? "¿No tienes cuenta? Regístrate"
          : "¿Ya tienes cuenta? Ingresa"}
      </button>
    </form>
  );
}
