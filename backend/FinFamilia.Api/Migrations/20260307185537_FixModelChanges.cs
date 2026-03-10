using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinFamilia.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComprasPessoas");

            migrationBuilder.AddColumn<bool>(
                name: "Ativa",
                table: "Compras",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DataInicioRecorrencia",
                table: "Compras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Recorrente",
                table: "Compras",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "CompraPessoas",
                columns: table => new
                {
                    CompraId = table.Column<int>(type: "INTEGER", nullable: false),
                    PessoaId = table.Column<int>(type: "INTEGER", nullable: false),
                    ValorRateio = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompraPessoas", x => new { x.CompraId, x.PessoaId });
                    table.ForeignKey(
                        name: "FK_CompraPessoas_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CompraPessoas_Pessoas_PessoaId",
                        column: x => x.PessoaId,
                        principalTable: "Pessoas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompraPessoas_PessoaId",
                table: "CompraPessoas",
                column: "PessoaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompraPessoas");

            migrationBuilder.DropColumn(
                name: "Ativa",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "DataInicioRecorrencia",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "Recorrente",
                table: "Compras");

            migrationBuilder.CreateTable(
                name: "ComprasPessoas",
                columns: table => new
                {
                    ComprasId = table.Column<int>(type: "INTEGER", nullable: false),
                    PessoasId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComprasPessoas", x => new { x.ComprasId, x.PessoasId });
                    table.ForeignKey(
                        name: "FK_ComprasPessoas_Compras_ComprasId",
                        column: x => x.ComprasId,
                        principalTable: "Compras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ComprasPessoas_Pessoas_PessoasId",
                        column: x => x.PessoasId,
                        principalTable: "Pessoas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ComprasPessoas_PessoasId",
                table: "ComprasPessoas",
                column: "PessoasId");
        }
    }
}
