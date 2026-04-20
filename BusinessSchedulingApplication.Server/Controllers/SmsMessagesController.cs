using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using BusinessSchedulingApplication.Server.Options;
using BusinessSchedulingApplication.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SmsMessagesController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TwilioOptions _twilioOptions;
    private readonly OpenAiConversationBotService _conversationBotService;
    private readonly BusinessHoursValidationService _businessHoursValidationService;

    public SmsMessagesController(
        BusinessSchedulingApplicationContext context,
        IHttpClientFactory httpClientFactory,
        IOptions<TwilioOptions> twilioOptions,
        OpenAiConversationBotService conversationBotService,
        BusinessHoursValidationService businessHoursValidationService)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _twilioOptions = twilioOptions.Value;
        _conversationBotService = conversationBotService;
        _businessHoursValidationService = businessHoursValidationService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SmsMessageDto>>> GetSmsMessages()
    {
        var currentUserId = GetCurrentUserId();
        var ownedCustomerIds = _context.Customers
            .AsNoTracking()
            .Where(customer => customer.OwnerUserId == currentUserId)
            .Select(customer => customer.CustomerId);

        var messages = await _context.SmsMessages
            .AsNoTracking()
            .Where(message => ownedCustomerIds.Contains(message.CustomerId))
            .ToListAsync();

        return Ok(messages.Select(MapToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SmsMessageDto>> GetSmsMessage(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.SmsMessages
            .AsNoTracking()
            .FirstOrDefaultAsync(message =>
                message.SmsMessageId == id &&
                _context.Customers.Any(customer =>
                    customer.CustomerId == message.CustomerId &&
                    customer.OwnerUserId == currentUserId));

        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<SmsMessageDto>> CreateSmsMessage(CreateSmsMessageDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var canAccessCustomer = await _context.Customers.AnyAsync(customer =>
            customer.CustomerId == dto.CustomerId &&
            customer.OwnerUserId == currentUserId);

        if (!canAccessCustomer)
        {
            return NotFound(new { message = "Selected customer is not owned by the current business owner." });
        }

        var conversation = await _context.SmsConversations
            .FirstOrDefaultAsync(item => item.ConversationId == dto.ConversationId && item.CustomerId == dto.CustomerId);

        if (conversation is null)
        {
            return NotFound(new { message = "Conversation not found for the selected customer." });
        }

        var entity = new SmsMessage
        {
            SmsMessageId = dto.SmsMessageId ?? Guid.NewGuid(),
            ConversationId = dto.ConversationId,
            CustomerId = dto.CustomerId,
            Direction = dto.Direction,
            MessageBody = dto.MessageBody,
            DeliveryStatus = dto.DeliveryStatus,
            SentAtUtc = dto.SentAtUtc ?? DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.SmsMessages.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSmsMessage), new { id = entity.SmsMessageId }, MapToDto(entity));
    }

    [HttpPost("send")]
    public async Task<ActionResult<SmsMessageDto>> SendSmsMessage(SendSmsMessageDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.MessageBody))
        {
            return BadRequest(new { message = "Message body is required." });
        }

        var currentUserId = GetCurrentUserId();
        var customer = await _context.Customers
            .FirstOrDefaultAsync(item =>
                item.CustomerId == dto.CustomerId &&
                item.OwnerUserId == currentUserId);

        if (customer is null)
        {
            return NotFound(new { message = "Selected customer is not owned by the current business owner." });
        }

        SmsConversation? conversation;
        if (dto.ConversationId.HasValue)
        {
            conversation = await _context.SmsConversations.FirstOrDefaultAsync(item =>
                item.ConversationId == dto.ConversationId.Value &&
                item.CustomerId == dto.CustomerId);

            if (conversation is null)
            {
                return NotFound(new { message = "Conversation not found for the selected customer." });
            }
        }
        else
        {
            conversation = await _context.SmsConversations.FirstOrDefaultAsync(item => item.CustomerId == dto.CustomerId);
            if (conversation is null)
            {
                conversation = new SmsConversation
                {
                    ConversationId = Guid.NewGuid(),
                    CustomerId = customer.CustomerId,
                    LastMessageAtUtc = DateTime.UtcNow,
                    UnreadCount = 0,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                _context.SmsConversations.Add(conversation);
            }
        }

        var sentAtUtc = DateTime.UtcNow;
        var entity = new SmsMessage
        {
            SmsMessageId = Guid.NewGuid(),
            ConversationId = conversation.ConversationId,
            CustomerId = customer.CustomerId,
            Direction = "outbound",
            MessageBody = dto.MessageBody,
            DeliveryStatus = "queued",
            SentAtUtc = sentAtUtc,
            CreatedAtUtc = sentAtUtc
        };

        var twilioConfigured = TryReadTwilioConfiguration(out var twilioConfiguration);
        if (twilioConfigured)
        {
            try
            {
                await SendViaTwilioAsync(twilioConfiguration, customer.PhoneNumber, dto.MessageBody);
                entity.DeliveryStatus = "sent";
            }
            catch (Exception ex)
            {
                entity.DeliveryStatus = "failed";
                _context.SmsMessages.Add(entity);
                conversation.LastMessageAtUtc = sentAtUtc;
                conversation.UnreadCount = 0;
                conversation.UpdatedAtUtc = sentAtUtc;
                await _context.SaveChangesAsync();

                return StatusCode(StatusCodes.Status502BadGateway, new { message = $"Unable to send message through Twilio: {ex.Message}" });
            }
        }

        conversation.LastMessageAtUtc = sentAtUtc;
        conversation.UnreadCount = 0;
        conversation.UpdatedAtUtc = sentAtUtc;

        _context.SmsMessages.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSmsMessage), new { id = entity.SmsMessageId }, MapToDto(entity));
    }

    [HttpPost("bot-reply")]
    public async Task<ActionResult<BotReplyResultDto>> SendBotReply(CreateBotReplyDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentUser = await _context.AppUsers.AsNoTracking().FirstAsync(user => user.UserId == currentUserId);

        var conversation = await _context.SmsConversations
            .Include(item => item.Customer)
            .FirstOrDefaultAsync(item =>
                item.ConversationId == dto.ConversationId &&
                item.Customer.OwnerUserId == currentUserId);

        if (conversation is null)
        {
            return NotFound(new { message = "Conversation not found for the current business owner." });
        }

        var messages = await _context.SmsMessages
            .AsNoTracking()
            .Where(message => message.ConversationId == conversation.ConversationId)
            .OrderBy(message => message.SentAtUtc)
            .ToListAsync();

        var latestCustomerMessage = messages.LastOrDefault(message => message.Direction == "inbound");
        if (latestCustomerMessage is null)
        {
            return BadRequest(new { message = "Add an inbound customer message before asking the bot to reply." });
        }

        if (!_conversationBotService.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "OpenAI is not configured." });
        }

        if (!_businessHoursValidationService.TryResolveTimeZoneInfo(currentUser.TimeZoneId, out var resolvedTimeZone) || resolvedTimeZone is null)
        {
            return BadRequest(new { message = "Business hours time zone is invalid." });
        }

        var businessHoursSummary = await _businessHoursValidationService.BuildBusinessHoursSummaryAsync(currentUserId);
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, resolvedTimeZone);
        var upcomingAppointment = await GetUpcomingAppointmentAsync(conversation.CustomerId);
        var upcomingAppointmentSummary = upcomingAppointment is null
            ? null
            : BuildAppointmentSummary(upcomingAppointment, resolvedTimeZone);

        var transcriptLines = messages
            .TakeLast(12)
            .Select(message =>
                $"{(message.Direction == "inbound" ? "Customer" : "Bot")}: {message.MessageBody}")
            .ToList();

        var botDraft = await _conversationBotService.GenerateReplyAsync(
            new OpenAiConversationBotService.ConversationBotContext(
                currentUser.BotName,
                currentUser.BusinessDescription,
                conversation.Customer.FullName,
                false,
                upcomingAppointment is not null,
                upcomingAppointmentSummary,
                currentUser.TimeZoneId,
                localNow,
                businessHoursSummary,
                latestCustomerMessage.MessageBody,
                transcriptLines));

        Appointment? appointmentEntity = null;
        AppointmentDto? appointmentDto = null;
        var replyText = botDraft.Reply;

        if (botDraft.Appointment is not null)
        {
            if (!_businessHoursValidationService.TryConvertBusinessLocalDateTimeToUtc(
                    currentUser.TimeZoneId,
                    botDraft.Appointment.ScheduledAtLocal,
                    out var scheduledAtUtc,
                    out _))
            {
                appointmentEntity = null;
                appointmentDto = null;
                replyText = BuildUnavailableTimeReply(currentUser.BotName);
                botDraft = botDraft with { Appointment = null };
            }
            else
            {
                var hoursCheck = await _businessHoursValidationService.IsWithinBusinessHoursAsync(
                    currentUserId,
                    currentUser.TimeZoneId,
                    scheduledAtUtc,
                    botDraft.Appointment.DurationMinutes);

                if (!hoursCheck.IsAllowed)
                {
                    appointmentEntity = null;
                    appointmentDto = null;
                    replyText = BuildUnavailableTimeReply(currentUser.BotName);
                    botDraft = botDraft with { Appointment = null };
                }
                else
                {
                    var availabilityCheck = await _businessHoursValidationService.IsAvailableAsync(
                        currentUserId,
                        currentUser.TimeZoneId,
                        scheduledAtUtc,
                        botDraft.Appointment.DurationMinutes);

                    if (!availabilityCheck.IsAllowed)
                    {
                        appointmentEntity = null;
                        appointmentDto = null;
                        replyText = BuildUnavailableTimeReply(currentUser.BotName);
                        botDraft = botDraft with { Appointment = null };
                    }
                    else
                    {
                        appointmentEntity = new Appointment
                        {
                            AppointmentId = Guid.NewGuid(),
                            CustomerId = conversation.CustomerId,
                            ScheduledAtUtc = scheduledAtUtc,
                            DurationMinutes = botDraft.Appointment.DurationMinutes,
                            ServiceName = botDraft.Appointment.ServiceName,
                            Status = "scheduled",
                            Notes = botDraft.Appointment.Notes,
                            CreatedVia = "bot",
                            CreatedByUserId = currentUserId,
                            CreatedAtUtc = DateTime.UtcNow,
                            UpdatedAtUtc = DateTime.UtcNow
                        };

                        _context.Appointments.Add(appointmentEntity);
                    }
                }
            }
        }

        var sentAtUtc = DateTime.UtcNow;
        var messageEntity = new SmsMessage
        {
            SmsMessageId = Guid.NewGuid(),
            ConversationId = conversation.ConversationId,
            CustomerId = conversation.CustomerId,
            Direction = "outbound",
            MessageBody = replyText,
            DeliveryStatus = "queued",
            SentAtUtc = sentAtUtc,
            CreatedAtUtc = sentAtUtc
        };

        var twilioConfigured = TryReadTwilioConfiguration(out var twilioConfiguration);
        if (twilioConfigured)
        {
            try
            {
                await SendViaTwilioAsync(twilioConfiguration, conversation.Customer.PhoneNumber, replyText);
                messageEntity.DeliveryStatus = "sent";
            }
            catch (Exception ex)
            {
                messageEntity.DeliveryStatus = "failed";
                conversation.LastMessageAtUtc = sentAtUtc;
                conversation.UnreadCount = 0;
                conversation.UpdatedAtUtc = sentAtUtc;
                _context.SmsMessages.Add(messageEntity);
                await _context.SaveChangesAsync();

                return StatusCode(StatusCodes.Status502BadGateway, new { message = $"Unable to send bot reply through Twilio: {ex.Message}" });
            }
        }

        conversation.LastMessageAtUtc = sentAtUtc;
        conversation.UnreadCount = 0;
        conversation.UpdatedAtUtc = sentAtUtc;
        _context.SmsMessages.Add(messageEntity);
        await _context.SaveChangesAsync();

        if (appointmentEntity is not null)
        {
            appointmentDto = MapAppointmentToDto(appointmentEntity, conversation.Customer.FullName);
        }

        return Ok(new BotReplyResultDto
        {
            Message = MapToDto(messageEntity),
            Appointment = appointmentDto
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSmsMessage(Guid id, UpdateSmsMessageDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.SmsMessages
            .FirstOrDefaultAsync(message =>
                message.SmsMessageId == id &&
                _context.Customers.Any(customer =>
                    customer.CustomerId == message.CustomerId &&
                    customer.OwnerUserId == currentUserId));

        if (entity is null)
        {
            return NotFound();
        }

        entity.ConversationId = dto.ConversationId;
        entity.CustomerId = dto.CustomerId;
        entity.Direction = dto.Direction;
        entity.MessageBody = dto.MessageBody;
        entity.DeliveryStatus = dto.DeliveryStatus;
        entity.SentAtUtc = dto.SentAtUtc ?? entity.SentAtUtc;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSmsMessage(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.SmsMessages
            .FirstOrDefaultAsync(message =>
                message.SmsMessageId == id &&
                _context.Customers.Any(customer =>
                    customer.CustomerId == message.CustomerId &&
                    customer.OwnerUserId == currentUserId));

        if (entity is null)
        {
            return NotFound();
        }

        _context.SmsMessages.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private bool TryReadTwilioConfiguration(out TwilioConfiguration configuration)
    {
        var accountSid = _twilioOptions.AccountSid;
        var authToken = _twilioOptions.AuthToken;
        var fromNumber = _twilioOptions.FromNumber;

        if (string.IsNullOrWhiteSpace(accountSid) ||
            string.IsNullOrWhiteSpace(authToken) ||
            string.IsNullOrWhiteSpace(fromNumber))
        {
            configuration = default!;
            return false;
        }

        configuration = new TwilioConfiguration(accountSid, authToken, fromNumber);
        return true;
    }

    private async Task SendViaTwilioAsync(TwilioConfiguration configuration, string toNumber, string messageBody)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://api.twilio.com/2010-04-01/Accounts/{configuration.AccountSid}/Messages.json");

        var authToken = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{configuration.AccountSid}:{configuration.AuthToken}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", authToken);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["To"] = toNumber,
            ["From"] = configuration.FromNumber,
            ["Body"] = messageBody
        });

        using var response = await httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Twilio returned {(int)response.StatusCode}: {responseBody}");
        }
    }

    private static SmsMessageDto MapToDto(SmsMessage message) => new()
    {
        SmsMessageId = message.SmsMessageId,
        ConversationId = message.ConversationId,
        CustomerId = message.CustomerId,
        Direction = message.Direction,
        MessageBody = message.MessageBody,
        DeliveryStatus = message.DeliveryStatus,
        SentAtUtc = message.SentAtUtc,
        CreatedAtUtc = message.CreatedAtUtc
    };

    private static AppointmentDto MapAppointmentToDto(Appointment appointment, string customerName) => new()
    {
        AppointmentId = appointment.AppointmentId,
        CustomerId = appointment.CustomerId,
        CustomerName = customerName,
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

    private static string BuildUnavailableTimeReply(string? botName)
    {
        var name = string.IsNullOrWhiteSpace(botName) ? "the bot" : botName.Trim();
        return $"{name} here. That time is already booked or outside business hours. Please send another time that fits the posted schedule.";
    }

    private async Task<UpcomingAppointmentInfo?> GetUpcomingAppointmentAsync(Guid customerId)
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
            .FirstOrDefaultAsync();

        return appointment;
    }

    private static string BuildAppointmentSummary(UpcomingAppointmentInfo appointment, TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(appointment.ScheduledAtUtc.ToUniversalTime(), timeZone);
        var localOffset = new DateTimeOffset(local, timeZone.GetUtcOffset(local));
        return $"{localOffset:O} for {appointment.DurationMinutes} minutes ({appointment.ServiceName}).";
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

    private sealed record TwilioConfiguration(string AccountSid, string AuthToken, string FromNumber);

    private sealed record UpcomingAppointmentInfo(DateTime ScheduledAtUtc, int DurationMinutes, string ServiceName);
}
