namespace BusinessSchedulingApplication.Server.Options;

public sealed class OpenAiOptions
{
    public string? ApiKey { get; set; }

    public string Model { get; set; } = "gpt-5.2";
}
