namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class BusinessHoursDayDto
{
    public int DayOfWeek { get; set; }

    public string DayLabel { get; set; } = null!;

    public bool IsOpen { get; set; }

    public string? OpensAtLocal { get; set; }

    public string? ClosesAtLocal { get; set; }
}

public sealed class BusinessHoursScheduleDto
{
    public string TimeZoneId { get; set; } = "UTC";

    public IReadOnlyList<BusinessHoursDayDto> Days { get; set; } = [];
}

public sealed class UpdateBusinessHoursDayDto
{
    public int DayOfWeek { get; set; }

    public bool IsOpen { get; set; }

    public string? OpensAtLocal { get; set; }

    public string? ClosesAtLocal { get; set; }
}

public sealed class UpdateBusinessHoursScheduleDto
{
    public string TimeZoneId { get; set; } = "UTC";

    public List<UpdateBusinessHoursDayDto> Days { get; set; } = [];
}
