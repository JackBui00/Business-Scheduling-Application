using System;
using System.Collections.Generic;

namespace BusinessSchedulingApplication.Server.Models;

public partial class SmsMessage
{
    public Guid SmsMessageId { get; set; }

    public Guid ConversationId { get; set; }

    public Guid CustomerId { get; set; }

    public string Direction { get; set; } = null!;

    public string MessageBody { get; set; } = null!;

    public string DeliveryStatus { get; set; } = null!;

    public DateTime SentAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public virtual SmsConversation Conversation { get; set; } = null!;

    public virtual Customer Customer { get; set; } = null!;
}
