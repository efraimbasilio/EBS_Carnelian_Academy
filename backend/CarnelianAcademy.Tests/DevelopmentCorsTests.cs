using System.Net;
using System.Text.Json;
using CarnelianAcademy.Api.Configuration;
using CarnelianAcademy.Api.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CarnelianAcademy.Tests;

/// <summary>
/// CORS is enforced by browsers, so these tests assert the response headers that a browser relies on.
/// Development tests use the committed appsettings.Development.json origin list.
/// </summary>
public class DevelopmentCorsTests
{
    private const string FrontendOrigin = "http://localhost:5173";
    private const string AllowOriginHeader = "Access-Control-Allow-Origin";
    private const string AllowCredentialsHeader = "Access-Control-Allow-Credentials";

    [Theory]
    [InlineData("/health")]
    [InlineData("/health/database")]
    public async Task Development_AllowsLocalFrontendOrigin_WithoutCredentials(string path)
    {
        await using var factory = TestHost.Create("Development", configureTestServices: UseStubCheck(canConnect: true));
        using var client = factory.CreateHttpsClient();

        using var response = await SendGet(client, path, FrontendOrigin);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(FrontendOrigin, Assert.Single(response.Headers.GetValues(AllowOriginHeader)));
        Assert.False(response.Headers.Contains(AllowCredentialsHeader));
    }

