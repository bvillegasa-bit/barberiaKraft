# Barbería Kraft — Plataforma web (Hito 1)

Plataforma web de la barbería **Barbería Kraft** (Callao, Perú): catálogo público de
servicios y promociones, ocupación del local con tiempo estimado de espera, registro
y login seguros (cliente y administrador), y panel de administración para gestionar
servicios, promociones y sillas.

Desarrollada por el **Grupo 6** como parte del curso de Calidad de Software (VIII ciclo, UCV).

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript **vanilla** (ES modules) |
| Build | `build.js` (Node puro, sin dependencias): copia `pages/` → `dist/` + inyección de config |
| Base de datos / Auth | [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS) |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com) (estático, HTTPS) |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`): push a `master` → build → deploy con wrangler |
| Iconos / fuentes | **self-host** (`assets/sprite.svg`, `assets/fonts/`) — cero CDN de terceros (RNF01, CSP estricto) |

El sitio final es 100% estático: no hay servidor propio, y se **genera en el build**
(`build.js` copia `pages/` → `dist/` e inyecta la configuración de Supabase desde
variables de entorno — en CI, desde los GitHub Secrets—, de modo que **ninguna clave
se versiona**). La seguridad real la aportan **Supabase Auth** (hashing y sesiones
gestionados por Supabase, nunca por la app) y **Row Level Security (RLS)** en todas
las tablas.

---

## Estructura de carpetas (RNF06 / CA-RNF06-1)

```
barberia-kraft/
├── build.js                   ← build estático (Node puro): pages/ → dist/ + inyección de config
├── package.json               ← scripts: build / dev (sin dependencias)
├── .env.example               ← documentación de env vars (sin valores reales)
├── .github/
│   └── workflows/deploy.yml   ← CI/CD: push a master → build → Cloudflare Pages (wrangler)
├── pages/                     ← fuente del sitio (lo que el build copia a dist/)
│   ├── index.html             ← catálogo público (servicios, promos, ocupación)
│   ├── login.html             ← inicio de sesión cliente/admin
│   ├── registro.html          ← registro de cliente (consentimiento Ley 29733)
│   ├── 404.html               ← página de error personalizada
│   ├── _headers               ← cabeceras de seguridad (CSP estricto; host inyectado en el build)
│   ├── _redirects             ← /admin → /admin/dashboard.html
│   ├── admin/
│   │   └── dashboard.html     ← panel de administración (shell + tabs)
│   ├── css/
│   │   ├── base.css           ← tokens de diseño (paleta, tipografía, reset)
│   │   ├── components.css     ← navbar, cards, semáforo, forms, toast, footer
│   │   └── admin.css          ← tabs, tablas CRUD, grid de sillas
│   ├── js/
│   │   ├── config.template.js ← FUENTE versionada con tokens (__SUPABASE_URL__, __SUPABASE_ANON_KEY__)
│   │   ├── config.js          ← GENERADO por el build (NO se versiona; vive en dist/js/config.js)
│   │   ├── supabase-client.js ← cliente singleton (sesión persistente)
│   │   ├── ui.js              ← helpers DOM (toast, estados, formato S/)
│   │   ├── validacion.js      ← validadores (email, password, precio…)
│   │   ├── api.js             ← lectura pública (servicios/promos) + errores
│   │   ├── ocupacion.js       ← fórmula pura calcularOcupacion() + rpc
│   │   ├── auth.js            ← registro, login, logout, guard admin
│   │   ├── pagina-admin.js    ← shell del panel (tabs, guard, teclado)
│   │   ├── admin-ui.js        ← estados admin (rutas ../assets/sprite.svg)
│   │   ├── admin-servicios.js ← CRUD servicios
│   │   ├── admin-promociones.js ← CRUD promociones
│   │   └── admin-ocupacion.js ← toggle de sillas + límite
│   └── assets/
│       ├── sprite.svg         ← sprite de iconos (~18 símbolos)
│       └── fonts/             ← Oswald + Inter (woff2 self-host)
├── dist/                      ← GENERADO por el build (NO se versiona; salida del deploy)
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql      ← esquema completo + RLS + seed (NUNCA editar a mano)
│       └── 0002_promote_admin.sql ← guía (comentada) para promover un admin
└── docs/
    ├── README.md              ← este documento
    ├── REQUIREMENTS.md        ← trazabilidad RF/RNF ↔ ISO/IEC 25010 ↔ estándares
    ├── QUALITY.md             ← plan de pruebas (RLS, auth, cálculo, UI, a11y, secretos)
    └── QA-AUDIT-CHECKLIST.md  ← checklist de auditoría por características ISO 25010
