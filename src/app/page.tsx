import { redirect } from "next/navigation";
import { getContexto } from "@/lib/auth";

export default async function Home() {
  const ctx = await getContexto();
  if (!ctx) redirect("/auth/login");
  redirect("/reportes");
}
