using System.Net;
using System.Text.Json;

namespace CarnelianAcademy.Tests;

public class ApiDocumentationTests
{
    [Theory]
    [InlineData("Development", HttpStatusCode.OK)]
    [InlineData("Production", HttpStatusCode.NotFound)]
    public async Task Swagger_IsAvailableOnlyInDevelopment(string environment, HttpStatusCode expected)
    {
        await using var factory = TestHost.Create(environment);
        using var client = factory.CreateHttpsClient();

        using var document = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(expected, document.StatusCode);
        using var ui = await client.GetAsync("/swagger/index.html");
        Assert.Equal(expected, ui.StatusCode);
        if (expected == HttpStatusCode.OK)
        {
            using var json = JsonDocument.Parse(await document.Content.ReadAsStringAsync());
            var paths = json.RootElement.GetProperty("paths");
            Assert.True(paths.TryGetProperty("/health", out _));
            Assert.True(paths.TryGetProperty("/health/database", out _));
        }
    }
}
