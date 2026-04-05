using BusinessSchedulingApplication.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace BusinessSchedulingApplication.Server.Data;

public sealed class BusinessSchedulingApplicationContextFactory : IDesignTimeDbContextFactory<BusinessSchedulingApplicationContext>
{
    public BusinessSchedulingApplicationContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddUserSecrets<Program>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("BusinessSchedulingApplicationContext")
            ?? throw new InvalidOperationException("Missing connection string: BusinessSchedulingApplicationContext.");

        var optionsBuilder = new DbContextOptionsBuilder<BusinessSchedulingApplicationContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new BusinessSchedulingApplicationContext(optionsBuilder.Options);
    }
}
