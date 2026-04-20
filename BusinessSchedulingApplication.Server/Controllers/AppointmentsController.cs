using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using BusinessSchedulingApplication.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;
    private readonly BusinessHoursValidationService _businessHoursValidationService;

    public AppointmentsController(
        BusinessSchedulingApplicationContext context,
        BusinessHoursValidationService businessHoursValidationService)
    {
        _context = context;
        _businessHoursValidationService = businessHoursValidationService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppointmentDto>>> GetAppointments()
    {
        var currentUserId = GetCurrentUserId();
        var ownedCustomerIds = _context.Customers
            .AsNoTracking()
            .Where(customer => customer.OwnerUserId == currentUserId)
            .Select(customer => customer.CustomerId);

        var appointments = await _context.Appointments
            .AsNoTracking()
            .Include(appointment => appointment.Customer)
            .Where(appointment => ownedCustomerIds.Contains(appointment.CustomerId))
            .ToListAsync();

        return Ok(appointments.Select(MapToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> GetAppointment(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var ownedCustomerIds = _context.Customers
            .AsNoTracking()
            .Where(customer => customer.OwnerUserId == currentUserId)
            .Select(customer => customer.CustomerId);

        var entity = await _context.Appointments
            .AsNoTracking()
            .Include(appointment => appointment.Customer)
            .FirstOrDefaultAsync(appointment => appointment.AppointmentId == id && ownedCustomerIds.Contains(appointment.CustomerId));
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> CreateAppointment(CreateAppointmentDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentUser = await _context.AppUsers.AsNoTracking().FirstAsync(user => user.UserId == currentUserId);

        var ownedCustomer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(customer => customer.CustomerId == dto.CustomerId && customer.OwnerUserId == currentUserId);

        if (ownedCustomer is null)
        {
            return BadRequest(new { message = "Selected customer is not owned by the current business owner." });
        }

        var hoursCheck = await _businessHoursValidationService.IsWithinBusinessHoursAsync(
            currentUserId,
            currentUser.TimeZoneId,
            dto.ScheduledAtUtc,
            dto.DurationMinutes);
        if (!hoursCheck.IsAllowed)
        {
            return BadRequest(new { message = hoursCheck.Message });
        }

        var availabilityCheck = await _businessHoursValidationService.IsAvailableAsync(
            currentUserId,
            currentUser.TimeZoneId,
            dto.ScheduledAtUtc,
            dto.DurationMinutes);
        if (!availabilityCheck.IsAllowed)
        {
            return BadRequest(new { message = availabilityCheck.Message });
        }

        var entity = new Appointment
        {
            AppointmentId = dto.AppointmentId ?? Guid.NewGuid(),
            CustomerId = dto.CustomerId,
            ScheduledAtUtc = dto.ScheduledAtUtc,
            DurationMinutes = dto.DurationMinutes,
            ServiceName = dto.ServiceName,
            Status = dto.Status,
            Notes = dto.Notes,
            CreatedVia = dto.CreatedVia,
            CreatedByUserId = dto.CreatedByUserId,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        entity.Customer = ownedCustomer;

        _context.Appointments.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAppointment), new { id = entity.AppointmentId }, MapToDto(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateAppointment(Guid id, UpdateAppointmentDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentUser = await _context.AppUsers.AsNoTracking().FirstAsync(user => user.UserId == currentUserId);

        var entity = await _context.Appointments
            .Include(appointment => appointment.Customer)
            .FirstOrDefaultAsync(appointment => appointment.AppointmentId == id && appointment.Customer.OwnerUserId == currentUserId);
        if (entity is null)
        {
            return NotFound();
        }

        var ownedCustomer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(customer => customer.CustomerId == dto.CustomerId && customer.OwnerUserId == currentUserId);

        if (ownedCustomer is null)
        {
            return BadRequest(new { message = "Selected customer is not owned by the current business owner." });
        }

        var hoursCheck = await _businessHoursValidationService.IsWithinBusinessHoursAsync(
            currentUserId,
            currentUser.TimeZoneId,
            dto.ScheduledAtUtc,
            dto.DurationMinutes);
        if (!hoursCheck.IsAllowed)
        {
            return BadRequest(new { message = hoursCheck.Message });
        }

        var availabilityCheck = await _businessHoursValidationService.IsAvailableAsync(
            currentUserId,
            currentUser.TimeZoneId,
            dto.ScheduledAtUtc,
            dto.DurationMinutes,
            id);
        if (!availabilityCheck.IsAllowed)
        {
            return BadRequest(new { message = availabilityCheck.Message });
        }

        entity.CustomerId = dto.CustomerId;
        entity.ScheduledAtUtc = dto.ScheduledAtUtc;
        entity.DurationMinutes = dto.DurationMinutes;
        entity.ServiceName = dto.ServiceName;
        entity.Status = dto.Status;
        entity.Notes = dto.Notes;
        entity.CreatedVia = dto.CreatedVia;
        entity.CreatedByUserId = dto.CreatedByUserId;
        entity.Customer = ownedCustomer;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id)
    {
        var currentUserId = GetCurrentUserId();

        var entity = await _context.Appointments
            .Include(appointment => appointment.Customer)
            .FirstOrDefaultAsync(appointment => appointment.AppointmentId == id && appointment.Customer.OwnerUserId == currentUserId);
        if (entity is null)
        {
            return NotFound();
        }

        _context.Appointments.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static AppointmentDto MapToDto(Appointment appointment) => new()
    {
        AppointmentId = appointment.AppointmentId,
        CustomerId = appointment.CustomerId,
        CustomerName = appointment.Customer.FullName,
        ScheduledAtUtc = appointment.ScheduledAtUtc,
        DurationMinutes = appointment.DurationMinutes,
        ServiceName = appointment.ServiceName,
        Status = appointment.Status,
        Notes = appointment.Notes,
        CreatedVia = appointment.CreatedVia,
        CreatedByUserId = appointment.CreatedByUserId,
        CreatedAtUtc = appointment.CreatedAtUtc,
        UpdatedAtUtc = appointment.UpdatedAtUtc
    };

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("Authenticated user id is missing or invalid.");
        }

        return userId;
    }
}
