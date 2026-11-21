using System.Data.Common;
using CarnelianAcademy.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace CarnelianAcademy.Tests;

/// <summary>
/// Exercises the real EF Core 8 SQL Server provider against the synthetic unreachable connection string.
/// A connection interceptor triggers cancellation deterministically while EF Core is opening the connection.
/// </summary>
public class EfCoreDatabaseConnectivityCheckTests
{
    [Fact]
    public async Task CanConnectAsync_CancelledBeforeStart_ThrowsWithoutOpeningConnection()
    {
        var interceptor = new OpeningInterceptor();
        var logger = new CapturingLogger();
        await using var dbContext = CreateDbContext(interceptor);
        var check = new EfCoreDatabaseConnectivityCheck(dbContext, logger);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => check.CanConnectAsync(cts.Token));

        Assert.Equal(0, interceptor.OpeningCount);
        Assert.Empty(logger.Warnings);
    }

    [Fact]
    public async Task CanConnectAsync_CancelledDuringConnectionOpen_Throws()
    {
        using var cts = new CancellationTokenSource();
        var interceptor = new OpeningInterceptor(onOpening: cts.Cancel);
        var logger = new CapturingLogger();
        await using var dbContext = CreateDbContext(interceptor);
        var check = new EfCoreDatabaseConnectivityCheck(dbContext, logger);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => check.CanConnectAsync(cts.Token));

        Assert.Equal(1, interceptor.OpeningCount);
        Assert.Empty(logger.Warnings);
    }

    [Fact]
    public async Task CanConnectAsync_CancelledWhileProviderFails_Throws()
    {
        using var cts = new CancellationTokenSource();
        var interceptor = new OpeningInterceptor(onOpening: () =>
        {
            cts.Cancel();
            throw new InvalidOperationException("Simulated provider failure after cancellation.");
        });
        var logger = new CapturingLogger();
        await using var dbContext = CreateDbContext(interceptor);
        var check = new EfCoreDatabaseConnectivityCheck(dbContext, logger);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => check.CanConnectAsync(cts.Token));

        Assert.Empty(logger.Warnings);
    }

    [Fact]
    public async Task CanConnectAsync_UnreachableServerWithoutCancellation_ReturnsFalseAndLogs()
    {
        var interceptor = new OpeningInterceptor();
        var logger = new CapturingLogger();
        await using var dbContext = CreateDbContext(interceptor);
        var check = new EfCoreDatabaseConnectivityCheck(dbContext, logger);

        var canConnect = await check.CanConnectAsync(CancellationToken.None);

        Assert.False(canConnect);
        Assert.Equal(1, interceptor.OpeningCount);
        Assert.Single(logger.Warnings);
    }

    [Fact]
    public async Task CanConnectAsync_ProviderFailureWithoutCancellation_ReturnsFalseAndLogs()
    {
        var interceptor = new OpeningInterceptor(onOpening: () =>
            throw new InvalidOperationException("Simulated provider failure."));
        var logger = new CapturingLogger();
        await using var dbContext = CreateDbContext(interceptor);
        var check = new EfCoreDatabaseConnectivityCheck(dbContext, logger);

        var canConnect = await check.CanConnectAsync(CancellationToken.None);

        Assert.False(canConnect);
        Assert.Single(logger.Warnings);
    }

    private static CarnelianAcademyDbContext CreateDbContext(IInterceptor interceptor) =>
        new(new DbContextOptionsBuilder<CarnelianAcademyDbContext>()
            .UseSqlServer(TestHost.UnreachableConnectionString)
            .AddInterceptors(interceptor)
            .Options);

    private sealed class OpeningInterceptor(Action? onOpening = null) : DbConnectionInterceptor
    {
        public int OpeningCount { get; private set; }

        public override ValueTask<InterceptionResult> ConnectionOpeningAsync(
            DbConnection connection,
            ConnectionEventData eventData,
            InterceptionResult result,
            CancellationToken cancellationToken = default)
        {
            OpeningCount++;
            onOpening?.Invoke();
            return ValueTask.FromResult(result);
        }
    }

    private sealed class CapturingLogger : ILogger<EfCoreDatabaseConnectivityCheck>
    {
        public List<string> Warnings { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Warning)
            {
                Warnings.Add(formatter(state, exception));
            }
        }
    }
}
