using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SmsConversationsController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;

    public SmsConversationsController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SmsConversationDto>>> GetSmsConversations()
    {
        var currentUserId = GetCurrentUserId();
        var ownedCustomerIds = _context.Customers
            .AsNoTracking()
            .Where(customer => customer.OwnerUserId == currentUserId)
            .Select(customer => customer.CustomerId);

        var conversations = await _context.SmsConversations
            .AsNoTracking()
            .Where(conversation => ownedCustomerIds.Contains(conversation.CustomerId))
            .ToListAsync();

        return Ok(conversations.Select(MapToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SmsConversationDto>> GetSmsConversation(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.SmsConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(conversation =>
                conversation.ConversationId == id &&
                _context.Customers.Any(customer =>
                    customer.CustomerId == conversation.CustomerId &&
                    customer.OwnerUserId == currentUserId));
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<SmsConversationDto>> CreateSmsConversation(CreateSmsConversationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var canAccessCustomer = await _context.Customers.AnyAsync(customer =>
            customer.CustomerId == dto.CustomerId &&
            customer.OwnerUserId == currentUserId);

        if (!canAccessCustomer)
        {
            return NotFound(new { message = "Selected customer is not owned by the current business owner." });
        }

        var entity = new SmsConversation
        {
            ConversationId = dto.ConversationId ?? Guid.NewGuid(),
            CustomerId = dto.CustomerId,
            LastMessageAtUtc = dto.LastMessageAtUtc,
            UnreadCount = dto.UnreadCount,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.SmsConversations.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSmsConversation), new { id = entity.ConversationId }, MapToDto(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSmsConversation(Guid id, UpdateSmsConversationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.SmsConversations
            .FirstOrDefaultAsync(conversation =>
                conversation.ConversationId == id &&
                _context.Customers.Any(customer =>
                    customer.CustomerId == conversation.CustomerId &&
                    customer.OwnerUserId == currentUserId));
        if (entity is null)
        {
            return NotFound();
        }

        entity.CustomerId = dto.CustomerId;
        entity.LastMessageAtUtc = dto.LastMessageAtUtc;
        entity.UnreadCount = dto.UnreadCount;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSmsConversation(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.SmsConversations
            .FirstOrDefaultAsync(conversation =>
                conversation.ConversationId == id &&
                _context.Customers.Any(customer =>
                    customer.CustomerId == conversation.CustomerId &&
                    customer.OwnerUserId == currentUserId));
        if (entity is null)
        {
            return NotFound();
        }

        _context.SmsConversations.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static SmsConversationDto MapToDto(SmsConversation conversation) => new()
    {
        ConversationId = conversation.ConversationId,
        CustomerId = conversation.CustomerId,
        LastMessageAtUtc = conversation.LastMessageAtUtc,
        UnreadCount = conversation.UnreadCount,
        CreatedAtUtc = conversation.CreatedAtUtc,
        UpdatedAtUtc = conversation.UpdatedAtUtc
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
