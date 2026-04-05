using System;
using System.Collections.Generic;

namespace BusinessSchedulingApplication.Server.Models;

public partial class AppUser
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string RoleName { get; set; } = null!;

    public bool IsActive { get; set; }

    public string TimeZoneId { get; set; } = "UTC";

    public string? BusinessDescription { get; set; }

    public string? BotName { get; set; }

    public DateTime? LastLoginAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();

    public virtual ICollection<Customer> Customers { get; set; } = new List<Customer>();

    public virtual ICollection<BusinessHour> BusinessHours { get; set; } = new List<BusinessHour>();
}
