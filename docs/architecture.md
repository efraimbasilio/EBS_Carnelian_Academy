# Architecture

## Scope

V1 is a local-first school management application for approximately 300 students. Its planned modules are Student Information and Enrollment Management, and Billing and Collections Management. M01-T01 established a running API and integration testing infrastructure. M01-T02 adds the database foundation without business entities. M01-T03 adds a frontend application shell. M01-T04 connects the frontend to the existing health endpoints, with a Development-only CORS policy.

## Backend

A single ASP.NET Core Web API targets .NET 8 and uses C# with nullable reference types and implicit usings. The application composition root is Program.cs. Built-in dependency injection registers controllers, endpoint discovery, Swagger generation, Problem Details, the EF Core DbContext, and the database connectivity check. Controllers own REST/JSON routes; no extra service/repository layers are introduced without business requirements.

HealthController exposes anonymous GET /health and returns a typed response. This is a process health check with no I/O and no database dependency; it returns synchronously. GET /health/database is a separate anonymous endpoint that performs a real database connectivity check asynchronously with the request cancellation token. It returns HTTP 200 `{"status":"Healthy","database":"Connected"}` or HTTP 503 `{"status":"Unhealthy","database":"Unavailable"}`.

Development CORS (M01-T04, decision D012, approved for local development): after HTTPS redirection, Program.cs applies the `LocalDevelopmentFrontend` policy in Development to actual GET requests and OPTIONS preflights asking for GET. `Configuration/DevelopmentCors` reads `Cors:DevelopmentFrontendOrigins` (committed: `http://localhost:5173`), accepts explicitly configured HTTP(S) origins on exactly `localhost`, `127.0.0.1`, or `[::1]`, and normalizes an optional trailing slash away. Invalid origins fail startup without echoing the input. The policy allows no credentials or wildcard origins. CORS controls whether a browser exposes the response to another origin. Routing and authorization are handled separately. The Development policy is absent in Production. The allowed origin can read the existing health contracts, including the database 503 response.

Configuration follows standard environment-specific ASP.NET Core precedence. Swagger UI and OpenAPI are registered in the middleware pipeline only in Development. Other environments use exception handling with generic Problem Details and HSTS. HTTPS redirection is enabled; local launch profiles provide an HTTPS endpoint. Production requires a configured certificate and deployment-specific host restrictions.

## Persistence

SQL Server Express is accessed through EF Core 8.0.34 (`Microsoft.EntityFrameworkCore.SqlServer`), which uses Microsoft.Data.SqlClient 5.1.9. The application targets .NET 8 under the approved development-only exception (decisions D009); package versions and remediated advisories are recorded in D010. `Data/CarnelianAcademyDbContext` receives `DbContextOptions` through DI (scoped lifetime) and currently has no entity sets. `OnModelCreating` applies `IEntityTypeConfiguration<T>` classes from the API assembly so future entity mappings stay out of the context.

The connection string `ConnectionStrings:CarnelianAcademyDatabase` is required. Program.cs validates it immediately after the host is built and throws a clear `InvalidOperationException` naming the key if it is missing; the DbContext options resolve it from configuration when a context is created. Development uses the local `.\SQLEXPRESS` instance with Windows authentication (`CarnelianAcademy_Dev`); no credentials are stored in source control, and Production has no committed connection string.

`IDatabaseConnectivityCheck` abstracts connectivity so endpoint tests can run without SQL Server. `EfCoreDatabaseConnectivityCheck` (scoped) calls `Database.CanConnectAsync()`, which reports `false` when the server is unreachable or the database does not exist. Other exceptions are logged server-side as warnings and reported as unavailable. No exception detail, connection string, or server name reaches the HTTP response.

Cancellation: probes of EF Core 8.0.10 with Microsoft.Data.SqlClient 5.1.5, repeated after the update to EF Core 8.0.34 with SqlClient 5.1.9 with identical results, showed that `CanConnectAsync` does not throw when its token is cancelled; it returns `false`, both for a token cancelled before the call (even against the healthy local database) and for one cancelled while connecting. The check therefore (1) calls `ThrowIfCancellationRequested()` before starting, so no connection is attempted; (2) calls it again after the await, so a cancelled check is never reported as a connectivity failure; and (3) when an exception occurs after cancellation was requested, rethrows an `OperationCanceledException` (wrapping a non-cancellation exception) instead of logging a failure. Cancellation is not logged as a database warning. An `OperationCanceledException` whose token was not cancelled (for example, a provider timeout) is still treated as a connectivity failure. The propagated exception is left to ASP.NET Core's standard handling of aborted requests; no end-to-end test aborts a live HTTP request.

Schema changes use EF Core migrations in `Data/Migrations`, applied explicitly with `dotnet ef database update` against a verified target. There is no automatic migration at startup. The `InitialBaseline` migration is intentionally empty and only establishes `__EFMigrationsHistory`.

## Verification

