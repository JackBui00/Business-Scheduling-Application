using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class AppUsersController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;

    public AppUsersController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppUserDto>>> GetAppUsers()
    {
        var users = await _context.AppUsers
            .AsNoTracking()
            .ToListAsync();

        return Ok(users.Select(MapToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppUserDto>> GetAppUser(Guid id)
    {
        var user = await _context.AppUsers.FindAsync(id);
        return user is null ? NotFound() : Ok(MapToDto(user));
    }

    [HttpPost]
    public async Task<ActionResult<AppUserDto>> CreateAppUser(CreateAppUserDto dto)
    {
        var entity = new AppUser
        {
            UserId = dto.UserId ?? Guid.NewGuid(),
            Email = dto.Email,
            PasswordHash = dto.PasswordHash,
            DisplayName = dto.DisplayName,
            RoleName = dto.RoleName,
            IsActive = dto.IsActive,
            LastLoginAtUtc = dto.LastLoginAtUtc,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.AppUsers.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAppUser), new { id = entity.UserId }, MapToDto(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateAppUser(Guid id, UpdateAppUserDto dto)
    {
        var entity = await _context.AppUsers.FindAsync(id);
        if (entity is null)
        {
            return NotFound();
        }

        entity.Email = dto.Email;
        entity.PasswordHash = dto.PasswordHash;
        entity.DisplayName = dto.DisplayName;
        entity.RoleName = dto.RoleName;
        entity.IsActive = dto.IsActive;
        entity.LastLoginAtUtc = dto.LastLoginAtUtc;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAppUser(Guid id)
    {
        var entity = await _context.AppUsers.FindAsync(id);
        if (entity is null)
        {
            return NotFound();
        }

        _context.AppUsers.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static AppUserDto MapToDto(AppUser user) => new()
    {
        UserId = user.UserId,
        Email = user.Email,
        DisplayName = user.DisplayName,
        RoleName = user.RoleName,
        IsActive = user.IsActive,
        LastLoginAtUtc = user.LastLoginAtUtc,
        CreatedAtUtc = user.CreatedAtUtc,
        UpdatedAtUtc = user.UpdatedAtUtc
    };
}
