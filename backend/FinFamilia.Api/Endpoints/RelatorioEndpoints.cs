using ClosedXML.Excel;
using FinFamilia.Api.Data;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Text;

namespace FinFamilia.Api.Endpoints;

public static class RelatorioEndpoints
{
    public static void MapRelatorioEndpoints(this WebApplication app)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var group = app.MapGroup("/api/relatorios").WithTags("Relatórios");

        // ──────────────────────────────────────────────
        // CSV
        // ──────────────────────────────────────────────
        group.MapGet("/csv", async (int? pessoaId, int mes, int ano, AppDbContext db) =>
        {
            var compras = await ObterCompras(db, pessoaId, mes, ano);

            var sb = new StringBuilder();
            sb.AppendLine("Data;Descrição;Valor Total;Pessoa;Valor Rateio;Cartão;Categoria;Parcelas;Valor da Parcela");

            foreach (var c in compras)
            {
                foreach (var cp in c.CompraPessoas)
                {
                    if (pessoaId.HasValue && cp.PessoaId != pessoaId.Value) continue;
                    sb.AppendLine(string.Join(";",
                        c.DataCompra.ToString("dd/MM/yyyy"),
                        Escapar(c.Descricao),
                        c.Valor.ToString("F2"),
                        Escapar(cp.Pessoa.Nome),
                        cp.ValorRateio.ToString("F2"),
                        Escapar(c.Cartao.Nome),
                        Escapar(c.Categoria.Nome),
                        c.Parcelas,
                        (cp.ValorRateio / c.Parcelas).ToString("F2")
                    ));
                }
            }

            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            return Results.File(bytes, "text/csv", $"relatorio_{mes:D2}_{ano}.csv");
        });

