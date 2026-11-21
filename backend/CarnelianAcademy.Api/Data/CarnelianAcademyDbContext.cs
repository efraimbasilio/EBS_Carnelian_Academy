using Microsoft.EntityFrameworkCore;

namespace CarnelianAcademy.Api.Data;

/// <summary>
/// EF Core unit of work for the Carnelian Academy SQL Server database.
/// Intentionally contains no entities yet; business entities are added only by approved tasks.
/// </summary>
public class CarnelianAcademyDbContext : DbContext
{
    public CarnelianAcademyDbContext(DbContextOptions<CarnelianAcademyDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Future entities keep their mapping in IEntityTypeConfiguration<T> classes in this assembly.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CarnelianAcademyDbContext).Assembly);
    }
}
