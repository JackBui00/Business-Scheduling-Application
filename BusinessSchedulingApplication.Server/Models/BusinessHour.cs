using System;

namespace BusinessSchedulingApplication.Server.Models;

public partial class BusinessHour
{
    public Guid BusinessHourId { get; set; }

    public Guid OwnerUserId { get; set; }

    public int DayOfWeek { get; set; }

    public bool IsOpen { get; set; }

    public TimeOnly? OpensAtUtc { get; set; }

    public TimeOnly? ClosesAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual AppUser OwnerUser { get; set; } = null!;
}
