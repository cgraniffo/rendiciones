import Link from "next/link";
import { DemoBadge } from "@/app/_components/demo-badge";

export const metadata = { title: "Manual de uso" };

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 mb-2 border-b border-slate-200 pb-1 text-lg font-extrabold text-emerald-900">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-1 font-bold text-slate-800">{children}</h3>;
}

const FUTURO: Array<{ t: string; d: string }> = [
  {
    t: "Exportar a Excel / CSV / PDF",
    d: "Descargar rendiciones y reportes del dashboard para contabilidad o respaldo.",
  },
  {
    t: "Comparativos de período",
    d: "Mes vs mes anterior, acumulado anual y variaciones porcentuales en el dashboard.",
  },
  {
    t: "Notificaciones por correo",
    d: "Avisar cuando una rendición se presenta, queda por aprobar o se aprueba/liquida.",
  },
  {
    t: "OCR de boletas",
    d: "Leer monto, fecha y emisor desde la foto del comprobante para llenar la línea solo.",
  },
  {
    t: "Aprobación por niveles",
    d: "Montos sobre cierto umbral requieren una segunda aprobación (jefatura / finanzas).",
  },
  {
    t: "Integración con el SII",
    d: "Importar automáticamente las facturas/boletas recibidas en vez de cargarlas a mano.",
  },
  {
    t: "Conciliación bancaria",
    d: "Vincular el anticipo y las liquidaciones con los movimientos reales del banco.",
  },
  {
    t: "Presupuestos y alertas",
    d: "Definir presupuesto por categoría/centro de costo y avisar al acercarse o excederlo.",
  },
  {
    t: "PWA / app móvil offline",
    d: "Instalar en el teléfono y registrar gastos sin conexión, sincronizando después.",
  },
  {
    t: "Multimoneda y tipo de cambio",
    d: "Gastos en USD/EUR con conversión automática a la moneda de la organización.",
  },
  {
    t: "Liquidaciones parciales y en cuotas",
    d: "Cerrar el saldo en varios abonos, con historial de cada movimiento.",
  },
  {
    t: "Roles y permisos más finos",
    d: "Aprobador por área, perfil de solo lectura, auditor, y delegación temporal.",
  },
  {
    t: "Bitácora de auditoría",
    d: "Registro de quién creó, editó, aprobó o liquidó cada rendición y cuándo.",
  },
  {
    t: "Importación masiva (CSV)",
    d: "Cargar empleados, categorías y documentos por archivo en vez de uno por uno.",
  },
  {
    t: "Integración contable",
    d: "Exportar asientos a software contable (centralización del gasto por cuenta).",
  },
];

