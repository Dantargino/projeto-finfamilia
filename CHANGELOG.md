# Changelog

Todas as alterações relevantes do projeto são documentadas aqui.  
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## [Não publicado] — 2026-02-23

### Adicionado

#### Backend — `backend/FinFamilia.Api/` _(novo)_

Criação completa de uma API REST com ASP.NET Core 10 Minimal API conectada ao PostgreSQL via Entity Framework Core.

- **`Program.cs`** — ponto de entrada da aplicação:
  - Registro do `AppDbContext` com provider Npgsql (PostgreSQL)
  - Configuração de CORS (permite chamadas do frontend estático)
  - Swagger UI habilitado para ambiente de desenvolvimento
  - Aplicação automática de migrations na inicialização (`db.Database.Migrate()`)
  - Registro de todos os grupos de endpoints

- **`appsettings.json`** — connection string do PostgreSQL local:

  ```
  Host=localhost;Port=5432;Database=finfamilia;Username=finfamilia;Password=...
  ```

- **`Data/AppDbContext.cs`** — contexto do EF Core:
  - `DbSet<Cartao>`, `DbSet<Pessoa>`, `DbSet<Categoria>`, `DbSet<Compra>`
  - Relacionamento N:N entre `Compra` e `Pessoa` com tabela de junção `ComprasPessoas`
  - Precisão decimal configurada (`HasPrecision(18, 2)`) para `Cartao.Limite` e `Compra.Valor`

- **`Models/Cartao.cs`** — entidade com campos: `Id`, `Nome`, `Bandeira`, `Limite`, `Cor`, `Fechamento`, `Vencimento`

- **`Models/Pessoa.cs`** — entidade com campos: `Id`, `Nome`, `Cor`

- **`Models/Categoria.cs`** — entidade com campos: `Id`, `Nome`, `Emoji`, `Cor`

- **`Models/Compra.cs`** — entidade com campos: `Id`, `Descricao`, `Valor`, `Parcelas`, `DataCompra`, `CartaoId`, `CategoriaId` e navegação para `Cartao`, `Categoria` e `ICollection<Pessoa>`

- **`Endpoints/CartaoEndpoints.cs`** — grupo `/api/cartoes`:
  - `GET /` — lista todos
  - `GET /{id}` — busca por ID
  - `POST /` — cria novo
  - `PUT /{id}` — atualiza
  - `DELETE /{id}` — remove (retorna `409 Conflict` se em uso em compras)

- **`Endpoints/PessoaEndpoints.cs`** — grupo `/api/pessoas`:
  - `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`

- **`Endpoints/CategoriaEndpoints.cs`** — grupo `/api/categorias`:
  - `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}` (retorna `409 Conflict` se em uso)

- **`Endpoints/CompraEndpoints.cs`** — grupo `/api/compras`:
  - `GET /` — lista com dados relacionados (`Cartao`, `Categoria`, `Pessoas`, `pessoaIds`)
  - `GET /{id}` — busca por ID com includes
  - `POST /` — cria via `CompraRequest` (DTO com `pessoaIds: List<int>`)
  - `PUT /{id}` — atualiza incluindo atualização do N:N com pessoas
  - `DELETE /{id}` — remove

- **`FinFamilia.Api.csproj`** — dependências NuGet:
  - `Npgsql.EntityFrameworkCore.PostgreSQL` v10.0.0
  - `Microsoft.EntityFrameworkCore.Design` v10.0.3
  - `Swashbuckle.AspNetCore` v10.1.4
  - `Microsoft.AspNetCore.OpenApi` v10.0.3

- **`Migrations/`** — migration inicial `InitialCreate` gerada pelo EF Core:
  - Cria tabelas: `Cartoes`, `Pessoas`, `Categorias`, `Compras`, `ComprasPessoas`
  - Cria índices e chaves estrangeiras

---

### Alterado

#### `src/script.js` — refatoração da camada de dados

Substituição completa da persistência via `localStorage` por chamadas à API REST.

**Removido:**

- Objeto `dadosIniciais` (dados de seed hardcoded)
- Contadores `nextCartaoId`, `nextPessoaId`, `nextCategoriaId`, `nextCompraId` do `state` (passaram a ser gerenciados pelo banco com auto-increment)
- Constante `STORAGE_KEY`
- Função `saveState()` (serialização do estado completo em JSON para localStorage)
- Função `loadState()` síncrona (leitura do localStorage)

**Adicionado:**

- Constante `API_URL = 'http://localhost:5006'`
- Função utilitária `apiFetch(path, options)` — wrapper assíncrono do `fetch()` com header `Content-Type: application/json` e tratamento de erros HTTP
- Nova `loadState()` assíncrona — busca os 4 recursos em paralelo via `Promise.all` e normaliza o retorno das compras (garante `pessoaIds` como array)
- Funções de CRUD reescritas como `async/await`:
  - `saveCompra()` → `POST /api/compras`
  - `saveCartao()` → `POST /api/cartoes`
  - `savePessoa()` → `POST /api/pessoas`
  - `saveCategoria()` → `POST /api/categorias`
  - `deleteCompra(id)` → `DELETE /api/compras/{id}`
  - `deleteItem(type, id)` → `DELETE /api/{cartoes|pessoas|categorias}/{id}`
- Inicialização assíncrona: `loadState().then(() => renderAll())`

**Inalterado** (lógica de negócio e renderização):

- Todas as funções de cálculo: `getActiveMonths`, `addMonths`, `getFaturaEntries`, `getTotalMes`, `getParcelasFuturas`, `getCatTotals`
- Todas as funções de renderização: `renderDashboard`, `renderComprasTable`, `renderComprasSection`, `renderCartoes`, `renderPessoas`, `renderCategorias`, `renderSidebar`, `renderMonthStrip`
- Sistema de modais, navegação, tabs e toast

#### `src/styles.css`

- `font-size` do logo `.navbar .logo h1` reduzido de `24px` para `22px`

#### `src/index.html`

- Tag `<p>Controle de Cartões</p>` comentada no bloco `.logo` da navbar

#### `README.md`

- Reescrito completamente para refletir a nova arquitetura com backend .NET 10 + PostgreSQL
- Adicionada seção de pré-requisitos (`.NET 10 SDK`, `PostgreSQL 17`)
- Adicionadas instruções de setup do banco e da connection string
- Adicionada tabela completa de endpoints da API
- Atualizada seção de estrutura do projeto

---

### Ferramentas instaladas globalmente

- `dotnet-ef` v10.0.3 — CLI do Entity Framework Core para gerenciamento de migrations
