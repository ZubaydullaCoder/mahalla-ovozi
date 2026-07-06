# Story 2.4: Frontend Auth Flow (Login Page & Protected Route Guard)

Status: done

## Story

As an **authorized user**,
I want a login page that submits credentials and an auth guard that redirects unauthenticated visitors to login,
so that the dashboard is only accessible after successful authentication.

## Acceptance Criteria

1. **Given** the React SPA is served at `/` with React Router v6 routes: `/login`, `/`, `/ops`
   **When** an unauthenticated user navigates to `/`
   **Then** the `AuthGuard` component redirects to `/login` before any dashboard content is rendered

2. **And** when the user submits valid credentials on the login page, the `POST /api/auth/login` mutation succeeds, the session cookie is stored by the browser, and the user is redirected to `/`

3. **And** when the user submits invalid credentials (HTTP 401) or hits the rate limit (HTTP 429), an inline error message is shown on the login page in Uzbek Cyrillic — no page reload, no alert dialog, no toast

4. **And** the login form has no public registration link or password-reset link

5. **And** all login page UI strings are in `strings.ts` in Uzbek Cyrillic; `pnpm lint` and `pnpm test` pass including `check-uz-strings`

## Tasks / Subtasks

- [x] Task 1: Wire providers and routing in `main.tsx` + `router.tsx` (AC: 1)
  - [x] 1.1 Update `apps/web/vite.config.ts` — add `/api` proxy to `http://localhost:3001`
  - [x] 1.2 Update `apps/web/index.html` — set title to `Маҳалла Овози`
  - [x] 1.3 Create `apps/web/src/theme.ts` — AntD v6 `mahallaTheme` ConfigProvider token overrides
  - [x] 1.4 Rewrite `apps/web/src/main.tsx` — wrap app with `QueryClientProvider`, `ConfigProvider`, `BrowserRouter`
  - [x] 1.5 Create `apps/web/src/router.tsx` — define `AppRoutes` with `/login`, `/`, `/ops` routes
  - [x] 1.6 Create `apps/web/src/types.ts` — API response interface types

- [x] Task 2: Implement `AuthGuard` component (AC: 1)
  - [x] 2.1 Create `apps/web/src/components/auth-guard.tsx`
  - [x] 2.2 On mount, probe `GET /api/signals` — if HTTP 401 → redirect to `/login`; any other status (currently `200 []` placeholder, future full `200` response) → render children
  - [x] 2.3 Show nothing (return `null`) while auth check is in-flight — do NOT render children before check resolves

- [x] Task 3: Implement `api/auth.ts` mutations (AC: 2, 3)
  - [x] 3.1 Create `apps/web/src/api/auth.ts` with `login()` and `logout()` fetch functions
  - [x] 3.2 `login()` returns the response object; throws with `{ status }` on non-2xx
  - [x] 3.3 `logout()` calls `POST /api/auth/logout`, returns `{ ok: true }` on success

- [x] Task 4: Implement `LoginPage` (AC: 2, 3, 4, 5)
  - [x] 4.1 Create `apps/web/src/pages/login-page.tsx` using AntD Form, Input, Input.Password, Button
  - [x] 4.2 On submit: call `login()` → on 200: `navigate('/')` → on 401: show `strings.login.errorInvalidCredentials` → on 429: show `strings.login.errorRateLimit`
  - [x] 4.3 No registration link, no password-reset link on the form
  - [x] 4.4 Error displayed inline (above submit button), not as modal/toast/alert component
  - [x] 4.5 Submit button shows loading state while request is in-flight

- [x] Task 5: Create stub pages for Epic 3+ routes (AC: 1)
  - [x] 5.1 Create `apps/web/src/pages/dashboard-page.tsx` — minimal placeholder only
  - [x] 5.2 Create `apps/web/src/pages/ops-page.tsx` — minimal placeholder only

- [x] Task 6: Add Uzbek Cyrillic strings to `strings.ts` (AC: 5)
  - [x] 6.1 Update `apps/web/src/strings.ts` with all login page strings in Uzbek Cyrillic
  - [x] 6.2 Verify no Latin Uzbek words appear (strings that would match `check-uz-strings` patterns)

