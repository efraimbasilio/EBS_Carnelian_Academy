namespace CarnelianAcademy.Api.Data;

/// <summary>
/// Reports whether the application database can be reached. Abstracted so endpoint tests
/// do not require a running SQL Server instance.
/// </summary>
public interface IDatabaseConnectivityCheck
{
    /// <returns><c>true</c> when a connection to the configured database succeeds; otherwise <c>false</c>.</returns>
    Task<bool> CanConnectAsync(CancellationToken cancellationToken);
}
