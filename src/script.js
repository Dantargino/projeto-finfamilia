// ═══════════════════════════════════════════
// CONFIGURAÇÃO DA API
// ═══════════════════════════════════════════
const API_URL = "http://localhost:5006";

async function apiFetch(path, options = {}) {
  const res = await fetch(API_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ═══════════════════════════════════════════
// ESTADO DA APLICAÇÃO
// ═══════════════════════════════════════════
const state = {
  selectedMonth: null,
  currentSection: "dashboard",
  currentTab: "gastos",

  cartoes: [],
  pessoas: [],
  categorias: [],
  compras: [],
};

// ═══════════════════════════════════════════
// PERSISTÊNCIA (API REST)
// ═══════════════════════════════════════════
async function loadState() {
  try {
    const [cartoes, pessoas, categorias, compras] = await Promise.all([
      apiFetch("/api/cartoes"),
      apiFetch("/api/pessoas"),
      apiFetch("/api/categorias"),
      apiFetch("/api/compras"),
    ]);

    state.cartoes = cartoes;
    state.pessoas = pessoas;
    state.categorias = categorias;

    // Normaliza compras: garante que pessoaIds exista como array de ints
    state.compras = compras.map((c) => ({
      id: c.id,
      descricao: c.descricao,
      valor: c.valor,
      parcelas: c.parcelas,
      dataCompra: c.dataCompra, // "YYYY-MM-DD"
      cartaoId: c.cartaoId,
      categoriaId: c.categoriaId,
      pessoaIds: c.pessoaIds ?? [],
    }));
  } catch (e) {
    toast("Erro ao conectar com a API: " + e.message, false);
  }
}

// ═══════════════════════════════════════════
// REGRAS DE NEGÓCIO
// ═══════════════════════════════════════════

// Retorna meses de janeiro do ano atual até o último mês com parcela
function getActiveMonths() {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.toISOString().slice(0, 7);

  // Encontra o último mês que possui alguma parcela
  let ultimoMes = mesAtual;
  state.compras.forEach((c) => {
    for (let p = 0; p < c.parcelas; p++) {
      const d = addMonths(c.dataCompra, p).slice(0, 7);
      if (d > ultimoMes) ultimoMes = d;
    }
  });

  // Gera sequência contínua: Jan/anoAtual → ultimoMes
  const inicio = new Date(anoAtual, 0, 1);
  const [fimAno, fimMes] = ultimoMes.split("-").map(Number);
  const fim = new Date(fimAno, fimMes - 1, 1);
  const months = [];
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// Retorna as "entradas de fatura" para um mês/cartao específico
function getFaturaEntries(monthStr, cartaoId = null) {
  const entries = [];
  state.compras.forEach((c) => {
    if (cartaoId && c.cartaoId !== cartaoId) return;
    for (let p = 0; p < c.parcelas; p++) {
      const dt = addMonths(c.dataCompra, p);
      if (dt.slice(0, 7) === monthStr) {
        entries.push({
          compra: c,
          numeroParcela: p + 1,
          totalParcelas: c.parcelas,
          valorParcela: c.valor / c.parcelas,
          dataCobranca: dt,
          isParcelado: c.parcelas > 1,
          isCarry: p > 0,
        });
      }
    }
  });
  return entries;
}

function getTotalMes(monthStr) {
  return getFaturaEntries(monthStr).reduce((s, e) => s + e.valorParcela, 0);
}

function getParcelasFuturas(monthStr) {
  const result = [];
  state.compras.forEach((c) => {
    if (c.parcelas <= 1) return;
    for (let p = 0; p < c.parcelas; p++) {
      const dt = addMonths(c.dataCompra, p);
      if (dt.slice(0, 7) > monthStr) {
        result.push({
          compra: c,
          numeroParcela: p + 1,
          totalParcelas: c.parcelas,
          valorParcela: c.valor / c.parcelas,
          dataCobranca: dt,
          mes: dt.slice(0, 7),
        });
      }
    }
  });
  return result.sort((a, b) => a.dataCobranca.localeCompare(b.dataCobranca));
}

function getCatTotals(monthStr) {
  const entries = getFaturaEntries(monthStr);
  const map = {};
  entries.forEach((e) => {
    const cat = state.categorias.find((c) => c.id === e.compra.categoriaId);
    if (!cat) return;
    map[cat.id] = (map[cat.id] || 0) + e.valorParcela;
  });
  return Object.entries(map)
    .map(([id, total]) => {
      const cat = state.categorias.find((c) => c.id === parseInt(id));
      return { cat, total };
    })
    .sort((a, b) => b.total - a.total);
}

// ═══════════════════════════════════════════
// RENDER HELPERS
// ═══════════════════════════════════════════
const fmt = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = (m) => {
  const [y, mo] = m.split("-");
  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return names[parseInt(mo) - 1] + " " + y;
};
const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};
const nowMonth = () => new Date().toISOString().slice(0, 7);

// ═══════════════════════════════════════════
// MONTH STRIP
// ═══════════════════════════════════════════
function renderMonthStrip() {
  const strip = document.getElementById("month-strip");
  const months = getActiveMonths();
  if (!state.selectedMonth) state.selectedMonth = nowMonth();

  strip.innerHTML = months
    .map((m) => {
      const total = getTotalMes(m);
      const entries = getFaturaEntries(m);
      const carries = entries.filter((e) => e.isCarry).length;
      const active = m === state.selectedMonth ? "active" : "";
      return `
      <button class="month-pill ${active}" data-month="${m}" onclick="selectMonth('${m}')">
        ${carries > 0 ? `<div class="m-badge">${carries}</div>` : ""}
        <span class="m-name">${fmtMonth(m)}</span>
        ${total > 0 ? `<span class="m-total">${fmt(total)}</span>` : '<span class="m-total" style="opacity:.3">—</span>'}
      </button>`;
    })
    .join("");

  // Scroll para o mês ativo
  const activeBtn = strip.querySelector(".month-pill.active");
  if (activeBtn)
    activeBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function selectMonth(m) {
  state.selectedMonth = m;
  renderAll();
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  const m = state.selectedMonth || nowMonth();
  const entries = getFaturaEntries(m);
  const totalMes = entries.reduce((s, e) => s + e.valorParcela, 0);
  const carries = entries.filter((e) => e.isCarry);
  const totalCarries = carries.reduce((s, e) => s + e.valorParcela, 0);
  const parcelados = getParcelasFuturas(m);
  const comprometido = parcelados.reduce((s, e) => s + e.valorParcela, 0);

  // Summary cards
  document.getElementById("summary-grid").innerHTML = `
    <div class="summary-card yellow">
      <div class="s-label">Total ${fmtMonth(m)}</div>
      <div class="s-value">${fmt(totalMes)}</div>
      <div class="s-sub">${entries.length} lançamentos</div>
    </div>
    <div class="summary-card cyan">
      <div class="s-label">Parcelas de Meses Anteriores</div>
      <div class="s-value">${fmt(totalCarries)}</div>
      <div class="s-sub">${carries.length} compras parceladas em aberto</div>
    </div>
    <div class="summary-card red">
      <div class="s-label">Comprometido Futuro</div>
      <div class="s-value">${fmt(comprometido)}</div>
      <div class="s-sub">Parcelas restantes nos próximos meses</div>
    </div>
    <div class="summary-card purple">
      <div class="s-label">Cartões Utilizados</div>
      <div class="s-value">${new Set(entries.map((e) => e.compra.cartaoId)).size}</div>
      <div class="s-sub">de ${state.cartoes.length} cartões cadastrados</div>
    </div>`;

  // Bar chart (últimos 6 meses + selecionado)
  const months = getActiveMonths();
  const idx = months.indexOf(m);
  const range = months.slice(Math.max(0, idx - 5), idx + 1);
  const vals = range.map((mm) => getTotalMes(mm));
  const maxVal = Math.max(...vals, 1);
  document.getElementById("bar-chart").innerHTML = range
    .map(
      (mm, i) => `
    <div class="bar-col">
      <div class="bar-val">${vals[i] > 0 ? fmt(vals[i]).replace("R$", "").trim() : ""}</div>
      <div class="bar" style="height:${Math.max(4, (vals[i] / maxVal) * 90)}px; background:${mm === m ? "var(--accent)" : "var(--surface3)"}; border:1px solid ${mm === m ? "transparent" : "var(--border)"}"></div>
      <div class="bar-label">${fmtMonth(mm).replace(" ", "<br>")}</div>
    </div>`,
    )
    .join("");

  // Cat chart
  document.getElementById("cat-chart-month").textContent = fmtMonth(m);
  const cats = getCatTotals(m);
  const maxCat = cats[0]?.total || 1;
  document.getElementById("cat-chart").innerHTML =
    cats.length === 0
      ? '<p style="font-size:11px;color:var(--text-dim);padding:8px 0;">Sem dados</p>'
      : cats
          .map(
            ({ cat, total }) => `
    <div class="cat-row">
      <span class="cat-name">${cat.emoji} ${cat.nome}</span>
      <div class="cat-bar-wrap">
        <div class="cat-bar-fill" style="width:${(total / maxCat) * 100}%;background:${cat.cor}"></div>
      </div>
      <span class="cat-amount">${fmt(total)}</span>
    </div>`,
          )
          .join("");

  // Recent table (last 5)
  const recent = [...entries]
    .sort((a, b) => b.dataCobranca.localeCompare(a.dataCobranca))
    .slice(0, 5);
  document.getElementById("recent-table-wrap").innerHTML = renderComprasTable(
    recent,
    false,
  );
}

// ═══════════════════════════════════════════
// COMPRAS TABLE
// ═══════════════════════════════════════════
function renderComprasTable(entries, showDelete = true) {
  if (entries.length === 0)
    return `<div class="empty"><div class="e-icon">🧾</div><p>Nenhuma compra neste mês</p></div>`;
  return `<table>
    <thead>
      <tr>
        <th>Estabelecimento</th>
        <th>Categoria</th>
        <th>Cartão</th>
        <th>Pessoa</th>
        <th>Parcelas</th>
        <th>Data da Compra</th>
        <th style="text-align:right">Valor Parcela</th>
        ${showDelete ? "<th></th>" : ""}
      </tr>
    </thead>
    <tbody>
      ${entries
        .map((e) => {
          const cat = state.categorias.find(
            (c) => c.id === e.compra.categoriaId,
          );
          const card = state.cartoes.find((c) => c.id === e.compra.cartaoId);
          const pessoas = e.compra.pessoaIds
            .map((pid) => state.pessoas.find((p) => p.id === pid))
            .filter(Boolean);
          return `<tr class="${e.isCarry ? "carry-row" : ""}">
          <td>
            <div style="font-weight:500">${e.compra.descricao}</div>
            ${e.isCarry ? `<div class="carry-info">↩ Parcela de ${fmtMonth(e.compra.dataCompra.slice(0, 7))}</div>` : ""}
          </td>
          <td>${cat ? `<span class="badge badge-cat">${cat.emoji} ${cat.nome}</span>` : "—"}</td>
          <td>${card ? `<span class="card-chip"><span class="card-dot" style="background:${card.cor}"></span>${card.nome}</span>` : "—"}</td>
          <td>${pessoas.map((p) => p.nome).join(" ")}</td>
          <td>
            <span class="badge ${e.isParcelado ? "badge-installment" : "badge-single"}">
              ${e.isParcelado ? `${e.numeroParcela}/${e.totalParcelas}` : "à vista"}
            </span>
          </td>
          <td>${fmtDate(e.compra.dataCompra)}</td>
          <td style="text-align:right; font-weight:600">${fmt(e.valorParcela)}</td>
          ${showDelete ? `<td><button class="btn btn-danger" style="padding:4px 8px;font-size:10px;" onclick="deleteCompra(${e.compra.id})">✕</button></td>` : ""}
        </tr>`;
        })
        .join("")}
    </tbody>
  </table>`;
}

function renderComprasSection() {
  const m = state.selectedMonth || nowMonth();
  document.getElementById("compras-title").textContent =
    `Compras — ${fmtMonth(m)}`;

  // Gastos do mês
  const entries = getFaturaEntries(m);
  document.getElementById("compras-table-wrap").innerHTML = renderComprasTable(
    entries,
    true,
  );

  // Parcelas futuras
  const futuras = getParcelasFuturas(m);
  if (futuras.length === 0) {
    document.getElementById("parcelas-table-wrap").innerHTML =
      `<div class="empty"><div class="e-icon">✅</div><p>Sem parcelas futuras a partir deste mês</p></div>`;
  } else {
    let html = `<table><thead><tr><th>Descrição</th><th>Mês</th><th>Cartão</th><th>Parcela</th><th style="text-align:right">Valor</th></tr></thead><tbody>`;
    futuras.forEach((e) => {
      const card = state.cartoes.find((c) => c.id === e.compra.cartaoId);
      html += `<tr>
        <td>${e.compra.descricao}</td>
        <td style="color:var(--accent2)">${fmtMonth(e.mes)}</td>
        <td>${card ? `<span class="card-chip"><span class="card-dot" style="background:${card.cor}"></span>${card.nome}</span>` : "—"}</td>
        <td><span class="badge badge-installment">${e.numeroParcela}/${e.totalParcelas}</span></td>
        <td style="text-align:right;font-weight:600">${fmt(e.valorParcela)}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    document.getElementById("parcelas-table-wrap").innerHTML = html;
  }

  // Cat chart
  const cats = getCatTotals(m);
  const maxCat = cats[0]?.total || 1;
  document.getElementById("cat-chart2").innerHTML =
    cats.length === 0
      ? '<p style="font-size:11px;color:var(--text-dim)">Sem dados neste mês</p>'
      : cats
          .map(
            ({ cat, total }) => `
      <div class="cat-row">
        <span class="cat-name">${cat.emoji} ${cat.nome}</span>
        <div class="cat-bar-wrap"><div class="cat-bar-fill" style="width:${(total / maxCat) * 100}%;background:${cat.cor}"></div></div>
        <span class="cat-amount">${fmt(total)}</span>
      </div>`,
          )
          .join("");
}

// ═══════════════════════════════════════════
// CARTÕES SECTION
// ═══════════════════════════════════════════
function renderCartoes() {
  const m = state.selectedMonth || nowMonth();
  
  // Resumo
  const totalLimite = state.cartoes.reduce((s, c) => s + c.limite, 0);
  const totalFaturas = state.cartoes.reduce((s, c) => {
    return s + getFaturaEntries(m, c.id).reduce((acc, e) => acc + e.valorParcela, 0);
  }, 0);
  
  const getOcupado = (cartaoId) => {
     let ocupado = 0;
     state.compras.forEach(c => {
       if (c.cartaoId !== cartaoId) return;
       for (let p = 0; p < c.parcelas; p++) {
         const dt = addMonths(c.dataCompra, p).slice(0, 7);
         if (dt >= m) {
           ocupado += (c.valor / c.parcelas);
         }
       }
     });
     return ocupado;
  };

  const totalOcupado = state.cartoes.reduce((s, c) => s + getOcupado(c.id), 0);
  
  const summaryEl = document.getElementById("cartoes-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="summary-card purple">
        <div class="s-label">Limite Total (Todos cartões)</div>
        <div class="s-value">${fmt(totalLimite)}</div>
        <div class="s-sub">${state.cartoes.length} cartões cadastrados</div>
      </div>
      <div class="summary-card yellow">
        <div class="s-label">Total Faturas em ${fmtMonth(m)}</div>
        <div class="s-value">${fmt(totalFaturas)}</div>
        <div class="s-sub">Soma das faturas no mês selecionado</div>
      </div>
      <div class="summary-card cyan">
        <div class="s-label">Limite Ocupado Estimado</div>
        <div class="s-value">${fmt(totalOcupado)}</div>
        <div class="s-sub">Faturas do mês atual em diante</div>
      </div>
    `;
  }

  document.getElementById("cartoes-list").innerHTML =
    state.cartoes.length === 0
      ? `<div class="empty"><div class="e-icon">💳</div><p>Nenhum cartão cadastrado</p></div>`
      : `<div style="overflow-x:auto;"><table style="width:100%;text-align:left;border-collapse:collapse;margin-top:8px;">
           <thead>
             <tr>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Cartão</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Limite</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Ocupado</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Saldo Disponível</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Fech. / Venc.</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);text-align:right;">Ações</th>
             </tr>
           </thead>
           <tbody>
             ` + state.cartoes.map(c => {
               const ocupado = getOcupado(c.id);
               const saldo = c.limite - ocupado;
               const faturaMes = getFaturaEntries(m, c.id).reduce((s, e) => s + e.valorParcela, 0);
               const pct = (ocupado / c.limite) * 100;

               return `<tr style="border-bottom:1px solid var(--border);">
                 <td style="padding:12px;">
                   <div style="display:flex;align-items:center;gap:8px;">
                     <div class="color-swatch" style="background:${c.cor}; width:16px;height:16px;border-radius:4px;"></div>
                     <div>
                       <div style="font-weight:600;font-size:13px;">${c.nome}</div>
                       <div style="font-size:10px;color:var(--text-muted);">${c.bandeira}</div>
                     </div>
                   </div>
                 </td>
                 <td style="padding:12px;font-weight:500;">${fmt(c.limite)}</td>
                 <td style="padding:12px;">
                   <div style="font-weight:500;">${fmt(ocupado)}</div>
                   <div style="font-size:10px;color:var(--text-muted);">Fatura atual: ${fmt(faturaMes)}</div>
                 </td>
                 <td style="padding:12px;">
                   <div style="font-weight:500;color:${saldo < 0 ? 'var(--red)' : 'inherit'}">${fmt(saldo)}</div>
                   <div style="height:4px;background:var(--surface3);border-radius:2px;width:100px;margin-top:4px;">
                     <div style="width:${Math.min(100, pct)}%;height:100%;background:${pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--accent)' : 'var(--accent2)'};border-radius:2px;"></div>
                   </div>
                 </td>
                 <td style="padding:12px;">
                    <span class="badge" style="background:var(--surface3);color:var(--text);font-size:10px;">F: ${c.fechamento} <br> V: ${c.vencimento}</span>
                 </td>
                 <td style="padding:12px;text-align:right;">
                   <div style="display:flex;gap:4px;justify-content:flex-end;">
                     <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px;" onclick="editItem('cartao', ${c.id})">✏️</button>
                     <button class="btn btn-danger" style="padding:6px 10px;font-size:11px;" onclick="safelyDelete('cartao', ${c.id})">✕</button>
                   </div>
                 </td>
               </tr>`;
             }).join("") + `
           </tbody>
         </table></div>`;
}

// ═══════════════════════════════════════════
// PESSOAS SECTION
// ═══════════════════════════════════════════
function renderPessoas() {
  const m = state.selectedMonth || nowMonth();
  
  // Dashboard / Summary
  const pessoasData = state.pessoas.map(p => {
    const entries = getFaturaEntries(m).filter(e => e.compra.pessoaIds.includes(p.id));
    const total = entries.reduce((s, e) => s + (e.valorParcela / e.compra.pessoaIds.length), 0);
    return { ...p, entriesCount: entries.length, total };
  }).sort((a, b) => b.total - a.total);

  const totalFamilia = pessoasData.reduce((s, p) => s + p.total, 0);

  const summaryEl = document.getElementById("pessoas-summary");
  if (summaryEl) {
    if (pessoasData.length > 0) {
      const topPessoa = pessoasData[0];
      summaryEl.innerHTML = `
        <div class="summary-card cyan">
          <div class="s-label">Total Gasto pela Família (${fmtMonth(m)})</div>
          <div class="s-value">${fmt(totalFamilia)}</div>
          <div class="s-sub">${state.pessoas.length} membros na família</div>
        </div>
        <div class="summary-card purple">
          <div class="s-label">Maior Gasto no Mês</div>
          <div class="s-value">${topPessoa.total > 0 ? fmt(topPessoa.total) : "—"}</div>
          <div class="s-sub">${topPessoa.total > 0 ? topPessoa.nome : "Sem gastos"}</div>
        </div>
        <div class="summary-card yellow">
           <div class="s-label">Média por Pessoa</div>
           <div class="s-value">${fmt(state.pessoas.length > 0 ? totalFamilia / state.pessoas.length : 0)}</div>
           <div class="s-sub">Rateio aproximado</div>
        </div>
      `;
    } else {
      summaryEl.innerHTML = "";
    }
  }

  // Tabela / Lista
  document.getElementById("pessoas-list").innerHTML =
    state.pessoas.length === 0
      ? `<div class="empty"><div class="e-icon">👥</div><p>Nenhuma pessoa cadastrada</p></div>`
      : `<div style="overflow-x:auto;"><table style="width:100%;text-align:left;border-collapse:collapse;margin-top:8px;">
           <thead>
             <tr>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Pessoa</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Participação (${fmtMonth(m)})</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Valor Total</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);text-align:right;">Ações</th>
             </tr>
           </thead>
           <tbody>
             ` + pessoasData.map(p => {
               const maxTotal = pessoasData[0]?.total || 1;
               const pct = (p.total / maxTotal) * 100;
               return `<tr style="border-bottom:1px solid var(--border);">
                 <td style="padding:12px;">
                   <div style="display:flex;align-items:center;gap:12px;">
                     <div class="person-avatar" style="background:${p.cor};color:#000;width:32px;height:32px;font-size:12px;margin:0;">${p.nome[0]}</div>
                     <div style="font-weight:600;font-size:13px;">${p.nome}</div>
                   </div>
                 </td>
                 <td style="padding:12px;font-size:12px;color:var(--text-muted);">
                   ${p.entriesCount} compras
                 </td>
                 <td style="padding:12px;">
                   <div style="font-weight:600;">${fmt(p.total)}</div>
                   <div style="height:4px;background:var(--surface3);border-radius:2px;width:120px;margin-top:4px;">
                     <div style="width:${Math.min(100, pct)}%;height:100%;background:${p.cor};border-radius:2px;"></div>
                   </div>
                 </td>
                 <td style="padding:12px;text-align:right;">
                   <div style="display:flex;gap:4px;justify-content:flex-end;">
                     <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px;" onclick="editItem('pessoa', ${p.id})">✏️</button>
                     <button class="btn btn-danger" style="padding:6px 10px;font-size:11px;" onclick="safelyDelete('pessoa', ${p.id})">✕</button>
                   </div>
                 </td>
               </tr>`;
             }).join("") + `
           </tbody>
         </table></div>`;
}

// ═══════════════════════════════════════════
// CATEGORIAS SECTION
// ═══════════════════════════════════════════
function renderCategorias() {
  const m = state.selectedMonth || nowMonth();
  
  // Dashboard / Summary
  const catsData = state.categorias.map(c => {
    const entries = getFaturaEntries(m).filter(e => e.compra.categoriaId === c.id);
    const total = entries.reduce((s, e) => s + e.valorParcela, 0);
    return { ...c, entriesCount: entries.length, total };
  }).sort((a, b) => b.total - a.total);

  const totalCategorias = catsData.reduce((s, c) => s + c.total, 0);

  const summaryEl = document.getElementById("categorias-summary");
  if (summaryEl) {
    if (catsData.length > 0) {
      const topCat = catsData[0];
      summaryEl.innerHTML = `
        <div class="summary-card cyan">
          <div class="s-label">Total Gasto em Categorias (${fmtMonth(m)})</div>
          <div class="s-value">${fmt(totalCategorias)}</div>
          <div class="s-sub">${state.categorias.length} categorias cadastradas</div>
        </div>
        <div class="summary-card purple">
          <div class="s-label">Categoria com Maior Gasto</div>
          <div class="s-value">${topCat.total > 0 ? fmt(topCat.total) : "—"}</div>
          <div class="s-sub">${topCat.total > 0 ? topCat.emoji + " " + topCat.nome : "Nenhum gasto"}</div>
        </div>
        <div class="summary-card yellow">
           <div class="s-label">Categorias Utilizadas</div>
           <div class="s-value">${catsData.filter(c => c.total > 0).length}</div>
           <div class="s-sub">Com gastos no mês selecionado</div>
        </div>
      `;
    } else {
      summaryEl.innerHTML = "";
    }
  }

  // Tabela / Lista
  document.getElementById("categorias-list").innerHTML =
    state.categorias.length === 0
      ? `<div class="empty"><div class="e-icon">🏷️</div><p>Nenhuma categoria</p></div>`
      : `<div style="overflow-x:auto;"><table style="width:100%;text-align:left;border-collapse:collapse;margin-top:8px;">
           <thead>
             <tr>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Categoria</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Volume (${fmtMonth(m)})</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:500;">Valor Total</th>
               <th style="padding:12px;border-bottom:1px solid var(--border);text-align:right;">Ações</th>
             </tr>
           </thead>
           <tbody>
             ` + catsData.map(c => {
               const maxTotal = catsData[0]?.total || 1;
               const pct = (c.total / maxTotal) * 100;
               return `<tr style="border-bottom:1px solid var(--border);">
                 <td style="padding:12px;">
                   <div style="display:flex;align-items:center;gap:12px;">
                     <div style="font-size:24px;">${c.emoji}</div>
                     <div>
                       <div style="font-weight:600;font-size:13px;">${c.nome}</div>
                       <div style="font-size:10px;color:var(--text-muted);">Cor: <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.cor};margin-left:4px;"></span></div>
                     </div>
                   </div>
                 </td>
                 <td style="padding:12px;font-size:12px;color:var(--text-muted);">
                   ${c.entriesCount} transações
                 </td>
                 <td style="padding:12px;">
                   <div style="font-weight:600;">${fmt(c.total)}</div>
                   <div style="height:4px;background:var(--surface3);border-radius:2px;width:120px;margin-top:4px;">
                     <div style="width:${Math.min(100, pct)}%;height:100%;background:${c.cor};border-radius:2px;"></div>
                   </div>
                 </td>
                 <td style="padding:12px;text-align:right;">
                   <div style="display:flex;gap:4px;justify-content:flex-end;">
                     <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px;" onclick="editItem('categoria', ${c.id})">✏️</button>
                     <button class="btn btn-danger" style="padding:6px 10px;font-size:11px;" onclick="safelyDelete('categoria', ${c.id})">✕</button>
                   </div>
                 </td>
               </tr>`;
             }).join("") + `
           </tbody>
         </table></div>`;
}

// ═══════════════════════════════════════════
// NAVBAR CARDS (mini resumo na barra de topo)
// ═══════════════════════════════════════════
function renderSidebar() {
  const m = state.selectedMonth || nowMonth();
  document.getElementById("sidebar-cards").innerHTML = state.cartoes
    .map((c) => {
      const total = getFaturaEntries(m, c.id).reduce(
        (s, e) => s + e.valorParcela,
        0,
      );
      return `<div class="navbar-card-mini">
      <span class="card-dot" style="background:${c.cor}"></span>
      <span>${c.nome}</span>
      <span class="card-val">${fmt(total)}</span>
    </div>`;
    })
    .join("");
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function showSection(section) {
  state.currentSection = section;
  document
    .querySelectorAll(".section-view")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById("section-" + section)?.classList.add("active");
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  event.currentTarget.classList.add("active");

  const tabsEl = document.getElementById("main-tabs");
  if (section === "compras") {
    tabsEl.style.display = "flex";
    switchTab(state.currentTab);
  } else {
    tabsEl.style.display = "none";
  }

  renderAll();
}

function switchTab(tab) {
  state.currentTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => (p.style.display = "none"));
  event?.currentTarget?.classList.add("active");
  const tabEl = document.getElementById("tab-" + tab);
  if (tabEl) {
    tabEl.style.display = "flex";
    tabEl.style.flexDirection = "column";
  }
  // Highlight correct tab button
  document.querySelectorAll(".tab").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(tab)) btn.classList.add("active");
  });
}

// ═══════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════
function openModal(type, idToEdit = null) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");

  if (type === "compra") box.innerHTML = modalCompra(idToEdit);
  else if (type === "cartao") box.innerHTML = modalCartao(idToEdit);
  else if (type === "pessoa") box.innerHTML = modalPessoa(idToEdit);
  else if (type === "categoria") box.innerHTML = modalCategoria(idToEdit);
  else if (type === "confirm") {
    // modal de confirmação
    overlay.classList.add("open");
    return;
  }

  overlay.classList.add("open");

  // Init checkboxes
  document.querySelectorAll(".checkbox-label").forEach((lbl) => {
    const cb = lbl.querySelector("input[type=checkbox]");
    if (cb) {
      cb.addEventListener("change", () =>
        lbl.classList.toggle("checked", cb.checked),
      );
    }
  });
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}
function closeModalOutside(e) {
  if (e.target.id === "modal-overlay") closeModal();
}

function modalCompra(id = null) {
  const compra = id ? state.compras.find(c => c.id === id) : null;
  const cartoesOpts = state.cartoes
    .map((c) => `<option value="${c.id}" ${compra && compra.cartaoId === c.id ? "selected" : ""}>${c.nome}</option>`)
    .join("");
  const catOpts = state.categorias
    .map((c) => `<option value="${c.id}" ${compra && compra.categoriaId === c.id ? "selected" : ""}>${c.emoji} ${c.nome}</option>`)
    .join("");
  const pessoasCheck = state.pessoas
    .map(
      (p) => `
    <label class="checkbox-label">
      <input type="checkbox" name="pessoas" value="${p.id}" ${compra && compra.pessoaIds.includes(p.id) ? "checked" : ""}>
      <span class="person-avatar" style="background:${p.cor};color:#000;width:18px;height:18px;font-size:9px;margin:0;">${p.nome[0]}</span>
      ${p.nome}
    </label>`,
    )
    .join("");

  return `<div class="modal-title">${compra ? "Editar" : "Nova"} Compra</div>
    <div class="form-group"><label>Descrição</label><input id="f-desc" placeholder="Ex: Mercado, Netflix..." value="${compra ? compra.descricao : ""}"></div>
    <div class="form-row">
      <div class="form-group"><label>Valor Total (R$)</label><input id="f-valor" type="number" step="0.01" placeholder="0,00" value="${compra ? compra.valor : ""}"></div>
      <div class="form-group"><label>Nº de Parcelas</label><input id="f-parcelas" type="number" min="1" value="${compra ? compra.parcelas : 1}" placeholder="1"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data da Compra</label><input id="f-data" type="date" value="${compra ? compra.dataCompra : new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group"><label>Cartão</label><select id="f-cartao">${cartoesOpts}</select></div>
    </div>
    <div class="form-group"><label>Categoria <span style="color:var(--accent3)">*única</span></label><select id="f-cat">${catOpts}</select></div>
    <div class="form-group"><label>Pessoas <span style="color:var(--text-muted);font-size:10px;">(pode selecionar múltiplas)</span></label>
      <div class="checkbox-group">${pessoasCheck}</div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-accent" onclick="saveCompra(${id ? id : 'null'})">Salvar Compra</button>
    </div>`;
}

function modalCartao(id = null) {
  const c = id ? state.cartoes.find(x => x.id === id) : null;
  return `<div class="modal-title">${c ? "Editar" : "Novo"} Cartão</div>
    <div class="form-group"><label>Nome do Cartão</label><input id="f-nome" placeholder="Ex: Nubank, Itaú..." value="${c ? c.nome : ""}"></div>
    <div class="form-group"><label>Bandeira</label>
      <select id="f-bandeira">
        <option ${c && c.bandeira === "Mastercard" ? "selected" : ""}>Mastercard</option>
        <option ${c && c.bandeira === "Visa" ? "selected" : ""}>Visa</option>
        <option ${c && c.bandeira === "Elo" ? "selected" : ""}>Elo</option>
        <option ${c && c.bandeira === "Amex" ? "selected" : ""}>Amex</option>
        <option ${c && c.bandeira === "Hipercard" ? "selected" : ""}>Hipercard</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Limite (R$)</label><input id="f-limite" type="number" placeholder="5000" value="${c ? c.limite : ""}"></div>
      <div class="form-group"><label>Cor</label><input id="f-cor" type="color" value="${c ? c.cor : "#5af0e8"}" style="height:42px;width:100%;"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Dia Fechamento</label><input id="f-fech" type="number" min="1" max="31" placeholder="10" value="${c ? c.fechamento : ""}"></div>
      <div class="form-group"><label>Dia Vencimento</label><input id="f-venc" type="number" min="1" max="31" placeholder="17" value="${c ? c.vencimento : ""}"></div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-accent" onclick="saveCartao(${id ? id : 'null'})">Salvar Cartão</button>
    </div>`;
}

function modalPessoa(id = null) {
  const p = id ? state.pessoas.find(x => x.id === id) : null;
  return `<div class="modal-title">${p ? "Editar" : "Nova"} Pessoa</div>
    <div class="form-group"><label>Nome</label><input id="f-nome" placeholder="Ex: Ana, Carlos..." value="${p ? p.nome : ""}"></div>
    <div class="form-group"><label>Cor</label><input id="f-cor" type="color" value="${p ? p.cor : "#e8ff5a"}" style="height:42px;width:100%;"></div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-accent" onclick="savePessoa(${id ? id : 'null'})">Salvar</button>
    </div>`;
}

function modalCategoria(id = null) {
  const c = id ? state.categorias.find(x => x.id === id) : null;
  return `<div class="modal-title">${c ? "Editar" : "Nova"} Categoria</div>
    <div class="form-group"><label>Nome</label><input id="f-nome" placeholder="Ex: Alimentação, Saúde..." value="${c ? c.nome : ""}"></div>
    <div class="form-group"><label>Emoji</label><input id="f-emoji" placeholder="🍔" style="font-size:20px;text-align:center;" value="${c ? c.emoji : ""}"></div>
    <div class="form-group"><label>Cor</label><input id="f-cor" type="color" value="${c ? c.cor : "#f59e0b"}" style="height:42px;width:100%;"></div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-accent" onclick="saveCategoria(${id ? id : 'null'})">Salvar</button>
    </div>`;
}

// ═══════════════════════════════════════════
// VALIDAÇÃO & SEGURANÇA (Regras 7 e 8)
// ═══════════════════════════════════════════
function checkTies(type, id) {
  if (type === "cartao") {
    return state.compras.some(c => c.cartaoId === id);
  } else if (type === "pessoa") {
    return state.compras.some(c => c.pessoaIds.includes(id));
  } else if (type === "categoria") {
    return state.compras.some(c => c.categoriaId === id);
  }
  return false;
}

function editItem(type, id) {
  if (checkTies(type, id)) {
    toast("Atenção: Este item possui compras vinculadas. Você pode alterar nome / cor, mas tenha cuidado.", false);
  }
  openModal(type, id);
}

function safelyDelete(type, id, skipCheck = false) {
  if (!skipCheck && type !== "compra" && checkTies(type, id)) {
    toast("Ação bloqueada: Há gastos vinculados a este item.", false);
    return;
  }
  
  const rotulo = type === "compra" ? "esta compra" : type === "cartao" ? "este cartão" : type === "pessoa" ? "esta pessoa" : "esta categoria";
  const box = document.getElementById("modal-box");
  box.innerHTML = `
    <div class="modal-title" style="color:var(--red);">Confirmar Exclusão</div>
    <p style="margin-bottom:24px;">Tem certeza que deseja excluir ${rotulo}? Esta ação não pode ser desfeita.</p>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-danger" onclick="${type === 'compra' ? `deleteCompra(${id})` : `deleteItem('${type}', ${id})`}">Sim, excluir</button>
    </div>
  `;
  openModal("confirm");
}



// ═══════════════════════════════════════════
// SAVE FUNCTIONS (chamam a API)
// ═══════════════════════════════════════════
async function saveCompra(id = null) {
  const desc = document.getElementById("f-desc").value.trim();
  const valor = parseFloat(document.getElementById("f-valor").value);
  const parcelas = parseInt(document.getElementById("f-parcelas").value) || 1;
  const data = document.getElementById("f-data").value;
  const cartaoId = parseInt(document.getElementById("f-cartao").value);
  const catId = parseInt(document.getElementById("f-cat").value);
  const pessoaIds = [
    ...document.querySelectorAll("input[name=pessoas]:checked"),
  ].map((cb) => parseInt(cb.value));

  if (!desc || isNaN(valor) || !data || !cartaoId || !catId) {
    toast("Preencha todos os campos obrigatórios", false);
    return;
  }
  if (pessoaIds.length === 0) {
    toast("Selecione ao menos uma pessoa", false);
    return;
  }

  try {
    const method = id ? "PUT" : "POST";
    const path = id ? `/api/compras/${id}` : "/api/compras";
    await apiFetch(path, {
      method,
      body: JSON.stringify({
        descricao: desc,
        valor,
        parcelas,
        dataCompra: data,
        cartaoId,
        categoriaId: catId,
        pessoaIds,
      }),
    });
    closeModal();
    await loadState();
    renderAll();
    toast(id ? "Compra atualizada!" : "Compra adicionada!", true);
  } catch (e) {
    toast("Erro ao salvar compra: " + e.message, false);
  }
}

async function saveCartao(id = null) {
  const nome = document.getElementById("f-nome").value.trim();
  const bandeira = document.getElementById("f-bandeira").value;
  const limite = parseFloat(document.getElementById("f-limite").value) || 0;
  const cor = document.getElementById("f-cor").value;
  const fechamento = parseInt(document.getElementById("f-fech").value) || 10;
  const vencimento = parseInt(document.getElementById("f-venc").value) || 17;

  if (!nome) {
    toast("Informe o nome do cartão", false);
    return;
  }

  try {
    const method = id ? "PUT" : "POST";
    const path = id ? `/api/cartoes/${id}` : "/api/cartoes";
    await apiFetch(path, {
      method,
      body: JSON.stringify({
        nome,
        bandeira,
        limite,
        cor,
        fechamento,
        vencimento,
      }),
    });
    closeModal();
    await loadState();
    renderAll();
    toast(id ? "Cartão atualizado!" : "Cartão adicionado!", true);
  } catch (e) {
    toast("Erro ao salvar cartão: " + e.message, false);
  }
}

async function savePessoa(id = null) {
  const nome = document.getElementById("f-nome").value.trim();
  const cor = document.getElementById("f-cor").value;

  if (!nome) {
    toast("Informe o nome", false);
    return;
  }

  try {
    const method = id ? "PUT" : "POST";
    const path = id ? `/api/pessoas/${id}` : "/api/pessoas";
    await apiFetch(path, {
      method,
      body: JSON.stringify({ nome, cor }),
    });
    closeModal();
    await loadState();
    renderAll();
    toast(id ? "Pessoa atualizada!" : "Pessoa adicionada!", true);
  } catch (e) {
    toast("Erro ao salvar pessoa: " + e.message, false);
  }
}

async function saveCategoria(id = null) {
  const nome = document.getElementById("f-nome").value.trim();
  const emoji = document.getElementById("f-emoji").value.trim() || "📦";
  const cor = document.getElementById("f-cor").value;

  if (!nome) {
    toast("Informe o nome", false);
    return;
  }

  try {
    const method = id ? "PUT" : "POST";
    const path = id ? `/api/categorias/${id}` : "/api/categorias";
    await apiFetch(path, {
      method,
      body: JSON.stringify({ nome, emoji, cor }),
    });
    closeModal();
    await loadState();
    renderAll();
    toast(id ? "Categoria atualizada!" : "Categoria adicionada!", true);
  } catch (e) {
    toast("Erro ao salvar categoria: " + e.message, false);
  }
}

// ═══════════════════════════════════════════
// DELETE (chamam a API)
// ═══════════════════════════════════════════
async function deleteCompra(id) {
  try {
    await apiFetch(`/api/compras/${id}`, { method: "DELETE" });
    await loadState();
    renderAll();
    toast("Compra removida", true);
  } catch (e) {
    toast("Erro ao remover compra: " + e.message, false);
  }
}

async function deleteItem(type, id) {
  const rotas = {
    cartao: "cartoes",
    pessoa: "pessoas",
    categoria: "categorias",
  };
  const rota = rotas[type];
  if (!rota) return;

  try {
    await apiFetch(`/api/${rota}/${id}`, { method: "DELETE" });
    await loadState();
    renderAll();
    toast("Removido com sucesso", true);
  } catch (e) {
    // A API retorna 409 Conflict se o item está em uso
    toast(e.message || "Erro ao remover", false);
  }
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function toast(msg, success) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (success ? " success" : "");
  setTimeout(() => el.classList.remove("show"), 2400);
}

// ═══════════════════════════════════════════
// RENDER ALL
// ═══════════════════════════════════════════
function renderAll() {
  renderMonthStrip();
  renderSidebar();

  // Garante que a seção correta fique visível
  document.querySelectorAll(".section-view").forEach(el => el.classList.remove("active"));
  const activeSection = document.getElementById("section-" + state.currentSection);
  if (activeSection) activeSection.classList.add("active");

  // Destaca o botão de navegação correto
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("onclick")?.includes(state.currentSection));
  });

  // Exibe/oculta tabs de compras
  const tabsEl = document.getElementById("main-tabs");
  if (tabsEl) {
    tabsEl.style.display = state.currentSection === "compras" ? "flex" : "none";
  }

  if (state.currentSection === "dashboard") renderDashboard();
  else if (state.currentSection === "compras") renderComprasSection();
  else if (state.currentSection === "cartoes") renderCartoes();
  else if (state.currentSection === "pessoas") renderPessoas();
  else if (state.currentSection === "categorias") renderCategorias();
}

// ═══════════════════════════════════════════
// INIT — carrega dados da API e renderiza
// ═══════════════════════════════════════════
loadState().then(() => renderAll());