- [x] Task 7: Pre-commit verification (AC: 5)
  - [x] 7.1 `pnpm lint` passes
  - [x] 7.2 `pnpm test` passes (97 existing server tests + check-uz-strings + any new tests)
  - [x] 7.3 `pnpm exec tsc -b apps/web/tsconfig.json` passes (frontend type check)

### Review Findings

- [x] [Review][Patch] Harden `AuthGuard` status handling and clean up stale auth probe requests [apps/web/src/components/auth-guard.tsx:21]
- [x] [Review][Patch] Preserve auth HTTP status for non-JSON responses and map only 401 to invalid credentials [apps/web/src/api/auth.ts:24]
- [x] [Review][Patch] Make `logout()` return `{ ok: true }` defensively on successful empty responses [apps/web/src/api/auth.ts:48]
- [x] [Review][Patch] Add durable accessible labels for login username and password fields [apps/web/src/pages/login-page.tsx:66]
- [x] [Review][Patch] Make the login card responsive on narrow screens and align radius with the 8px card convention [apps/web/src/pages/login-page.tsx:116]
- [x] [Review][Patch] Move visible stub page text to centralized Uzbek Cyrillic strings [apps/web/src/pages/dashboard-page.tsx:4]

## Dev Notes

### Architecture Overview — File Map for This Story

This story builds the entire frontend foundation. The architecture defines these files (verbatim from `apps/web/src/`):

```
apps/web/
├── index.html                 ← MODIFY: update title
├── vite.config.ts             ← MODIFY: add /api proxy
└── src/
    ├── main.tsx               ← MODIFY: add providers + BrowserRouter
    ├── theme.ts               ← NEW: mahallaTheme AntD token overrides
    ├── strings.ts             ← MODIFY: add login page Uzbek Cyrillic strings
    ├── types.ts               ← NEW: API response types
    ├── router.tsx             ← NEW: AppRoutes component (/login, /, /ops)
    ├── App.tsx                ← DELETE or replace with thin re-export of AppRoutes
    ├── App.css                ← DELETE (not needed)
    ├── api/
    │   └── auth.ts            ← NEW: login(), logout() functions
    ├── pages/
    │   ├── login-page.tsx     ← NEW: Login form
    │   ├── dashboard-page.tsx ← NEW: Placeholder stub (Epic 3 will build this out)
    │   └── ops-page.tsx       ← NEW: Placeholder stub (Epic 6 will build this out)
    └── components/
        └── auth-guard.tsx     ← NEW: Route protection component
```

`App.tsx` is the default Vite scaffold artifact. It must be replaced. The cleanest approach: update `main.tsx` to import from `router.tsx` directly and delete `App.tsx`, OR replace `App.tsx` content with `export { AppRoutes as default } from './router.tsx'` and update the main.tsx import accordingly.

---

### Task 1: Vite Config — /api Proxy

**File:** `apps/web/vite.config.ts` (MODIFY — currently has no proxy)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**Why:** The frontend dev server runs on port 5173. The backend runs on port 3001 (`pnpm dev:server`). Without this proxy, `fetch('/api/...')` calls will hit port 5173 (the Vite server) and 404. In production, both are served from the same origin so no proxy is needed.

---

### Task 1: AntD Theme — `theme.ts`

**File:** `apps/web/src/theme.ts` (NEW)

```typescript
import type { ThemeConfig } from 'antd'

export const mahallaTheme: ThemeConfig = {
  token: {
    colorPrimary: '#4F46A8',
    colorBgContainer: '#FAFAF9',
    colorBgLayout: '#F5F4F2',
    colorBgElevated: '#FFFFFF',
    colorBorder: '#E8E5E1',
    colorBorderSecondary: '#D1CEC9',
    colorText: '#1A1714',
    colorTextSecondary: '#6B6560',
    colorTextPlaceholder: '#A09990',
    colorWarning: '#D97706',
    colorSuccess: '#16A34A',
    colorError: '#DC2626',
    fontFamily: "'Inter', 'Outfit', sans-serif",
    borderRadius: 8,
  },
}
```

