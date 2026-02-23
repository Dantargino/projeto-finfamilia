using FinFamilia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinFamilia.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Cartao> Cartoes { get; set; }
    public DbSet<Pessoa> Pessoas { get; set; }
    public DbSet<Categoria> Categorias { get; set; }
    public DbSet<Compra> Compras { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Relacionamento N:N entre Compra e Pessoa (tabela ComprasPessoas)
        modelBuilder.Entity<Compra>()
            .HasMany(c => c.Pessoas)
            .WithMany(p => p.Compras)
            .UsingEntity(j => j.ToTable("ComprasPessoas"));

        // Precisão de decimais para o PostgreSQL
        modelBuilder.Entity<Cartao>()
            .Property(c => c.Limite)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Compra>()
            .Property(c => c.Valor)
            .HasPrecision(18, 2);
    }
}
