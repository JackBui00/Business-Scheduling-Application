namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class UpdateSmsMessageDto
{
    public Guid ConversationId { get; set; }

    public Guid CustomerId { get; set; }

    public string Direction { get; set; } = null!;

    public string MessageBody { get; set; } = null!;

    public string DeliveryStatus { get; set; } = null!;

    public DateTime? SentAtUtc { get; set; }
}