**Key decisions:**
- These are the exact token values from the UX design foundation spec
- `colorError` (`#DC2626`) is defined in the theme but per UX spec is **reserved — not used in any MVP hokim-facing element**. It is safe to set it; do NOT use it in UI components
- Category color tokens (`categoryHokim`, `categorySuv`, etc.) are custom tokens for Epic 3 — do NOT add them here in Story 2.4; they will be added in the signal card story (3-3)
- `fontFamily` requires Inter to be loaded via Google Fonts in `index.html`; add the import there

**Add to `index.html` `<head>`:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600&display=swap&subset=latin,cyrillic" rel="stylesheet" />
```

---

### Task 1: `main.tsx` — Provider Stack

**File:** `apps/web/src/main.tsx` (MODIFY)

The current `main.tsx` is a bare Vite scaffold that only renders `App`. Rewrite it to:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { mahallaTheme } from './theme.ts'
import { AppRoutes } from './router.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={mahallaTheme}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

**Provider order (from architecture):** `QueryClientProvider` wraps everything (server state), `ConfigProvider` wraps for AntD theming, `BrowserRouter` wraps for routing. This order matches Epic 3's architecture `main.tsx ← QueryClientProvider + ConfigProvider`.

**Note:** Import `AppRoutes` from `router.tsx` directly — do NOT use `App.tsx`. After this change, `App.tsx` and `App.css` are dead files and should be deleted.

---

### Task 1: `router.tsx` — Route Definitions

**File:** `apps/web/src/router.tsx` (NEW)

```typescript
import { Routes, Route } from 'react-router-dom'
import { AuthGuard } from './components/auth-guard.tsx'
import { LoginPage } from './pages/login-page.tsx'
import { DashboardPage } from './pages/dashboard-page.tsx'
import { OpsPage } from './pages/ops-page.tsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="/ops" element={<OpsPage />} />
    </Routes>
  )
}
```

**Key routing decisions (from architecture):**
- `/login` — open, no guard
- `/` — wrapped by `AuthGuard`; dashboard is protected client-side by guard + server-side by `requireAuth`
- `/ops` — **NO client-side `AuthGuard`**. The ops console is guarded **server-side only** via `NODE_ENV + OPS_ENABLED + local-IP or OPS_SECRET`. Do NOT add `AuthGuard` around `OpsPage` — this is intentional per architecture
- Redirect for unknown paths: React Router v6 has no fallback route defined in architecture — do NOT add a wildcard `*` route in this story; it will be addressed if needed

---

### Task 1: `types.ts` — API Types

**File:** `apps/web/src/types.ts` (NEW)

```typescript
// Auth API response shapes — mirrors server response contracts from Stories 2.1–2.3

export interface LoginSuccessResponse {
  ok: true
}

export interface LogoutSuccessResponse {
  ok: true
}