        // ──────────────────────────────────────────────
        // XLSX
        // ──────────────────────────────────────────────
        group.MapGet("/xlsx", async (int? pessoaId, int mes, int ano, AppDbContext db) =>
        {
            var compras = await ObterCompras(db, pessoaId, mes, ano);

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Relatório");

            // Cabeçalho
            var headers = new[] { "Data", "Descrição", "Valor Total", "Pessoa", "Valor Rateio", "Cartão", "Categoria", "Parcelas", "Valor da Parcela" };
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1e293b");
                cell.Style.Font.FontColor = XLColor.White;
            }

            int row = 2;
            foreach (var c in compras)
            {
                foreach (var cp in c.CompraPessoas)
                {
                    if (pessoaId.HasValue && cp.PessoaId != pessoaId.Value) continue;
                    ws.Cell(row, 1).Value = c.DataCompra.ToString("dd/MM/yyyy");
                    ws.Cell(row, 2).Value = c.Descricao;
                    ws.Cell(row, 3).Value = c.Valor;
                    ws.Cell(row, 3).Style.NumberFormat.Format = "R$ #,##0.00";
                    ws.Cell(row, 4).Value = cp.Pessoa.Nome;
                    ws.Cell(row, 5).Value = cp.ValorRateio;
                    ws.Cell(row, 5).Style.NumberFormat.Format = "R$ #,##0.00";
                    ws.Cell(row, 6).Value = c.Cartao.Nome;
                    ws.Cell(row, 7).Value = c.Categoria.Nome;
                    ws.Cell(row, 8).Value = c.Parcelas;
                    ws.Cell(row, 9).Value = cp.ValorRateio / c.Parcelas;
                    ws.Cell(row, 9).Style.NumberFormat.Format = "R$ #,##0.00";
                    row++;
                }
            }

            ws.Columns().AdjustToContents();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return Results.File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"relatorio_{mes:D2}_{ano}.xlsx");
        });

        // ──────────────────────────────────────────────
        // PDF
        // ──────────────────────────────────────────────
        group.MapGet("/pdf", async (int? pessoaId, int mes, int ano, AppDbContext db) =>
        {
            var compras = await ObterCompras(db, pessoaId, mes, ano);

            // Achata as linhas (uma por pessoa por compra)
            var linhas = compras
                .SelectMany(c => c.CompraPessoas
                    .Where(cp => !pessoaId.HasValue || cp.PessoaId == pessoaId.Value)
                    .Select(cp => new
                    {
                        Data = c.DataCompra.ToString("dd/MM/yyyy"),
                        c.Descricao,
                        Valor = c.Valor.ToString("F2"),
                        Pessoa = cp.Pessoa.Nome,
                        Rateio = cp.ValorRateio.ToString("F2"),
                        Cartao = c.Cartao.Nome,
                        Categoria = c.Categoria.Nome,
                        Parcelas = c.Parcelas.ToString(),
                        ValorParcela = (cp.ValorRateio / c.Parcelas).ToString("F2")
                    }))
                .ToList();

            var nomesMes = new[] { "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                                       "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro" };

            var pdf = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4.Landscape());
                    page.Margin(1.5f, Unit.Centimetre);
                    page.DefaultTextStyle(x => x.FontSize(9));

                    page.Header().Text($"Relatório — {nomesMes[mes]}/{ano}")
                        .SemiBold().FontSize(14).FontColor(Colors.Grey.Darken3);

                    page.Content().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(60);  // Data
                            cols.RelativeColumn(3);   // Descrição
                            cols.ConstantColumn(65);  // Valor
                            cols.RelativeColumn(2);   // Pessoa
                            cols.ConstantColumn(65);  // Rateio
                            cols.RelativeColumn(2);   // Cartão
                            cols.RelativeColumn(2);   // Categoria
                            cols.ConstantColumn(45);  // Parcelas
                            cols.ConstantColumn(65);  // Vlr Parcela
                        });

                        // Cabeçalho
                        var headers = new[] { "Data", "Descrição", "Valor", "Pessoa", "Rateio", "Cartão", "Categoria", "Parcelas", "Vlr Parcela" };
                        table.Header(header =>
                        {
                            foreach (var h in headers)
                            {
                                header.Cell().Background("#1e293b").Padding(4).Text(h)
                                    .FontColor("#ffffff").Bold().FontSize(8);
                            }
                        });

                        // Dados
                        bool zebraToggle = false;
                        foreach (var l in linhas)
                        {
                            var bg = zebraToggle ? "#f8fafc" : "#ffffff";
                            zebraToggle = !zebraToggle;
                            foreach (var val in new[] { l.Data, l.Descricao, $"R$ {l.Valor}", l.Pessoa, $"R$ {l.Rateio}", l.Cartao, l.Categoria, l.Parcelas, $"R$ {l.ValorParcela}" })
                            {
                                table.Cell().Background(bg).Padding(3).Text(val);
                            }
                        }
                    });

                    page.Footer().AlignRight().Text(x =>
                    {
                        x.Span("Página ").FontSize(8);
                        x.CurrentPageNumber().FontSize(8);
                        x.Span(" de ").FontSize(8);
                        x.TotalPages().FontSize(8);
                    });
                });
            });

            var bytes = pdf.GeneratePdf();
            return Results.File(bytes, "application/pdf", $"relatorio_{mes:D2}_{ano}.pdf");
        });
    }

    // ──────────────────────────────────────────────────────────
    // Helper: busca compras filtrando por mês/ano e pessoa
    // ──────────────────────────────────────────────────────────
    private static async Task<List<FinFamilia.Api.Models.Compra>> ObterCompras(
        AppDbContext db, int? pessoaId, int mes, int ano)
    {
        var query = db.Compras
            .Include(c => c.Cartao)
            .Include(c => c.Categoria)
            .Include(c => c.CompraPessoas)
                .ThenInclude(cp => cp.Pessoa)
            .Where(c => c.DataCompra.Month == mes && c.DataCompra.Year == ano);

        if (pessoaId.HasValue)
            query = query.Where(c => c.CompraPessoas.Any(cp => cp.PessoaId == pessoaId.Value));

        return await query.ToListAsync();
    }

    private static string Escapar(string valor) =>
        $"\"{valor.Replace("\"", "\"\"")}\"";
}
