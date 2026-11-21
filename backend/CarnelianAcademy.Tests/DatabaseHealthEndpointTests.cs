using System.Net;
using System.Text.Json;
using CarnelianAcademy.Api.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CarnelianAcademy.Tests;

public class DatabaseHealthEndpointTests
{
    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task GetDatabaseHealth_Returns200_WhenDatabaseIsReachable(string environment)
    {
        await using var factory = TestHost.Create(environment, configureTestServices: UseStubCheck(canConnect: true));
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync("/health/database");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await AssertExactBody(response, "Healthy", "Connected");
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task GetDatabaseHealth_Returns503_WhenDatabaseIsUnreachable(string environment)
    {
        await using var factory = TestHost.Create(environment, configureTestServices: UseStubCheck(canConnect: false));
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync("/health/database");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        await AssertExactBody(response, "Unhealthy", "Unavailable");
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task GetDatabaseHealth_WithRealEfCoreCheck_Returns503WithoutSensitiveDetails(string environment)
    {
        // Uses the real EF Core check against a closed local port, so a genuine SqlException is raised and handled.
        await using var factory = TestHost.Create(environment, TestHost.UnreachableConnectionString);
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync("/health/database");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        await AssertExactBody(response, "Unhealthy", "Unavailable");
        foreach (var sensitive in new[]
                 {
                     "127.0.0.1", "CarnelianAcademy_TestUnreachable", "Server=", "Database=", "Integrated Security",
                     "SqlException", "Exception", "Microsoft.Data", " at ", "stack"
                 })
        {
            Assert.DoesNotContain(sensitive, body, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void Startup_FailsClearly_WhenConnectionStringIsMissing()
    {
        using var factory = TestHost.Create("Production", connectionString: "");

        var exception = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());

        Assert.Contains("ConnectionStrings:CarnelianAcademyDatabase", exception.Message);
    }

    private static Action<IServiceCollection> UseStubCheck(bool canConnect) => services =>
    {
        services.RemoveAll<IDatabaseConnectivityCheck>();
        services.AddSingleton<IDatabaseConnectivityCheck>(new StubConnectivityCheck(canConnect));
    };

    private static async Task AssertExactBody(HttpResponseMessage response, string status, string database)
    {
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Object, json.RootElement.ValueKind);
        Assert.Equal(2, json.RootElement.EnumerateObject().Count());
        Assert.Equal(status, json.RootElement.GetProperty("status").GetString());
        Assert.Equal(database, json.RootElement.GetProperty("database").GetString());
    }

    private sealed class StubConnectivityCheck(bool canConnect) : IDatabaseConnectivityCheck
    {
        public Task<bool> CanConnectAsync(CancellationToken cancellationToken) => Task.FromResult(canConnect);
    }
}
