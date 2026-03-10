using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Cartao> Cartoes { get; set; }
    public DbSet<Pessoa> Pessoas { get; set; }
    public DbSet<Categoria> Categorias { get; set; }
    public DbSet<Compra> Compras { get; set; }
    public DbSet<CompraPessoa> CompraPessoas { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Entidade de junção explícita com chave composta
        modelBuilder.Entity<CompraPessoa>(entity =>
        {
            entity.HasKey(cp => new { cp.CompraId, cp.PessoaId });

            entity.HasOne(cp => cp.Compra)
                  .WithMany(c => c.CompraPessoas)
                  .HasForeignKey(cp => cp.CompraId);

            entity.HasOne(cp => cp.Pessoa)
                  .WithMany(p => p.CompraPessoas)
                  .HasForeignKey(cp => cp.PessoaId);

            entity.Property(cp => cp.ValorRateio)
                  .HasPrecision(18, 2);
        });

        // Precisão de decimais
        modelBuilder.Entity<Cartao>()
            .Property(c => c.Limite)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Compra>()
            .Property(c => c.Valor)
            .HasPrecision(18, 2);
    }
}
