namespace FinFamilia.Api.Models;

public class CompraPessoa
{
    public int CompraId { get; set; }
    public Compra Compra { get; set; } = null!;

    public int PessoaId { get; set; }
    public Pessoa Pessoa { get; set; } = null!;

    public decimal ValorRateio { get; set; }
}
