# Carnelian Academy

Local-first Enrollment & Billing Management System V1 for a preschool and elementary school of approximately 300 students.

## Current scope

M01-T01 provides the backend API foundation. M01-T02 adds the SQL Server Express / EF Core 8 database foundation (empty DbContext, baseline migration, database health endpoint). M01-T03 adds a React + Vite + TypeScript frontend shell (completed and approved for local development only; PPG-001 remains OPEN and BLOCKING for production); it does not call the API yet. Milestone M01 is **in progress**. Enrollment, billing, payments, authentication, business tables, and frontend business screens are not implemented.

## Structure

```text
backend/
  CarnelianAcademy.sln
  CarnelianAcademy.Api/       ASP.NET Core controllers, configuration, Swagger
    Data/                     EF Core DbContext, connectivity check, migrations
  CarnelianAcademy.Tests/     xUnit integration tests using WebApplicationFactory
frontend/
  carnelian-academy-web/      React + Vite + TypeScript application shell (see "Frontend")
docs/
  architecture.md
  decisions.md
  milestones/M01.md
```

## Local setup (Windows / PowerShell)

Use Git, SQL Server Express, and the verified local .NET 8 SDK 8.0.428 / runtime 8.0.34 installation described below, with `dotnet-ef` 8.0.34. VS Code with C# tooling is recommended. Node.js is intended for a later task. Microsoft support for .NET 8 ended on 10 November 2026; the final servicing release 8.0.34 was released that day. Patching does not restore support. D009 is explicitly **APPROVED: DEVELOPMENT ONLY**: local machines, synthetic/test data only, no production deployment, and no handling of real student or payment records. Migration to a supported LTS .NET runtime is mandatory before production. **PPG-001 remains OPEN and BLOCKING for production readiness** (see [decisions](docs/decisions.md) and [M01](docs/milestones/M01.md)).

| Component | Version / value |
| --- | --- |
| Target framework | .NET 8 (`net8.0`) |
| Microsoft.EntityFrameworkCore.SqlServer | 8.0.34 |
| Microsoft.EntityFrameworkCore.Design | 8.0.34 (development-time only) |
| dotnet-ef CLI | 8.0.34 (global tool; no repository-local tool) |
| Verified x64 SDK / host | 8.0.428 / 8.0.34 |
| Microsoft.NETCore.App / Microsoft.AspNetCore.App | 8.0.34 / 8.0.34 |
| SQL Server instance | `.\SQLEXPRESS` (SQL Server Express) |
| Development database | `CarnelianAcademy_Dev` |

The final remediation installed the official Microsoft x64 SDK ZIP side by side at `%LOCALAPPDATA%\Microsoft\CarnelianDotnet8`, after validating its SHA-512 against Microsoft release metadata. Existing machine-wide SDKs/runtimes and the separate pre-existing .NET 10 installation were preserved. No administrator action or persistent PATH/environment change was made. This task did not install .NET 10/11 or change `TargetFramework`.

Select the patched installation in **each new PowerShell terminal** before running commands. The original default PATH still selects the older machine-wide SDK; `DOTNET_ROOT` alone does not change which `dotnet.exe` PATH selects.

From the repository root:

```powershell
$carnelianDotnetRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\CarnelianDotnet8'
$env:DOTNET_ROOT = $carnelianDotnetRoot
$env:DOTNET_ROOT_X64 = $carnelianDotnetRoot
$env:PATH = "$carnelianDotnetRoot;$env:PATH"
dotnet --info
dotnet --list-runtimes
dotnet ef --version
dotnet restore backend/CarnelianAcademy.sln
dotnet build backend/CarnelianAcademy.sln --no-restore
dotnet test backend/CarnelianAcademy.sln --no-build
dotnet dev-certs https --trust
dotnet run --project backend/CarnelianAcademy.Api --launch-profile https
```

The HTTPS profile runs in Development at `https://localhost:7159` and `http://localhost:5082`. HTTP redirects to HTTPS. Stop the API with Ctrl+C.

If a test/apphost reports "You must install or update .NET", select the patched installation using all three environment assignments above. The pre-existing `DOTNET_ROOT` pointed to a separate .NET 10 installation without .NET 8. Do not fall back to the old machine-wide 8.0.3/8.0.8 runtimes for this task.

## Database

### Connection configuration

The API requires the connection string `ConnectionStrings:CarnelianAcademyDatabase` and fails at startup with a clear error if it is missing. The Development value in `backend/CarnelianAcademy.Api/appsettings.Development.json` uses Windows authentication and contains no credentials:

```text
Server=.\SQLEXPRESS;Database=CarnelianAcademy_Dev;Trusted_Connection=True;TrustServerCertificate=True;
```

`TrustServerCertificate=True` is acceptable only for this local Express instance. If your instance name differs, override the value without editing the file, for example with user secrets or an environment variable:

```powershell
dotnet user-secrets init --project backend/CarnelianAcademy.Api
dotnet user-secrets set "ConnectionStrings:CarnelianAcademyDatabase" "Server=.\MYINSTANCE;Database=CarnelianAcademy_Dev;Trusted_Connection=True;TrustServerCertificate=True;" --project backend/CarnelianAcademy.Api
# or, for the current terminal only:
$env:ConnectionStrings__CarnelianAcademyDatabase = "Server=.\MYINSTANCE;Database=CarnelianAcademy_Dev;Trusted_Connection=True;TrustServerCertificate=True;"
```

List local instances with `Get-Service MSSQL*` (the instance name follows `MSSQL$`). No Production connection string is defined; supply one through deployment configuration, never source control. Migrations are never applied automatically at startup.

### Migrations

Migrations live in `backend/CarnelianAcademy.Api/Data/Migrations`. `InitialBaseline` is intentionally empty: applying it creates the database (if absent) and the `__EFMigrationsHistory` table so future approved schema changes start from a known baseline. EF commands need the Development environment to read the connection string, so pass `-- --environment Development`:

```powershell
# Inspect the target before changing anything
dotnet ef dbcontext info --project backend/CarnelianAcademy.Api -- --environment Development
# Preview the SQL
dotnet ef migrations script --project backend/CarnelianAcademy.Api -- --environment Development
# Apply to the local development database only
dotnet ef database update --project backend/CarnelianAcademy.Api -- --environment Development
# Add a future migration (approved schema changes only)
dotnet ef migrations add <Name> --project backend/CarnelianAcademy.Api --output-dir Data/Migrations -- --environment Development
```

Verify the database and migration history:

```powershell
sqlcmd -S .\SQLEXPRESS -E -C -Q "SELECT MigrationId, ProductVersion FROM CarnelianAcademy_Dev.dbo.__EFMigrationsHistory"
```

## Health endpoints

With the API running, in another PowerShell terminal:

```powershell
Invoke-RestMethod https://localhost:7159/health
Invoke-WebRequest https://localhost:7159/health/database -SkipHttpErrorCheck   # PowerShell 7+
Start-Process https://localhost:7159/swagger
```

`GET /health` is anonymous, performs no database access, and returns HTTP 200 with:

```json
{"status":"Healthy","application":"Carnelian Academy API"}
```

`GET /health/database` is anonymous and performs a real connectivity check (`Database.CanConnectAsync()`). It returns HTTP 200 when the database is reachable:

```json
{"status":"Healthy","database":"Connected"}
```

and HTTP 503 when the server is unreachable or the database does not exist (for example, before `database update`):

```json
{"status":"Unhealthy","database":"Unavailable"}
```

Failure details are written only to the server log; responses never include connection strings, server names, or exception details.

Swagger UI is at `/swagger`; the OpenAPI document is at `/swagger/v1/swagger.json`. Both are available only in Development.

For HTTP-only local troubleshooting, use `--launch-profile http` and `http://localhost:5082/health`. With no HTTPS endpoint configured, redirection cannot occur and the middleware logs a warning. Prefer the HTTPS profile for normal development.

## Tests

`dotnet test backend/CarnelianAcademy.sln` runs integration tests in memory. Endpoint tests replace the database connectivity check or use a synthetic unreachable connection string, so no SQL Server is needed. One opt-in test checks the real local database (read-only) after migrations are applied:

```powershell
$env:CARNELIAN_LOCAL_SQL_TESTS = "1"
dotnet test backend/CarnelianAcademy.sln
Remove-Item Env:CARNELIAN_LOCAL_SQL_TESTS
```

Without the variable, that test is reported as skipped.

## Configuration and security

ASP.NET Core loads `appsettings.json`, then `appsettings.{Environment}.json`, user secrets (Development), environment variables, and command-line overrides. Launch profiles set Development locally; deployments should use Production. Production uses generic Problem Details for unhandled exceptions and HSTS; configure HTTPS endpoints/certificates for deployment. Restrict `AllowedHosts` to deployment hostnames before exposing the service beyond the local machine.