export interface ApiErrorResponse {
  statusCode: number
  error: string
  message: string
}
```

**Note:** Only auth-related types belong here for Story 2.4. Signal, mahalla, health, and other types will be added in their respective stories (Epics 3–5).

---

### Task 2: `AuthGuard` — Auth Detection Pattern

**File:** `apps/web/src/components/auth-guard.tsx` (NEW)

**Critical design decision — how to detect session validity:**

The session cookie is `httpOnly` — client-side JavaScript cannot read it. There is no `/api/auth/me` endpoint. The `requireAuth` middleware (Story 2.2) returns HTTP 401 if `req.session.userId || req.session.districtId` is missing — for ALL `/api/*` routes **except** `/api/auth/*`.

**Solution:** Probe `GET /api/signals` on mount.
- Unauthenticated → `requireAuth` returns `401` before any handler runs → redirect to `/login`
- Authenticated → `requireAuth` calls `next()` → current placeholder returns `200 []`; the full Epic 3 endpoint will also return `200` → show children

```typescript
import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    fetch('/api/signals', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then((res) => {
        // requireAuth returns 401 if not authenticated
        // Any non-401 status means requireAuth allowed the request.
        setStatus(res.status === 401 ? 'unauthenticated' : 'authenticated')
      })
      .catch(() => {
        // Network error — treat as unauthenticated for safety
        setStatus('unauthenticated')
      })
  }, [])

  if (status === 'loading') return null  // render nothing; do NOT flash dashboard content
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  return <>{children}</>
}
```

**Why `return null` while loading (not a spinner):**
- AC 1 requires redirect "before any dashboard content is rendered"
- A skeleton or spinner from the `DashboardPage` would violate this if children render first
- `null` guarantees no dashboard content flashes to screen
- The `/api/signals` probe is fast (single HTTP request, no data returned) — loading state is brief

**Why `credentials: 'same-origin'`:**
- Required for the session cookie to be sent with the fetch request
- Without this, the probe request has no cookie → always 401 → infinite redirect to `/login`
- The Vite proxy uses `changeOrigin: true` which handles cross-origin cookie forwarding in dev

**Future-proofing:** When Epic 3 implements `GET /api/signals`, this probe will return `200` (authenticated) or `401` (unauthenticated) — exactly the same behavior. No AuthGuard changes needed.

---

### Task 3: `api/auth.ts` — Login & Logout Functions

**File:** `apps/web/src/api/auth.ts` (NEW)

```typescript
import type { LoginSuccessResponse, LogoutSuccessResponse, ApiErrorResponse } from '../types.ts'

export class AuthError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorResponse,
  ) {
    super(data.message)
    this.name = 'AuthError'
  }
}

export async function login(credentials: {
  username: string
  password: string
}): Promise<LoginSuccessResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(credentials),
  })

  const data = (await res.json()) as LoginSuccessResponse | ApiErrorResponse

  if (!res.ok) {
    throw new AuthError(res.status, data as ApiErrorResponse)
  }

  return data as LoginSuccessResponse
}

export async function logout(): Promise<LogoutSuccessResponse> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({
      statusCode: res.status,
      error: 'Error',
      message: 'Logout failed',
    }))) as ApiErrorResponse
    throw new AuthError(res.status, data)
  }

  return res.json() as Promise<LogoutSuccessResponse>
}
```

**Key decisions:**
- `credentials: 'same-origin'` on all fetch calls — required for session cookie to be sent
- `login()` returns `{ ok: true }` on success. `userId` and `districtId` stay in the server-side session only and must not be exposed to client JavaScript.
- `login()` throws `AuthError` (extends `Error`) with `status` + `data` so `LoginPage` can differentiate 401 vs 429 vs 500
- `logout()` is used in future stories (Epic 3 dashboard toolbar or Epic 5) — expose it now from `auth.ts` as the architecture specifies
- No TanStack Query `useMutation` wrapper here — `api/auth.ts` exports plain async functions; components wrap them with `useState` for loading/error state. Mutations will use `useMutation` in component code where needed.

---

### Task 4: `LoginPage` — Form Implementation

**File:** `apps/web/src/pages/login-page.tsx` (NEW)

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography } from 'antd'
import { login, AuthError } from '../api/auth.ts'
import { strings } from '../strings.ts'

const { Title, Text } = Typography

interface LoginFormValues {
  username: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [form] = Form.useForm<LoginFormValues>()

  async function handleSubmit(values: LoginFormValues) {
    setErrorMessage(null)
    setIsLoading(true)
    try {
      await login(values)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.status === 429) {
          setErrorMessage(strings.login.errorRateLimit)
        } else {
          // 401 or any other error — show generic invalid credentials message
          // Do NOT expose which field was wrong (security: same message for wrong user/pass)
          setErrorMessage(strings.login.errorInvalidCredentials)
        }
      } else {
        setErrorMessage(strings.login.errorUnknown)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Title level={3} style={styles.title}>
          {strings.login.title}
        </Title>
        <Text type="secondary" style={styles.subtitle}>
          {strings.login.subtitle}
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={styles.form}
          autoComplete="off"
        >
          {errorMessage && (
            <div style={styles.errorBanner} role="alert" aria-live="polite">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </div>
          )}

          <Form.Item
            name="username"
            rules={[{ required: true, message: strings.login.usernameRequired }]}
          >
            <Input
              placeholder={strings.login.usernamePlaceholder}
              size="large"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: strings.login.passwordRequired }]}
          >
            <Input.Password
              placeholder={strings.login.passwordPlaceholder}
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={isLoading}
            >
              {strings.login.submitButton}
            </Button>
          </Form.Item>
        </Form>
        {/* No registration link. No password-reset link. Intentional per story AC. */}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F4F2',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: '40px 36px',
    width: 380,
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
  },
  title: {
    margin: 0,
    marginBottom: 4,
    color: '#1A1714',
    textAlign: 'center' as const,
  },
  subtitle: {
    display: 'block',
    textAlign: 'center' as const,
    marginBottom: 28,
    color: '#6B6560',
  },
  form: {
    marginTop: 0,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 6,
    padding: '10px 14px',
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
} as const
```

**Why inline styles instead of CSS modules:**
- The architecture says "No Tailwind"; CSS modules or inline styles are both acceptable
- Inline styles here are minimal and kept within the component — per architecture "No ad-hoc color literals in components" this may seem contradictory, but these are layout/structural styles (not semantic design tokens). Category/semantic tokens (signals, lanes) will use theme tokens in Epic 3. For Story 2.4's isolated login card, this is acceptable
- If the project has `index.css` with global resets, those still apply

**Error feedback pattern (from UX spec):**
- No `Modal.confirm()`, no `message.success()` toasts, no `notification` popups — UX spec explicitly prohibits these in MVP
- Error displayed inline in a red-tinted banner (`#FEF2F2` background, `#991B1B` text) above the submit button
- `role="alert"` and `aria-live="polite"` for WCAG AA accessibility
- Error clears on next submit attempt (`setErrorMessage(null)` at top of `handleSubmit`)

