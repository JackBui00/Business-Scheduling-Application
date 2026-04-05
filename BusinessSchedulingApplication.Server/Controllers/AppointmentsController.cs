using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;

    public AppointmentsController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppointmentDto>>> GetAppointments()
    {
        var appointments = await _context.Appointments
            .AsNoTracking()
            .Select(appointment => MapToDto(appointment))
            .ToListAsync();

        return Ok(appointments);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> GetAppointment(Guid id)
    {
        var entity = await _context.Appointments.FindAsync(id);
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> CreateAppointment(CreateAppointmentDto dto)
    {
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

        _context.Appointments.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAppointment), new { id = entity.AppointmentId }, MapToDto(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateAppointment(Guid id, UpdateAppointmentDto dto)
    {
        var entity = await _context.Appointments.FindAsync(id);
        if (entity is null)
        {
            return NotFound();
        }

        entity.CustomerId = dto.CustomerId;
        entity.ScheduledAtUtc = dto.ScheduledAtUtc;
        entity.DurationMinutes = dto.DurationMinutes;
        entity.ServiceName = dto.ServiceName;
        entity.Status = dto.Status;
        entity.Notes = dto.Notes;
        entity.CreatedVia = dto.CreatedVia;
        entity.CreatedByUserId = dto.CreatedByUserId;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id)
    {
        var entity = await _context.Appointments.FindAsync(id);
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
}
