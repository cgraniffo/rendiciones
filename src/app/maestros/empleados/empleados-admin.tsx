"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  guardarEmpleadoAction,
  eliminarEmpleadoAction,
} from "../_actions";

export type EmpleadoRow = {
  id: string;
  nombreCompleto: string;
  rut: string | null;
  email: string | null;
  vinculado: boolean;
  activo: boolean;
};

export function EmpleadosAdmin({ empleados }: { empleados: EmpleadoRow[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<EmpleadoRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar(e: EmpleadoRow) {
    if (!confirm(`¿Eliminar a ${e.nombreCompleto}?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarEmpleadoAction(e.id);
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
          + Nuevo empleado
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Móvil: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {empleados.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm italic text-slate-500">
            Sin empleados. Crea el primero.
          </p>
        ) : (
          empleados.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  {e.nombreCompleto}
                </span>
                {e.activo ? (
                  <span className="text-xs text-emerald-700">Activo</span>
                ) : (
                  <span className="text-xs text-slate-400">Inactivo</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {e.rut ?? "sin RUT"} · {e.email ?? "sin correo"}
              </div>
              <div className="mt-1.5">
                {e.vinculado ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    vinculado
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    sin login
                  </span>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-4 border-t border-slate-100 pt-2">
                <button
                  onClick={() => setEditando(e)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Editar
                </button>
                <button
                  onClick={() => borrar(e)}
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
              <th className="px-3 py-2 text-left font-bold">Nombre</th>
              <th className="px-3 py-2 text-left font-bold">RUT</th>
              <th className="px-3 py-2 text-left font-bold">Correo</th>
              <th className="px-3 py-2 text-center font-bold">Login</th>
              <th className="px-3 py-2 text-center font-bold">Estado</th>
              <th className="px-3 py-2 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {empleados.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm italic text-slate-500"
                >
                  Sin empleados. Crea el primero.
                </td>
              </tr>
            ) : (
              empleados.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {e.nombreCompleto}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{e.rut ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{e.email ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {e.vinculado ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        vinculado
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                        title="Sin login asociado. Para vincular, pon el correo con que la persona inicia sesión."
                      >
                        sin login
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {e.activo ? (
                      <span className="text-emerald-700">Activo</span>
                    ) : (
                      <span className="text-slate-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditando(e)}
                      className="mr-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => borrar(e)}
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
        <ModalEmpleado
          empleado={editando}
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

function ModalEmpleado({
  empleado,
  onClose,
  onDone,
}: {
  empleado: EmpleadoRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(empleado?.nombreCompleto ?? "");
  const [rut, setRut] = useState(empleado?.rut ?? "");
  const [email, setEmail] = useState(empleado?.email ?? "");
  const [activo, setActivo] = useState(empleado?.activo ?? true);

  function submit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await guardarEmpleadoAction({
        id: empleado?.id,
        nombreCompleto: nombre,
        rut: rut || undefined,
        email: email || undefined,
        activo,
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
      title={empleado ? "Editar empleado" : "Nuevo empleado"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Campo label="Nombre completo *">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="RUT">
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Activo">
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              Puede rendir
            </label>
          </Campo>
        </div>
        <Campo label="Correo (para vincular su login)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@empresa.cl"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] italic text-slate-500">
            Si coincide con el correo de un usuario registrado, queda vinculado y
            esa persona podrá rendir lo suyo.
          </p>
        </Campo>
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

export function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
