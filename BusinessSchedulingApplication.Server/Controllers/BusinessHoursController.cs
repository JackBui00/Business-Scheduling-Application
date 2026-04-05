using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class BusinessHoursController : ControllerBase
{
    private static readonly string[] DayLabels =
    [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    private static readonly UpdateBusinessHoursDayDto[] DefaultDays =
    [
        new() { DayOfWeek = 0, IsOpen = false },
        new() { DayOfWeek = 1, IsOpen = true, OpensAtLocal = "09:00", ClosesAtLocal = "17:00" },
        new() { DayOfWeek = 2, IsOpen = true, OpensAtLocal = "09:00", ClosesAtLocal = "17:00" },
        new() { DayOfWeek = 3, IsOpen = true, OpensAtLocal = "09:00", ClosesAtLocal = "17:00" },
        new() { DayOfWeek = 4, IsOpen = true, OpensAtLocal = "09:00", ClosesAtLocal = "17:00" },
        new() { DayOfWeek = 5, IsOpen = true, OpensAtLocal = "09:00", ClosesAtLocal = "17:00" },
        new() { DayOfWeek = 6, IsOpen = false }
    ];

    private readonly BusinessSchedulingApplicationContext _context;

    public BusinessHoursController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<BusinessHoursScheduleDto>> GetBusinessHours()
    {
        var currentUserId = GetCurrentUserId();
        var currentUser = await _context.AppUsers
            .AsNoTracking()
            .FirstAsync(user => user.UserId == currentUserId);

        var rows = await _context.BusinessHours
            .AsNoTracking()
            .Where(row => row.OwnerUserId == currentUserId)
            .OrderBy(row => row.DayOfWeek)
            .ToListAsync();

        return Ok(new BusinessHoursScheduleDto
        {
            TimeZoneId = currentUser.TimeZoneId,
            Days = BuildSchedule(rows)
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateBusinessHours(UpdateBusinessHoursScheduleDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentUser = await _context.AppUsers.FirstAsync(user => user.UserId == currentUserId);
        var normalizedDays = NormalizeDays(dto.Days);
        var resolvedTimeZone = ResolveTimeZoneInfo(dto.TimeZoneId);

        if (resolvedTimeZone is null)
        {
            return BadRequest(new { message = "Please choose a valid time zone." });
        }

        if (normalizedDays is null)
        {
            return BadRequest(new { message = "Business hours must include all seven days." });
        }

        foreach (var day in normalizedDays)
        {
            if (day.IsOpen)
            {
                if (!TryParseTime(day.OpensAtLocal, out var opensAtLocal) || !TryParseTime(day.ClosesAtLocal, out var closesAtLocal))
                {
                    return BadRequest(new { message = $"Day {DayLabels[day.DayOfWeek]} needs valid open and close times." });
                }

                if (closesAtLocal <= opensAtLocal)
                {
                    return BadRequest(new { message = $"Day {DayLabels[day.DayOfWeek]} must close after it opens." });
                }
            }
        }

        currentUser.TimeZoneId = dto.TimeZoneId.Trim();

        var existingRows = await _context.BusinessHours
            .Where(row => row.OwnerUserId == currentUserId)
            .ToListAsync();

        var existingByDay = existingRows.ToDictionary(row => row.DayOfWeek);
        var now = DateTime.UtcNow;

        foreach (var day in normalizedDays)
        {
            if (existingByDay.TryGetValue(day.DayOfWeek, out var entity))
            {
                entity.IsOpen = day.IsOpen;
                entity.OpensAtUtc = TryParseTime(day.OpensAtLocal, out var opensAtLocal) ? opensAtLocal : null;
                entity.ClosesAtUtc = TryParseTime(day.ClosesAtLocal, out var closesAtLocal) ? closesAtLocal : null;
                entity.UpdatedAtUtc = now;
            }
            else
            {
                _context.BusinessHours.Add(new BusinessHour
                {
                    BusinessHourId = Guid.NewGuid(),
                    OwnerUserId = currentUserId,
                    DayOfWeek = day.DayOfWeek,
                    IsOpen = day.IsOpen,
                    OpensAtUtc = TryParseTime(day.OpensAtLocal, out var opensAtLocal) ? opensAtLocal : null,
                    ClosesAtUtc = TryParseTime(day.ClosesAtLocal, out var closesAtLocal) ? closesAtLocal : null,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static IReadOnlyList<BusinessHoursDayDto> BuildSchedule(IReadOnlyList<BusinessHour> rows)
    {
        var byDay = rows.ToDictionary(row => row.DayOfWeek);
        var schedule = new List<BusinessHoursDayDto>(7);

        for (var dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++)
        {
            if (byDay.TryGetValue(dayOfWeek, out var row))
            {
                schedule.Add(MapToDto(row));
            }
            else
            {
                var defaultRow = DefaultDays[dayOfWeek];
                schedule.Add(new BusinessHoursDayDto
                {
                    DayOfWeek = defaultRow.DayOfWeek,
                    DayLabel = DayLabels[defaultRow.DayOfWeek],
                    IsOpen = defaultRow.IsOpen,
                    OpensAtLocal = defaultRow.OpensAtLocal,
                    ClosesAtLocal = defaultRow.ClosesAtLocal
                });
            }
        }

        return schedule;
    }

    private static BusinessHoursDayDto MapToDto(BusinessHour row) => new()
    {
        DayOfWeek = row.DayOfWeek,
        DayLabel = DayLabels[row.DayOfWeek],
        IsOpen = row.IsOpen,
        OpensAtLocal = row.OpensAtUtc?.ToString("HH:mm", CultureInfo.InvariantCulture),
        ClosesAtLocal = row.ClosesAtUtc?.ToString("HH:mm", CultureInfo.InvariantCulture)
    };

    private static List<UpdateBusinessHoursDayDto>? NormalizeDays(List<UpdateBusinessHoursDayDto> days)
    {
        if (days.Count != 7)
        {
            return null;
        }

        var distinctDays = days
            .OrderBy(day => day.DayOfWeek)
            .ToList();

        if (distinctDays.Select(day => day.DayOfWeek).Distinct().Count() != 7 || distinctDays[0].DayOfWeek != 0 || distinctDays[^1].DayOfWeek != 6)
        {
            return null;
        }

        return distinctDays;
    }

    private static bool TryParseTime(string? value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);

    private static TimeZoneInfo? ResolveTimeZoneInfo(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return null;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
        }
        catch (InvalidTimeZoneException)
        {
        }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZoneId, out var windowsId))
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(windowsId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(timeZoneId, out var ianaId))
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(ianaId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return null;
    }

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
