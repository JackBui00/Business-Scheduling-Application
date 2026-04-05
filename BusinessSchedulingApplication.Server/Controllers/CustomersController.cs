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
        var ownedCustomerIds = _context.CustomerOwners
            .AsNoTracking()
            .Where(customerOwner => customerOwner.OwnerUserId == currentUserId)
            .Select(customerOwner => customerOwner.CustomerId);

        var customers = await _context.Customers
            .AsNoTracking()
            .Where(customer => ownedCustomerIds.Contains(customer.CustomerId))
            .ToListAsync();

        return Ok(customers.Select(MapToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> GetCustomer(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        var ownedCustomerIds = _context.CustomerOwners
            .AsNoTracking()
            .Where(customerOwner => customerOwner.OwnerUserId == currentUserId)
            .Select(customerOwner => customerOwner.CustomerId);

        var entity = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(customer => customer.CustomerId == id && ownedCustomerIds.Contains(customer.CustomerId));
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> CreateCustomer(CreateCustomerDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        var existingCustomer = await _context.Customers
            .Include(customer => customer.CustomerOwners)
            .FirstOrDefaultAsync(customer => customer.PhoneNumber == dto.PhoneNumber);

        Customer entity;

        if (existingCustomer is null)
        {
            entity = new Customer
            {
                CustomerId = dto.CustomerId ?? Guid.NewGuid(),
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

        var existingLink = await _context.CustomerOwners
            .FirstOrDefaultAsync(customerOwner => customerOwner.CustomerId == entity.CustomerId && customerOwner.OwnerUserId == currentUserId);

        if (existingLink is null)
        {
            _context.CustomerOwners.Add(new CustomerOwner
            {
                CustomerOwnerId = Guid.NewGuid(),
                CustomerId = entity.CustomerId,
                OwnerUserId = currentUserId,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
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
        var ownedCustomerIds = _context.CustomerOwners
            .AsNoTracking()
            .Where(customerOwner => customerOwner.OwnerUserId == currentUserId)
            .Select(customerOwner => customerOwner.CustomerId);

        var entity = await _context.Customers.FirstOrDefaultAsync(customer =>
            customer.CustomerId == id &&
            ownedCustomerIds.Contains(customer.CustomerId));
        if (entity is null)
        {
            return NotFound();
        }

        var existingPhoneConflict = await _context.Customers.AnyAsync(customer =>
            customer.CustomerId != id &&
            customer.PhoneNumber == dto.PhoneNumber);

        if (existingPhoneConflict)
        {
            return Conflict(new { message = "Another customer already uses that phone number." });
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
        var entity = await _context.Customers
            .Include(customer => customer.CustomerOwners)
            .FirstOrDefaultAsync(customer =>
                customer.CustomerId == id &&
                _context.CustomerOwners.Any(customerOwner => customerOwner.CustomerId == customer.CustomerId && customerOwner.OwnerUserId == currentUserId));
        if (entity is null)
        {
            return NotFound();
        }

        var ownershipLink = entity.CustomerOwners.FirstOrDefault(customerOwner => customerOwner.OwnerUserId == currentUserId);
        if (ownershipLink is not null)
        {
            _context.CustomerOwners.Remove(ownershipLink);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/owners")]
    public async Task<IActionResult> AddCustomerOwner(Guid id, AddCustomerOwnerDto dto)
    {
        var currentUserId = GetCurrentUserId();

        var canAccessCustomer = await _context.CustomerOwners.AnyAsync(customerOwner =>
            customerOwner.CustomerId == id &&
            customerOwner.OwnerUserId == currentUserId);

        if (!canAccessCustomer)
        {
            return NotFound();
        }

        var targetOwnerExists = await _context.AppUsers.AnyAsync(user => user.UserId == dto.OwnerUserId);
        if (!targetOwnerExists)
        {
            return BadRequest(new { message = "The selected business owner does not exist." });
        }

        var existingOwnership = await _context.CustomerOwners.AnyAsync(customerOwner =>
            customerOwner.CustomerId == id &&
            customerOwner.OwnerUserId == dto.OwnerUserId);

        if (!existingOwnership)
        {
            _context.CustomerOwners.Add(new CustomerOwner
            {
                CustomerOwnerId = Guid.NewGuid(),
                CustomerId = id,
                OwnerUserId = dto.OwnerUserId,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpDelete("{id:guid}/owners/{ownerUserId:guid}")]
    public async Task<IActionResult> RemoveCustomerOwner(Guid id, Guid ownerUserId)
    {
        var currentUserId = GetCurrentUserId();

        var canAccessCustomer = await _context.CustomerOwners.AnyAsync(customerOwner =>
            customerOwner.CustomerId == id &&
            customerOwner.OwnerUserId == currentUserId);

        if (!canAccessCustomer)
        {
            return NotFound();
        }

        var ownership = await _context.CustomerOwners.FirstOrDefaultAsync(customerOwner =>
            customerOwner.CustomerId == id &&
            customerOwner.OwnerUserId == ownerUserId);

        if (ownership is null)
        {
            return NotFound();
        }

        _context.CustomerOwners.Remove(ownership);
        await _context.SaveChangesAsync();
        return NoContent();
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
