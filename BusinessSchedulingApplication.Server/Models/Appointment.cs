using System;
using System.Collections.Generic;

namespace BusinessSchedulingApplication.Server.Models;

public partial class Appointment
{
    public Guid AppointmentId { get; set; }

    public Guid CustomerId { get; set; }

    public DateTime ScheduledAtUtc { get; set; }

    public int DurationMinutes { get; set; }

    public string ServiceName { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? Notes { get; set; }

    public string CreatedVia { get; set; } = null!;

    public Guid? CreatedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual AppUser? CreatedByUser { get; set; }

    public virtual Customer Customer { get; set; } = null!;
}
