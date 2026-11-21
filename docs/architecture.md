# Architecture

## Scope

V1 is a local-first school management application for approximately 300 students. Its planned modules are Student Information and Enrollment Management, and Billing and Collections Management. M01-T01 established a running API and integration testing infrastructure. M01-T02 adds the database foundation without business entities.

## Backend

A single ASP.NET Core Web API targets .NET 8 and uses C# with nullable reference types and implicit usings. The application composition root is Program.cs. Built-in dependency injection registers controllers, endpoint discovery, Swagger generation, Problem Details, the EF Core DbContext, and the database connectivity check. Controllers own REST/JSON routes; no extra service/repository layers are introduced without business requirements.

HealthController exposes anonymous GET /health and returns a typed response. This is a process health check with no I/O and no database dependency; it returns synchronously. GET /health/database is a separate anonymous endpoint that performs a real database connectivity check asynchronously with the request cancellation token. It returns HTTP 200 `{"status":"Healthy","database":"Connected"}` or HTTP 503 `{"status":"Unhealthy","database":"Unavailable"}`.

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

## Deferred components

Domain models, business tables, enrollment, billing, payments, authentication, and a React + Vite + TypeScript frontend are deferred. Keep the initial single-API structure until real module requirements justify further separation.


## Development exception and production gate

D008 is owner-approved; the existing 503 `{"status":"Unhealthy","database":"Unavailable"}` contract is unchanged. D009 is explicitly **APPROVED: DEVELOPMENT ONLY**: local machines, synthetic/test data, no production deployment, and no real student or payment records. .NET 8 is unsupported; its final servicing patch does not restore support. Migration to a supported LTS .NET runtime is mandatory before production. **PPG-001 remains OPEN and BLOCKING for production readiness.**

D010 records the owner's development-only acceptance of deprecated transitive dependency risks, with the complete deprecated-package inventory. Actual use and impact of Microsoft.Identity.Client, Azure.Identity, and related dependencies are unverified; Windows authentication does not establish non-use. Investigate and reconsider replacement or risk resolution before production. xUnit v3 migration is separate maintenance work. D006 (SQL Server Express / EF Core foundation) and D007 (explicit migrations with the empty `InitialBaseline`) are **APPROVED — LOCAL DEVELOPMENT**.


Final local verification (2026-11-19) selected the side-by-side x64 SDK 8.0.428 and Microsoft.NETCore.App / Microsoft.AspNetCore.App 8.0.34 at `%LOCALAPPDATA%\Microsoft\CarnelianDotnet8`; global EF CLI is 8.0.34. Host traces and loaded API modules verify runtime selection. Existing installations and persistent machine configuration were preserved; README documents the required session PATH/DOTNET_ROOT setup. The full suite passed (17 + 1 opt-in skip by default; all 18 with local SQL enabled), package advisory scans report no known vulnerabilities, and the baseline/model/schema remain unchanged. These results do not resolve unsupported-platform or deprecated-package risks. M01-T02 is **COMPLETED — APPROVED FOR LOCAL DEVELOPMENT** (final Code Guardian result: PASS WITH WARNINGS); production remains blocked by PPG-001. Complete evidence is in the milestone record.
