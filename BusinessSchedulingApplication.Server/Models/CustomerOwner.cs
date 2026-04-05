using System;

namespace BusinessSchedulingApplication.Server.Models;

public partial class CustomerOwner
{
    public Guid CustomerOwnerId { get; set; }

    public Guid CustomerId { get; set; }

    public Guid OwnerUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual AppUser OwnerUser { get; set; } = null!;
}
