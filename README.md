# Rendiciones de gasto

App standalone de rendición de gastos (anticipos de caja chica, líneas de gasto,
comprobantes y aprobación). Multi-tenant, basada en el módulo `rendiciones` del
ERP `bdata-web`. Ver [`SCOPE.md`](./SCOPE.md) para el alcance.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres + Auth + Storage).

## Puesta en marcha

1. **Variables de entorno**

   ```bash
   cp .env.local.example .env.local
   ```

   Completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los
   valores de tu proyecto Supabase (dashboard → Settings → API).

2. **Base de datos**

   Aplica en orden las migraciones de `supabase/migrations/` (SQL Editor del
   dashboard, o `supabase db push` si usas la CLI):
   - `0001_init.sql`: tablas, RLS, numeración y bucket de comprobantes.
   - `0002_maestros.sql`: función de vinculación empleado↔login y bucket de
     archivos de documentos.

3. **Datos mínimos para probar**

   - Crea una fila en `organizaciones` (no hay UI para esto todavía).
   - Tras registrarte en `/auth/login`, agrega tu `auth.users.id` a `org_users`
     con `rol = 'admin'`.
   - El resto se gestiona desde la UI en `/maestros`: crea empleados (pon tu
     correo para que tu login quede vinculado), categorías y documentos.

4. **Desarrollo**

   ```bash
   npm install
   npm run dev
   ```

   Abre http://localhost:3000 → redirige a login → luego a `/rendiciones`.

## Estructura

```
src/
├── proxy.ts                  # Refresco de sesión Supabase (ex middleware)
├── lib/
│   ├── supabase/{server,client}.ts
│   └── auth.ts               # getContexto(): org activa por sesión + rol + empleado
└── app/
    ├── _actions/org.ts       # setOrgActiva() (cookie)
    ├── _components/org-switcher.tsx
    ├── auth/login/           # ingresar / registrar
    ├── auth/logout/route.ts
    └── rendiciones/          # módulo (en construcción)
```

## Estado

- [x] Scaffolding, configs, build limpio.
- [x] Esquema SQL + RLS + numeración + Storage.
- [x] Auth (email/contraseña) y organización activa por sesión.
- [x] Módulo de rendiciones: listado, alta, detalle, server actions.
- [x] Maestros: pantallas CRUD de empleados, categorías y documentos (`/maestros`, admin).
- [x] Editar encabezado de la rendición desde el detalle.
- [x] Dashboard de reportes (`/reportes`) con KPIs y drill-down (estado / categoría / rendidor → líneas → detalle).
- [x] Liquidación del saldo: devolución del sobrante / reembolso del sobregasto (sobre rendiciones aprobadas).
