namespace FinFamilia.Api.Models;

public class Categoria
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Emoji { get; set; } = "📦";
    public string Cor { get; set; } = "#f59e0b";

    public ICollection<Compra> Compras { get; set; } = [];
}
