// Configuración de conexión a Supabase.
//
// La URL y la anon/publishable key son PÚBLICAS por diseño (viajan al
// navegador en cualquier app Supabase; la seguridad la da RLS, no el secreto
// de la key). Por eso, para esta DEMO las dejamos como valor por defecto:
// así la app funciona aunque el host no tenga configuradas las variables de
// entorno. Si `NEXT_PUBLIC_SUPABASE_*` están definidas, tienen prioridad.
//
// ⚠️ La service_role key (secreta) NUNCA debe ir aquí.

const DEMO_URL = "https://hcvlokdyxqlxemojtqtq.supabase.co";
const DEMO_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjdmxva2R5eHFseGVtb2p0cXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MzcwMTEsImV4cCI6MjA5NjAxMzAxMX0.AvVUlj_G-F4Sq0Pl9vvYOwu2xBFJQA9ooVPkBCfMiE0";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || DEMO_URL;
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_ANON_KEY;
