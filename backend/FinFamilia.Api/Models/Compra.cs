namespace FinFamilia.Api.Models;

public class Compra
{
    public int Id { get; set; }
    public string Descricao { get; set; } = "";
    public decimal Valor { get; set; }
    public int Parcelas { get; set; } = 1;
    public DateOnly DataCompra { get; set; }

    // Recorrência mensal (ex: serviços de streaming)
    public bool Recorrente { get; set; } = false;
    public DateOnly? DataInicioRecorrencia { get; set; }
    public bool Ativa { get; set; } = true;

    public int CartaoId { get; set; }
    public Cartao Cartao { get; set; } = null!;

    public int CategoriaId { get; set; }
    public Categoria Categoria { get; set; } = null!;

    // Relacionamento N:N com Pessoa via entidade explícita (permite armazenar ValorRateio)
    public ICollection<CompraPessoa> CompraPessoas { get; set; } = [];
}