**After successful login:**
- `navigate('/', { replace: true })` — replace is important so the back button doesn't return the user to the login page while authenticated

---

### Task 5: Stub Pages

**File:** `apps/web/src/pages/dashboard-page.tsx` (NEW) — minimal placeholder

```typescript
export function DashboardPage() {
  // Epic 3 will build the full five-lane signal dashboard here.
  // Story 3-1 sets up the AntD app shell and theme system.
  return <div style={{ padding: 24 }}>Dashboard placeholder</div>
}
```

**File:** `apps/web/src/pages/ops-page.tsx` (NEW) — minimal placeholder

```typescript
export function OpsPage() {
  // Epic 6 will build the Developer Ops Console here.
  // Server-side guarded by NODE_ENV + OPS_ENABLED + OPS_SECRET.
  return <div style={{ padding: 24 }}>Ops placeholder</div>
}
```

These stubs exist so `router.tsx` can import them without errors. They will be replaced in full in their respective epics.

---

### Task 6: `strings.ts` — Uzbek Cyrillic Strings

**File:** `apps/web/src/strings.ts` (MODIFY — currently `export const strings = {} as const`)

```typescript
// All user-facing Uzbek Cyrillic UI strings go here.
// DO NOT add Latin Uzbek here — will fail check-uz-strings.ts test.
// check-uz-strings.ts flags: mahalla, signal, bugun, kecha, soat, qidiruv — use Cyrillic equivalents.

export const strings = {
  login: {
    title: 'Маҳалла Овози',
    subtitle: 'Тизимга кириш',
    usernamePlaceholder: 'Фойдаланувчи номи',
    passwordPlaceholder: 'Парол',
    usernameRequired: 'Фойдаланувчи номини киритинг',
    passwordRequired: 'Паролни киритинг',
    submitButton: 'Кириш',
    errorInvalidCredentials: 'Фойдаланувчи номи ёки парол нотўғри',
    errorRateLimit: 'Кириш уринишлари сони ошиб кетди. Бир оздан кейин уриниб кўринг',
    errorUnknown: 'Хатолик юз берди. Кейинроқ уриниб кўринг',
  },
} as const
```

**check-uz-strings.ts compliance:**

The script (`scripts/check-uz-strings.ts`) flags these Latin patterns in `strings.ts`:
- `mahalla` → use `Маҳалла` ✅
- `signal` → not present in login strings ✅
- `bugun` → not present ✅
- `kecha` → not present ✅
- `soat` → not present ✅
- `qidiruv` → not present ✅
- `ma'lumot` → not present ✅

All strings above use Uzbek Cyrillic exclusively. No Latin characters appear in string values.

