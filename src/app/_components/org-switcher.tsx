"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrgActiva } from "@/app/_actions/org";
import type { OrgRef } from "@/lib/auth";

export function OrgSwitcher({
  orgs,
  activaId,
}: {
  orgs: OrgRef[];
  activaId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (orgs.length <= 1) {
    const o = orgs[0];
    return (
      <span className="text-xs font-semibold text-emerald-100">
        {o?.nombre ?? ""}
      </span>
    );
  }

  return (
    <select
      value={activaId}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          await setOrgActiva(id);
          router.refresh();
        });
      }}
      className="rounded-md border border-emerald-600 bg-emerald-800 px-2 py-1 text-xs font-semibold text-white"
    >
      {orgs.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}
