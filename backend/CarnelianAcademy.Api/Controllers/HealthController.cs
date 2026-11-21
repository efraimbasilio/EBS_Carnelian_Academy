using CarnelianAcademy.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarnelianAcademy.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get() =>
        Ok(new HealthResponse("Healthy", "Carnelian Academy API"));

    [HttpGet("database")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(DatabaseHealthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(DatabaseHealthResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<DatabaseHealthResponse>> GetDatabase(
        [FromServices] IDatabaseConnectivityCheck connectivityCheck,
        CancellationToken cancellationToken)
    {
        if (await connectivityCheck.CanConnectAsync(cancellationToken))
        {
            return Ok(new DatabaseHealthResponse("Healthy", "Connected"));
        }

        return StatusCode(
            StatusCodes.Status503ServiceUnavailable,
            new DatabaseHealthResponse("Unhealthy", "Unavailable"));
    }
}

public sealed record HealthResponse(string Status, string Application);

public sealed record DatabaseHealthResponse(string Status, string Database);
