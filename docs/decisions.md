# Architecture decisions

## D001 - .NET 8 controller-based API

Status: accepted for M01-T01.
Use ASP.NET Core Web API with controllers, built-in DI, nullable reference types, and environment-specific configuration. This matches the agreed stack and gives future endpoints a consistent location without adding speculative layers.

## D002 - One backend solution, two projects

Status: accepted for M01-T01.
Keep the API and xUnit integration tests in backend/CarnelianAcademy.sln. WebApplicationFactory exercises HTTP behavior in memory and does not need a running database. A public partial Program exposes the entry point to the test host.

## D003 - Development-only Swagger

Status: accepted for M01-T01.
Use Swashbuckle for OpenAPI and Swagger UI in Development. Hide documentation outside Development. Use built-in Problem Details and exception handling in non-development environments to avoid exposing exception details.

## D004 - Anonymous process health

Status: accepted for M01-T01.
GET /health returns the specified status/application JSON without authentication. It checks that the API is responding, not database readiness. Do not introduce database dependencies for this endpoint.

## D005 - Defer persistence and frontend

Status: persistence portion superseded by D006 (M01-T02); frontend still deferred.
SQL Server Express with EF Core and React + Vite + TypeScript remain the intended technologies. M01-T01 added no EF packages, connection strings, migrations, frontend scaffolding, or business modules. Authentication design is also deferred.

## D006 - EF Core 8 with SQL Server Express

Status: **APPROVED — LOCAL DEVELOPMENT** (repository owner; recorded 2026-11-20 at M01-T02 closure). The SQL Server Express and EF Core database foundation is accepted for local development. Production use remains blocked by PPG-001 (D009).
Use EF Core 8.0.34 (`Microsoft.EntityFrameworkCore.SqlServer`, plus `Microsoft.EntityFrameworkCore.Design` as a private development-time asset); `Microsoft.EntityFrameworkCore.Tools` is not needed. M01-T02 initially used 8.0.10 to match the installed CLI; it was updated to the latest EF Core 8 patch, 8.0.34, during security remediation (D010). The global `dotnet-ef` CLI was 8.0.10 before final remediation; the verified final tool inventory is recorded below. A single `CarnelianAcademyDbContext` with no business entities is registered through DI. The connection string `CarnelianAcademyDatabase` is required and validated at startup; Development uses `.\SQLEXPRESS` with Windows authentication and no stored credentials.

## D007 - Explicit migrations with an empty baseline

Status: **APPROVED — LOCAL DEVELOPMENT** (repository owner; recorded 2026-11-20 at M01-T02 closure). Explicit EF Core migrations and the empty `InitialBaseline` migration (`20261119153726_InitialBaseline`) are accepted; preserve the migration history.
Migrations are applied only by explicit `dotnet ef database update` after verifying the target; never automatically at startup. `InitialBaseline` is intentionally empty and records the starting point in `__EFMigrationsHistory`. Placeholder business tables are not created.

## D008 - Separate database health endpoint

Status: **approved by the owner (2026-11-19)**, including the 503 response body.
GET /health stays a database-independent process check (D004). GET /health/database performs a real `CanConnectAsync()` check through `IDatabaseConnectivityCheck`, returning 200 `{"status":"Healthy","database":"Connected"}` or 503. The 503 body `{"status":"Unhealthy","database":"Unavailable"}` was proposed by the developer, because the original task did not specify one, and was approved by the owner; it mirrors the success shape and discloses no details. Failure details are logged server-side only. The endpoint is anonymous like /health; restricting it is part of future authentication design. Request cancellation is propagated as `OperationCanceledException`, not reported as 503 (see architecture, Persistence).

## D009 - Temporary .NET 8 development exception

Status: **APPROVED: DEVELOPMENT ONLY** (explicit owner confirmation recorded 2026-11-19). PPG-001 remains **OPEN and BLOCKING for production readiness**.

