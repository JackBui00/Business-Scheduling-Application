namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class SmsConversationDto
{
    public Guid ConversationId { get; set; }

    public Guid CustomerId { get; set; }

    public DateTime? LastMessageAtUtc { get; set; }

    public int UnreadCount { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
