using System.Net;
using System.Text.Json;

namespace CarnelianAcademy.Tests;

public class HealthEndpointTests
{
    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task GetHealth_ReturnsHealthyWithoutAuthentication(string environment)
    {
        await using var factory = TestHost.Create(environment);
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Object, json.RootElement.ValueKind);
        Assert.Equal(2, json.RootElement.EnumerateObject().Count());
        Assert.Equal("Healthy", json.RootElement.GetProperty("status").GetString());
        Assert.Equal("Carnelian Academy API", json.RootElement.GetProperty("application").GetString());
    }

    [Fact]
    public async Task GetHealth_DoesNotDependOnDatabaseConnectivity()
    {
        // The default test connection string is unreachable; process health must still report healthy.
        await using var factory = TestHost.Create("Production");
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
