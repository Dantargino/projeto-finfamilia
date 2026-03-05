# FinFamília — Controle de Cartões

Aplicação web para controle de gastos em cartões de crédito da família, com suporte a compras parceladas, múltiplos cartões, múltiplas pessoas e categorias de gasto.

## Funcionalidades

- **Dashboard** — visão geral com totais por cartão, gráfico de evolução mensal e distribuição por categoria
- **Compras** — cadastro de compras à vista ou parceladas, com filtro por mês, visualização de parcelas futuras e agrupamento por categoria
- **Cartões** — cadastro de cartões de crédito com limite, bandeira, data de fechamento e vencimento
- **Pessoas** — cadastro de membros da família para vincular às compras
- **Categorias** — categorias personalizadas com emoji e cor
- **Navegação por mês** — sidebar com todos os meses ativos (do início do ano até o último mês com parcela)
- **Persistência em banco de dados** — todos os dados são armazenados localmente em um arquivo SQLite via API REST

## Tecnologias

### Frontend

- HTML5
- CSS3 (variáveis CSS, Grid, Flexbox)
- JavaScript puro (sem frameworks ou dependências externas)
- Google Fonts: [Syne](https://fonts.google.com/specimen/Syne) + [DM Mono](https://fonts.google.com/specimen/DM+Mono)

### Backend

- [.NET 10](https://dotnet.microsoft.com/) — ASP.NET Core Minimal API
- [Entity Framework Core 10](https://learn.microsoft.com/ef/core/) — ORM
- [Microsoft.EntityFrameworkCore.Sqlite](https://learn.microsoft.com/ef/core/providers/sqlite/) — provider SQLite para EF Core
- [Swashbuckle / Swagger UI](https://swagger.io/) — documentação interativa da API
- [SQLite](https://www.sqlite.org/) — banco de dados relacional (arquivo local)

## Estrutura do projeto

```
projeto-finfamilia/
├── README.md
├── CHANGELOG.md
├── src/                              # Frontend
│   ├── index.html                    # Estrutura e marcação da aplicação
│   ├── styles.css                    # Estilos e tema visual
│   └── script.js                     # Lógica, estado e chamadas à API
└── backend/
    └── FinFamilia.Api/               # API REST (.NET 10)
        ├── Program.cs                # Ponto de entrada e configuração
        ├── appsettings.json          # Connection string e configurações
        ├── FinFamilia.Api.csproj     # Dependências NuGet
        ├── Data/
        │   └── AppDbContext.cs       # EF Core DbContext
        ├── Models/
        │   ├── Cartao.cs
        │   ├── Pessoa.cs
        │   ├── Categoria.cs
        │   └── Compra.cs
        ├── Endpoints/
        │   ├── CartaoEndpoints.cs    # GET/POST/PUT/DELETE /api/cartoes
        │   ├── PessoaEndpoints.cs    # GET/POST/PUT/DELETE /api/pessoas
        │   ├── CategoriaEndpoints.cs # GET/POST/PUT/DELETE /api/categorias
        │   └── CompraEndpoints.cs    # GET/POST/PUT/DELETE /api/compras
        └── Migrations/               # Migrations EF Core (geradas automaticamente)
```

- [.NET 10 SDK](https://dotnet.microsoft.com/download)

### 1. Iniciar o backend

Navegue até a pasta do backend e execute o projeto. O banco de dados SQLite (`finfamilia.db`) será criado automaticamente na primeira execução.

```bash
cd backend/FinFamilia.Api
dotnet run
```

A API sobe em `http://localhost:5006`.  
O Swagger UI fica disponível em `http://localhost:5006/swagger`.

> As migrations são aplicadas automaticamente e o arquivo do banco de dados é gerado na raiz da pasta `FinFamilia.Api`.

### 4. Abrir o frontend

Abra o arquivo `src/index.html` diretamente no navegador — nenhum servidor adicional é necessário.

## API — Endpoints disponíveis

| Método   | Rota                   | Descrição                                     |
| -------- | ---------------------- | --------------------------------------------- |
| `GET`    | `/api/cartoes`         | Lista todos os cartões                        |
| `POST`   | `/api/cartoes`         | Cria um novo cartão                           |
| `PUT`    | `/api/cartoes/{id}`    | Atualiza um cartão                            |
| `DELETE` | `/api/cartoes/{id}`    | Remove um cartão                              |
| `GET`    | `/api/pessoas`         | Lista todas as pessoas                        |
| `POST`   | `/api/pessoas`         | Cria uma nova pessoa                          |
| `PUT`    | `/api/pessoas/{id}`    | Atualiza uma pessoa                           |
| `DELETE` | `/api/pessoas/{id}`    | Remove uma pessoa                             |
| `GET`    | `/api/categorias`      | Lista todas as categorias                     |
| `POST`   | `/api/categorias`      | Cria uma nova categoria                       |
| `PUT`    | `/api/categorias/{id}` | Atualiza uma categoria                        |
| `DELETE` | `/api/categorias/{id}` | Remove uma categoria                          |
| `GET`    | `/api/compras`         | Lista todas as compras com dados relacionados |
| `POST`   | `/api/compras`         | Cria uma nova compra                          |
| `PUT`    | `/api/compras/{id}`    | Atualiza uma compra                           |
| `DELETE` | `/api/compras/{id}`    | Remove uma compra                             |

## Dados e persistência

Os dados são armazenados localmente em um arquivo SQLite (`finfamilia.db`). O schema é gerenciado pelo Entity Framework Core via Migrations.

Tabelas criadas:

- `Cartoes` — cartões de crédito
- `Pessoas` — membros da família
- `Categorias` — categorias de gasto
- `Compras` — lançamentos de compras
- `ComprasPessoas` — tabela de junção N:N entre compras e pessoas