Context: Microsoft support for .NET 8 (LTS) ended on 10 November 2026. .NET 8 runtimes and EF Core 8 packages no longer receive security fixes. Before final remediation, the active machine-wide x64 host was 8.0.8 with Microsoft.NETCore.App 8.0.3/8.0.8 and Microsoft.AspNetCore.App 8.0.3. See the final remediation inventory below; patching does not restore platform support.

Exception terms:

- Continued use of .NET 8 (`net8.0`) and EF Core 8 is restricted to local development on developer machines.
- Only synthetic or test data may be used. No real student, guardian, enrollment, billing, or payment records may be stored or processed while the exception applies.
- The application must not be deployed to production, a shared server, or any network-exposed environment under this exception.
- Before production deployment or processing any real student/payment records, the solution must move to a supported LTS .NET version with compatible EF Core, ASP.NET Core, Swashbuckle, and test packages, and the regression testing below must pass. This is open pre-production gate **PPG-001** in `docs/milestones/M01.md`.
- Until then, use the latest available .NET 8 SDK/runtime patch locally.

Original dependency advisory review (2026-11-19, before remediation; `dotnet list package --vulnerable --include-transitive` against nuget.org). These advisories were remediated by D010:

| Package (transitive) | Resolved | Severity | Advisories | Introduced by | Projects |
| --- | --- | --- | --- | --- | --- |
| System.Formats.Asn1 | 5.0.0 | High | GHSA-447r-wph3-92pm | System.Security.Cryptography.Cng 5.0.0 ← Microsoft.Data.SqlClient 5.1.5 ← EF Core SqlServer 8.0.10 | Api, Tests |
| Azure.Identity | 1.10.3 | Moderate | GHSA-wvxc-855f-jvrv, GHSA-m5vv-6r4h-3vj9 | Microsoft.Data.SqlClient 5.1.5 | Api, Tests |
| Microsoft.Identity.Client | 4.56.0 | Low / Moderate | GHSA-x674-v45j-fwxw, GHSA-m5vv-6r4h-3vj9 | Microsoft.Data.SqlClient 5.1.5, Azure.Identity 1.10.3 | Api, Tests |
| System.Net.Http | 4.3.0 | High | GHSA-7jgj-8wvc-jh57 | NETStandard.Library 1.6.1 ← xunit 2.5.3 (pre-existing since M01-T01) | Tests only |
| System.Text.RegularExpressions | 4.3.0 | High | GHSA-cmhx-cq75-c4mj | NETStandard.Library 1.6.1 ← xunit 2.5.3 (pre-existing since M01-T01) | Tests only |

The scan covers NuGet packages only, not the installed .NET runtime. Each advisory's exploitability in this application was not assessed.

Required before closing PPG-001: target a supported LTS .NET version; update EF Core and all packages to compatible supported versions; rerun the vulnerability scan with no unresolved High advisories (or documented owner disposition); regenerate or verify the EF migration snapshot; run the full automated suite, the opt-in local SQL Server test, and the live health endpoint checks; update documentation; obtain independent Code Guardian review.

## D010 - M01-T02 NuGet security remediation

Status: prior package security remediation implemented 2026-11-19; final independent Code Guardian review result (2026-11-20): PASS WITH WARNINGS. **Deprecated dependency deferral: RISK ACCEPTED FOR DEVELOPMENT** by the repository owner (2026-11-19). This explicit approval covers the development-only deprecation deferral; it does not invent approval of other pending decisions.

Remediation updated direct dependencies only, within their current major versions, and stays on .NET 8. No direct references were added to override transitive packages.

| Direct package | Project | Before | After | Reason |
| --- | --- | --- | --- | --- |
| Microsoft.EntityFrameworkCore.SqlServer | Api | 8.0.10 | 8.0.34 | Latest EF Core 8 patch. Brings Microsoft.Data.SqlClient 5.1.9 (from 5.1.5) and declares System.Formats.Asn1 8.0.2 directly. |
| Microsoft.EntityFrameworkCore.Design | Api | 8.0.10 | 8.0.34 | Kept consistent with the SqlServer provider. |
| xunit | Tests | 2.5.3 | 2.9.3 | Same major version. No longer depends on NETStandard.Library 1.6.1. |