    [Fact]
    public async Task Development_AllowsLocalFrontendOrigin_OnDatabase503_AndPreservesContract()
    {
        // The browser can read the 503 body only if the CORS header is present on the error response.
        await using var factory = TestHost.Create("Development", configureTestServices: UseStubCheck(canConnect: false));
        using var client = factory.CreateHttpsClient();

        using var response = await SendGet(client, "/health/database", FrontendOrigin);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(FrontendOrigin, Assert.Single(response.Headers.GetValues(AllowOriginHeader)));
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2, json.RootElement.EnumerateObject().Count());
        Assert.Equal("Unhealthy", json.RootElement.GetProperty("status").GetString());
        Assert.Equal("Unavailable", json.RootElement.GetProperty("database").GetString());
    }

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("http://192.168.1.20:5173")]
    [InlineData("http://localhost:5174")]
    [InlineData("https://localhost:5173")]
    [InlineData("http://127.0.0.1:5173")]
    [InlineData("null")]
    public async Task Development_DoesNotAllowUnlistedOrigins(string origin)
    {
        await using var factory = TestHost.Create("Development");
        using var client = factory.CreateHttpsClient();

        using var response = await SendGet(client, "/health", origin);

        // The endpoint still responds; without the header the browser blocks the page from reading it.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains(AllowOriginHeader));
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    public async Task Development_ActualNonGet_DoesNotExposeResponse(string method)
    {
        await using var factory = TestHost.Create("Development");
        using var client = factory.CreateHttpsClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), "/health");
        request.Headers.Add("Origin", FrontendOrigin);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.False(response.Headers.Contains(AllowOriginHeader));
        Assert.False(response.Headers.Contains(AllowCredentialsHeader));
    }

    [Fact]
    public async Task Development_Preflight_AllowsGetFromFrontendOrigin_AndRejectsOtherMethodsAndOrigins()
    {
        await using var factory = TestHost.Create("Development");
        using var client = factory.CreateHttpsClient();

        using var allowed = await SendPreflight(client, FrontendOrigin, "GET");
        using var otherMethod = await SendPreflight(client, FrontendOrigin, "DELETE");
        using var otherOrigin = await SendPreflight(client, "https://example.com", "GET");

        Assert.Equal(FrontendOrigin, Assert.Single(allowed.Headers.GetValues(AllowOriginHeader)));
        Assert.Contains("GET", string.Join(",", allowed.Headers.GetValues("Access-Control-Allow-Methods")));
        Assert.False(allowed.Headers.Contains(AllowCredentialsHeader));
        Assert.False(otherMethod.Headers.Contains(AllowOriginHeader));
        Assert.False(otherMethod.Headers.Contains("Access-Control-Allow-Methods"));
        Assert.False(otherOrigin.Headers.Contains(AllowOriginHeader));
    }

    [Fact]
    public async Task Production_DoesNotEnableCors_EvenWhenOriginsAreConfigured()
    {
        await using var factory = TestHost.Create(
            "Production",
            configureTestServices: UseStubCheck(canConnect: true),
            configuration: new Dictionary<string, string?>
            {
                [$"{DevelopmentCors.OriginsConfigurationKey}:0"] = FrontendOrigin
            });
        using var client = factory.CreateHttpsClient();

        using var health = await SendGet(client, "/health", FrontendOrigin);
        using var database = await SendGet(client, "/health/database", FrontendOrigin);
        using var preflight = await SendPreflight(client, FrontendOrigin, "GET");

        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
        Assert.False(health.Headers.Contains(AllowOriginHeader));
        Assert.False(database.Headers.Contains(AllowOriginHeader));
        Assert.False(preflight.Headers.Contains(AllowOriginHeader));
        Assert.False(preflight.Headers.Contains("Access-Control-Allow-Methods"));
    }

    [Fact]
    public void Development_StartupFails_WhenAConfiguredOriginIsNotLocal()
    {
        using var factory = TestHost.Create("Development", configuration: new Dictionary<string, string?>
        {
            [$"{DevelopmentCors.OriginsConfigurationKey}:0"] = "http://192.168.1.20:5173"
        });

        var exception = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());

        Assert.Contains(DevelopmentCors.OriginsConfigurationKey, exception.Message);
        Assert.DoesNotContain("192.168.1.20", exception.Message);
    }

    [Fact]
    public void CommittedDevelopmentConfiguration_AllowsOnlyTheViteOrigin()
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();

        Assert.Equal([FrontendOrigin], DevelopmentCors.GetAllowedOrigins(configuration));
    }

    [Theory]
    [InlineData("http://localhost:5173", "http://localhost:5173")]
    [InlineData("  http://LOCALHOST:5173/  ", "http://localhost:5173")]
    [InlineData("https://localhost:5173", "https://localhost:5173")]
    [InlineData("http://127.0.0.1:5173", "http://127.0.0.1:5173")]
    [InlineData("http://[::1]:5173", "http://[::1]:5173")]
    [InlineData("http://localhost", "http://localhost")]
    public void NormalizeOrigin_AcceptsLoopbackOrigins(string value, string expected)
    {
        Assert.Equal(expected, DevelopmentCors.NormalizeOrigin(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("*")]
    [InlineData("http://*.localhost:5173")]
    [InlineData("null")]
    [InlineData("localhost:5173")]
    [InlineData("ftp://localhost:5173")]
    [InlineData("http://192.168.1.20:5173")]
    [InlineData("http://10.0.0.5:5173")]
    [InlineData("http://0.0.0.0:5173")]
    [InlineData("http://example.com")]
    [InlineData("http://localhost.example.com:5173")]
    [InlineData("http://user:secret@localhost:5173")]
    [InlineData("http://localhost:5173/app")]
    [InlineData("http://localhost:5173/app/..")]
    [InlineData("http://@localhost:5173")]
    [InlineData("http://127.0.0.2:5173")]
    [InlineData("http://127.1:5173")]
    [InlineData("http://127.255.0.1:5173")]
    [InlineData("http://localhost:5173?x=1")]
    [InlineData("http://localhost:5173/?")]
    [InlineData("http://localhost:5173#top")]
    public void NormalizeOrigin_RejectsNonLocalOrMalformedOrigins_WithoutEchoingThem(string? value)
    {
        var exception = Assert.Throws<InvalidOperationException>(() => DevelopmentCors.NormalizeOrigin(value));

        Assert.Contains(DevelopmentCors.OriginsConfigurationKey, exception.Message);
        // Values that are part of the message's fixed example (such as "localhost:5173") cannot be checked.
        if (!string.IsNullOrEmpty(value) && value != "*" && !"'http://localhost:5173'".Contains(value))
        {
            Assert.DoesNotContain(value, exception.Message);
        }
    }

    private static Task<HttpResponseMessage> SendGet(HttpClient client, string path, string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add("Origin", origin);
        return client.SendAsync(request);
    }

    private static Task<HttpResponseMessage> SendPreflight(HttpClient client, string origin, string method)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/health");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", method);
        return client.SendAsync(request);
    }

    private static Action<IServiceCollection> UseStubCheck(bool canConnect) => services =>
    {
        services.RemoveAll<IDatabaseConnectivityCheck>();
        services.AddSingleton<IDatabaseConnectivityCheck>(new StubConnectivityCheck(canConnect));
    };

    private sealed class StubConnectivityCheck(bool canConnect) : IDatabaseConnectivityCheck
    {
        public Task<bool> CanConnectAsync(CancellationToken cancellationToken) => Task.FromResult(canConnect);
    }
}
