"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  guardarDocumentoAction,
  eliminarDocumentoAction,
} from "../_actions";
import { Modal, Campo } from "../empleados/empleados-admin";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const BUCKET = "documentos-archivos";

export type DocumentoRow = {
  id: string;
  tipo: string | null;
  folio: string | null;
  emisor: string | null;
  rutEmisor: string | null;
  montoTotal: number;
  fecha: string | null;
  archivoUrl: string | null;
  estadoPago: "pendiente" | "pagado";
};

const TIPOS = ["Factura", "Boleta", "Otro"];

export function DocumentosAdmin({
  documentos,
}: {
  documentos: DocumentoRow[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<DocumentoRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar(d: DocumentoRow) {
    if (!confirm(`¿Eliminar el documento ${d.folio ?? ""}?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarDocumentoAction(d.id);
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
          + Nuevo documento
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Móvil: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {documentos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm italic text-slate-500">
            Sin documentos. Crea el primero.
          </p>
        ) : (
          documentos.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  {d.tipo ?? "Documento"}
                  {d.folio ? ` · ${d.folio}` : ""}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                >
                  {d.estadoPago === "pagado" ? "Pagado" : "Pendiente"}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {d.emisor ?? "—"}
                {d.rutEmisor ? ` · ${d.rutEmisor}` : ""}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs tabular-nums text-slate-500">
                  {d.fecha ?? "s/f"}
                </span>
                <span className="font-mono text-sm tabular-nums text-slate-800">
                  {CLP.format(d.montoTotal)}
                </span>
              </div>
              {d.archivoUrl && (
                <a
                  href={d.archivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Ver archivo ↗
                </a>
              )}
              <div className="mt-3 flex justify-end gap-4 border-t border-slate-100 pt-2">
                <button
                  onClick={() => setEditando(d)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Editar
                </button>
                <button
                  onClick={() => borrar(d)}
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
              <th className="px-3 py-2 text-left font-bold">Tipo</th>
              <th className="px-3 py-2 text-left font-bold">Folio</th>
              <th className="px-3 py-2 text-left font-bold">Emisor</th>
              <th className="px-3 py-2 text-left font-bold">Fecha</th>
              <th className="px-3 py-2 text-right font-bold">Monto</th>
              <th className="px-3 py-2 text-center font-bold">Pago</th>
              <th className="px-3 py-2 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {documentos.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm italic text-slate-500"
                >
                  Sin documentos. Crea el primero.
                </td>
              </tr>
            ) : (
              documentos.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{d.tipo ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {d.archivoUrl ? (
                      <a
                        href={d.archivoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        {d.folio ?? "ver"} ↗
                      </a>
                    ) : (
                      (d.folio ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{d.emisor ?? "—"}</div>
                    {d.rutEmisor && (
                      <div className="text-xs text-slate-400">{d.rutEmisor}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {d.fecha ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                    {CLP.format(d.montoTotal)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {d.estadoPago === "pagado" ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditando(d)}
                      className="mr-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => borrar(d)}
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
        <ModalDocumento
          documento={editando}
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

function ModalDocumento({
  documento,
  onClose,
  onDone,
}: {
  documento: DocumentoRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState(documento?.tipo ?? TIPOS[0]);
  const [folio, setFolio] = useState(documento?.folio ?? "");
  const [emisor, setEmisor] = useState(documento?.emisor ?? "");
  const [rutEmisor, setRutEmisor] = useState(documento?.rutEmisor ?? "");
  const [monto, setMonto] = useState(
    documento ? String(documento.montoTotal) : "",
  );
  const [fecha, setFecha] = useState(documento?.fecha ?? "");
  const [archivoUrl, setArchivoUrl] = useState<string | null>(
    documento?.archivoUrl ?? null,
  );

  function submit() {
    const m = Number(monto.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(m) || m <= 0) {
      setError("El monto total debe ser mayor a 0.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await guardarDocumentoAction({
        id: documento?.id,
        tipo,
        folio: folio || undefined,
        emisor: emisor || undefined,
        rutEmisor: rutEmisor || undefined,
        montoTotal: m,
        fecha: fecha || undefined,
        archivoUrl,
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
      title={documento ? "Editar documento" : "Nuevo documento"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Folio">
            <input
              type="text"
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
        </div>
        <Campo label="Emisor">
          <input
            type="text"
            value={emisor}
            onChange={(e) => setEmisor(e.target.value)}
            placeholder="Razón social del proveedor"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="RUT emisor">
            <input
              type="text"
              value={rutEmisor}
              onChange={(e) => setRutEmisor(e.target.value)}
              placeholder="76.543.210-K"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
        </div>
        <Campo label="Monto total (CLP) *">
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-mono text-sm tabular-nums"
          />
        </Campo>
        <CampoArchivo value={archivoUrl} onChange={setArchivoUrl} />
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

function CampoArchivo({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    setSubiendo(true);
    const supabase = createClient();
    const ext = f.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, f, { cacheControl: "3600", upsert: false });
    setSubiendo(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
        Archivo (PDF / foto, opcional)
      </label>
      {value ? (
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2 py-1.5">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Ver archivo adjunto ↗
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-full px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
          >
            Quitar
          </button>
        </div>
      ) : (
        <div className="mt-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={onFile}
            disabled={subiendo}
            className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-emerald-800"
          />
          {subiendo && (
            <p className="mt-1 text-[11px] italic text-slate-500">Subiendo…</p>
          )}
          {err && <p className="mt-1 text-[11px] text-rose-700">{err}</p>}
        </div>
      )}
    </div>
  );
}
