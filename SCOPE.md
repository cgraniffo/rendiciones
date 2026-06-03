# Rendición de Gastos — Alcance (MVP)

App standalone de rendición de gastos, basada en el módulo `rendiciones` del ERP
`bdata-web` pero desacoplada de sus dependencias (SII, conciliación bancaria,
maestros del ERP).

## Plataforma

- **Stack:** Next.js (App Router) + Supabase (Postgres + Auth + Storage).
- **Multi-tenant:** varias organizaciones aisladas. Aislamiento por `org_id` con
  **Row Level Security** en todas las tablas.
- **Resolución de tenant:** **por sesión** (organización activa del usuario), no
  por subdominio. Un usuario puede pertenecer a varias organizaciones.
- **Moneda:** CLP, formato `es-CL`.

## Modelo de datos

| Tabla | Rol |
|---|---|
| `organizaciones` | Tenant. |
| `org_users` | Pertenencia usuario↔org + rol (`empleado` \| `admin`). |
| `empleados` | Personas que rinden. `user_id` opcional vincula con el login. |
| `categorias` | Clasificación del gasto (≈ centro de costo). |
| `documentos` | Facturas/boletas de **carga manual** (folio, emisor, monto, archivo). |
| `rendiciones` | Encabezado (anticipo, estado, saldo). |
| `rendicion_lineas` | Detalle: línea `documento` (enlaza factura) o `libre` (glosa + foto). |

Columnas calculadas en BD:
- `rendiciones.monto_rendido` = Σ montos de sus líneas (mantenido por trigger).
- `rendiciones.saldo` = `monto_anticipo − monto_rendido` (columna generada).

**Anticipo / banca (campo simple):** `rendiciones.anticipo_referencia` (texto) y
`anticipo_fecha` (date). Sin tabla de movimientos ni conciliación.

## Flujo de negocio

Máquina de estados (igual al original):

```
borrador  ──presentar──▶  presentada  ──aprobar──▶  aprobada
(editable)               (sellada)                 (marca documentos pagados)
```

- **Crear** → estado `borrador`. `numero` correlativo por organización.
- **Editar líneas** solo en `borrador`. Dos tipos:
  - `documento`: enlaza una factura existente; al aprobar la marca `pagado`.
  - `libre`: glosa + monto + foto de comprobante (Storage).
- **Regla:** no se puede rendir más que el anticipo (`Σ líneas ≤ monto_anticipo`).
- **Presentar** exige ≥ 1 línea; sella la rendición.
- **Aprobar** (solo admin): marca los documentos enlazados como `pagado`.
- **Soft delete** (`deleted_at`); no se borran rendiciones aprobadas.

## Roles (simplificado)

| Rol | Permisos |
|---|---|
| `empleado` | Crea y edita **sus** rendiciones (las de su `empleado_id`). No cambia el rendidor ni el monto del anticipo. |
| `admin` | Ve y edita todas; presenta; **aprueba**; gestiona maestros (empleados, categorías, documentos). |

## Fuera de alcance (descartado del original)

- Tabla `movimientos_bancarios` y toda la conciliación (`monto_matcheado`, vincular/desvincular).
- Integración con el SII.
- `especies`, `centros_costo` del ERP (reemplazados por `categorias`).
- Modelo de 4 roles (`manager`, `field_worker`, `viewer`, `superadmin`).

## Qué se reutiliza de `bdata-web`

- Máquina de estados y validaciones de `_actions.ts` (recortadas).
- Patrón server component (carga + permisos) + cliente (`useTransition`, modales).
- `form-nueva.tsx` y `detalle.tsx` (sin el bloque bancario; documentos simplificados).
- Tipos y funciones de carga de `_lib.ts`.

## Próximos pasos

1. ✅ Esquema SQL + RLS + numeración + columnas calculadas (`supabase/migrations/0001_init.sql`).
2. Scaffolding Next.js + cliente Supabase + auth.
3. Capa de datos (`_lib`) y server actions (`_actions`) adaptadas.
4. Páginas y componentes (listado, nueva, detalle).
