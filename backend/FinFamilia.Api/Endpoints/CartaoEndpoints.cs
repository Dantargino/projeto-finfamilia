using FinFamilia.Api.Data;
using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Endpoints;

public static class CartaoEndpoints
{
    public static void MapCartaoEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/cartoes").WithTags("Cartões");

        group.MapGet("/", async (AppDbContext db) =>
            await db.Cartoes.ToListAsync());

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Cartoes.FindAsync(id) is Cartao cartao
                ? Results.Ok(cartao)
                : Results.NotFound());

        group.MapPost("/", async (Cartao cartao, AppDbContext db) =>
        {
            db.Cartoes.Add(cartao);
            await db.SaveChangesAsync();
            return Results.Created($"/api/cartoes/{cartao.Id}", cartao);
        });

        group.MapPut("/{id:int}", async (int id, Cartao input, AppDbContext db) =>
        {
            var cartao = await db.Cartoes.FindAsync(id);
            if (cartao is null) return Results.NotFound();

            cartao.Nome = input.Nome;
            cartao.Bandeira = input.Bandeira;
            cartao.Limite = input.Limite;
            cartao.Cor = input.Cor;
            cartao.Fechamento = input.Fechamento;
            cartao.Vencimento = input.Vencimento;

            await db.SaveChangesAsync();
            return Results.Ok(cartao);
        });

        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var cartao = await db.Cartoes.FindAsync(id);
            if (cartao is null) return Results.NotFound();

            var emUso = await db.Compras.AnyAsync(c => c.CartaoId == id);
            if (emUso) return Results.Conflict("Cartão está em uso em compras.");

            db.Cartoes.Remove(cartao);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
