namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class CreateSmsConversationDto
{
    public Guid? ConversationId { get; set; }

    public Guid CustomerId { get; set; }

    public DateTime? LastMessageAtUtc { get; set; }

    public int UnreadCount { get; set; }
}
