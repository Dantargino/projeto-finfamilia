namespace FinFamilia.Api.Models;

public class Compra
{
    public int Id { get; set; }
    public string Descricao { get; set; } = "";
    public decimal Valor { get; set; }
    public int Parcelas { get; set; } = 1;
    public DateOnly DataCompra { get; set; }

    public int CartaoId { get; set; }
    public Cartao Cartao { get; set; } = null!;

    public int CategoriaId { get; set; }
    public Categoria Categoria { get; set; } = null!;

    // Relacionamento N:N com Pessoa (tabela de junção gerada automaticamente pelo EF)
    public ICollection<Pessoa> Pessoas { get; set; } = [];
}