Resulting transitive resolution (from `obj/project.assets.json`):

| Previously vulnerable package | Before | After | Why |
| --- | --- | --- | --- |
| System.Formats.Asn1 | 5.0.0 | 8.0.2 | Declared directly by EF Core SqlServer 8.0.34. |
| Azure.Identity | 1.10.3 | 1.12.1 | Via Microsoft.Data.SqlClient 5.1.9. |
| Microsoft.Identity.Client | 4.56.0 | 4.76.0 | Via Microsoft.Data.SqlClient 5.1.9 and Azure.Identity 1.12.1. |
| System.Net.Http | 4.3.0 | not in graph | NETStandard.Library 1.6.1 no longer referenced by xunit 2.9.3. |
| System.Text.RegularExpressions | 4.3.0 | not in graph | Same as above. |

Post-remediation `dotnet list package --vulnerable --include-transitive` (nuget.org, 2026-11-19): no vulnerable packages in either project. A clean scan means no *known* advisory matched at scan time; it does not establish that the application is secure.

Remaining risks:

- **Unsupported platform:** .NET 8 and EF Core 8 are out of support (D009); future vulnerabilities will not be patched. The pre-remediation runtime was older than the 8.0.34 packages; the final runtime inventory is recorded below. PPG-001 remains **OPEN and BLOCKING for production readiness** even after patching.
- **Deprecated transitive packages:** the complete reported deprecated-package inventory is retained below. Microsoft.Identity.Client (`CriticalBugs`), Azure.Identity, Microsoft.Identity.Client.Extensions.Msal, and the related token/JSON dependencies retain security and maintenance risks. Actual runtime usage and possible impact remain **unverified**; Windows authentication is not evidence that these libraries are unused. Deprecation is not itself a confirmed security vulnerability. The owner accepts this risk for local development with synthetic/test data only; no production deployment or real student/payment records are permitted. Investigate usage, compatibility, and replacement/risk resolution before production under PPG-001. No dependency version overrides or package changes are authorized for T02-004.
- **Legacy test framework:** xunit 2.9.3 and its deprecated transitive components remain test-only. xUnit v3 migration is deferred as a separate maintenance item; it requires its own approved task and regression verification.
- **Tooling mismatch:** pre-remediation global `dotnet-ef` was 8.0.10; see the final verified inventory below.
- Not covered: exploitability analysis, runtime-level vulnerabilities, SQL Server Express patch level, and application-level security testing.


### Complete deprecated-package inventory (2026-11-19)

From `dotnet list package --deprecated --include-transitive`. This inventory records deprecation metadata, not confirmed exploitability. All entries are transitive unless marked direct. API = CarnelianAcademy.Api; Tests = CarnelianAcademy.Tests.

| Package | Resolved version | Deprecation reason | Projects |
| --- | --- | --- | --- |
| Azure.Identity | 1.12.1 | Other | API, Tests |
| Microsoft.Identity.Client | 4.76.0 | CriticalBugs | API, Tests |
| Microsoft.Identity.Client.Extensions.Msal | 4.65.0 | Other | API, Tests |
| Microsoft.IdentityModel.Abstractions | 6.35.0 | Legacy | API, Tests |
| Microsoft.IdentityModel.JsonWebTokens | 6.35.0 | Legacy | API, Tests |
| Microsoft.IdentityModel.Logging | 6.35.0 | Legacy | API, Tests |
| Microsoft.IdentityModel.Protocols | 6.35.0 | Legacy | API, Tests |
| Microsoft.IdentityModel.Protocols.OpenIdConnect | 6.35.0 | Legacy | API, Tests |
| Microsoft.IdentityModel.Tokens | 6.35.0 | Legacy | API, Tests |
| System.Collections.Immutable | 6.0.0 | Legacy | API only (Tests resolves a different version) |
| System.IdentityModel.Tokens.Jwt | 6.35.0 | Legacy | API, Tests |
| System.Text.Json | 4.7.2 | Legacy | API, Tests |
| xunit (direct) | 2.9.3 | Legacy | Tests |
| xunit.assert | 2.9.3 | Legacy | Tests |
| xunit.core | 2.9.3 | Legacy | Tests |
| xunit.extensibility.core | 2.9.3 | Legacy | Tests |
| xunit.extensibility.execution | 2.9.3 | Legacy | Tests |

