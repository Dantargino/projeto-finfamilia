using FinFamilia.Api.Data;
using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Endpoints;

public static class PessoaEndpoints
{
    public static void MapPessoaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/pessoas").WithTags("Pessoas");

        group.MapGet("/", async (AppDbContext db) =>
            await db.Pessoas.ToListAsync());

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Pessoas.FindAsync(id) is Pessoa pessoa
                ? Results.Ok(pessoa)
                : Results.NotFound());

        group.MapPost("/", async (Pessoa pessoa, AppDbContext db) =>
        {
            db.Pessoas.Add(pessoa);
            await db.SaveChangesAsync();
            return Results.Created($"/api/pessoas/{pessoa.Id}", pessoa);
        });

        group.MapPut("/{id:int}", async (int id, Pessoa input, AppDbContext db) =>
        {
            var pessoa = await db.Pessoas.FindAsync(id);
            if (pessoa is null) return Results.NotFound();

            pessoa.Nome = input.Nome;
            pessoa.Cor = input.Cor;

            await db.SaveChangesAsync();
            return Results.Ok(pessoa);
        });

        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var pessoa = await db.Pessoas.FindAsync(id);
            if (pessoa is null) return Results.NotFound();

            db.Pessoas.Remove(pessoa);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