```

**Convenciones**: archivos en kebab-case; JS en ES modules con imports relativos;
comentarios breves en español; todo cambio de esquema entrega su **migración SQL
numerada** (`supabase/migrations/`), jamás se edita el esquema a mano en el dashboard.

---

## Setup local (levantarlo en ~10 minutos)

### 1. Requisitos

- Tener un proyecto en [Supabase](https://supabase.com/dashboard) (plan free, sin tarjeta).
- Node.js **≥ 18** (para `build.js`; en CI se usa Node 20).
- Python 3 (para servir localmente) o `npx serve`.

### 2. Crear el proyecto Supabase

1. Crea un proyecto en el dashboard (región cercana, ej. `us-east-1`).
2. Ve a **SQL Editor**, abre el archivo `supabase/migrations/0001_init.sql`, cópialo **íntegro** y ejecútalo.
   > El esquema crea tablas, funciones, triggers, **RLS** y seed (config + 4 sillas). No lo edites a mano: si cambia algo, se entrega una migración nueva.
3. (Opcional) Confirma el email automático en **Authentication → Providers → Email**: si lo desactivas, la sesión es inmediata; si lo activas, los usuarios deben confirmar su correo.

### 3. Configurar el entorno (sin versionar claves)

El repo **nunca contiene valores reales**: solo placeholders en
`pages/js/config.template.js` (tokens `__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__`).
La configuración se inyecta en el **build** (`build.js`):

- **Desarrollo local sin claves** (recomendado para empezar): `npm run dev`
  (o `node build.js --dev`) genera `dist/` con `dist/js/config.js` de placeholders;
  la app muestra el aviso *"Configuración pendiente"* (`esConfigPlaceholder()`).
- **Contra Supabase real (local)**: exporta las env vars y ejecuta el build:

  ```powershell
  # PowerShell
  $env:SUPABASE_URL = "https://TU-REFERENCIA.supabase.co"
  $env:SUPABASE_ANON_KEY = "TU_ANON_KEY_PUBLICA_AQUI"
  npm run build
  ```

  ```bash
  # bash
  export SUPABASE_URL="https://TU-REFERENCIA.supabase.co"
  export SUPABASE_ANON_KEY="TU_ANON_KEY_PUBLICA_AQUI"
  npm run build
  ```

  > Valores en **Project Settings → API → Project URL** y **anon public**.
  > ⚠️ La `anon key` es **pública por diseño** (la seguridad la da RLS); la key
  > **`service_role` NUNCA** debe ir en el repo, en env vars, ni en esta
  > documentación (CA-RNF03-2).

- El build también reescribe `dist/_headers`: sustituye el token `<TU-PROYECTO>`
  del CSP (`connect-src`) por el **host real** extraído de `SUPABASE_URL`
  (ej. `https://xyzcompany.supabase.co` → `xyzcompany.supabase.co`).
- En **Project Settings → API → CORS/Restrictions** agrega los orígenes: local
  `http://localhost:8788` y producción `https://<tu-sitio>.pages.dev`.

### 4. Servir localmente (siempre desde dist/, NO desde pages/)

```bash
npm run dev                          # o: node build.js --dev  (genera dist/ con placeholders)
python -m http.server 8788 -d dist
```

Abre `http://localhost:8788`. El sitio se sirve desde `dist/` (lo que produce el
build y lo que se despliega en producción); `pages/` por sí solo ya no es
servible directamente porque `js/config.js` se **genera** en el build.

### 5. Promover al administrador

El registro público **nunca** asigna rol admin (CA-RF03-6). Para promocionar un correo,
abre `supabase/migrations/0002_promote_admin.sql`: es una guía **100% comentada** que
indica el comando exacto (`UPDATE public.profiles SET rol = 'admin' WHERE email = '…'`).
Ejecútala en el SQL Editor como owner/postgres y verifica con `SELECT is_admin();`.

---

## Publicar en Cloudflare Pages

### Modelo de secretos (por qué no hay claves en el repo)

Patrón de industria: **placeholder en el repo → GitHub Secrets → el build inyecta → deploy a CF Pages**.
`pages/js/config.template.js` se versiona con tokens; los valores reales viven
solo en los **GitHub Secrets** y se inyectan como env vars en el build del CI,
que genera `dist/js/config.js` y despliega `dist/` con wrangler. **Ninguna clave
se sube al código fuente del repositorio** (verificable con Q-SEC-1/2 en `docs/QUALITY.md`).

### Opción A — Automático con GitHub Actions (recomendada)

1. **Prepara Cloudflare**:
   - **API Token**: Cloudflare → *My Profile* → *API Tokens* → *Create Token* →
     selecciona el template **"Edit Cloudflare Workers"** (o crea uno personalizado)
     con permiso **Cloudflare Pages:Edit** sobre la cuenta. Guárdalo en el momento
     de crearlo: solo se muestra una vez.
   - **Account ID**: en `dash.cloudflare.com`, está en la URL de tu cuenta
     (`dash.cloudflare.com/<ACCOUNT_ID>`) o en *Workers & Pages* → *Overview*.
