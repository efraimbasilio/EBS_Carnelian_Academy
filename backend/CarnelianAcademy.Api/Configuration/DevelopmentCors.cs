using System.Text.RegularExpressions;

namespace CarnelianAcademy.Api.Configuration;

/// <summary>
/// Development-only CORS settings that let the local Vite frontend call the API from another origin.
/// The policy is registered and applied only in the Development environment (see Program.cs).
/// </summary>
public static class DevelopmentCors
{
    public const string PolicyName = "LocalDevelopmentFrontend";

    /// <summary>Configuration key holding the list of allowed local frontend origins.</summary>
    public const string OriginsConfigurationKey = "Cors:DevelopmentFrontendOrigins";

    /// <summary>
    /// Reads and validates the configured origins. Each entry must be an http or https origin on a
    /// loopback host (<c>localhost</c>, <c>127.0.0.1</c>, or <c>[::1]</c>) with no path, query,
    /// fragment, credentials, or wildcard. Invalid entries fail startup instead of being ignored,
    /// so a typo can never widen the policy.
    /// </summary>
    /// <returns>Normalized origins such as <c>http://localhost:5173</c>; empty if none are configured.</returns>
    public static string[] GetAllowedOrigins(IConfiguration configuration)
    {
        var configured = configuration.GetSection(OriginsConfigurationKey).Get<string[]>() ?? [];
        return configured.Select(NormalizeOrigin).Distinct(StringComparer.Ordinal).ToArray();
    }

    /// <summary>Validates one origin and returns it in the form browsers send in the Origin header.</summary>
    /// <exception cref="InvalidOperationException">The value is not an allowed local development origin.</exception>
    public static string NormalizeOrigin(string? value)
    {
        // Never echo the rejected value; configuration may be supplied from untrusted sources.
        var error = new InvalidOperationException(
            $"Each '{OriginsConfigurationKey}' entry must be a local http or https origin such as " +
            "'http://localhost:5173' (host localhost, 127.0.0.1, or [::1]; no path, query, fragment, wildcard, or credentials).");

        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)
            // Check the original spelling so Uri cannot normalize a different host or a path into an allowed origin.
            || !Regex.IsMatch(trimmed, @"\Ahttps?://(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?/?\z",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
            || !Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            throw error;
        }

        // Scheme, host, and port only, lower-cased, without a trailing slash.
        return uri.GetLeftPart(UriPartial.Authority).ToLowerInvariant();
    }
}
