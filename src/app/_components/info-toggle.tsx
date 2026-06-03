// Toggle informativo desplegable. Usa <details> nativo: no requiere JS de
// cliente, así que funciona dentro de Server Components.
export function InfoToggle({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-slate-700">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-emerald-800 [&::-webkit-details-marker]:hidden">
        <span aria-hidden>💡</span>
        {titulo}
        <span className="ml-auto text-xs font-normal text-emerald-600 group-open:hidden">
          ver +
        </span>
        <span className="ml-auto hidden text-xs font-normal text-emerald-600 group-open:inline">
          ocultar −
        </span>
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </details>
  );
}