2. **Crea el proyecto Pages** (o deja que wrangler lo cree en el primer deploy)
   y define su **nombre** (ej. `barberia-kraft`).
3. **En GitHub** (repo → **Settings → Secrets and variables → Actions**) crea
   estos **secrets** (botón *New repository secret*):

   | Secret | De dónde se obtiene |
   |---|---|
   | `SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* |
   | `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → *anon public* |
   | `CF_API_TOKEN` | Cloudflare → *My Profile* → *API Tokens* (permiso **Pages:Edit**) |
   | `CF_ACCOUNT_ID` | Cloudflare → *Account ID* de tu cuenta |

   Y una **variable** (misma pantalla → pestaña *Variables* → *New repository variable*):

   | Variable | Valor |
   |---|---|
   | `CF_PROJECT_NAME` | nombre del proyecto Pages (ej. `barberia-kraft`) |

   > ⚠️ Crea los secrets **ANTES del primer push a `master`**: el workflow
   > (`deploy.yml`) corre en cada push y fallará si faltan (build con error claro).
4. **Push a `master`** (o *Run workflow* manual en la pestaña Actions). El pipeline:
   checkout → Node 20 (caché npm) → `npm ci` → `npm run build` (inyecta
   `SUPABASE_URL`/`SUPABASE_ANON_KEY` desde los secrets) → `wrangler pages deploy dist`
   → sitio en producción. Un solo deploy a la vez por rama; permisos mínimos
   (`contents: read`); nunca se imprimen valores de secrets en los logs.

### Opción B — Manual (sin GitHub Actions)

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Conecta el repo `barberiaKraft` (rama `master`).
3. Configuración del build:
   - **Framework preset**: `None`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Define las **mismas variables de entorno** en el proyecto Pages
   (**Settings → Environment variables**): `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   (y opcional `CF_PAGES_EXPECTED_HOST`). Sin ellas, el build falla con un error claro.
5. Deploy. Cloudflare sirve el sitio por **HTTPS automáticamente** (CA-RNF03-3) y
   aplica `_headers`/`_redirects` (incluido `/admin` → `/admin/dashboard.html`).
6. **No olvides** agregar `https://<tu-sitio>.pages.dev` a los **CORS origins**
   de Supabase (paso 3) para que las consultas funcionen en producción.

> **Nota sobre la `anon key`**: es **pública por diseño** de Supabase (el frontend
> la necesita y la seguridad real la da **RLS**). Aun así, por **política del grupo**
> tampoco se versiona en el repo: se inyecta solo en el build. La `service_role`
> **NUNCA** debe aparecer en el repo, en secrets ni en esta documentación — solo en
> el entorno controlado del líder (CA-RNF03-2).

---

## Wake-up del free tier de Supabase (RNF02 / CA-RNF02-2)

El plan free de Supabase **pausa el proyecto tras ~7 días sin actividad**. Para la demo:

1. Entra al dashboard de Supabase → verás el proyecto en estado *Paused*.
2. **Restore project**: tarda 1–3 minutos en reactivar.
3. Verifica con la URL pública antes de la demo.

**Plan B (si no se puede reactivar a tiempo)**: servir localmente con `python -m http.server`
y grabar un video de respaldo del recorrido funcional.

El registro mensual de disponibilidad se lleva en `docs/QUALITY.md` (§8.2).

---

## Estado del Hito 1 vs Hito 2

| Funcionalidad | Hito 1 | Hito 2 |
|---|---|---|
| Catálogo público de servicios | ✅ | — |
| Ocupación + tiempo de espera (fórmula §3.2) | ✅ | — |
| Promociones activas | ✅ | — |
| Registro/login cliente y admin (Supabase Auth + RLS) | ✅ | — |
| Panel admin: CRUD servicios y promociones | ✅ | — |
| Panel admin: gestión de sillas (ocupar/liberar) | ✅ | — |
| Panel admin: consulta de **clientes** y **historial** | 🔜 tabs deshabilitadas | ✅ |

El esquema SQL de `clientes` e `historial_atencion` **ya existe** con RLS (CA-RF08-1/3);
solo faltan las pantallas admin de consulta (diferido explícito, ver `REQUIREMENTS.md` §5).

---

## Convenciones de código

- **ES modules**: cada archivo importa solo lo que usa; sin dependencias externas.
- **Convención de retorno de API**: `{ ok: true, data }` / `{ ok: false, error }`; las funciones nunca lanzan al llamador (RNF07).
- **Errores en español** en toda la UI, junto al campo cuando es un formulario (RNF04).
- **Accesibilidad mínima** (RNF08): labels visibles, foco visible, áreas táctiles ≥ 44 px, estado de sillas con texto (*Libre/Ocupada*) además del color.