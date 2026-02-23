using FinFamilia.Api.Data;
using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Endpoints;

// DTO para criação/atualização de compra (recebe pessoaIds como lista)
public record CompraRequest(
    string Descricao,
    decimal Valor,
    int Parcelas,
    DateOnly DataCompra,
    int CartaoId,
    int CategoriaId,
    List<int> PessoaIds
);

public static class CompraEndpoints
{
    public static void MapCompraEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/compras").WithTags("Compras");

        // Lista todas as compras com dados relacionados
        group.MapGet("/", async (AppDbContext db) =>
            await db.Compras
                .Include(c => c.Cartao)
                .Include(c => c.Categoria)
                .Include(c => c.Pessoas)
                .Select(c => new
                {
                    c.Id,
                    c.Descricao,
                    c.Valor,
                    c.Parcelas,
                    c.DataCompra,
                    c.CartaoId,
                    cartao = new { c.Cartao.Id, c.Cartao.Nome, c.Cartao.Cor },
                    c.CategoriaId,
                    categoria = new { c.Categoria.Id, c.Categoria.Nome, c.Categoria.Emoji, c.Categoria.Cor },
                    pessoaIds = c.Pessoas.Select(p => p.Id).ToList(),
                    pessoas = c.Pessoas.Select(p => new { p.Id, p.Nome, p.Cor }).ToList()
                })
                .ToListAsync());

        // Busca compra por ID
        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
        {
            var compra = await db.Compras
                .Include(c => c.Cartao)
                .Include(c => c.Categoria)
                .Include(c => c.Pessoas)
                .FirstOrDefaultAsync(c => c.Id == id);

            return compra is null ? Results.NotFound() : Results.Ok(compra);
        });

        // Cria nova compra
        group.MapPost("/", async (CompraRequest req, AppDbContext db) =>
        {
            var pessoas = await db.Pessoas
                .Where(p => req.PessoaIds.Contains(p.Id))
                .ToListAsync();

            var compra = new Compra
            {
                Descricao = req.Descricao,
                Valor = req.Valor,
                Parcelas = req.Parcelas,
                DataCompra = req.DataCompra,
                CartaoId = req.CartaoId,
                CategoriaId = req.CategoriaId,
                Pessoas = pessoas
            };

            db.Compras.Add(compra);
            await db.SaveChangesAsync();
            return Results.Created($"/api/compras/{compra.Id}", new { compra.Id });
        });

        // Atualiza compra existente
        group.MapPut("/{id:int}", async (int id, CompraRequest req, AppDbContext db) =>
        {
            var compra = await db.Compras
                .Include(c => c.Pessoas)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (compra is null) return Results.NotFound();

            var pessoas = await db.Pessoas
                .Where(p => req.PessoaIds.Contains(p.Id))
                .ToListAsync();

            compra.Descricao = req.Descricao;
            compra.Valor = req.Valor;
            compra.Parcelas = req.Parcelas;
            compra.DataCompra = req.DataCompra;
            compra.CartaoId = req.CartaoId;
            compra.CategoriaId = req.CategoriaId;
            compra.Pessoas = pessoas;

            await db.SaveChangesAsync();
            return Results.Ok(new { compra.Id });
        });

        // Remove compra
        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var compra = await db.Compras.FindAsync(id);
            if (compra is null) return Results.NotFound();

            db.Compras.Remove(compra);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
