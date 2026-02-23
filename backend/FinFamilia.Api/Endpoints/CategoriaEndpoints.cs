using FinFamilia.Api.Data;
using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Endpoints;

public static class CategoriaEndpoints
{
    public static void MapCategoriaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/categorias").WithTags("Categorias");

        group.MapGet("/", async (AppDbContext db) =>
            await db.Categorias.ToListAsync());

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Categorias.FindAsync(id) is Categoria categoria
                ? Results.Ok(categoria)
                : Results.NotFound());

        group.MapPost("/", async (Categoria categoria, AppDbContext db) =>
        {
            db.Categorias.Add(categoria);
            await db.SaveChangesAsync();
            return Results.Created($"/api/categorias/{categoria.Id}", categoria);
        });

        group.MapPut("/{id:int}", async (int id, Categoria input, AppDbContext db) =>
        {
            var categoria = await db.Categorias.FindAsync(id);
            if (categoria is null) return Results.NotFound();

            categoria.Nome = input.Nome;
            categoria.Emoji = input.Emoji;
            categoria.Cor = input.Cor;

            await db.SaveChangesAsync();
            return Results.Ok(categoria);
        });

        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var categoria = await db.Categorias.FindAsync(id);
            if (categoria is null) return Results.NotFound();

            var emUso = await db.Compras.AnyAsync(c => c.CategoriaId == id);
            if (emUso) return Results.Conflict("Categoria está em uso em compras.");

            db.Categorias.Remove(categoria);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
