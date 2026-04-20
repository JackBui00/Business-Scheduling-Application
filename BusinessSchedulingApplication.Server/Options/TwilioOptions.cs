namespace BusinessSchedulingApplication.Server.Options;

public sealed class TwilioOptions
{
    public string? AccountSid { get; set; }

    public string? AuthToken { get; set; }

    public string? FromNumber { get; set; }

    public string? OwnerUserId { get; set; }
}
