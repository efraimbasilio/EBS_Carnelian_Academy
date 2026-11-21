namespace CarnelianAcademy.Api.Data;

/// <summary>
/// Performs a real connectivity check through EF Core's <c>Database.CanConnectAsync</c>.
/// Failure details are logged server-side only and never returned to callers.
/// </summary>
public sealed class EfCoreDatabaseConnectivityCheck : IDatabaseConnectivityCheck
{
    private readonly CarnelianAcademyDbContext _dbContext;
    private readonly ILogger<EfCoreDatabaseConnectivityCheck> _logger;

    public EfCoreDatabaseConnectivityCheck(
        CarnelianAcademyDbContext dbContext,
        ILogger<EfCoreDatabaseConnectivityCheck> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<bool> CanConnectAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        bool canConnect;
        try
        {
            canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);
        }
        catch (Exception exception) when (cancellationToken.IsCancellationRequested)
        {
            if (exception is OperationCanceledException)
            {
                throw;
            }

            throw new OperationCanceledException("The database connectivity check was cancelled.", exception, cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Database connectivity check failed with {ExceptionType}.", exception.GetType().Name);
            return false;
        }

        // EF Core 8 CanConnectAsync reports a cancelled check as false rather than throwing,
        // so a false result must not be treated as a connectivity failure once cancellation is requested.
        cancellationToken.ThrowIfCancellationRequested();

        if (!canConnect)
        {
            _logger.LogWarning("Database connectivity check failed: the database is not reachable or does not exist.");
        }

        return canConnect;
    }
}
