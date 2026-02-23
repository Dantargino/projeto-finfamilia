namespace FinFamilia.Api.Models;

public class Cartao
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Bandeira { get; set; } = "";
    public decimal Limite { get; set; }
    public string Cor { get; set; } = "#5af0e8";
    public int Fechamento { get; set; }
    public int Vencimento { get; set; }

    public ICollection<Compra> Compras { get; set; } = [];
}
