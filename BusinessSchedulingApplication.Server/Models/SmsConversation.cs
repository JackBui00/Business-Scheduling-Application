using System;
using System.Collections.Generic;

namespace BusinessSchedulingApplication.Server.Models;

public partial class SmsConversation
{
    public Guid ConversationId { get; set; }

    public Guid CustomerId { get; set; }

    public DateTime? LastMessageAtUtc { get; set; }

    public int UnreadCount { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ICollection<SmsMessage> SmsMessages { get; set; } = new List<SmsMessage>();
}
