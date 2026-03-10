namespace FinFamilia.Api.Models;

public class Pessoa
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Cor { get; set; } = "#e8ff5a";

    public ICollection<CompraPessoa> CompraPessoas { get; set; } = [];
}
