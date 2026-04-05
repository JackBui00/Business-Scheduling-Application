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
public class CustomersController : ControllerBase
{
    private readonly BusinessSchedulingApplicationContext _context;

    public CustomersController(BusinessSchedulingApplicationContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CustomerDto>>> GetCustomers()
    {
        var currentUserId = GetCurrentUserId();

        var customers = await _context.Customers
            .AsNoTracking()
            .Where(customer => customer.OwnerUserId == currentUserId)
            .ToListAsync();

        return Ok(customers.Select(MapToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> GetCustomer(Guid id)
    {
        var currentUserId = GetCurrentUserId();

        var entity = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(customer => customer.CustomerId == id && customer.OwnerUserId == currentUserId);

        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> CreateCustomer(CreateCustomerDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        var existingCustomer = await _context.Customers
            .FirstOrDefaultAsync(customer => customer.OwnerUserId == currentUserId && customer.PhoneNumber == dto.PhoneNumber);

        Customer entity;

        if (existingCustomer is null)
        {
            entity = new Customer
            {
                CustomerId = dto.CustomerId ?? Guid.NewGuid(),
                OwnerUserId = currentUserId,
                FullName = dto.FullName,
                PhoneNumber = dto.PhoneNumber,
                Email = dto.Email,
                Notes = dto.Notes,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };

            _context.Customers.Add(entity);
        }
        else
        {
            entity = existingCustomer;
            entity.FullName = dto.FullName;
            entity.PhoneNumber = dto.PhoneNumber;
            entity.Email = dto.Email;
            entity.Notes = dto.Notes;
            entity.UpdatedAtUtc = now;
        }

        await _context.SaveChangesAsync();

        return existingCustomer is null
            ? CreatedAtAction(nameof(GetCustomer), new { id = entity.CustomerId }, MapToDto(entity))
            : Ok(MapToDto(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateCustomer(Guid id, UpdateCustomerDto dto)
    {
        var currentUserId = GetCurrentUserId();

        var entity = await _context.Customers.FirstOrDefaultAsync(customer =>
            customer.CustomerId == id &&
            customer.OwnerUserId == currentUserId);
        if (entity is null)
        {
            return NotFound();
        }

        var existingPhoneConflict = await _context.Customers.AnyAsync(customer =>
            customer.CustomerId != id &&
            customer.OwnerUserId == currentUserId &&
            customer.PhoneNumber == dto.PhoneNumber);

        if (existingPhoneConflict)
        {
            return Conflict(new { message = "Another customer in your account already uses that phone number." });
        }

        entity.FullName = dto.FullName;
        entity.PhoneNumber = dto.PhoneNumber;
        entity.Email = dto.Email;
        entity.Notes = dto.Notes;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteCustomer(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var entity = await _context.Customers.FirstOrDefaultAsync(customer =>
            customer.CustomerId == id &&
            customer.OwnerUserId == currentUserId);

        if (entity is null)
        {
            return NotFound();
        }

        _context.Customers.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/owners")]
    public IActionResult AddCustomerOwner(Guid id, AddCustomerOwnerDto dto)
    {
        return Conflict(new
        {
            message = "Customer sharing between owners is no longer supported. Create a separate customer profile for the other owner."
        });
    }

    [HttpDelete("{id:guid}/owners/{ownerUserId:guid}")]
    public IActionResult RemoveCustomerOwner(Guid id, Guid ownerUserId)
    {
        return Conflict(new
        {
            message = "Customer sharing between owners is no longer supported."
        });
    }

    private static CustomerDto MapToDto(Customer customer) => new()
    {
        CustomerId = customer.CustomerId,
        FullName = customer.FullName,
        PhoneNumber = customer.PhoneNumber,
        Email = customer.Email,
        Notes = customer.Notes,
        CreatedAtUtc = customer.CreatedAtUtc,
        UpdatedAtUtc = customer.UpdatedAtUtc
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
