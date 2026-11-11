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

Status: planned stack, implementation deferred.
SQL Server Express with EF Core and React + Vite + TypeScript remain the intended technologies. This task adds no EF packages, connection strings, migrations, frontend scaffolding, or business modules. Authentication design is also deferred.
