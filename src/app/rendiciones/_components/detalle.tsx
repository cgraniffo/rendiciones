"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { desglosaIva } from "../_lib";
import type { RendicionDetalle, RendicionLineaDetalle } from "../_lib";
import {
  agregarLineaAction,
  actualizarLineaAction,
  quitarLineaAction,
  presentarRendicionAction,
  aprobarRendicionAction,
  borrarRendicionAction,
  actualizarRendicionAction,
  registrarLiquidacionAction,
  anularLiquidacionAction,
  type LineaRendicionInput,
} from "../_actions";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const BUCKET_COMPROBANTES = "rendiciones-comprobantes";

async function subirComprobante(
  file: File,
  rendicionId: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${rendicionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from(BUCKET_COMPROBANTES).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  presentada: "Presentada",
  aprobada: "Aprobada",
};
const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-200 text-slate-800",
  presentada: "bg-amber-200 text-amber-900",
  aprobada: "bg-emerald-200 text-emerald-900",
};

type DocPendiente = {
  id: string;
  folio: string;
  tipo: string;
  fecha: string | null;
  monto: number;
  rut: string | null;
  nombre: string;
};

type Cat = { id: string; label: string };

// ─────────────────────────────────────────────────────────────────────────
// Bloque reutilizable: monto + (P×Q opcional) + IVA (afecto/exento)
// ─────────────────────────────────────────────────────────────────────────

type MontoIvaState = {
  cantidad: string;
  precio: string;
  unidad: string;
  montoManual: string;
  afecto: boolean;
  tasa: string;
};

function nuevoMontoIva(init?: {
  cantidad?: number;
  precioUnitario?: number | null;
  unidad?: string | null;
  monto?: number;
  afectoIva?: boolean;
  tasaIva?: number;
}): MontoIvaState {
  return {
    cantidad: String(init?.cantidad ?? 1),
    precio: init?.precioUnitario != null ? String(init.precioUnitario) : "",
    unidad: init?.unidad ?? "",
    montoManual: init?.monto != null ? String(init.monto) : "",
    afecto: init?.afectoIva ?? false,
    tasa: String(init?.tasaIva ?? 19),
  };
}

function calcMontoIva(s: MontoIvaState, withPxQ: boolean) {
  const num = (x: string) => Number(x.replace(/[^\d.-]/g, "")) || 0;
  const precioUnitario = withPxQ && s.precio.trim() ? num(s.precio) : null;
  const cantidad = num(s.cantidad) || 1;
  const monto =
    precioUnitario != null ? Math.round(cantidad * precioUnitario) : num(s.montoManual);
  const tasaIva = num(s.tasa) || 0;
  const { neto, iva } = desglosaIva(monto, s.afecto, tasaIva);
  return {
    monto,
    cantidad: precioUnitario != null ? cantidad : 1,
    precioUnitario,
    unidad: s.unidad.trim() || null,
    afectoIva: s.afecto,
    tasaIva,
    neto,
    iva,
  };
}

