using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
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
        var conversations = await _context.SmsConversations
            .AsNoTracking()
            .Select(conversation => MapToDto(conversation))
            .ToListAsync();

        return Ok(conversations);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SmsConversationDto>> GetSmsConversation(Guid id)
    {
        var entity = await _context.SmsConversations.FindAsync(id);
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<SmsConversationDto>> CreateSmsConversation(CreateSmsConversationDto dto)
    {
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
        var entity = await _context.SmsConversations.FindAsync(id);
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
        var entity = await _context.SmsConversations.FindAsync(id);
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
}
