using BusinessSchedulingApplication.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace BusinessSchedulingApplication.Server.Services;

public sealed class BusinessHoursValidationService
{
    private readonly BusinessSchedulingApplicationContext _context;

    public BusinessHoursValidationService(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    public async Task<(bool IsAllowed, string Message)> IsWithinBusinessHoursAsync(
        Guid ownerUserId,
        string timeZoneId,
        DateTime scheduledAtUtc,
        int durationMinutes)
    {
        var rows = await _context.BusinessHours
            .AsNoTracking()
            .Where(row => row.OwnerUserId == ownerUserId)
            .ToListAsync();

        if (rows.Count == 0)
        {
            return (true, string.Empty);
        }

        var timeZone = ResolveTimeZoneInfo(timeZoneId);
        if (timeZone is null)
        {
            return (false, "Business hours time zone is invalid.");
        }

        var localScheduledAt = TimeZoneInfo.ConvertTimeFromUtc(scheduledAtUtc.ToUniversalTime(), timeZone);
        var localEndAt = localScheduledAt.AddMinutes(durationMinutes);
        var start = TimeOnly.FromDateTime(localScheduledAt);
        var end = TimeOnly.FromDateTime(localEndAt);
        var dayOfWeek = (int)localScheduledAt.DayOfWeek;

        var row = rows.FirstOrDefault(item => item.DayOfWeek == dayOfWeek);
        if (row is null || !row.IsOpen || row.OpensAtUtc is null || row.ClosesAtUtc is null)
        {
            return (false, "That appointment time is outside the configured business hours.");
        }

        if (end <= start)
        {
            return (false, "Appointments must end after they start.");
        }

        if (start < row.OpensAtUtc || end > row.ClosesAtUtc)
        {
            return (false, "That appointment time is outside the configured business hours.");
        }

        return (true, string.Empty);
    }

    public async Task<(bool IsAllowed, string Message)> IsAvailableAsync(
        Guid ownerUserId,
        string timeZoneId,
        DateTime scheduledAtUtc,
        int durationMinutes,
        Guid? appointmentIdToIgnore = null)
    {
        var businessHoursCheck = await IsWithinBusinessHoursAsync(ownerUserId, timeZoneId, scheduledAtUtc, durationMinutes);
        if (!businessHoursCheck.IsAllowed)
        {
            return businessHoursCheck;
        }

        var timeZone = ResolveTimeZoneInfo(timeZoneId);
        if (timeZone is null)
        {
            return (false, "Business hours time zone is invalid.");
        }

        var localStart = TimeZoneInfo.ConvertTimeFromUtc(scheduledAtUtc.ToUniversalTime(), timeZone);
        var localEnd = localStart.AddMinutes(durationMinutes);

        var existingAppointments = await _context.Appointments
            .AsNoTracking()
            .Where(appointment =>
                appointment.Customer.OwnerUserId == ownerUserId &&
                (!appointmentIdToIgnore.HasValue || appointment.AppointmentId != appointmentIdToIgnore.Value))
            .Select(appointment => new
            {
                appointment.AppointmentId,
                appointment.ScheduledAtUtc,
                appointment.DurationMinutes
            })
            .ToListAsync();

        foreach (var appointment in existingAppointments)
        {
            var existingStart = TimeZoneInfo.ConvertTimeFromUtc(appointment.ScheduledAtUtc.ToUniversalTime(), timeZone);
            var existingEnd = existingStart.AddMinutes(appointment.DurationMinutes);
            if (IntervalsOverlap(localStart, localEnd, existingStart, existingEnd))
            {
                return (false, "That appointment conflicts with an existing booking.");
            }
        }

        return (true, string.Empty);
    }

    public bool TryResolveTimeZoneInfo(string? timeZoneId, out TimeZoneInfo? timeZone)
    {
        timeZone = null;

        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return false;
        }

        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return true;
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
                timeZone = TimeZoneInfo.FindSystemTimeZoneById(windowsId);
                return true;
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
                timeZone = TimeZoneInfo.FindSystemTimeZoneById(ianaId);
                return true;
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return false;
    }

    private TimeZoneInfo? ResolveTimeZoneInfo(string? timeZoneId)
    {
        return TryResolveTimeZoneInfo(timeZoneId, out var timeZone) ? timeZone : null;
    }

    public bool TryConvertBusinessLocalDateTimeToUtc(
        string timeZoneId,
        string localDateTimeText,
        out DateTime scheduledAtUtc,
        out string errorMessage)
    {
        scheduledAtUtc = default;
        errorMessage = string.Empty;

        if (HasExplicitOffset(localDateTimeText) &&
            DateTimeOffset.TryParse(
                localDateTimeText,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var offsetDateTime))
        {
            scheduledAtUtc = offsetDateTime.UtcDateTime;
            return true;
        }

        if (!TryResolveTimeZoneInfo(timeZoneId, out var timeZone) || timeZone is null)
        {
            errorMessage = "Business hours time zone is invalid.";
            return false;
        }

        if (!DateTime.TryParse(
                localDateTimeText,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
                out var localDateTime))
        {
            errorMessage = "The requested date and time could not be read.";
            return false;
        }

        var unspecifiedLocalTime = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);
        try
        {
            scheduledAtUtc = TimeZoneInfo.ConvertTimeToUtc(unspecifiedLocalTime, timeZone);
            return true;
        }
        catch (ArgumentException)
        {
            errorMessage = "The requested date and time is not valid in that time zone.";
            return false;
        }
    }

    private static bool HasExplicitOffset(string value)
    {
        var timeSeparatorIndex = value.IndexOf('T');
        if (timeSeparatorIndex < 0)
        {
            return false;
        }

        var offsetIndex = value.IndexOfAny(new[] { 'Z', '+', '-' }, timeSeparatorIndex + 1);
        return offsetIndex >= 0;
    }

    private static bool IntervalsOverlap(DateTime startA, DateTime endA, DateTime startB, DateTime endB) =>
        startA < endB && startB < endA;

    public async Task<string> BuildBusinessHoursSummaryAsync(Guid ownerUserId)
    {
        var rows = await _context.BusinessHours
            .AsNoTracking()
            .Where(row => row.OwnerUserId == ownerUserId)
            .OrderBy(row => row.DayOfWeek)
            .ToListAsync();

        if (rows.Count == 0)
        {
            return "No business hours have been saved yet.";
        }

        var lines = rows.Select(row =>
            row.IsOpen && row.OpensAtUtc is not null && row.ClosesAtUtc is not null
                ? $"{DayLabel(row.DayOfWeek)}: open {row.OpensAtUtc:HH:mm} to {row.ClosesAtUtc:HH:mm}"
                : $"{DayLabel(row.DayOfWeek)}: closed");

        return string.Join("; ", lines);
    }

    private static string DayLabel(int dayOfWeek) => dayOfWeek switch
    {
        0 => "Sunday",
        1 => "Monday",
        2 => "Tuesday",
        3 => "Wednesday",
        4 => "Thursday",
        5 => "Friday",
        6 => "Saturday",
        _ => "Unknown"
    };
}
