using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;
    private readonly PasswordHasher<AppUser> _passwordHasher = new();

    public AuthController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpPost("signup")]
    public async Task<ActionResult<AuthSessionDto>> SignUp(SignUpRequestDto request)
    {
        var email = NormalizeEmail(request.Email);
        var existingUser = await _context.AppUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Email == email);

        if (existingUser is not null)
        {
            return Conflict(new { message = "An account with this email already exists." });
        }

        var now = DateTime.UtcNow;
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            RoleName = "Owner",
            IsActive = true,
            TimeZoneId = NormalizeTimeZoneId(request.TimeZoneId),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.AppUsers.Add(user);
        await _context.SaveChangesAsync();

        await SignInAsync(user);

        return Ok(ToSession(user));
    }

    [HttpPost("signin")]
    public async Task<ActionResult<AuthSessionDto>> SignIn(SignInRequestDto request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _context.AppUsers.FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !user.IsActive)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        user.LastLoginAtUtc = DateTime.UtcNow;
        user.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await SignInAsync(user);

        return Ok(ToSession(user));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthSessionDto>> Me()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = await _context.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
        return user is null ? Unauthorized() : Ok(ToSession(user));
    }

    [Authorize]
    [HttpPost("signout")]
    public async Task<IActionResult> SignOutCurrentUser()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    private async Task SignInAsync(AppUser user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.DisplayName),
            new(ClaimTypes.Role, user.RoleName)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7)
            });
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static string NormalizeTimeZoneId(string timeZoneId)
    {
        return string.IsNullOrWhiteSpace(timeZoneId) ? "UTC" : timeZoneId.Trim();
    }

    private static AuthSessionDto ToSession(AppUser user) => new()
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
