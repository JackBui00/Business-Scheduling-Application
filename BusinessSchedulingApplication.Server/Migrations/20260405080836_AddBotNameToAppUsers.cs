using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessSchedulingApplication.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddBotNameToAppUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BotName",
                table: "AppUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BotName",
                table: "AppUsers");
        }
    }
}
