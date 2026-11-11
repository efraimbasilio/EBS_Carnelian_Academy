using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CarnelianAcademy.Tests;

public class ApiDocumentationTests
{
    [Theory]
    [InlineData("Development", HttpStatusCode.OK)]
    [InlineData("Production", HttpStatusCode.NotFound)]
    public async Task Swagger_IsAvailableOnlyInDevelopment(string environment, HttpStatusCode expected)
    {
        await using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment(environment));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

        using var document = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(expected, document.StatusCode);
        using var ui = await client.GetAsync("/swagger/index.html");
        Assert.Equal(expected, ui.StatusCode);
        if (expected == HttpStatusCode.OK)
        {
            using var json = JsonDocument.Parse(await document.Content.ReadAsStringAsync());
            Assert.True(json.RootElement.GetProperty("paths").TryGetProperty("/health", out _));
        }
    }
}
