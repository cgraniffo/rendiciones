"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_ORG } from "@/lib/auth";

/** Cambia la organización activa de la sesión (cookie). */
export async function setOrgActiva(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_ORG, orgId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
