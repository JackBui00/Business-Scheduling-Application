using System.ComponentModel.DataAnnotations;

namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class SignInRequestDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = null!;

    [Required]
    [StringLength(200, MinimumLength = 8)]
    public string Password { get; set; } = null!;
}

public sealed class SignUpRequestDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = null!;

    [Required]
    [StringLength(200, MinimumLength = 8)]
    public string Password { get; set; } = null!;

    [Required]
    [StringLength(200)]
    public string DisplayName { get; set; } = null!;

    [Required]
    [StringLength(100)]
    public string TimeZoneId { get; set; } = null!;
}

public sealed class UpdateBusinessProfileDto
{
    [StringLength(4000)]
    public string? BusinessDescription { get; set; }

    [StringLength(100)]
    public string? BotName { get; set; }
}

public sealed class AuthSessionDto
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string RoleName { get; set; } = null!;

    public string? BusinessDescription { get; set; }

    public string? BotName { get; set; }

    public bool IsActive { get; set; }

    public DateTime? LastLoginAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
