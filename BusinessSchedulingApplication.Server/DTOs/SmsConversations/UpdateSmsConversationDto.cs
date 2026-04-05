namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class UpdateSmsConversationDto
{
    public Guid CustomerId { get; set; }

    public DateTime? LastMessageAtUtc { get; set; }

    public int UnreadCount { get; set; }
}
