using System.Net;

namespace CarnelianAcademy.Tests;

/// <summary>
/// Opt-in checks against the developer's local SQL Server Express database configured in
/// appsettings.Development.json. They are read-only (connectivity only) and are skipped unless
/// the environment variable CARNELIAN_LOCAL_SQL_TESTS is set to 1.
/// </summary>
public class LocalSqlServerIntegrationTests
{
    [LocalSqlServerFact]
    public async Task GetDatabaseHealth_ConnectsToLocalDevelopmentDatabase()
    {
        await using var factory = TestHost.Create("Development", connectionString: null);
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync("/health/database");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

public sealed class LocalSqlServerFactAttribute : FactAttribute
{
    public const string EnableVariable = "CARNELIAN_LOCAL_SQL_TESTS";

    public LocalSqlServerFactAttribute()
    {
        if (Environment.GetEnvironmentVariable(EnableVariable) != "1")
        {
            Skip = $"Local SQL Server check. Set {EnableVariable}=1 after applying migrations to run it.";
        }
    }
}
