import Link from "next/link";

export function MaestroHeader({
  titulo,
  volverHref = "/maestros",
  volverLabel = "Maestros",
}: {
  titulo: string;
  volverHref?: string;
  volverLabel?: string;
}) {
  return (
    <header className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-4 py-3 shadow-md sm:px-5 sm:py-4">
      <Link
        href={volverHref}
        className="text-xs font-semibold uppercase tracking-widest text-emerald-200 hover:text-emerald-100"
      >
        ← {volverLabel}
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        {titulo}
      </h1>
    </header>
  );
}