Do not put secrets, credentials, student data, or local certificates in source control. Use Windows authentication locally; if SQL authentication is ever required, store its credentials in user secrets or environment variables. Authentication and authorization policy design remain future work.

## Frontend

`frontend/carnelian-academy-web` is an independently buildable React single-page application. M01-T03 provides only the application shell (header, responsive sidebar, dashboard placeholder) and typed API configuration; it makes **no HTTP requests** and does not depend on a running backend. It is a development preview: no authentication, no real student or financial data, and no production deployment (D009; PPG-001 remains OPEN and BLOCKING).

| Component | Version |
| --- | --- |
| Node.js | 24.14.0 verified; supported range `^22.13.0` or `^24.0.0` (`engines` in package.json) |
| npm | 11.16.0 verified |
| React / React DOM | 19.3.1 |
| Vite / @vitejs/plugin-react | 8.3.8 / 6.3.0 |
| TypeScript | 6.0.3 (TypeScript 7 is not yet supported by typescript-eslint) |
| ESLint / typescript-eslint | 10.15.0 / 8.73.0 |
| Vitest / jsdom | 5.1.1 / 29.1.1 (jsdom 30+ requires Node 24.15 or later) |
| React Testing Library / jest-dom / user-event | 16.3.3 / 8.0.0 / 14.6.13 |

Setup and commands (run inside `frontend/carnelian-academy-web`):

```powershell
Set-Location frontend/carnelian-academy-web
npm install            # installs the versions locked in package-lock.json (use `npm ci` for a clean install)
npm run dev            # development server at http://localhost:5173 (fixed port; fails if 5173 is busy)
npm run lint           # ESLint with type-aware TypeScript rules
npm run test           # Vitest in watch mode
npm run test:run       # Vitest once, then exit
npm run build          # type-check (tsc -b) and production build to dist/
npm run preview        # serve the built dist/ locally
```

The dev server listens on localhost only. Stop it with Ctrl+C.

On Windows, run Vitest from a terminal whose working directory uses an upper-case drive letter (`C:\...`). If the current directory is reported as `c:\...` (as some VS Code terminals do), Vitest can load its runner twice and every suite fails with "failed to find the current suite" or "Cannot read properties of undefined (reading 'config')". Fix the current terminal with:

```powershell
Set-Location ($PWD.Path.Substring(0,1).ToUpper() + $PWD.Path.Substring(1))
```

### API base URL

The frontend reads the API location from `VITE_API_BASE_URL` through `src/config/env.ts`. Copy the example file and adjust it if your API runs elsewhere:

```powershell
Copy-Item .env.example .env.local
# .env.local (ignored by Git):
# VITE_API_BASE_URL=https://localhost:7159
```

The value must be an absolute `http` or `https` URL without credentials, query string, or fragment; a trailing slash is removed. It is validated when first used, with a clear `ConfigurationError` if it is missing or malformed. Every `VITE_` variable is embedded in the browser bundle, so never put tokens or secrets in it. No production address is configured. M01-T03 does not use the value yet; calling the API, and the backend CORS configuration that requires, belong to M01-T04.

See [architecture](docs/architecture.md), [decisions](docs/decisions.md), and [M01 status](docs/milestones/M01.md).


## M01-T02 status

Status: **COMPLETED — APPROVED FOR LOCAL DEVELOPMENT** (2026-11-20; final Code Guardian result PASS WITH WARNINGS). M01 remains in progress. Not approved for production: PPG-001 remains OPEN and BLOCKING.

- D008 remains approved: preserve the existing HTTP 503 `{"status":"Unhealthy","database":"Unavailable"}` contract. No endpoint changes were authorized or made.
- D009 is explicitly approved for development only under the restrictions above. PPG-001 stays open and blocking for production readiness.
- D010: the owner accepts the remaining deprecated transitive dependency risks for local development with synthetic/test data only. See the complete deprecated-package inventory and historical security remediation inventory in [decisions](docs/decisions.md). Deprecation is not a confirmed security vulnerability. Actual runtime usage and impact of Microsoft.Identity.Client, Azure.Identity, and related libraries remain unverified; investigate replacement or risk resolution before production. No package changes/overrides were made for this deferral. xUnit v3 migration is deferred as separate maintenance work.
- D006 (SQL Server Express / EF Core foundation) and D007 (explicit migrations, empty `InitialBaseline`) are **APPROVED — LOCAL DEVELOPMENT**.

Current regression results and runtime-resolution evidence are recorded in [M01 verification](docs/milestones/M01.md). No migration was created or applied during final remediation.