**Future stories:** Epic 3 will add `dashboard`, `filter`, lane header labels, and other UI strings here. Each epic's story will extend this object with new keys.

---

### Anti-Patterns to Prevent

| ❌ Wrong | ✅ Correct |
|---|---|
| `import { Navigate } from 'react-router-dom'` missing in AuthGuard | Always import `Navigate` for redirect |
| `AuthGuard` probes `/api/auth/me` | Route doesn't exist; probe `/api/signals` instead |
| `AuthGuard` renders children while loading | `return null` while `status === 'loading'` — prevents dashboard flash |
| `credentials: 'include'` on fetch | Use `credentials: 'same-origin'` — correct for same-origin requests |
| Adding `AuthGuard` around `OpsPage` | `/ops` is server-side guarded only — no client `AuthGuard` needed |
| Using `message.success()` or `notification.error()` from AntD | No toasts in MVP — use inline error state only |
| Adding registration or password-reset link to login form | Intentionally absent per AC — do not add |
| `window.location.href = '/'` after login | Use `navigate('/', { replace: true })` — React Router navigation |
| Latin Uzbek in `strings.ts` (e.g., `'mahalla'`, `'bugun'`) | Uzbek Cyrillic only: `'маҳалла'`, `'бугун'` |
| `alert()` or `window.confirm()` for errors | Inline state only — `setErrorMessage(...)` |
| Hardcoding color tokens in components (e.g., `color: '#4F46A8'`) | Use AntD tokens via `theme.useToken()` in Epic 3+ components; inline styles are acceptable in Story 2.4's login card for structural layout |
| `module: NodeNext` in `apps/web/tsconfig.json` | Frontend uses `module: ESNext` + `moduleResolution: Bundler` — already set, do not change |
| Importing from `.ts` extension in server files | Frontend TSConfig uses `allowImportingTsExtensions: true`; use `.tsx`/`.ts` extensions as shown |

---

### Server-Side Auth Contract (What Backend Is Ready)

All backend auth is DONE (97 tests pass). The frontend consumes these endpoints:

| Endpoint | Method | Request | Response (success) | Response (error) |
|---|---|---|---|---|
| `/api/auth/login` | POST | `{ username: string, password: string }` | `200 { ok: true }` | `401 { ... }` or `429 { ... }` |
| `/api/auth/logout` | POST | _(no body)_ | `200 { ok: true }` | `500 { ... }` (rare) |
| `/api/signals` _(probe)_ | GET | _(no body)_ | `401` if unauth; `200 []` if auth currently; full `200` response after Epic 3 | — |

**Session cookie details (from Story 2.3):**
- Name: `connect.sid` (default `express-session`)
- `httpOnly: true` — JS cannot read it; the browser sends it automatically with `credentials: 'same-origin'`
- `sameSite: 'strict'` — CSRF-safe; no cross-origin submissions
- `maxAge: 8 * 60 * 60 * 1000` (8 hours)
- `secure: false` in Phase 1 (local dev); will be `true` in Phase 2 (HTTPS via Nginx)

**Rate limiting (from Story 2.1):**
- 5 failed attempts per username per 60-second window → HTTP 429
- Counter is in-memory (resets on server restart); resets automatically after 60 seconds
- `LoginPage` must handle 429 with a specific Uzbek Cyrillic message — see `strings.login.errorRateLimit`

---

### TypeScript Setup Notes

**Frontend TypeScript config** (`apps/web/tsconfig.json`):
- `"module": "ESNext"` and `"moduleResolution": "Bundler"` — different from root/server config
- `"allowImportingTsExtensions": true` — use `.ts`/`.tsx` extensions in imports as shown above
- `"noEmit": true` — no output; Vite handles transpilation
- `"jsx": "react-jsx"` — React 18 JSX transform (no need to `import React`)
- **Type check command:** `pnpm exec tsc -b apps/web/tsconfig.json` — use `-b` (build mode) not `-p` (project mode) for `noEmit`

**Root `tsconfig.json` does NOT include `apps/web/`** — root tsconfig's `include` covers only `apps/server/src/**/*.ts`, `prisma/**`, and `scripts/**`. Web app is type-checked independently via its own tsconfig.

