# Carnelian Academy

Local-first Enrollment & Billing Management System V1 for a preschool and elementary school of approximately 300 students.

## Current scope

M01-T01 provides the backend foundation only. Milestone M01 is **in progress**. Enrollment, billing, authentication, database access, and frontend code are not implemented.

## Structure

```text
backend/
  CarnelianAcademy.sln
  CarnelianAcademy.Api/       ASP.NET Core controllers, configuration, Swagger
  CarnelianAcademy.Tests/     xUnit integration tests using WebApplicationFactory
docs/
  architecture.md
  decisions.md
  milestones/M01.md
```

## Local setup (Windows / PowerShell)

Install the .NET 8 SDK and Git. Use a supported, patched .NET 8 SDK/runtime. VS Code with C# tooling is recommended. SQL Server Express and Node.js are intended for later tasks; neither is needed for this API.

From the repository root:

```powershell
dotnet restore backend/CarnelianAcademy.sln
dotnet build backend/CarnelianAcademy.sln --no-restore
dotnet test backend/CarnelianAcademy.sln --no-build
dotnet dev-certs https --trust
dotnet run --project backend/CarnelianAcademy.Api --launch-profile https
```

The HTTPS profile runs in Development at `https://localhost:7159` and `http://localhost:5082`. HTTP redirects to HTTPS. Stop the API with Ctrl+C.

In another PowerShell terminal:

```powershell
Invoke-RestMethod https://localhost:7159/health
Start-Process https://localhost:7159/swagger
```

`GET /health` is anonymous and returns HTTP 200 with:

```json
{"status":"Healthy","application":"Carnelian Academy API"}
```

Swagger UI is at `/swagger`; the OpenAPI document is at `/swagger/v1/swagger.json`. Both are available only in Development.

For HTTP-only local troubleshooting, use `--launch-profile http` and `http://localhost:5082/health`. With no HTTPS endpoint configured, redirection cannot occur and the middleware logs a warning. Prefer the HTTPS profile for normal development.

## Configuration and security

ASP.NET Core loads `appsettings.json`, then `appsettings.{Environment}.json`, environment variables, and command-line overrides. Launch profiles set Development locally; deployments should use Production. Production uses generic Problem Details for unhandled exceptions and HSTS; configure HTTPS endpoints/certificates for deployment. Restrict `AllowedHosts` to deployment hostnames before exposing the service beyond the local machine.

Do not put secrets, credentials, student data, or local certificates in source control. No connection string or database is needed yet. Use environment variables or .NET user secrets for future local secrets. Authentication and authorization policy design remain future work.

See [architecture](docs/architecture.md), [decisions](docs/decisions.md), and [M01 status](docs/milestones/M01.md).
