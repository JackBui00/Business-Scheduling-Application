using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using BusinessSchedulingApplication.Server.Options;
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

    public SmsMessagesController(
        BusinessSchedulingApplicationContext context,
        IHttpClientFactory httpClientFactory,
        IOptions<TwilioOptions> twilioOptions)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _twilioOptions = twilioOptions.Value;
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
}
