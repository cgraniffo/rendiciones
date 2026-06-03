"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  guardarCategoriaAction,
  eliminarCategoriaAction,
} from "../_actions";
import { Modal, Campo } from "../empleados/empleados-admin";

export type CategoriaRow = {
  id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
};

export function CategoriasAdmin({
  categorias,
}: {
  categorias: CategoriaRow[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<CategoriaRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar(c: CategoriaRow) {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarCategoriaAction(c.id);
      if (!r.ok) setError(r.error ?? "Error");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setCreando(true)}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800"
        >
          + Nueva categoría
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Móvil: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {categorias.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm italic text-slate-500">
            Sin categorías. Crea la primera.
          </p>
        ) : (
          categorias.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">{c.nombre}</span>
                {c.activa ? (
                  <span className="text-xs text-emerald-700">Activa</span>
                ) : (
                  <span className="text-xs text-slate-400">Inactiva</span>
                )}
              </div>
              {c.codigo && (
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {c.codigo}
                </div>
              )}
              <div className="mt-3 flex justify-end gap-4 border-t border-slate-100 pt-2">
                <button
                  onClick={() => setEditando(c)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Editar
                </button>
                <button
                  onClick={() => borrar(c)}
                  disabled={pending}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden overflow-x-auto rounded-3xl border border-slate-200/70 bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900">
            <tr>
              <th className="px-3 py-2 text-left font-bold">Código</th>
              <th className="px-3 py-2 text-left font-bold">Nombre</th>
              <th className="px-3 py-2 text-center font-bold">Estado</th>
              <th className="px-3 py-2 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-sm italic text-slate-500"
                >
                  Sin categorías. Crea la primera.
                </td>
              </tr>
            ) : (
              categorias.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-slate-600">
                    {c.codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {c.nombre}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.activa ? (
                      <span className="text-emerald-700">Activa</span>
                    ) : (
                      <span className="text-slate-400">Inactiva</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditando(c)}
                      className="mr-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => borrar(c)}
                      disabled={pending}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creando || editando) && (
        <ModalCategoria
          categoria={editando}
          onClose={() => {
            setCreando(false);
            setEditando(null);
          }}
          onDone={() => {
            setCreando(false);
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ModalCategoria({
  categoria,
  onClose,
  onDone,
}: {
  categoria: CategoriaRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [codigo, setCodigo] = useState(categoria?.codigo ?? "");
  const [activa, setActiva] = useState(categoria?.activa ?? true);

  function submit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await guardarCategoriaAction({
        id: categoria?.id,
        nombre,
        codigo: codigo || undefined,
        activa,
      });
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      onDone();
    });
  }

  return (
    <Modal
      title={categoria ? "Editar categoría" : "Nueva categoría"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Campo label="Nombre *">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Combustible"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Código (opcional)">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: CC-01"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Activa">
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
              />
              Disponible
            </label>
          </Campo>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}
