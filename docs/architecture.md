# Architecture

## Scope

V1 is a local-first school management application for approximately 300 students. Its planned modules are Student Information and Enrollment Management, and Billing and Collections Management. M01-T01 establishes only a running API and integration testing infrastructure.

## Backend

A single ASP.NET Core Web API targets .NET 8 and uses C# with nullable reference types and implicit usings. The application composition root is Program.cs. Built-in dependency injection registers controllers, endpoint discovery, Swagger generation, and Problem Details. Controllers own REST/JSON routes; no extra service/repository layers are introduced without business requirements.

HealthController exposes anonymous GET /health and returns a typed response. This is a process health check, not a database or dependency readiness check. It performs no I/O and therefore returns synchronously; integration tests use async HTTP and body reads. Future I/O endpoints should use async/await with cancellation tokens.

Configuration follows standard environment-specific ASP.NET Core precedence. Swagger UI and OpenAPI are registered in the middleware pipeline only in Development. Other environments use exception handling with generic Problem Details and HSTS. HTTPS redirection is enabled; local launch profiles provide an HTTPS endpoint. Production requires a configured certificate and deployment-specific host restrictions.

## Verification

The separate xUnit project references the API and uses WebApplicationFactory with its in-memory TestServer. Health tests exercise the real middleware/controller pipeline without authentication in Development and Production. These tests need no SQL Server or external service.

## Deferred components

SQL Server Express with EF Core, migrations, domain models, enrollment, billing, authentication, and a React + Vite + TypeScript frontend are deferred. There is no database or frontend implementation in this foundation. Keep the initial single-API structure until real module requirements justify further separation.
