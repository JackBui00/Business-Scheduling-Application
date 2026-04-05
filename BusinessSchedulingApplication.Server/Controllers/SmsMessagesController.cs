using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SmsMessagesController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;

    public SmsMessagesController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SmsMessageDto>>> GetSmsMessages()
    {
        var messages = await _context.SmsMessages
            .AsNoTracking()
            .Select(message => MapToDto(message))
            .ToListAsync();

        return Ok(messages);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SmsMessageDto>> GetSmsMessage(Guid id)
    {
        var entity = await _context.SmsMessages.FindAsync(id);
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<SmsMessageDto>> CreateSmsMessage(CreateSmsMessageDto dto)
    {
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

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSmsMessage(Guid id, UpdateSmsMessageDto dto)
    {
        var entity = await _context.SmsMessages.FindAsync(id);
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
        var entity = await _context.SmsMessages.FindAsync(id);
        if (entity is null)
        {
            return NotFound();
        }

        _context.SmsMessages.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
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
}
