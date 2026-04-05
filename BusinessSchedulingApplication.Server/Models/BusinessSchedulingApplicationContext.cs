using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace BusinessSchedulingApplication.Server.Models;

public partial class BusinessSchedulingApplicationContext : DbContext
{
    public BusinessSchedulingApplicationContext()
    {
    }

    public BusinessSchedulingApplicationContext(DbContextOptions<BusinessSchedulingApplicationContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AppUser> AppUsers { get; set; }

    public virtual DbSet<Appointment> Appointments { get; set; }

    public virtual DbSet<Customer> Customers { get; set; }

    public virtual DbSet<CustomerOwner> CustomerOwners { get; set; }

    public virtual DbSet<BusinessHour> BusinessHours { get; set; }

    public virtual DbSet<SmsConversation> SmsConversations { get; set; }

    public virtual DbSet<SmsMessage> SmsMessages { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(e => e.UserId);

            entity.HasIndex(e => e.Email, "IX_AppUsers_Email").IsUnique();

            entity.Property(e => e.UserId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.PasswordHash).HasMaxLength(500);
            entity.Property(e => e.RoleName).HasMaxLength(50);
            entity.Property(e => e.TimeZoneId).HasMaxLength(100).HasDefaultValue("UTC");
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
        });

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.HasIndex(e => e.CreatedByUserId, "IX_Appointments_CreatedByUserId");

            entity.HasIndex(e => new { e.CustomerId, e.ScheduledAtUtc }, "IX_Appointments_CustomerId_ScheduledAtUtc");

            entity.Property(e => e.AppointmentId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.CreatedVia).HasMaxLength(20);
            entity.Property(e => e.ServiceName).HasMaxLength(200);
            entity.Property(e => e.Status).HasMaxLength(30);
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.CreatedByUser).WithMany(p => p.Appointments).HasForeignKey(d => d.CreatedByUserId);

            entity.HasOne(d => d.Customer).WithMany(p => p.Appointments)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<BusinessHour>(entity =>
        {
            entity.HasIndex(e => new { e.OwnerUserId, e.DayOfWeek }, "IX_BusinessHours_OwnerUserId_DayOfWeek").IsUnique();

            entity.HasIndex(e => e.OwnerUserId, "IX_BusinessHours_OwnerUserId");

            entity.Property(e => e.BusinessHourId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.DayOfWeek);
            entity.Property(e => e.ClosesAtUtc).HasColumnType("time");
            entity.Property(e => e.OpensAtUtc).HasColumnType("time");
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.OwnerUser).WithMany(p => p.BusinessHours)
                .HasForeignKey(d => d.OwnerUserId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<CustomerOwner>(entity =>
        {
            entity.HasIndex(e => e.CustomerId, "IX_CustomerOwners_CustomerId");

            entity.HasIndex(e => e.OwnerUserId, "IX_CustomerOwners_OwnerUserId");

            entity.HasIndex(e => new { e.CustomerId, e.OwnerUserId }, "IX_CustomerOwners_CustomerId_OwnerUserId").IsUnique();

            entity.Property(e => e.CustomerOwnerId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Customer).WithMany(p => p.CustomerOwners)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.OwnerUser).WithMany(p => p.CustomerOwnerships)
                .HasForeignKey(d => d.OwnerUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasIndex(e => e.FullName, "IX_Customers_FullName");

            entity.HasIndex(e => e.PhoneNumber, "IX_Customers_PhoneNumber").IsUnique();

            entity.Property(e => e.CustomerId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.FullName).HasMaxLength(200);
            entity.Property(e => e.PhoneNumber).HasMaxLength(30);
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
        });

        modelBuilder.Entity<SmsConversation>(entity =>
        {
            entity.HasKey(e => e.ConversationId);

            entity.HasIndex(e => e.CustomerId, "IX_SmsConversations_CustomerId").IsUnique();

            entity.Property(e => e.ConversationId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Customer).WithOne(p => p.SmsConversation)
                .HasForeignKey<SmsConversation>(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<SmsMessage>(entity =>
        {
            entity.HasIndex(e => new { e.ConversationId, e.SentAtUtc }, "IX_SmsMessages_ConversationId_SentAtUtc");

            entity.HasIndex(e => e.CustomerId, "IX_SmsMessages_CustomerId");

            entity.Property(e => e.SmsMessageId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.DeliveryStatus).HasMaxLength(20);
            entity.Property(e => e.Direction).HasMaxLength(20);
            entity.Property(e => e.SentAtUtc).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Conversation).WithMany(p => p.SmsMessages)
                .HasForeignKey(d => d.ConversationId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Customer).WithMany(p => p.SmsMessages)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
