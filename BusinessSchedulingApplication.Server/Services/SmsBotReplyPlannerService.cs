using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Services;

public sealed class SmsBotReplyPlannerService
{
    private readonly BusinessSchedulingApplicationContext _context;
    private readonly OpenAiConversationBotService _conversationBotService;
    private readonly BusinessHoursValidationService _businessHoursValidationService;

    public SmsBotReplyPlannerService(
        BusinessSchedulingApplicationContext context,
        OpenAiConversationBotService conversationBotService,
        BusinessHoursValidationService businessHoursValidationService)
    {
        _context = context;
        _conversationBotService = conversationBotService;
        _businessHoursValidationService = businessHoursValidationService;
    }

    public async Task<PlannedBotReply> PlanReplyAsync(Guid ownerUserId, Guid conversationId, bool isNewCustomer, CancellationToken cancellationToken = default)
    {
        var currentUser = await _context.AppUsers.AsNoTracking().FirstAsync(user => user.UserId == ownerUserId, cancellationToken);

        if (!_conversationBotService.IsConfigured)
        {
            throw new InvalidOperationException("OpenAI is not configured.");
        }

        if (!_businessHoursValidationService.TryResolveTimeZoneInfo(currentUser.TimeZoneId, out var resolvedTimeZone) || resolvedTimeZone is null)
        {
            throw new InvalidOperationException("Business hours time zone is invalid.");
        }

        var conversation = await _context.SmsConversations
            .Include(item => item.Customer)
            .FirstOrDefaultAsync(item =>
                item.ConversationId == conversationId &&
                item.Customer.OwnerUserId == ownerUserId,
                cancellationToken);

        if (conversation is null)
        {
            throw new InvalidOperationException("Conversation not found for the current business owner.");
        }

        var messages = await _context.SmsMessages
            .AsNoTracking()
            .Where(message => message.ConversationId == conversation.ConversationId)
            .OrderBy(message => message.SentAtUtc)
            .ToListAsync(cancellationToken);

        var latestCustomerMessage = messages.LastOrDefault(message => message.Direction == "inbound");
        if (latestCustomerMessage is null)
        {
            throw new InvalidOperationException("Add an inbound customer message before asking the bot to reply.");
        }

        var businessHoursSummary = await _businessHoursValidationService.BuildBusinessHoursSummaryAsync(ownerUserId);
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, resolvedTimeZone);
        var upcomingAppointment = await GetUpcomingAppointmentAsync(conversation.CustomerId, cancellationToken);
        var upcomingAppointmentSummary = upcomingAppointment is null
            ? null
            : BuildAppointmentSummary(upcomingAppointment, resolvedTimeZone);

        var transcriptLines = messages
            .TakeLast(12)
            .Select(message => $"{(message.Direction == "inbound" ? "Customer" : "Bot")}: {message.MessageBody}")
            .ToList();

        var botDraft = await _conversationBotService.GenerateReplyAsync(
            new OpenAiConversationBotService.ConversationBotContext(
                currentUser.BotName,
                currentUser.BusinessDescription,
                conversation.Customer.FullName,
                isNewCustomer,
                upcomingAppointment is not null,
                upcomingAppointmentSummary,
                currentUser.TimeZoneId,
                localNow,
                businessHoursSummary,
                latestCustomerMessage.MessageBody,
                transcriptLines),
            cancellationToken);

        var replyText = botDraft.Reply;
        PlannedAppointment? appointment = null;

        if (botDraft.Appointment is not null &&
            _businessHoursValidationService.TryConvertBusinessLocalDateTimeToUtc(
                currentUser.TimeZoneId,
                botDraft.Appointment.ScheduledAtLocal,
                out var scheduledAtUtc,
                out _))
        {
            var hoursCheck = await _businessHoursValidationService.IsWithinBusinessHoursAsync(
                ownerUserId,
                currentUser.TimeZoneId,
                scheduledAtUtc,
                botDraft.Appointment.DurationMinutes);

            var availabilityCheck = hoursCheck.IsAllowed
                ? await _businessHoursValidationService.IsAvailableAsync(
                    ownerUserId,
                    currentUser.TimeZoneId,
                    scheduledAtUtc,
                    botDraft.Appointment.DurationMinutes)
                : hoursCheck;

            if (availabilityCheck.IsAllowed)
            {
                appointment = new PlannedAppointment(
                    scheduledAtUtc,
                    botDraft.Appointment.DurationMinutes,
                    botDraft.Appointment.ServiceName,
                    botDraft.Appointment.Notes);
            }
            else
            {
                replyText = BuildUnavailableTimeReply(currentUser.BotName);
            }
        }
        else if (botDraft.Appointment is not null)
        {
            replyText = BuildUnavailableTimeReply(currentUser.BotName);
        }

        return new PlannedBotReply(replyText, appointment);
    }

    private static string BuildUnavailableTimeReply(string? botName)
    {
        var name = string.IsNullOrWhiteSpace(botName) ? "the bot" : botName.Trim();
        return $"{name} here. That time is unavailable. Please send another time during business hours.";
    }

    private async Task<UpcomingAppointmentInfo?> GetUpcomingAppointmentAsync(Guid customerId, CancellationToken cancellationToken)
    {
        var nowUtc = DateTime.UtcNow;
        var appointment = await _context.Appointments
            .AsNoTracking()
            .Where(item =>
                item.CustomerId == customerId &&
                item.Status == "scheduled" &&
                item.ScheduledAtUtc >= nowUtc)
            .OrderBy(item => item.ScheduledAtUtc)
            .Select(item => new UpcomingAppointmentInfo(
                item.ScheduledAtUtc,
                item.DurationMinutes,
                item.ServiceName))
            .FirstOrDefaultAsync(cancellationToken);

        return appointment;
    }

    private static string BuildAppointmentSummary(UpcomingAppointmentInfo appointment, TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(appointment.ScheduledAtUtc.ToUniversalTime(), timeZone);
        var localOffset = new DateTimeOffset(local, timeZone.GetUtcOffset(local));
        return $"{localOffset:O} for {appointment.DurationMinutes} minutes ({appointment.ServiceName}).";
    }

    private sealed record UpcomingAppointmentInfo(DateTime ScheduledAtUtc, int DurationMinutes, string ServiceName);
}

public sealed record PlannedBotReply(string ReplyText, PlannedAppointment? Appointment);

public sealed record PlannedAppointment(DateTime ScheduledAtUtc, int DurationMinutes, string ServiceName, string? Notes);
