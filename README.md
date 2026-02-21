# FinFamília — Controle de Cartões

Aplicação web para controle de gastos em cartões de crédito da família, com suporte a compras parceladas, múltiplos cartões, múltiplas pessoas e categorias de gasto.

## Funcionalidades

- **Dashboard** — visão geral com totais por cartão, gráfico de evolução mensal e distribuição por categoria
- **Compras** — cadastro de compras à vista ou parceladas, com filtro por mês, visualização de parcelas futuras e agrupamento por categoria
- **Cartões** — cadastro de cartões de crédito com limite, bandeira, data de fechamento e vencimento
- **Pessoas** — cadastro de membros da família para vincular às compras
- **Categorias** — categorias personalizadas com emoji e cor
- **Navegação por mês** — sidebar com todos os meses ativos (do início do ano até o último mês com parcela)
- **Persistência local** — todos os dados são salvos no `localStorage` do navegador

## Tecnologias

- HTML5
- CSS3 (variáveis CSS, Grid, Flexbox)
- JavaScript puro (sem frameworks ou dependências externas)
- Google Fonts: [Syne](https://fonts.google.com/specimen/Syne) + [DM Mono](https://fonts.google.com/specimen/DM+Mono)

## Estrutura do projeto

```
projeto-finfamilia/
├── README.md
└── src/
    ├── index.html   # Estrutura e marcação da aplicação
    ├── styles.css   # Estilos e tema visual
    └── script.js    # Lógica, estado e renderização
```

## Como executar

Abra o arquivo `src/index.html` diretamente no navegador — nenhuma instalação ou servidor é necessário.

## Dados e persistência

Os dados são armazenados no `localStorage` sob a chave `finFamiliaState`. Para resetar para os dados de exemplo, basta limpar o `localStorage` do navegador (DevTools → Application → Local Storage).
