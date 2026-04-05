namespace BusinessSchedulingApplication.Server.DTOs;

public sealed class UpdateCustomerDto
{
    public string FullName { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public string? Email { get; set; }

    public string? Notes { get; set; }
}
