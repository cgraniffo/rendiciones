# Base de referencia: módulo de Rendiciones de Gastos (de BData Agro)

> **Para qué sirve este archivo:** es el "mapa" del módulo de rendiciones que ya
> existe en la plataforma agrícola de BData, para usarlo como base al construir
> esta app standalone de rendición de gastos.
>
> **Origen del código:** `C:\Users\chris\dev\bdata-web\src\app\clientes\[subdomain]\rendiciones\`
> (si quieres que Claude Code lo lea directo en esta sesión, corre
> `/add-dir C:\Users\chris\dev\bdata-web`).
>
> El módulo original está acoplado al mundo agrícola (multi-tenant, centros de
> costo, facturas DTE del SII, personal, conciliación bancaria). Sirve como base
> de **flujo, reglas de negocio y UX** — hay que **desacoplar** esas partes.

---

## 1. Concepto
Una **rendición** = una caja chica / fondo por rendir de UNA persona:
1. Se le entrega un **anticipo** (plata por adelantado).
2. La persona **rinde**: agrega líneas de gasto (cada una con monto, fecha,
   categoría y comprobante).
3. Alguien con permiso la **aprueba**.
4. El **saldo se calcula solo**: `saldo = anticipo − total rendido`. Lo que
   sobra, se devuelve.

## 2. Máquina de estados (clave)
```
borrador ──presentar──▶ presentada ──aprobar──▶ aprobada
```
- **borrador**: editable (agregar/editar/quitar líneas, cambiar encabezado).
- **presentada**: sellada (no se editan líneas). Requiere ≥1 línea para presentar.
- **aprobada**: final. Registra quién y cuándo aprobó. (En agro, además marca las
  facturas como pagadas — eso es agro-específico).
- Borrado = **soft delete** (`deleted_at`), y NO se puede borrar una aprobada.

## 3. Tipos de línea
Cada línea es de tipo `documento` o `libre`:
- **documento**: referencia una factura/boleta ya cargada en el sistema (DTE).
  ← *agro-específico, depende de su bandeja de documentos.*
- **libre**: gasto a mano (glosa + monto).
  ← *esto es lo que probablemente uses para TODAS las líneas en tu app.*
- Ambas llevan: monto, fecha, categoría (centro de costo), notas y
  `comprobante_url` (foto/PDF del comprobante).

## 4. Reglas de negocio (lo más valioso de copiar)
- **No se puede rendir más que el anticipo**: al agregar/editar una línea valida
  `total_rendido ≤ anticipo` (muestra "disponible para rendir").
- **No bajar el anticipo** por debajo de lo ya rendido.
- Solo se edita/agrega/quita líneas en **borrador**.
- `monto_rendido` y `saldo` los mantiene un **trigger de BD** (suma de líneas) —
  el código nunca los escribe a mano. En tu app: replícalo con trigger o
  calcúlalo al leer.

## 5. Roles / permisos
- **manager / admin / superadmin**: crea para cualquiera, edita, presenta.
- **rendidor** (la persona que rinde, vinculada por `user_id`): crea/edita/presenta
  **solo la suya**, pero NO cambia la persona ni el monto del anticipo.
- **Aprobar**: solo admin/superadmin **o** usuario con flag
  `puede_aprobar_rendiciones`.
- Numeración correlativa (`numero`) vía función `siguiente_numero_rendicion`.

## 6. Modelo de datos real (Postgres / Supabase)

**`rendiciones`** (encabezado):
`id` uuid PK · `client_id`* · `numero` int · `nombre` text? · `personal_id`*
(quién rinde) · `fecha_emision` date · `fecha_aprobacion` date? ·
`cuenta_bancaria_id`*? · `movimiento_anticipo_id`*? · `movimiento_reembolso_id`*? ·
`estado` enum(borrador|presentada|aprobada) · `monto_anticipo` numeric ·
`monto_rendido` numeric (trigger) · `saldo` numeric (trigger) · `notas` text? ·
`aprobada_por` uuid? · `aprobada_at` timestamptz? · `created_by` · `created_at` ·
`updated_at` · `deleted_at`

**`rendicion_lineas`** (detalle):
`id` uuid PK · `rendicion_id`* · `orden` int · `tipo` enum(documento|libre) ·
`documento_id`*? · `centro_costo_id`* · `glosa` text? · `monto` numeric ·
`fecha` date? · `notas` text? · `comprobante_url` text? · `created_at`

`*` = FK que depende del esquema agro. Para standalone, **reemplaza**:
- `client_id` → fuera (app de un solo dueño) o tu propio multi-tenant si aplica.
- `personal_id` → tu tabla de empleados/usuarios.
- `centro_costo_id` → tu tabla de **categorías/proyectos** de gasto.
- `documento_id` + `cuenta_bancaria_id` + `movimiento_*` → **omitir en el MVP**
  (son la integración con DTE y conciliación bancaria del agro).

## 7. Archivos a estudiar (en el repo agro)
```
rendiciones/_lib.ts        → tipos + queries de listado y detalle (joins)
rendiciones/_actions.ts    → TODA la lógica: crear, editar, líneas, presentar,
                             aprobar, vincular banco, borrar + las validaciones
rendiciones/page.tsx       → listado
rendiciones/nueva/page.tsx → crear
rendiciones/[id]/page.tsx  → detalle
rendiciones/_components/form-nueva.tsx, detalle.tsx → UI
```
**El oro está en `_actions.ts`** (flujo + validaciones) y `_lib.ts` (modelo). El
resto es UI atada a Tailwind/Next del agro.

## 8. Qué copiar vs. repensar
- ✅ **Copiar tal cual el concepto**: estados, saldo automático, reglas de tope,
  soft delete, roles.
- 🔁 **Repensar para standalone**: el modelo sin las FKs agro; las líneas
  probablemente todas "libres" con foto de comprobante; sin DTE ni conciliación
  bancaria (al menos en MVP).
- ❌ **No traer**: multi-tenant por `client_id`, RLS por cliente, marcado de
  documentos pagados.

---

## Cómo usar este archivo en Claude Code
1. (Opcional pero recomendado) `/add-dir C:\Users\chris\dev\bdata-web` para que
   esta sesión pueda leer el código real del módulo.
2. Pídele a Claude Code: *"Lee CONTEXTO-rendiciones-base.md y propón el modelo de
   datos + el plan de archivos para construir esta app de rendiciones standalone."*