function MontoIvaFields({
  withPxQ,
  s,
  set,
}: {
  withPxQ: boolean;
  s: MontoIvaState;
  set: (patch: Partial<MontoIvaState>) => void;
}) {
  const d = calcMontoIva(s, withPxQ);
  const usaPxQ = withPxQ && s.precio.trim() !== "";

  return (
    <div className="space-y-2">
      {withPxQ && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Cantidad
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={s.cantidad}
              onChange={(e) => set({ cantidad: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-mono text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Precio unit.
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={s.precio}
              onChange={(e) => set({ precio: e.target.value })}
              placeholder="(opcional)"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-mono text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Unidad
            </label>
            <input
              type="text"
              value={s.unidad}
              onChange={(e) => set({ unidad: e.target.value })}
              placeholder="peaje, litro…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Monto total (CLP){usaPxQ ? " · calculado" : ""}
        </label>
        {usaPxQ ? (
          <p className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-700">
            {CLP.format(d.monto)}
          </p>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={s.montoManual}
            onChange={(e) => set({ montoManual: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-mono text-sm tabular-nums"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={s.afecto}
            onChange={(e) => set({ afecto: e.target.checked })}
          />
          Afecto a IVA
        </label>
        {s.afecto && (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Tasa %
            <input
              type="text"
              inputMode="decimal"
              value={s.tasa}
              onChange={(e) => set({ tasa: e.target.value })}
              className="w-14 rounded-md border border-slate-300 px-2 py-1 text-right font-mono text-sm tabular-nums"
            />
          </label>
        )}
        {s.afecto && d.monto > 0 && (
          <span className="text-xs text-slate-500">
            Neto <b className="font-mono">{CLP.format(d.neto)}</b> · IVA{" "}
            <b className="font-mono">{CLP.format(d.iva)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

export function DetalleRendicion({
  rendicion,
  categorias,
  empleados = [],
  docsPendientes,
  puedeEscribir,
  puedeAprobar,
  esRendidor = false,
  esAdmin = false,
}: {
  rendicion: RendicionDetalle;
  categorias: Cat[];
  empleados?: Array<{ id: string; nombre: string }>;
  docsPendientes: DocPendiente[];
  puedeEscribir: boolean;
  puedeAprobar: boolean;
  esRendidor?: boolean;
  esAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "factura" | "libre" | "encabezado" | "liquidacion" | null
  >(null);
  const [editandoLinea, setEditandoLinea] =
    useState<RendicionLineaDetalle | null>(null);

  const esBorrador = rendicion.estado === "borrador";
  const esPresentada = rendicion.estado === "presentada";
  const esAprobada = rendicion.estado === "aprobada";
  const disponible = rendicion.montoAnticipo - rendicion.montoRendido;
  const tagRol = esAdmin
    ? "Admin"
    : esRendidor
      ? "Eres el rendidor"
      : null;

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
      router.refresh();
    });
  }

  return (
    <>
      {tagRol && (
        <p className="mb-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-200">
          {tagRol}
        </p>
      )}

      {/* Resumen */}
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card label="Estado">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${ESTADO_BADGE[rendicion.estado]}`}
          >
            {ESTADO_LABELS[rendicion.estado]}
          </span>
        </Card>
        <Card label="Anticipo">
          <span className="font-mono font-bold tabular-nums text-slate-900">
            {CLP.format(rendicion.montoAnticipo)}
          </span>
        </Card>
        <Card label="Rendido">
          <span className="font-mono font-bold tabular-nums text-slate-900">
            {CLP.format(rendicion.montoRendido)}
          </span>
        </Card>
        <Card label="Saldo">
          <span
            className={`font-mono font-bold tabular-nums ${rendicion.saldo > 0 ? "text-amber-700" : rendicion.saldo < 0 ? "text-rose-700" : "text-emerald-700"}`}
          >
            {CLP.format(rendicion.saldo)}
          </span>
          <p className="mt-1 text-[10px] text-slate-500">
            {rendicion.saldo > 0
              ? "Empleado debe devolver"
              : rendicion.saldo < 0
                ? "Empresa debe reembolsar"
                : "Cuadrado"}
          </p>
        </Card>
      </section>

      {/* Referencia del traspaso del anticipo (campo simple, sin conciliación) */}
      {(rendicion.anticipoReferencia || rendicion.anticipoFecha) && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Traspaso del anticipo
          </p>
          <p className="mt-1 text-slate-700">
            {rendicion.anticipoReferencia ?? "—"}
            {rendicion.anticipoFecha ? ` · ${rendicion.anticipoFecha}` : ""}
          </p>
        </section>
      )}

      {/* Liquidación del saldo (rendición aprobada) */}
      {esAprobada && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Liquidación del saldo
          </p>
          {rendicion.liquidacionTipo ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-emerald-700">
                  ✓{" "}
                  {rendicion.liquidacionTipo === "devolucion"
                    ? "Devolución"
                    : "Reembolso"}{" "}
                  de {CLP.format(rendicion.liquidacionMonto ?? 0)}
                </span>{" "}
                registrada el {rendicion.liquidacionFecha}
                {rendicion.liquidacionReferencia
                  ? ` · ${rendicion.liquidacionReferencia}`
                  : ""}
              </p>
              {esAdmin && (
                <button
                  onClick={() => {
                    if (!confirm("¿Anular esta liquidación?")) return;
                    runAction(() =>
                      anularLiquidacionAction({ rendicionId: rendicion.id }),
                    );
                  }}
                  disabled={pending}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anular
                </button>
              )}
            </div>
          ) : Math.abs(rendicion.saldo) < 0.5 ? (
            <p className="mt-1 text-sm italic text-slate-500">
              Rendición cuadrada: no hay saldo que liquidar.
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-700">
                {rendicion.saldo > 0
                  ? "El empleado debe devolver "
                  : "La empresa debe reembolsar "}
                <b
                  className={
                    rendicion.saldo > 0 ? "text-amber-700" : "text-rose-700"
                  }
                >
                  {CLP.format(Math.abs(rendicion.saldo))}
                </b>
                .
              </p>
              {esAdmin ? (
                <button
                  onClick={() => setModal("liquidacion")}
                  disabled={pending}
                  className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
                >
                  Registrar{" "}
                  {rendicion.saldo > 0 ? "devolución" : "reembolso"}
                </button>
              ) : (
                <span className="text-xs italic text-slate-500">
                  Pendiente de que el administrador lo registre.
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Acciones */}
      {puedeEscribir && (
        <div className="mb-4 flex flex-wrap gap-2">
          {esBorrador && (
            <>
              <button
                onClick={() => setModal("encabezado")}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                ✎ Editar encabezado
              </button>
              <button
                onClick={() => setModal("factura")}
                className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800"
              >
                + Factura pendiente
              </button>
              <button
                onClick={() => setModal("libre")}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50"
              >
                + Gasto sin documento
              </button>
              <button
                onClick={() =>
                  runAction(() =>
                    presentarRendicionAction({ rendicionId: rendicion.id }),
                  )
                }
                disabled={pending || rendicion.lineas.length === 0}
                className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-700 disabled:opacity-50"
              >
                Presentar →
              </button>
              <button
                onClick={() => {
                  if (!confirm("¿Eliminar esta rendición? No se puede recuperar."))
                    return;
                  runAction(() => borrarRendicionAction(rendicion.id));
                }}
                disabled={pending}
                className="ml-auto rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50"
              >
                Eliminar
              </button>
            </>
          )}
          {esPresentada && puedeAprobar && (
            <button
              onClick={() =>
                runAction(() =>
                  aprobarRendicionAction({ rendicionId: rendicion.id }),
                )
              }
              disabled={pending}
              className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
            >
              Aprobar (marca documentos pagados)
            </button>
          )}
          {esPresentada && !puedeAprobar && (
            <p className="text-xs italic text-slate-500">
              Esperando aprobación del administrador.
            </p>
          )}
          {esAprobada && (
            <p className="text-xs italic text-emerald-700">
              Rendición aprobada el {rendicion.fechaAprobacion} — documentos
              marcados como pagados.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {esBorrador && puedeEscribir && rendicion.lineas.length > 0 && (
        <p className="mb-1 text-[11px] italic text-slate-500">
          💡 Toca una línea para editarla.
        </p>
      )}

      {/* Líneas */}
      <section className="overflow-x-auto rounded-3xl border border-slate-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900">
            <tr>
              <th className="px-3 py-2 text-left font-bold">#</th>
              <th className="px-3 py-2 text-left font-bold">Concepto</th>
              <th className="px-3 py-2 text-left font-bold">Categoría</th>
              <th className="px-3 py-2 text-left font-bold">Fecha</th>
              <th className="px-3 py-2 text-right font-bold">Monto</th>
              {esBorrador && puedeEscribir && (
                <th className="px-3 py-2 text-right font-bold"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {rendicion.lineas.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm italic text-slate-500"
                >
                  Sin líneas. Agrega una factura pendiente o un gasto sin
                  documento.
                </td>
              </tr>
            ) : (
              rendicion.lineas.map((l) => {
                const editable = esBorrador && puedeEscribir;
                return (
                  <tr
                    key={l.id}
                    className={`border-t border-slate-100 ${editable ? "cursor-pointer hover:bg-emerald-50/30" : ""}`}
                    onClick={() => editable && setEditandoLinea(l)}
                  >
                    <td className="px-3 py-2 text-slate-500">{l.orden}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        {l.comprobanteUrl && (
                          <a
                            href={l.comprobanteUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="block h-9 w-9 flex-shrink-0 overflow-hidden rounded border border-slate-200"
                            title="Ver comprobante"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={l.comprobanteUrl}
                              alt="cmp"
                              className="h-full w-full object-cover"
                            />
                          </a>
                        )}
                        <div className="min-w-0">
                          {l.tipo === "documento" ? (
                            <>
                              <div className="font-semibold text-slate-800">
                                {l.documentoEmisor ?? "—"}
                              </div>
                              <div className="text-xs text-slate-500">
                                {l.documentoTipo ?? "doc"} · folio{" "}
                                {l.documentoFolio ?? "—"}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold text-slate-800">
                                {l.glosa}
                              </div>
                              <div className="text-xs italic text-slate-500">
                                Sin documento
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {l.categoriaLabel}
                      {l.precioUnitario != null && (
                        <div className="text-[11px] text-slate-400">
                          {l.cantidad} {l.unidad ?? "u"} ×{" "}
                          {CLP.format(l.precioUnitario)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">
                      {l.fecha ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-slate-900">
                      {CLP.format(l.monto)}
                      {l.afectoIva && l.iva > 0 && (
                        <div className="text-[10px] font-normal text-slate-400">
                          neto {CLP.format(l.neto)} · IVA {CLP.format(l.iva)}
                        </div>
                      )}
                    </td>
                    {esBorrador && puedeEscribir && (
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm("¿Quitar esta línea?")) return;
                            runAction(() =>
                              quitarLineaAction({
                                rendicionId: rendicion.id,
                                lineaId: l.id,
                              }),
                            );
                          }}
                          className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {editandoLinea && (
        <ModalEditarLinea
          rendicionId={rendicion.id}
          linea={editandoLinea}
          categorias={categorias}
          disponible={disponible + editandoLinea.monto}
          onClose={() => setEditandoLinea(null)}
          onDone={() => {
            setEditandoLinea(null);
            router.refresh();
          }}
        />
      )}

      {modal === "encabezado" && (
        <ModalEditarEncabezado
          rendicion={rendicion}
          empleados={empleados}
          esAdmin={esAdmin}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {modal === "liquidacion" && (
        <ModalLiquidacion
          rendicion={rendicion}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {modal === "factura" && (
        <ModalAgregarFactura
          rendicionId={rendicion.id}
          categorias={categorias}
          docs={docsPendientes}
          disponible={disponible}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "libre" && (
        <ModalAgregarLibre
          rendicionId={rendicion.id}
          categorias={categorias}
          disponible={disponible}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: editar encabezado (solo borrador)
// ─────────────────────────────────────────────────────────────────────────

function ModalEditarEncabezado({
  rendicion,
  empleados,
  esAdmin,
  onClose,
  onDone,
}: {
  rendicion: RendicionDetalle;
  empleados: Array<{ id: string; nombre: string }>;
  esAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(rendicion.nombre ?? "");
  const [empleadoId, setEmpleadoId] = useState(rendicion.empleadoId);
  const [fechaEmision, setFechaEmision] = useState(rendicion.fechaEmision);
  const [montoAnticipo, setMontoAnticipo] = useState(
    String(rendicion.montoAnticipo),
  );
  const [anticipoReferencia, setAnticipoReferencia] = useState(
    rendicion.anticipoReferencia ?? "",
  );
  const [anticipoFecha, setAnticipoFecha] = useState(
    rendicion.anticipoFecha ?? "",
  );
  const [notas, setNotas] = useState(rendicion.notas ?? "");

  function submit() {
    setError(null);
    const args: Parameters<typeof actualizarRendicionAction>[0] = {
      rendicionId: rendicion.id,
      nombre,
      fechaEmision,
      anticipoReferencia,
      anticipoFecha: anticipoFecha || null,
      notas,
    };
    // Persona y monto del anticipo: solo el admin puede cambiarlos.
    if (esAdmin) {
      args.empleadoId = empleadoId;
      const m = Number(montoAnticipo.replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(m) || m < 0) {
        setError("Monto del anticipo inválido.");
        return;
      }
      args.montoAnticipo = m;
    }
    startTransition(async () => {
      const r = await actualizarRendicionAction(args);
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      onDone();
    });
  }

  return (
    <Modal title="Editar encabezado" onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Nombre / descripción
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Rendidor
          </label>
          {esAdmin ? (
            <select
              value={empleadoId}
              onChange={(e) => setEmpleadoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {empleados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {rendicion.empleadoNombre}{" "}
              <span className="text-[11px] italic text-slate-400">
                (solo un admin puede cambiarlo)
              </span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
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
            {esAdmin ? (
              <input
                type="text"
                inputMode="numeric"
                value={montoAnticipo}
                onChange={(e) => setMontoAnticipo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-mono text-sm tabular-nums"
              />
            ) : (
              <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-600">
                {CLP.format(rendicion.montoAnticipo)}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Referencia traspaso
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
              Fecha traspaso
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
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
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

// ─────────────────────────────────────────────────────────────────────────
// Modal: registrar liquidación (devolución / reembolso) del saldo
// ─────────────────────────────────────────────────────────────────────────

function ModalLiquidacion({
  rendicion,
  onClose,
  onDone,
}: {
  rendicion: RendicionDetalle;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState("");

  const esDevolucion = rendicion.saldo > 0;
  const monto = Math.abs(rendicion.saldo);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await registrarLiquidacionAction({
        rendicionId: rendicion.id,
        fecha,
        referencia: referencia || undefined,
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
      title={esDevolucion ? "Registrar devolución" : "Registrar reembolso"}
      onClose={onClose}
    >
      <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {esDevolucion
          ? "El empleado reintegra el sobrante del anticipo:"
          : "La empresa reembolsa el sobregasto al empleado:"}{" "}
        <b>{CLP.format(monto)}</b>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Referencia (opcional)
          </label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej: transferencia #5582"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
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
          {pending ? "Guardando…" : "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow ring-1 ring-slate-200/60">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-0.5 text-lg">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: agregar factura pendiente
// ─────────────────────────────────────────────────────────────────────────

function ModalAgregarFactura({
  rendicionId,
  categorias,
  docs,
  disponible,
  onClose,
  onDone,
}: {
  rendicionId: string;
  categorias: Cat[];
  docs: DocPendiente[];
  disponible: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<DocPendiente | null>(null);
  const [catId, setCatId] = useState(categorias[0]?.id ?? "");
  const [mi, setMi] = useState<MontoIvaState>(nuevoMontoIva());
  const setMiPatch = (p: Partial<MontoIvaState>) =>
    setMi((prev) => ({ ...prev, ...p }));

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    if (!q) return docs.slice(0, 50);
    return docs
      .filter(
        (d) =>
          d.folio.toLowerCase().includes(q) ||
          d.nombre.toLowerCase().includes(q) ||
          (d.rut ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [busqueda, docs]);

  function elegir(d: DocPendiente) {
    setSeleccion(d);
    setMi(
      nuevoMontoIva({
        monto: Math.min(d.monto, Math.max(0, disponible)),
        afectoIva: true,
      }),
    );
  }

  function submit() {
    if (!seleccion || !catId) {
      setError("Selecciona factura y categoría.");
      return;
    }
    const d = calcMontoIva(mi, false);
    if (d.monto <= 0) {
      setError("Monto inválido.");
      return;
    }
    const linea: LineaRendicionInput = {
      tipo: "documento",
      documentoId: seleccion.id,
      categoriaId: catId,
      monto: d.monto,
      afectoIva: d.afectoIva,
      tasaIva: d.tasaIva,
    };
    setError(null);
    startTransition(async () => {
      const r = await agregarLineaAction({ rendicionId, linea });
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      onDone();
    });
  }

  return (
    <Modal title="Agregar factura pendiente" onClose={onClose}>
      <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Disponible del anticipo: <b>{CLP.format(disponible)}</b>. Puedes
        excederlo; el saldo se cierra después con una liquidación.
      </p>
      <input
        type="search"
        placeholder="Buscar por folio, emisor o RUT…"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setSeleccion(null);
        }}
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
        {filtrados.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">
            Sin facturas pendientes que coincidan.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtrados.map((d) => (
              <li
                key={d.id}
                onClick={() => elegir(d)}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-emerald-50 ${seleccion?.id === d.id ? "bg-emerald-100" : ""}`}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {d.nombre}
                    </div>
                    <div className="text-xs text-slate-500">
                      {d.tipo} · folio {d.folio} · {d.fecha ?? "s/f"}
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-slate-900">
                    {CLP.format(d.monto)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {seleccion && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Categoría *
            </label>
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <MontoIvaFields withPxQ={false} s={mi} set={setMiPatch} />
        </div>
      )}
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={pending || !seleccion}
          className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: agregar gasto sin documento
// ─────────────────────────────────────────────────────────────────────────

function ModalAgregarLibre({
  rendicionId,
  categorias,
  disponible,
  onClose,
  onDone,
}: {
  rendicionId: string;
  categorias: Cat[];
  disponible: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [glosa, setGlosa] = useState("");
  const [catId, setCatId] = useState(categorias[0]?.id ?? "");
  const [mi, setMi] = useState<MontoIvaState>(nuevoMontoIva());
  const setMiPatch = (p: Partial<MontoIvaState>) =>
    setMi((prev) => ({ ...prev, ...p }));
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);

  function submit() {
    if (!glosa || !catId) {
      setError("Glosa y categoría son obligatorias.");
      return;
    }
    const d = calcMontoIva(mi, true);
    if (d.monto <= 0) {
      setError("Monto inválido.");
      return;
    }
    const linea: LineaRendicionInput = {
      tipo: "libre",
      glosa,
      categoriaId: catId,
      monto: d.monto,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      unidad: d.unidad,
      afectoIva: d.afectoIva,
      tasaIva: d.tasaIva,
      fecha,
      comprobanteUrl,
    };
    setError(null);
    startTransition(async () => {
      const r = await agregarLineaAction({ rendicionId, linea });
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      onDone();
    });
  }

  return (
    <Modal title="Agregar gasto sin documento" onClose={onClose}>
      <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Disponible del anticipo: <b>{CLP.format(disponible)}</b>. Puedes
        excederlo; el saldo se cierra después con una liquidación.
      </p>
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Glosa / descripción *
          </label>
          <input
            type="text"
            value={glosa}
            onChange={(e) => setGlosa(e.target.value)}
            placeholder="Ej: Bencina viaje terreno"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Categoría *
          </label>
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <MontoIvaFields withPxQ s={mi} set={setMiPatch} />
        <CampoComprobante
          rendicionId={rendicionId}
          value={comprobanteUrl}
          onChange={setComprobanteUrl}
        />
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
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
          {pending ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: editar línea existente
// ─────────────────────────────────────────────────────────────────────────

function ModalEditarLinea({
  rendicionId,
  linea,
  categorias,
  disponible,
  onClose,
  onDone,
}: {
  rendicionId: string;
  linea: RendicionLineaDetalle;
  categorias: Cat[];
  /** Disponible incluyendo el monto actual de esta línea (su máximo). */
  disponible: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mi, setMi] = useState<MontoIvaState>(
    nuevoMontoIva({
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario,
      unidad: linea.unidad,
      monto: linea.monto,
      afectoIva: linea.afectoIva,
      tasaIva: linea.tasaIva,
    }),
  );
  const setMiPatch = (p: Partial<MontoIvaState>) =>
    setMi((prev) => ({ ...prev, ...p }));
  const [glosa, setGlosa] = useState(linea.glosa ?? "");
  const [catId, setCatId] = useState(linea.categoriaId ?? categorias[0]?.id ?? "");
  const [fecha, setFecha] = useState(linea.fecha ?? "");
  const [notas, setNotas] = useState(linea.notas ?? "");
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(
    linea.comprobanteUrl,
  );

  function submit() {
    const withPxQ = linea.tipo === "libre";
    const d = calcMontoIva(mi, withPxQ);
    if (d.monto <= 0) {
      setError("Monto inválido.");
      return;
    }
    if (!catId) {
      setError("La categoría es obligatoria.");
      return;
    }
    if (linea.tipo === "libre" && !glosa.trim()) {
      setError("La glosa es obligatoria.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await actualizarLineaAction({
        rendicionId,
        lineaId: linea.id,
        monto: d.monto,
        glosa: linea.tipo === "libre" ? glosa : undefined,
        categoriaId: catId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        unidad: d.unidad,
        afectoIva: d.afectoIva,
        tasaIva: d.tasaIva,
        fecha: fecha || null,
        notas,
        comprobanteUrl,
      });
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      onDone();
    });
  }

  return (
    <Modal title={`Editar línea #${linea.orden}`} onClose={onClose}>
      <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Disponible para esta línea: <b>{CLP.format(disponible)}</b>
      </p>
      <div className="space-y-2">
        {linea.tipo === "documento" ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <b>{linea.documentoEmisor}</b> · {linea.documentoTipo} · folio{" "}
            {linea.documentoFolio}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Glosa / descripción *
            </label>
            <input
              type="text"
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Categoría *
          </label>
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <MontoIvaFields
          withPxQ={linea.tipo === "libre"}
          s={mi}
          set={setMiPatch}
        />
        <CampoComprobante
          rendicionId={rendicionId}
          value={comprobanteUrl}
          onChange={setComprobanteUrl}
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
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

function CampoComprobante({
  rendicionId,
  value,
  onChange,
}: {
  rendicionId: string;
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
    const r = await subirComprobante(f, rendicionId);
    setSubiendo(false);
    if (r.error) {
      setErr(r.error);
      return;
    }
    onChange(r.url);
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
        Comprobante (foto de boleta/ticket, opcional)
      </label>
      {value ? (
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2 py-1.5">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="block h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-slate-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="comprobante"
              className="h-full w-full object-cover"
            />
          </a>
          <div className="flex-1 text-xs text-slate-600">
            Comprobante adjunto
          </div>
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
            accept="image/*"
            capture="environment"
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

function Modal({
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
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
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
