namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class CreateAppUserDto
{
    public Guid? UserId { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string RoleName { get; set; } = null!;

    public string? BusinessDescription { get; set; }

    public string? BotName { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginAtUtc { get; set; }
}