The separate xUnit project references the API and uses WebApplicationFactory with its in-memory TestServer. `TestHost` supplies a synthetic connection string pointing at a closed local port, so tests never reach a real database. Endpoint tests either replace `IDatabaseConnectivityCheck` with a stub or exercise the real EF Core check against the unreachable address to confirm the 503 response discloses nothing sensitive. An opt-in test (`CARNELIAN_LOCAL_SQL_TESTS=1`) verifies read-only connectivity to the local development database.

`EfCoreDatabaseConnectivityCheckTests` exercise the real EF Core SQL Server provider. Cancellation during the check is triggered deterministically from a `DbConnectionInterceptor` while EF Core opens the connection. This covers cancellation inside the EF Core operation at the connection-opening boundary, but not cancellation at an arbitrary point inside SqlClient's network handshake, which cannot be timed deterministically in a unit test; that path was observed only in the manual probes above. Probes confirmed that EF Core (8.0.10 and 8.0.34) converts an exception thrown while opening the connection into a `false` result (with or without cancellation), so the branch that wraps a non-cancellation exception is defensive and not uniquely exercised by these tests.

## Frontend

`frontend/carnelian-academy-web` is a React 19 + Vite 8 + TypeScript 6 single-page application, built and tested independently of the backend (decision D011). It shares no source files with the backend; since M01-T04 it reads the backend health endpoints over REST/JSON.

```text
src/
  main.tsx                     entry point; mounts <App /> and global styles
  app/App.tsx                  composes the layout and the dashboard page
  components/layout/
    AppLayout.tsx              shell: skip link, header, sidebar, main; owns mobile-menu state and focus
    Header.tsx                 brand, current section, menu toggle (aria-expanded / aria-controls)
    Sidebar.tsx                <nav aria-label="Main">; Dashboard link plus "Coming soon" entries
  components/dashboard/
    SystemConnectivity.tsx     System connectivity panel: status list (role="status") and Refresh button
    useSystemHealth.ts         check orchestration, status mapping, single-flight/abort handling
  pages/DashboardPage.tsx      development-preview landing page; renders SystemConnectivity
  api/http.ts                  native-fetch GET helper: URL joining, timeout, cancellation, typed errors
  api/health.ts                /health and /health/database clients with runtime contract validation
  config/env.ts                typed, lazily validated VITE_API_BASE_URL and VITE_API_TIMEOUT_MS
  styles/global.css            design tokens and responsive layout
  test/setup.ts                jest-dom matchers, synthetic env, network-free fetch stub, cleanup
  test/fetch.ts                fetch stubs and response helpers for tests
```

There is no router: Dashboard is the only page. Students, Enrollment, Billing & Payments, Reports, and Settings are listed as non-interactive "Coming soon" entries rather than links, so no route points at unimplemented functionality. No component library, state library, or HTTP client is used.

Responsive behavior is CSS-driven. At 1024px and wider the sidebar is persistent and the menu toggle is hidden. Below 1024px the sidebar is an off-canvas panel, collapsed by default (`visibility: hidden`, so its contents are not focusable). The header toggle opens it and moves focus to its "Close navigation menu" button; the close button, the toggle, the backdrop, or Escape closes it and returns focus to the toggle. The open panel is a disclosure, not a modal dialog: focus is not trapped and content behind the backdrop is not made inert. Colors meet WCAG 2.1 AA contrast (maroon primary, warm orange accent, neutral background), focus indicators are visible, and motion is disabled under `prefers-reduced-motion`.

The layout also observes `matchMedia('(min-width: 1024px)')` to synchronize mobile state and keyboard focus with CSS. Entering desktop closes mobile navigation and removes its backdrop. Focus transfers from the disappearing toggle or close button to the visible Dashboard link; focus already on Dashboard or other visible content stays unchanged. Returning to mobile keeps navigation closed and transfers focus from the now-hidden Dashboard link to the menu toggle. Shell-scoped focus/blur capture handles browsers that clear focus before emitting the media-query event, without a document-wide focus listener. Ordinary mobile closure still restores toggle focus; desktop Escape and Dashboard navigation do not focus hidden mobile controls. The media-query listener is removed on unmount. Regression tests mock media events and blur ordering; only the separate Edge checks exercise actual CSS breakpoint behavior (see M01-T03 remediation in the milestone record).

`config/env.ts` exposes `getApiBaseUrl()`, which reads `import.meta.env.VITE_API_BASE_URL` (typed in `vite-env.d.ts`) and validates it on use: required, absolute http/https, no credentials, query, or fragment, trailing slashes removed. Errors never echo the rejected value. `.env.example` documents the variable; `.env.local` and other `.env.*` files are ignored by Git.

### Frontend/API integration (M01-T04)

The browser calls the API directly at `VITE_API_BASE_URL` (cross-origin, allowed by the Development CORS policy). A Vite dev proxy was not used: proxying to the self-signed HTTPS API would require disabling TLS verification in the proxy, and it would hide the real cross-origin behavior.

