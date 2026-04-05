using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessSchedulingApplication.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessDescriptionToAppUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BusinessDescription",
                table: "AppUsers",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BusinessDescription",
                table: "AppUsers");
        }
    }
}
