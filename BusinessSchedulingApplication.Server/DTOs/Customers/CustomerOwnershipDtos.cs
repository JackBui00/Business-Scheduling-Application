using System.ComponentModel.DataAnnotations;

namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class AddCustomerOwnerDto
{
    [Required]
    public Guid OwnerUserId { get; set; }
}
