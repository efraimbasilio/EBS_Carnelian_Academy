using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CarnelianAcademy.Tests;

/// <summary>Creates in-memory API hosts for integration tests.</summary>
internal static class TestHost
{
    /// <summary>
    /// Synthetic connection string that points at a closed local port. It contains no credentials
    /// and fails quickly, so tests never reach a real SQL Server instance.
    /// </summary>
    public const string UnreachableConnectionString =
        "Server=tcp:127.0.0.1,1;Database=CarnelianAcademy_TestUnreachable;Integrated Security=True;" +
        "TrustServerCertificate=True;Connect Timeout=2;";

    /// <param name="environment">ASP.NET Core environment name.</param>
    /// <param name="connectionString">
    /// Value for <c>ConnectionStrings:CarnelianAcademyDatabase</c>. Pass <c>null</c> to keep the
    /// application's own configuration (for example appsettings.Development.json).
    /// </param>
    /// <param name="configureTestServices">Optional service replacements applied after the application's registrations.</param>
    /// <param name="configuration">Optional extra in-memory configuration values, applied last.</param>
    public static WebApplicationFactory<Program> Create(
        string environment,
        string? connectionString = UnreachableConnectionString,
        Action<IServiceCollection>? configureTestServices = null,
        IReadOnlyDictionary<string, string?>? configuration = null)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);

            if (connectionString is not null)
            {
                builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                    configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:CarnelianAcademyDatabase"] = connectionString
                    }));
            }

            if (configuration is not null)
            {
                builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                    configurationBuilder.AddInMemoryCollection(configuration));
            }

            if (configureTestServices is not null)
            {
                builder.ConfigureTestServices(configureTestServices);
            }
        });
    }

    public static HttpClient CreateHttpsClient(this WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
}
