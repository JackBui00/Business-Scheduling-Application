namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class AppUserDto
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