D008 remains **APPROVED**: keep HTTP 503 with exactly `{"status":"Unhealthy","database":"Unavailable"}`. No endpoint contract changes are authorized.

D009 owner decision: temporary .NET 8 use is approved for local development only, synthetic/test data only, with no production deployment and no handling of real student/payment records. Migration to a supported LTS .NET runtime is mandatory before production. **PPG-001: OPEN and BLOCKING for production readiness.**

D010 owner decision: deprecated transitive dependency remediation is deferred for development only. Preserve the inventory and security/maintenance risks; investigate actual runtime usage and replacement/risk resolution before production. Do not override versions merely to clear warnings. xUnit v3 remains separate maintenance work.

D006 and D007 were later explicitly **APPROVED — LOCAL DEVELOPMENT** by the repository owner (recorded 2026-11-20, M01-T02 closure). Their technical content is unchanged.


### Final development environment inventory (2026-11-19; T02-003)

Source: [official Microsoft .NET 8 download information](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) and [release metadata](https://builds.dotnet.microsoft.com/dotnet/release-metadata/8.0/releases.json). Final servicing release: 8.0.34, released 2026-11-10; .NET 8 end of support: 2026-11-10. This remains an unsupported platform.

| Component | Before | After |
| --- | --- | --- |
| Active x64 SDK | 8.0.202, machine-wide | 8.0.428, explicitly selected user-local installation |
| Active x64 host | 8.0.8 | 8.0.34 |
| Microsoft.NETCore.App | 8.0.3, 8.0.8 in machine-wide root | Old versions retained; 8.0.34 added in user-local root |
| Microsoft.AspNetCore.App | 8.0.3 in machine-wide root | Old version retained; 8.0.34 added in user-local root |
| Microsoft.WindowsDesktop.App | 8.0.3, 8.0.8 in machine-wide root | Old versions retained; 8.0.34 added with Windows SDK ZIP |
| Global dotnet-ef | 8.0.10 (active; no local tool) | 8.0.34 (verified active; no local tool) |

Installed location: `%LOCALAPPDATA%\Microsoft\CarnelianDotnet8`. Official x64 ZIP: `https://builds.dotnet.microsoft.com/dotnet/Sdk/8.0.428/dotnet-sdk-8.0.428-win-x64.zip`. Its SHA-512 matched Microsoft release metadata before extraction/execution:

```text
cce1dc5cfb2c5b73ddd9d3658f6009deb85be3a58dbec44a6dfe3910bb32b044ad2fc6bb28c77aded70c73270a204d207fe790dcb82ffca6c7b42c1335b51c21
```

No installer, elevation, reboot, uninstall, or machine-wide environment change was required. No .NET 10/11 was installed. The pre-existing separate user-local SDK 10.0.404 / runtimes 10.0.15 and the machine-wide .NET 8 installation were preserved. PATH and DOTNET_ROOT selection is per-process/per-terminal; the default machine-wide SDK is still old. Follow README's terminal setup before future builds/tests/launches. TargetFramework remains net8.0.

Global tool update: `dotnet tool update --global dotnet-ef --version 8.0.34`; `dotnet ef --version` verified 8.0.34 under the patched installation.

Runtime selection was verified with COREHOST_TRACE for the testhost and API: both resolved Microsoft.NETCore.App and Microsoft.AspNetCore.App from the new 8.0.34 root. Loaded API process modules independently confirmed coreclr.dll and ASP.NET Core from that root. Trace files, package inventory JSON, build outputs, and the verified downloaded ZIP are ignored artifacts under backend project obj/bin directories.

Final NuGet advisory scan (2026-11-19, nuget.org, transitive packages included): **no known vulnerabilities reported for either project**. This is package advisory matching at scan time, not a runtime/application security certification. T02-004 is development-only risk acceptance, not elimination of deprecated-package risks; no package versions were changed during final closure. Investigation and replacement/risk resolution remain required before production. PPG-001 remains **OPEN and BLOCKING**.


<details>
<summary>Complete resolved direct and transitive package inventory at final closure (2026-11-19)</summary>

Generated from `dotnet list backend/CarnelianAcademy.sln package --include-transitive --format json` after restore with SDK 8.0.428. A dash means the package is absent from that project. Deprecation reasons are retained in the separate complete deprecated-package table above.

| Package | API | Tests |
| --- | --- | --- |
| Azure.Core | 1.41.0 (transitive) | 1.41.0 (transitive) |
| Azure.Identity | 1.12.1 (transitive) | 1.12.1 (transitive) |
| coverlet.collector | - | 6.0.0 (direct) |
| Humanizer.Core | 2.14.1 (transitive) | - |
| Microsoft.AspNetCore.Mvc.Testing | - | 8.0.34 (direct) |
| Microsoft.AspNetCore.TestHost | - | 8.0.34 (transitive) |
| Microsoft.Bcl.AsyncInterfaces | 6.0.0 (transitive) | 1.1.1 (transitive) |
| Microsoft.CodeAnalysis.Analyzers | 3.3.3 (transitive) | - |
| Microsoft.CodeAnalysis.Common | 4.5.0 (transitive) | - |
| Microsoft.CodeAnalysis.CSharp | 4.5.0 (transitive) | - |
| Microsoft.CodeAnalysis.CSharp.Workspaces | 4.5.0 (transitive) | - |
| Microsoft.CodeAnalysis.Workspaces.Common | 4.5.0 (transitive) | - |
| Microsoft.CodeCoverage | - | 17.8.0 (transitive) |
| Microsoft.CSharp | 4.5.0 (transitive) | 4.5.0 (transitive) |
| Microsoft.Data.SqlClient | 5.1.9 (transitive) | 5.1.9 (transitive) |
| Microsoft.Data.SqlClient.SNI.runtime | 5.1.2 (transitive) | 5.1.2 (transitive) |
| Microsoft.EntityFrameworkCore | 8.0.34 (transitive) | 8.0.34 (transitive) |
| Microsoft.EntityFrameworkCore.Abstractions | 8.0.34 (transitive) | 8.0.34 (transitive) |
| Microsoft.EntityFrameworkCore.Analyzers | 8.0.34 (transitive) | 8.0.34 (transitive) |
| Microsoft.EntityFrameworkCore.Design | 8.0.34 (direct) | - |
| Microsoft.EntityFrameworkCore.Relational | 8.0.34 (transitive) | 8.0.34 (transitive) |
| Microsoft.EntityFrameworkCore.SqlServer | 8.0.34 (direct) | 8.0.34 (transitive) |
| Microsoft.Extensions.ApiDescription.Server | 6.0.5 (transitive) | 6.0.5 (transitive) |
| Microsoft.Extensions.Caching.Abstractions | 8.0.0 (transitive) | 8.0.0 (transitive) |
| Microsoft.Extensions.Caching.Memory | 8.0.1 (transitive) | 8.0.1 (transitive) |
| Microsoft.Extensions.Configuration | - | 8.0.0 (transitive) |
| Microsoft.Extensions.Configuration.Abstractions | 8.0.0 (transitive) | 8.0.0 (transitive) |
| Microsoft.Extensions.Configuration.Binder | - | 8.0.2 (transitive) |
| Microsoft.Extensions.Configuration.CommandLine | - | 8.0.0 (transitive) |
| Microsoft.Extensions.Configuration.EnvironmentVariables | - | 8.0.0 (transitive) |
| Microsoft.Extensions.Configuration.FileExtensions | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Configuration.Json | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Configuration.UserSecrets | - | 8.0.1 (transitive) |
| Microsoft.Extensions.DependencyInjection | 8.0.1 (transitive) | 8.0.1 (transitive) |
| Microsoft.Extensions.DependencyInjection.Abstractions | 8.0.2 (transitive) | 8.0.2 (transitive) |
| Microsoft.Extensions.DependencyModel | 8.0.2 (transitive) | 8.0.2 (transitive) |
| Microsoft.Extensions.Diagnostics | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Diagnostics.Abstractions | - | 8.0.1 (transitive) |
| Microsoft.Extensions.FileProviders.Abstractions | - | 8.0.0 (transitive) |
| Microsoft.Extensions.FileProviders.Physical | - | 8.0.0 (transitive) |
| Microsoft.Extensions.FileSystemGlobbing | - | 8.0.0 (transitive) |
| Microsoft.Extensions.Hosting | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Hosting.Abstractions | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Logging | 8.0.1 (transitive) | 8.0.1 (transitive) |
| Microsoft.Extensions.Logging.Abstractions | 8.0.2 (transitive) | 8.0.2 (transitive) |
| Microsoft.Extensions.Logging.Configuration | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Logging.Console | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Logging.Debug | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Logging.EventLog | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Logging.EventSource | - | 8.0.1 (transitive) |
| Microsoft.Extensions.Options | 8.0.2 (transitive) | 8.0.2 (transitive) |
| Microsoft.Extensions.Options.ConfigurationExtensions | - | 8.0.0 (transitive) |
| Microsoft.Extensions.Primitives | 8.0.0 (transitive) | 8.0.0 (transitive) |
| Microsoft.Identity.Client | 4.76.0 (transitive) | 4.76.0 (transitive) |
| Microsoft.Identity.Client.Extensions.Msal | 4.65.0 (transitive) | 4.65.0 (transitive) |
| Microsoft.IdentityModel.Abstractions | 6.35.0 (transitive) | 6.35.0 (transitive) |
| Microsoft.IdentityModel.JsonWebTokens | 6.35.0 (transitive) | 6.35.0 (transitive) |
| Microsoft.IdentityModel.Logging | 6.35.0 (transitive) | 6.35.0 (transitive) |
| Microsoft.IdentityModel.Protocols | 6.35.0 (transitive) | 6.35.0 (transitive) |
| Microsoft.IdentityModel.Protocols.OpenIdConnect | 6.35.0 (transitive) | 6.35.0 (transitive) |
| Microsoft.IdentityModel.Tokens | 6.35.0 (transitive) | 6.35.0 (transitive) |
| Microsoft.NET.Test.Sdk | - | 17.8.0 (direct) |
| Microsoft.NETCore.Platforms | 1.1.0 (transitive) | 1.1.0 (transitive) |
| Microsoft.NETCore.Targets | 1.1.0 (transitive) | 1.1.0 (transitive) |
| Microsoft.OpenApi | 1.6.14 (transitive) | 1.6.14 (transitive) |
| Microsoft.SqlServer.Server | 1.0.0 (transitive) | 1.0.0 (transitive) |
| Microsoft.TestPlatform.ObjectModel | - | 17.8.0 (transitive) |
| Microsoft.TestPlatform.TestHost | - | 17.8.0 (transitive) |
| Microsoft.Win32.SystemEvents | 6.0.0 (transitive) | 6.0.0 (transitive) |
| Mono.TextTemplating | 2.2.1 (transitive) | - |
| Newtonsoft.Json | - | 13.0.1 (transitive) |
| NuGet.Frameworks | - | 6.5.0 (transitive) |
| Swashbuckle.AspNetCore | 6.6.2 (direct) | 6.6.2 (transitive) |
| Swashbuckle.AspNetCore.Swagger | 6.6.2 (transitive) | 6.6.2 (transitive) |
| Swashbuckle.AspNetCore.SwaggerGen | 6.6.2 (transitive) | 6.6.2 (transitive) |
| Swashbuckle.AspNetCore.SwaggerUI | 6.6.2 (transitive) | 6.6.2 (transitive) |
| System.ClientModel | 1.0.0 (transitive) | 1.0.0 (transitive) |
| System.CodeDom | 4.4.0 (transitive) | - |
| System.Collections.Immutable | 6.0.0 (transitive) | - |
| System.Composition | 6.0.0 (transitive) | - |
| System.Composition.AttributedModel | 6.0.0 (transitive) | - |
| System.Composition.Convention | 6.0.0 (transitive) | - |
| System.Composition.Hosting | 6.0.0 (transitive) | - |
| System.Composition.Runtime | 6.0.0 (transitive) | - |
| System.Composition.TypedParts | 6.0.0 (transitive) | - |
| System.Configuration.ConfigurationManager | 6.0.1 (transitive) | 6.0.1 (transitive) |
| System.Diagnostics.DiagnosticSource | 6.0.1 (transitive) | 6.0.1 (transitive) |
| System.Diagnostics.EventLog | - | 8.0.1 (transitive) |
| System.Drawing.Common | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Formats.Asn1 | 8.0.2 (transitive) | 8.0.2 (transitive) |
| System.IdentityModel.Tokens.Jwt | 6.35.0 (transitive) | 6.35.0 (transitive) |
| System.IO.Pipelines | 6.0.3 (transitive) | 8.0.0 (transitive) |
| System.Memory | 4.5.4 (transitive) | 4.5.4 (transitive) |
| System.Memory.Data | 1.0.2 (transitive) | 1.0.2 (transitive) |
| System.Numerics.Vectors | 4.5.0 (transitive) | 4.5.0 (transitive) |
| System.Reflection.Metadata | 6.0.1 (transitive) | 1.6.0 (transitive) |
| System.Runtime | 4.3.0 (transitive) | 4.3.0 (transitive) |
| System.Runtime.Caching | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Runtime.CompilerServices.Unsafe | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Security.AccessControl | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Security.Cryptography.Cng | 4.5.0 (transitive) | 4.5.0 (transitive) |
| System.Security.Cryptography.ProtectedData | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Security.Permissions | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Security.Principal.Windows | 5.0.0 (transitive) | 5.0.0 (transitive) |
| System.Text.Encoding | 4.3.0 (transitive) | 4.3.0 (transitive) |
| System.Text.Encoding.CodePages | 6.0.0 (transitive) | 6.0.0 (transitive) |
| System.Text.Encodings.Web | 4.7.2 (transitive) | 4.7.2 (transitive) |
| System.Text.Json | 4.7.2 (transitive) | 4.7.2 (transitive) |
| System.Threading.Channels | 6.0.0 (transitive) | - |
| System.Threading.Tasks.Extensions | 4.5.4 (transitive) | 4.5.4 (transitive) |
| System.Windows.Extensions | 6.0.0 (transitive) | 6.0.0 (transitive) |
| xunit | - | 2.9.3 (direct) |
| xunit.abstractions | - | 2.0.3 (transitive) |
| xunit.analyzers | - | 1.18.0 (transitive) |
| xunit.assert | - | 2.9.3 (transitive) |
| xunit.core | - | 2.9.3 (transitive) |
| xunit.extensibility.core | - | 2.9.3 (transitive) |
| xunit.extensibility.execution | - | 2.9.3 (transitive) |
| xunit.runner.visualstudio | - | 2.5.3 (direct) |

</details>
