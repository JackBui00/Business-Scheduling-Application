using BusinessSchedulingApplication.Server.DTOs;
using BusinessSchedulingApplication.Server.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Controllers;

[ApiController]
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
        var customers = await _context.Customers
            .AsNoTracking()
            .Select(customer => MapToDto(customer))
            .ToListAsync();

        return Ok(customers);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> GetCustomer(Guid id)
    {
        var entity = await _context.Customers.FindAsync(id);
        return entity is null ? NotFound() : Ok(MapToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> CreateCustomer(CreateCustomerDto dto)
    {
        var entity = new Customer
        {
            CustomerId = dto.CustomerId ?? Guid.NewGuid(),
            FullName = dto.FullName,
            PhoneNumber = dto.PhoneNumber,
            Email = dto.Email,
            Notes = dto.Notes,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Customers.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCustomer), new { id = entity.CustomerId }, MapToDto(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateCustomer(Guid id, UpdateCustomerDto dto)
    {
        var entity = await _context.Customers.FindAsync(id);
        if (entity is null)
        {
            return NotFound();
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
        var entity = await _context.Customers.FindAsync(id);
        if (entity is null)
        {
            return NotFound();
        }

        _context.Customers.Remove(entity);
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
}
