"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearRendicionAction } from "../_actions";

export function FormNuevaRendicion({
  empleados,
  empleadoPredeterminadoId,
  esAdmin,
}: {
  empleados: Array<{ id: string; nombre: string; rut: string | null }>;
  empleadoPredeterminadoId?: string | null;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [empleadoId, setEmpleadoId] = useState<string>(
    empleadoPredeterminadoId ?? empleados[0]?.id ?? "",
  );
  const [nombre, setNombre] = useState("");
  const [fechaEmision, setFechaEmision] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [montoAnticipo, setMontoAnticipo] = useState<string>("");
  const [anticipoReferencia, setAnticipoReferencia] = useState("");
  const [anticipoFecha, setAnticipoFecha] = useState("");
  const [notas, setNotas] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!empleadoId) {
      setError("Selecciona la persona que rinde.");
      return;
    }
    const monto = Number(montoAnticipo.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(monto) || monto < 0) {
      setError("Monto del anticipo inválido.");
      return;
    }

    startTransition(async () => {
      const res = await crearRendicionAction({
        empleadoId,
        nombre: nombre || undefined,
        fechaEmision,
        montoAnticipo: monto,
        anticipoReferencia: anticipoReferencia || undefined,
        anticipoFecha: anticipoFecha || undefined,
        notas: notas || undefined,
      });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Error creando la rendición.");
        return;
      }
      router.push(`/rendiciones/${res.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Rendidor *
        </label>
        <select
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          disabled={!esAdmin}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          required
        >
          <option value="">— Selecciona —</option>
          {empleados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.rut ? ` · ${p.rut}` : ""}
            </option>
          ))}
        </select>
        {!esAdmin && (
          <p className="mt-1 text-[11px] italic text-slate-500">
            Solo puedes rendir a tu propio nombre.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Nombre / descripción (opcional)
        </label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Rendición mayo - viajes terreno"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Fecha
          </label>
          <input
            type="date"
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Monto anticipo (CLP)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={montoAnticipo}
            onChange={(e) => setMontoAnticipo(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-mono text-sm tabular-nums"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Referencia traspaso (opcional)
          </label>
          <input
            type="text"
            value={anticipoReferencia}
            onChange={(e) => setAnticipoReferencia(e.target.value)}
            placeholder="Ej: transferencia #1234"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Fecha traspaso (opcional)
          </label>
          <input
            type="date"
            value={anticipoFecha}
            onChange={(e) => setAnticipoFecha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Notas
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear rendición"}
        </button>
      </div>
    </form>
  );
}
