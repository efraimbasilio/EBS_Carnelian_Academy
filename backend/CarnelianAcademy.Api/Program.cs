using CarnelianAcademy.Api.Configuration;
using CarnelianAcademy.Api.Data;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

const string DatabaseConnectionStringName = "CarnelianAcademyDatabase";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

// The connection string is resolved when the context is created so that configuration
// supplied by hosts (including test hosts) after builder creation is honored.
builder.Services.AddDbContext<CarnelianAcademyDbContext>((services, options) =>
    options.UseSqlServer(GetRequiredConnectionString(services.GetRequiredService<IConfiguration>())));
builder.Services.AddScoped<IDatabaseConnectivityCheck, EfCoreDatabaseConnectivityCheck>();

// Development only: allow the configured local frontend origin(s) to make simple GET requests.
// No credentials or wildcard origins. The named policy exists only in Development.
// Origins are resolved from configuration when the options are created, like the connection string.
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors();
    builder.Services.AddOptions<CorsOptions>().Configure<IConfiguration>((options, configuration) =>
        options.AddPolicy(DevelopmentCors.PolicyName, policy => policy
            .WithOrigins(DevelopmentCors.GetAllowedOrigins(configuration))
            .WithMethods(HttpMethods.Get)));
}

var app = builder.Build();

// Fail fast at startup with a clear message instead of on the first database request.
GetRequiredConnectionString(app.Configuration);
if (app.Environment.IsDevelopment())
{
    DevelopmentCors.GetAllowedOrigins(app.Configuration);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseHttpsRedirection();

if (app.Environment.IsDevelopment())
{
    app.UseWhen(context =>
        HttpMethods.IsGet(context.Request.Method)
        || (HttpMethods.IsOptions(context.Request.Method)
            && context.Request.Headers.ContainsKey(HeaderNames.Origin)
            && HttpMethods.IsGet(context.Request.Headers[HeaderNames.AccessControlRequestMethod].ToString())),
        branch => branch.UseCors(DevelopmentCors.PolicyName));
}

app.MapControllers();
app.Run();

static string GetRequiredConnectionString(IConfiguration configuration)
{
    var connectionString = configuration.GetConnectionString(DatabaseConnectionStringName);
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            $"Connection string 'ConnectionStrings:{DatabaseConnectionStringName}' is not configured. " +
            "Set it in appsettings.{Environment}.json, user secrets, or the " +
            $"'ConnectionStrings__{DatabaseConnectionStringName}' environment variable.");
    }

    return connectionString;
}

// Makes the top-level entry point accessible to WebApplicationFactory.
public partial class Program { }
