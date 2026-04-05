namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class SendSmsMessageDto
{
    public Guid? ConversationId { get; set; }

    public Guid CustomerId { get; set; }

    public string MessageBody { get; set; } = null!;
}
