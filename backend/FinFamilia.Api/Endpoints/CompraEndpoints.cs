using FinFamilia.Api.Data;
using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Endpoints;

// Sub-DTO para rateio por pessoa
public record CompraPessoaRequest(int PessoaId, decimal ValorRateio);

// DTO para criação/atualização de compra
public record CompraRequest(
    string Descricao,
    decimal Valor,
    int Parcelas,
    DateOnly DataCompra,
    int CartaoId,
    int CategoriaId,
    bool Recorrente,
    DateOnly? DataInicioRecorrencia,
    bool Ativa,
    List<CompraPessoaRequest> Pessoas
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
                .Include(c => c.CompraPessoas)
                    .ThenInclude(cp => cp.Pessoa)
                .Select(c => new
                {
                    c.Id,
                    c.Descricao,
                    c.Valor,
                    c.Parcelas,
                    c.DataCompra,
                    c.Recorrente,
                    c.DataInicioRecorrencia,
                    c.Ativa,
                    c.CartaoId,
                    cartao = new { c.Cartao.Id, c.Cartao.Nome, c.Cartao.Cor },
                    c.CategoriaId,
                    categoria = new { c.Categoria.Id, c.Categoria.Nome, c.Categoria.Emoji, c.Categoria.Cor },
                    pessoas = c.CompraPessoas.Select(cp => new
                    {
                        cp.PessoaId,
                        cp.Pessoa.Nome,
                        cp.Pessoa.Cor,
                        cp.ValorRateio
                    }).ToList()
                })
                .ToListAsync());

        // Busca compra por ID
        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
        {
            var compra = await db.Compras
                .Include(c => c.Cartao)
                .Include(c => c.Categoria)
                .Include(c => c.CompraPessoas)
                    .ThenInclude(cp => cp.Pessoa)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (compra is null) return Results.NotFound();

            return Results.Ok(new
            {
                compra.Id,
                compra.Descricao,
                compra.Valor,
                compra.Parcelas,
                compra.DataCompra,
                compra.Recorrente,
                compra.DataInicioRecorrencia,
                compra.Ativa,
                compra.CartaoId,
                cartao = new { compra.Cartao.Id, compra.Cartao.Nome, compra.Cartao.Cor },
                compra.CategoriaId,
                categoria = new { compra.Categoria.Id, compra.Categoria.Nome, compra.Categoria.Emoji, compra.Categoria.Cor },
                pessoas = compra.CompraPessoas.Select(cp => new
                {
                    cp.PessoaId,
                    cp.Pessoa.Nome,
                    cp.Pessoa.Cor,
                    cp.ValorRateio
                }).ToList()
            });
        });

        // Cria nova compra
        group.MapPost("/", async (CompraRequest req, AppDbContext db) =>
        {
            var pessoaIds = req.Pessoas.Select(p => p.PessoaId).ToList();
            var pessoasExistentes = await db.Pessoas
                .Where(p => pessoaIds.Contains(p.Id))
                .ToListAsync();

            var compra = new Compra
            {
                Descricao = req.Descricao,
                Valor = req.Valor,
                Parcelas = req.Parcelas,
                DataCompra = req.DataCompra,
                CartaoId = req.CartaoId,
                CategoriaId = req.CategoriaId,
                Recorrente = req.Recorrente,
                DataInicioRecorrencia = req.DataInicioRecorrencia,
                Ativa = req.Ativa,
            };

            db.Compras.Add(compra);
            await db.SaveChangesAsync();

            // Adiciona os rateios
            foreach (var pessoaReq in req.Pessoas)
            {
                db.CompraPessoas.Add(new CompraPessoa
                {
                    CompraId = compra.Id,
                    PessoaId = pessoaReq.PessoaId,
                    ValorRateio = pessoaReq.ValorRateio
                });
            }
            await db.SaveChangesAsync();

            return Results.Created($"/api/compras/{compra.Id}", new { compra.Id });
        });

        // Atualiza compra existente
        group.MapPut("/{id:int}", async (int id, CompraRequest req, AppDbContext db) =>
        {
            var compra = await db.Compras
                .Include(c => c.CompraPessoas)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (compra is null) return Results.NotFound();

            compra.Descricao = req.Descricao;
            compra.Valor = req.Valor;
            compra.Parcelas = req.Parcelas;
            compra.DataCompra = req.DataCompra;
            compra.CartaoId = req.CartaoId;
            compra.CategoriaId = req.CategoriaId;
            compra.Recorrente = req.Recorrente;
            compra.DataInicioRecorrencia = req.DataInicioRecorrencia;
            compra.Ativa = req.Ativa;

            // Remove rateios antigos e recria
            db.CompraPessoas.RemoveRange(compra.CompraPessoas);
            foreach (var pessoaReq in req.Pessoas)
            {
                db.CompraPessoas.Add(new CompraPessoa
                {
                    CompraId = compra.Id,
                    PessoaId = pessoaReq.PessoaId,
                    ValorRateio = pessoaReq.ValorRateio
                });
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { compra.Id });
        });

        // Encerra recorrência (marca Ativa = false sem excluir)
        group.MapPatch("/{id:int}/encerrar", async (int id, AppDbContext db) =>
        {
            var compra = await db.Compras.FindAsync(id);
            if (compra is null) return Results.NotFound();

            compra.Ativa = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { compra.Id, compra.Ativa });
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