`api/http.ts` (`getJson`) is the only code that calls `fetch`. It resolves an endpoint path against the validated base URL and checks the normalized origin and base-path boundary. It rejects absolute URLs, literal and encoded dot segments, encoded path separators, queries, and fragments. It sends `GET` with `Accept: application/json`, `credentials: 'omit'`, `cache: 'no-store'`, and `redirect: 'error'`, and applies a finite timeout (default 20 s, `VITE_API_TIMEOUT_MS`) through an internal `AbortController` that also follows the caller's signal. It parses JSON only for status codes defined by the endpoint contract. Failures become `ApiRequestError` with kind `network`, `timeout`, `http-status`, or `invalid-response` and a fixed message. Caller cancellation becomes `ApiRequestAbortedError`. Browsers report DNS, connection, TLS certificate, and CORS failures identically, so they share the `network` kind.

`api/health.ts` validates the contracts at runtime: `/health` must be HTTP 200 `{"status":"Healthy","application":"Carnelian Academy API"}`; `/health/database` must be HTTP 200 `{"status":"Healthy","database":"Connected"}` or HTTP 503 `{"status":"Unhealthy","database":"Unavailable"}`. Status code and body must agree; extra properties are tolerated; anything else is `invalid-response`.

`useSystemHealth` checks `/health` first and `/health/database` only after the API answered, so an unreachable API yields database "Not checked" rather than an inferred result. It runs one check on mount and one per Refresh; a Refresh during a check is ignored (single flight), a result from a superseded check is discarded, and the in-flight check is aborted on unmount (including React StrictMode's development remount). The Refresh button uses `aria-disabled` instead of `disabled` while checking so keyboard focus is not lost. Status text sits in a `role="status"` live region with `aria-busy` during checks; each status has a text label, with color only supplementary.

Tests use Vitest with jsdom and React Testing Library, querying by role and accessible name. They cover the shell landmarks and branding, dashboard content, navigation (only Dashboard is a link), mobile menu open/close and focus management, keyboard operation (Tab, Enter, Space, Escape), and configuration validation. Client and dashboard tests stub `fetch` (success, 503, unreachable, HTTP 500/502, invalid JSON, wrong shape, timeout with fake timers, abort, StrictMode stale response, rapid refresh, unmount). The setup file installs a default stub that never touches the network, so tests need no backend, database, or network. Backend `DevelopmentCorsTests` cover the allowed origin, rejected origins, preflight, the 503 response, Production, and origin validation. Linting uses ESLint 10 with type-aware typescript-eslint rules plus React Hooks and React Refresh rules. `eslint-plugin-jsx-a11y` is not used because it does not support ESLint 10; accessibility relies on role-based tests and manual checks.

## Deferred components

Domain models, business tables, enrollment, billing, payments, authentication, frontend business screens, routing, a general-purpose API client (authentication, interceptors, retries), status polling, production CORS/deployment configuration, and automated browser end-to-end tests are deferred. Keep the initial single-API structure until real module requirements justify further separation.


## Development exception and production gate

D008 is owner-approved; the existing 503 `{"status":"Unhealthy","database":"Unavailable"}` contract is unchanged. D009 is explicitly **APPROVED: DEVELOPMENT ONLY**: local machines, synthetic/test data, no production deployment, and no real student or payment records. .NET 8 is unsupported; its final servicing patch does not restore support. Migration to a supported LTS .NET runtime is mandatory before production. **PPG-001 remains OPEN and BLOCKING for production readiness.**

D010 records the owner's development-only acceptance of deprecated transitive dependency risks, with the complete deprecated-package inventory. Actual use and impact of Microsoft.Identity.Client, Azure.Identity, and related dependencies are unverified; Windows authentication does not establish non-use. Investigate and reconsider replacement or risk resolution before production. xUnit v3 migration is separate maintenance work. D006 (SQL Server Express / EF Core foundation) and D007 (explicit migrations with the empty `InitialBaseline`) are **APPROVED — LOCAL DEVELOPMENT**.


Final local verification (2026-11-19) selected the side-by-side x64 SDK 8.0.428 and Microsoft.NETCore.App / Microsoft.AspNetCore.App 8.0.34 at `%LOCALAPPDATA%\Microsoft\CarnelianDotnet8`; global EF CLI is 8.0.34. Host traces and loaded API modules verify runtime selection. Existing installations and persistent machine configuration were preserved; README documents the required session PATH/DOTNET_ROOT setup. The full suite passed (17 + 1 opt-in skip by default; all 18 with local SQL enabled), package advisory scans report no known vulnerabilities, and the baseline/model/schema remain unchanged. These results do not resolve unsupported-platform or deprecated-package risks. M01-T02 is **COMPLETED — APPROVED FOR LOCAL DEVELOPMENT** (final Code Guardian result: PASS WITH WARNINGS); production remains blocked by PPG-001. Complete evidence is in the milestone record.