export default function ManualPage() {
  return (
    <main className="bg-hub-mesh min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-4 py-3 shadow-md sm:px-5 sm:py-4">
          <Link
            href="/reportes"
            className="text-xs font-semibold uppercase tracking-widest text-emerald-200 hover:text-emerald-100"
          >
            ← Volver a la app
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Manual de uso <DemoBadge />
          </h1>
        </header>

        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 text-sm text-slate-700 shadow-sm sm:p-8">
          {/* Aviso DEMO */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold text-amber-900">⚠️ Esto es una DEMO</p>
            <p className="mt-1 text-amber-800">
              Esta aplicación es una <b>demostración</b> del módulo de rendición
              de gastos. Los datos (empleados, categorías, documentos y
              rendiciones) son de <b>ejemplo</b> y pueden borrarse o cambiar en
              cualquier momento. No la uses todavía con información real ni
              sensible. El objetivo es mostrar el flujo y las capacidades del
              producto.
            </p>
          </div>

          <p className="mt-4">
            La app permite gestionar <b>anticipos de caja chica</b>: se entrega
            un monto a una persona, esta rinde sus gastos con boletas/facturas,
            y al final se cierra el saldo (devolución o reembolso).
          </p>

          <H2>1. Roles</H2>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <b>Empleado:</b> crea y edita <i>sus</i> rendiciones, agrega líneas
              de gasto y las presenta. No cambia el rendidor ni el monto del
              anticipo.
            </li>
            <li>
              <b>Administrador:</b> ve y edita todas, <b>aprueba</b>, registra la{" "}
              <b>liquidación</b> del saldo y gestiona los maestros (empleados,
              categorías, documentos).
            </li>
          </ul>

          <H2>2. El flujo de una rendición</H2>
          <p>Una rendición pasa por tres estados:</p>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            borrador → presentada → aprobada → (liquidación del saldo)
          </p>
          <H3>a) Crear (borrador)</H3>
          <p>
            Desde <b>+ Nueva rendición</b>: eliges el rendidor, el monto del
            anticipo y, opcionalmente, la referencia del traspaso. Queda en{" "}
            <b>borrador</b>, editable.
          </p>
          <H3>b) Agregar líneas de gasto</H3>
          <p>Una rendición puede tener muchas líneas. Hay dos tipos:</p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>
              <b>Factura pendiente:</b> enlaza un documento ya cargado (al
              aprobar, se marca como pagado).
            </li>
            <li>
              <b>Gasto sin documento:</b> glosa libre + monto + foto del
              comprobante.
            </li>
          </ul>
          <p className="mt-1">
            Cada línea admite <b>cantidad × precio unitario</b> con su{" "}
            <b>unidad</b> (ej. 6 peajes, 40 litros) y marca de{" "}
            <b>IVA (afecto/exento)</b>: la app calcula neto + IVA sola.
          </p>
          <H3>c) Presentar</H3>
          <p>
            Sella la rendición (ya no se editan líneas) y queda lista para que
            el administrador la revise.
          </p>
          <H3>d) Aprobar</H3>
          <p>
            El administrador la aprueba; las facturas enlazadas se marcan como{" "}
            <b>pagadas</b>.
          </p>
          <H3>e) Liquidar el saldo</H3>
          <p>
            Si sobró plata (saldo positivo) se registra una <b>devolución</b>;
            si la persona gastó más que el anticipo (saldo negativo), un{" "}
            <b>reembolso</b>. Así el saldo queda cerrado.
          </p>

          <H2>3. Maestros (solo administrador)</H2>
          <p>
            En <b>Maestros</b> se administran <b>empleados</b> (pon su correo
            para vincular su login), <b>categorías</b> de gasto y{" "}
            <b>documentos</b> (facturas/boletas con su archivo).
          </p>

          <H2>4. Dashboard y reportes</H2>
          <p>
            La portada muestra KPIs (anticipado, rendido, saldo pendiente), gasto
            por categoría, por rendidor, IVA recuperable, cantidades por unidad y
            evolución mensual. Todo es <b>navegable hacia el detalle</b>: tocas
            una categoría, un rendidor o un mes y bajas hasta las líneas y la
            rendición específica.
          </p>

          <H2>5. Acceso de otras personas</H2>
          <p>
            Cualquiera con el enlace puede registrarse, pero entra <b>sin
            organización</b> y no ve datos (cada organización está aislada). Para
            dar acceso real, el administrador crea su ficha de empleado con su
            correo y lo suma a la organización.
          </p>

          {/* ─────────────── Desarrollos propuestos ─────────────── */}
          <H2>Potenciales desarrollos propuestos</H2>
          <p>
            Ideas para evolucionar la app más allá de esta demo (en orden de
            valor sugerido, no definitivo):
          </p>
          <ol className="mt-3 space-y-2">
            {FUTURO.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                  {i + 1}
                </span>
                <span>
                  <b className="text-slate-800">{f.t}.</b> {f.d}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-center text-xs italic text-slate-400">
            Versión Demo · Rendición de gastos · construida sobre Next.js +
            Supabase.
          </p>
        </article>
      </div>
    </main>
  );
}
