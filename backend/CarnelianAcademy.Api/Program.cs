using CarnelianAcademy.Api.Data;
using Microsoft.EntityFrameworkCore;

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

var app = builder.Build();

// Fail fast at startup with a clear message instead of on the first database request.
GetRequiredConnectionString(app.Configuration);

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