---

### Cross-Story Context (Stories 2.1–2.3 Learnings for Frontend)

- **No `GET /api/auth/me`:** The architecture deliberately omits this; AuthGuard probes `/api/signals`
- **Cookie is browser-managed:** After `POST /api/auth/login` returns 200, the browser automatically stores `connect.sid` — no manual cookie handling needed
- **Logout redirect:** After `POST /api/auth/logout` returns 200, redirect user to `/login`. The next time `AuthGuard` probes `/api/signals`, it will get 401 (session is destroyed server-side by Story 2.3's `req.session.destroy()`)
- **pnpm test scope:** `vitest.config.ts` includes `scripts/**/*.ts` + `apps/**/*.test.ts` — running `pnpm test` runs ALL 97 server tests AND `check-uz-strings.ts`. All must pass
- **`vi.hoisted()` pattern:** Not needed for Story 2.4 (no server-side mocks in frontend code); this was a server test pattern from Stories 2.1–2.3
- **Redirect is one-way:** No "return to original URL" pattern (not in spec). After login, always redirect to `/` — not to the originally requested URL

---

### Development Workflow

```bash
# Terminal 1 — backend
pnpm dev:server   # Express on port 3001; required for /api proxy to work

# Terminal 2 — frontend
pnpm dev:web      # Vite on port 5173; proxies /api → localhost:3001

# Type-check frontend only
pnpm exec tsc -b apps/web/tsconfig.json

# Run all tests (server + check-uz-strings)
pnpm test

# Lint everything
pnpm lint
```

**Manual verification flow:**
1. Start both dev servers
2. Navigate to `http://localhost:5173` — should redirect to `/login`
3. Submit wrong credentials → inline Cyrillic error appears (no page reload)
4. Submit correct credentials → redirect to `/` (dashboard placeholder)
5. Navigate back to `/login` while authenticated → stays on `/login` (no auto-redirect; this is expected — AuthGuard only guards `/`)

---

### Files to Create / Modify Summary

| File | Action | What changes |
|---|---|---|
| `apps/web/vite.config.ts` | MODIFY | Add `/api` proxy to `http://localhost:3001` |
| `apps/web/index.html` | MODIFY | Update `<title>` to `Маҳалла Овози`; add Inter/Outfit Google Fonts link |
| `apps/web/src/main.tsx` | MODIFY | Add `QueryClientProvider`, `ConfigProvider`, `BrowserRouter`; import `AppRoutes` from `router.tsx` |
| `apps/web/src/theme.ts` | NEW | `mahallaTheme` AntD v6 ConfigProvider token overrides |
| `apps/web/src/types.ts` | NEW | `LoginSuccessResponse`, `LogoutSuccessResponse`, `ApiErrorResponse` interfaces |
| `apps/web/src/strings.ts` | MODIFY | Add `login` key with Uzbek Cyrillic strings |
| `apps/web/src/router.tsx` | NEW | `AppRoutes` with `/login`, `/`, `/ops` routes |
| `apps/web/src/api/auth.ts` | NEW | `login()`, `logout()`, `AuthError` class |
| `apps/web/src/pages/login-page.tsx` | NEW | Login form with AntD Form, inline error handling |
| `apps/web/src/pages/dashboard-page.tsx` | NEW | Placeholder stub for Epic 3 |
| `apps/web/src/pages/ops-page.tsx` | NEW | Placeholder stub for Epic 6 |
| `apps/web/src/components/auth-guard.tsx` | NEW | Route protection; probes `/api/signals`; redirects on 401 |
| `apps/web/src/App.tsx` | DELETE | Replaced by `router.tsx` + updated `main.tsx` |
| `apps/web/src/App.css` | DELETE | Not needed; default Vite scaffold artifact |

**Do NOT touch:**
- `apps/server/` — all backend auth is done (Stories 2.1–2.3); no server changes needed
- `apps/web/src/index.css` — global CSS resets; leave as-is unless adding font-face rules
- `apps/web/tsconfig.json` — frontend TS config is correct as-is
- `prisma/` — no schema changes
- `scripts/check-uz-strings.ts` — validation script; do not modify

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- `check-uz-strings.ts` initially failed: comment in `strings.ts` contained the word `mahalla` (Latin). Fixed by replacing comment with Cyrillic-only wording. Root cause: script scans entire file including comments, not just string values.

### Completion Notes List

- ✅ Task 1: Wired full provider stack in `main.tsx` (QueryClientProvider → ConfigProvider → BrowserRouter → AppRoutes). Created `theme.ts` with exact UX design token values. Created `router.tsx` with `/login` (open), `/` (AuthGuard-protected), `/ops` (no client guard, server-side only). Created `types.ts` for auth API response shapes. Added `/api` proxy in `vite.config.ts`. Updated `index.html` with Маҳалла Овози title and Inter/Outfit Google Fonts. Deleted Vite scaffold `App.tsx` and `App.css`.
- ✅ Task 2: Implemented `AuthGuard` — probes `GET /api/signals` with `credentials: 'same-origin'`. Returns `null` while loading, `<Navigate to="/login" replace />` on 401/network-error, renders children otherwise. Future-proof: works identically when Epic 3 implements the real signals endpoint.
- ✅ Task 3: Implemented `api/auth.ts` — `login()`, `logout()`, and `AuthError` class. All fetch calls use `credentials: 'same-origin'`. `login()` returns `{ ok: true }` on success (no userId/districtId exposed to client). `AuthError` carries `status` for 401 vs 429 differentiation in LoginPage.
- ✅ Task 4: Implemented `LoginPage` — AntD Form with username/password fields, loading button state, inline error banner (`role="alert"`, `aria-live="polite"`). Handles 401 (errorInvalidCredentials) and 429 (errorRateLimit) distinctly. No toast, no modal, no registration link, no password-reset link. Uses `navigate('/', { replace: true })` after successful login.
- ✅ Task 5: Created minimal placeholder stubs for `DashboardPage` and `OpsPage`.
- ✅ Task 6: Populated `strings.ts` with 10 Uzbek Cyrillic login strings. Fixed comment to not contain flagged Latin word `mahalla`.
- ✅ Task 7: `pnpm lint` ✓, `pnpm test` 97/97 ✓ (including check-uz-strings), `pnpm exec tsc -b apps/web/tsconfig.json` ✓.

### File List

- `apps/web/vite.config.ts` — MODIFIED: added `/api` proxy to `http://localhost:3001`
- `apps/web/index.html` — MODIFIED: title → `Маҳалла Овози`, added Inter/Outfit Google Fonts preconnect + stylesheet, lang → `uz`
- `apps/web/src/main.tsx` — MODIFIED: rewrote to add QueryClientProvider, ConfigProvider, BrowserRouter; imports AppRoutes from router.tsx
- `apps/web/src/theme.ts` — NEW: mahallaTheme AntD v6 ConfigProvider token overrides
- `apps/web/src/types.ts` — NEW: LoginSuccessResponse, LogoutSuccessResponse, ApiErrorResponse interfaces
- `apps/web/src/strings.ts` — MODIFIED: added `login` key with 10 Uzbek Cyrillic strings
- `apps/web/src/router.tsx` — NEW: AppRoutes component with /login, /, /ops routes
- `apps/web/src/api/auth.ts` — NEW: login(), logout(), AuthError class
- `apps/web/src/pages/login-page.tsx` — NEW: Login form with inline Uzbek Cyrillic error handling
- `apps/web/src/pages/dashboard-page.tsx` — NEW: Placeholder stub for Epic 3
- `apps/web/src/pages/ops-page.tsx` — NEW: Placeholder stub for Epic 6
- `apps/web/src/components/auth-guard.tsx` — NEW: Route protection component
- `apps/web/src/App.tsx` — DELETED: replaced by router.tsx + updated main.tsx
- `apps/web/src/App.css` — DELETED: Vite scaffold artifact, not needed

## Change Log

| Date | Description |
|---|---|
| 2026-06-13 | Story 2.4 created — Frontend Auth Flow: Login Page & Protected Route Guard |
| 2026-06-13 | Story 2.4 implemented — all tasks complete, all ACs satisfied, lint/tests/typecheck passing |

