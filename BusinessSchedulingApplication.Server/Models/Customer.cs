using System;
using System.Collections.Generic;

namespace BusinessSchedulingApplication.Server.Models;

public partial class Customer
{
    public Guid CustomerId { get; set; }

    public string FullName { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public string? Email { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();

    public virtual SmsConversation? SmsConversation { get; set; }

    public virtual ICollection<SmsMessage> SmsMessages { get; set; } = new List<SmsMessage>();
}
