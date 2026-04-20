using BusinessSchedulingApplication.Server.Models;
using BusinessSchedulingApplication.Server.Options;
using BusinessSchedulingApplication.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Security;
using System.Text.RegularExpressions;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/twilio")]
public class TwilioWebhookController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;
    private readonly TwilioOptions _twilioOptions;
    private readonly SmsBotReplyPlannerService _botReplyPlannerService;

    public TwilioWebhookController(
        BusinessSchedulingApplicationContext context,
        IOptions<TwilioOptions> twilioOptions,
        SmsBotReplyPlannerService botReplyPlannerService)
    {
        _context = context;
        _twilioOptions = twilioOptions.Value;
        _botReplyPlannerService = botReplyPlannerService;
    }

    [HttpPost("sms")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> ReceiveInboundSms([FromForm] TwilioInboundSmsDto dto)
    {
        var fromPhone = NormalizePhoneNumber(dto.From);
        var messageBody = (dto.Body ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(fromPhone) || string.IsNullOrWhiteSpace(messageBody))
        {
            return Content("<Response />", "text/xml");
        }

        var ownerUserId = await ResolveOwnerUserIdAsync();
        var now = DateTime.UtcNow;

        var customer = (await _context.Customers
                .Where(customer => customer.OwnerUserId == ownerUserId)
                .ToListAsync())
            .FirstOrDefault(customer => NormalizePhoneNumber(customer.PhoneNumber) == fromPhone);

        var isNewCustomer = customer is null;
        if (customer is null)
        {
            customer = new Customer
            {
                CustomerId = Guid.NewGuid(),
                OwnerUserId = ownerUserId,
                FullName = ExtractCustomerName(messageBody) ?? fromPhone,
                PhoneNumber = fromPhone,
                Email = null,
                Notes = "Auto-created from inbound SMS.",
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };

            _context.Customers.Add(customer);
        }
        else
        {
            var extractedName = ExtractCustomerName(messageBody);
            if (!string.IsNullOrWhiteSpace(extractedName) && LooksLikePlaceholderName(customer.FullName))
            {
                customer.FullName = extractedName;
                customer.UpdatedAtUtc = now;
            }
        }

        var conversation = await _context.SmsConversations.FirstOrDefaultAsync(item => item.CustomerId == customer.CustomerId);
        if (conversation is null)
        {
            conversation = new SmsConversation
            {
                ConversationId = Guid.NewGuid(),
                CustomerId = customer.CustomerId,
                LastMessageAtUtc = now,
                UnreadCount = 0,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };

            _context.SmsConversations.Add(conversation);
        }

        var inboundMessage = new SmsMessage
        {
            SmsMessageId = Guid.NewGuid(),
            ConversationId = conversation.ConversationId,
            CustomerId = customer.CustomerId,
            Direction = "inbound",
            MessageBody = messageBody,
            DeliveryStatus = "received",
            SentAtUtc = now,
            CreatedAtUtc = now
        };

        _context.SmsMessages.Add(inboundMessage);
        conversation.LastMessageAtUtc = now;
        conversation.UnreadCount = 1;
        conversation.UpdatedAtUtc = now;
        customer.UpdatedAtUtc = now;

        await _context.SaveChangesAsync();

        PlannedBotReply? plannedReply = null;
        try
        {
            plannedReply = await _botReplyPlannerService.PlanReplyAsync(ownerUserId, conversation.ConversationId, isNewCustomer);
        }
        catch
        {
        }

        if (plannedReply is not null)
        {
            var outboundMessage = new SmsMessage
            {
                SmsMessageId = Guid.NewGuid(),
                ConversationId = conversation.ConversationId,
                CustomerId = customer.CustomerId,
                Direction = "outbound",
                MessageBody = plannedReply.ReplyText,
                DeliveryStatus = "sent",
                SentAtUtc = now,
                CreatedAtUtc = now
            };

            _context.SmsMessages.Add(outboundMessage);
            conversation.LastMessageAtUtc = now;
            conversation.UnreadCount = 0;

            if (plannedReply.Appointment is not null)
            {
                _context.Appointments.Add(new Appointment
                {
                    AppointmentId = Guid.NewGuid(),
                    CustomerId = customer.CustomerId,
                    ScheduledAtUtc = plannedReply.Appointment.ScheduledAtUtc,
                    DurationMinutes = plannedReply.Appointment.DurationMinutes,
                    ServiceName = plannedReply.Appointment.ServiceName,
                    Status = "scheduled",
                    Notes = plannedReply.Appointment.Notes,
                    CreatedVia = "bot",
                    CreatedByUserId = ownerUserId,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }

            await _context.SaveChangesAsync();
            return Content(BuildTwiml(plannedReply.ReplyText), "text/xml");
        }

        return Content("<Response />", "text/xml");
    }

    private async Task<Guid> ResolveOwnerUserIdAsync()
    {
        if (Guid.TryParse(_twilioOptions.OwnerUserId, out var configuredOwnerUserId))
        {
            return configuredOwnerUserId;
        }

        var ownerIds = await _context.AppUsers
            .AsNoTracking()
            .Where(user => user.IsActive && user.RoleName == "Owner")
            .Select(user => user.UserId)
            .ToListAsync();

        if (ownerIds.Count == 1)
        {
            return ownerIds[0];
        }

        throw new InvalidOperationException("Twilio owner user is not configured.");
    }

    private static string? ExtractCustomerName(string messageBody)
    {
        var patterns = new[]
        {
            @"\bmy name is\s+(?<name>[A-Za-z][A-Za-z' -]{1,59})(?:[.,!?;:]|\s|$)",
            @"\bi\s*am\s+(?<name>[A-Za-z][A-Za-z' -]{1,59})(?:[.,!?;:]|\s|$)",
            @"\bi[' ]?m\s+(?<name>[A-Za-z][A-Za-z' -]{1,59})(?:[.,!?;:]|\s|$)",
            @"\bthis is\s+(?<name>[A-Za-z][A-Za-z' -]{1,59})(?:[.,!?;:]|\s|$)"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(messageBody, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (match.Success)
            {
                var candidate = match.Groups["name"].Value.Trim();
                if (candidate.Length is >= 2 and <= 60)
                {
                    return candidate;
                }
            }
        }

        return null;
    }

    private static bool LooksLikePlaceholderName(string value)
    {
        var trimmed = value.Trim();
        return trimmed.StartsWith("+") || trimmed.Any(char.IsDigit) || trimmed.Contains("SMS Customer", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePhoneNumber(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : new string(value.Trim().Where(ch => char.IsDigit(ch) || ch == '+').ToArray());

    private static string BuildTwiml(string messageBody) =>
        $"<Response><Message>{SecurityElement.Escape(messageBody)}</Message></Response>";

    public sealed class TwilioInboundSmsDto
    {
        public string? From { get; set; }

        public string? To { get; set; }

        public string? Body { get; set; }

        public string? MessageSid { get; set; }
    }
}
