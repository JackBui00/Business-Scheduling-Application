namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class BotReplyResultDto
{
    public SmsMessageDto Message { get; set; } = null!;

    public AppointmentDto? Appointment { get; set; }
}
