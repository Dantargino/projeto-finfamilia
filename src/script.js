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
  document.getElementById("cartoes-list").innerHTML =
    state.cartoes.length === 0
      ? `<div class="empty"><div class="e-icon">💳</div><p>Nenhum cartão cadastrado</p></div>`
      : state.cartoes
          .map((c) => {
            const total = getFaturaEntries(m, c.id).reduce(
              (s, e) => s + e.valorParcela,
              0,
            );
            const pct = (total / c.limite) * 100;
            return `<div class="list-item">
          <div class="list-item-info">
            <div class="color-swatch" style="background:${c.cor}; width:18px;height:18px;border-radius:4px;"></div>
            <div>
              <div style="font-weight:600;font-size:13px;">${c.nome} <span style="color:var(--text-muted);font-size:10px;">${c.bandeira}</span></div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Fecha dia ${c.fechamento} · Vence dia ${c.vencimento}</div>
              <div style="margin-top:6px;">
                <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px;">
                  <span style="color:var(--text-muted)">Usado em ${fmtMonth(m)}</span>
                  <span>${fmt(total)} / ${fmt(c.limite)}</span>
                </div>
                <div style="height:4px;background:var(--surface3);border-radius:2px;width:200px;">
                  <div style="width:${Math.min(100, pct)}%;height:100%;background:${pct > 80 ? "var(--accent3)" : pct > 50 ? "var(--accent)" : "var(--accent2)"};border-radius:2px;transition:width .5s;"></div>
                </div>
              </div>
            </div>
          </div>
          <button class="btn btn-danger" onclick="deleteItem('cartao',${c.id})">Remover</button>
        </div>`;
          })
          .join("");
}

// ═══════════════════════════════════════════
// PESSOAS SECTION
// ═══════════════════════════════════════════
function renderPessoas() {
  const m = state.selectedMonth || nowMonth();
  document.getElementById("pessoas-list").innerHTML =
    state.pessoas.length === 0
      ? `<div class="empty"><div class="e-icon">👥</div><p>Nenhuma pessoa cadastrada</p></div>`
      : state.pessoas
          .map((p) => {
            const entries = getFaturaEntries(m).filter((e) =>
              e.compra.pessoaIds.includes(p.id),
            );
            const total = entries.reduce(
              (s, e) => s + e.valorParcela / e.compra.pessoaIds.length,
              0,
            );
            return `<div class="list-item">
          <div class="list-item-info">
            <div class="person-avatar" style="background:${p.cor};color:#000;width:36px;height:36px;font-size:14px;margin-right:0;">${p.nome[0]}</div>
            <div>
              <div style="font-weight:600;font-size:13px;">${p.nome}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Participação em ${entries.length} compras em ${fmtMonth(m)} · ~${fmt(total)}</div>
            </div>
          </div>
          <button class="btn btn-danger" onclick="deleteItem('pessoa',${p.id})">Remover</button>
        </div>`;
          })
          .join("");
}

// ═══════════════════════════════════════════
// CATEGORIAS SECTION
// ═══════════════════════════════════════════
function renderCategorias() {
  document.getElementById("categorias-list").innerHTML =
    state.categorias.length === 0
      ? `<div class="empty"><div class="e-icon">🏷️</div><p>Nenhuma categoria</p></div>`
      : state.categorias
          .map(
            (c) => `
      <div class="list-item">
        <div class="list-item-info">
          <span style="font-size:20px;">${c.emoji}</span>
          <div>
            <div style="font-weight:600;font-size:13px;">${c.nome}</div>
            <div style="font-size:10px;color:var(--text-muted);">Cor: <span style="color:${c.cor}">${c.cor}</span></div>
          </div>
        </div>
        <button class="btn btn-danger" onclick="deleteItem('categoria',${c.id})">Remover</button>
      </div>`,
          )
          .join("");
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
  document.getElementById("tab-" + tab)?.style &&
    (document.getElementById("tab-" + tab).style.display = "flex");
  document.getElementById("tab-" + tab)?.style &&
    (document.getElementById("tab-" + tab).style.flexDirection = "column");
  document.getElementById("tab-" + tab).style.display = "block";

  // Highlight correct tab button
  document.querySelectorAll(".tab").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(tab)) btn.classList.add("active");
  });
}

// ═══════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════
function openModal(type) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");

  if (type === "compra") box.innerHTML = modalCompra();
  else if (type === "cartao") box.innerHTML = modalCartao();
  else if (type === "pessoa") box.innerHTML = modalPessoa();
  else if (type === "categoria") box.innerHTML = modalCategoria();

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

function modalCompra() {
  const cartoesOpts = state.cartoes
    .map((c) => `<option value="${c.id}">${c.nome}</option>`)
    .join("");
  const catOpts = state.categorias
    .map((c) => `<option value="${c.id}">${c.emoji} ${c.nome}</option>`)
    .join("");
  const pessoasCheck = state.pessoas
    .map(
      (p) => `
    <label class="checkbox-label">
      <input type="checkbox" name="pessoas" value="${p.id}">
      <span class="person-avatar" style="background:${p.cor};color:#000;width:18px;height:18px;font-size:9px;margin:0;">${p.nome[0]}</span>
      ${p.nome}
    </label>`,
    )
    .join("");

  return `<div class="modal-title">Nova Compra</div>
    <div class="form-group"><label>Descrição</label><input id="f-desc" placeholder="Ex: Mercado, Netflix..."></div>
    <div class="form-row">
      <div class="form-group"><label>Valor Total (R$)</label><input id="f-valor" type="number" step="0.01" placeholder="0,00"></div>
      <div class="form-group"><label>Nº de Parcelas</label><input id="f-parcelas" type="number" min="1" value="1" placeholder="1"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data da Compra</label><input id="f-data" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group"><label>Cartão</label><select id="f-cartao">${cartoesOpts}</select></div>
    </div>
    <div class="form-group"><label>Categoria <span style="color:var(--accent3)">*única</span></label><select id="f-cat">${catOpts}</select></div>
    <div class="form-group"><label>Pessoas <span style="color:var(--text-muted);font-size:10px;">(pode selecionar múltiplas)</span></label>
      <div class="checkbox-group">${pessoasCheck}</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveCompra()">Salvar Compra</button>
    </div>`;
}

function modalCartao() {
  return `<div class="modal-title">Novo Cartão</div>
    <div class="form-group"><label>Nome do Cartão</label><input id="f-nome" placeholder="Ex: Nubank, Itaú..."></div>
    <div class="form-group"><label>Bandeira</label>
      <select id="f-bandeira"><option>Mastercard</option><option>Visa</option><option>Elo</option><option>Amex</option><option>Hipercard</option></select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Limite (R$)</label><input id="f-limite" type="number" placeholder="5000"></div>
      <div class="form-group"><label>Cor</label><input id="f-cor" type="color" value="#5af0e8" style="height:42px;width:100%;"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Dia Fechamento</label><input id="f-fech" type="number" min="1" max="31" placeholder="10"></div>
      <div class="form-group"><label>Dia Vencimento</label><input id="f-venc" type="number" min="1" max="31" placeholder="17"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveCartao()">Salvar Cartão</button>
    </div>`;
}

function modalPessoa() {
  return `<div class="modal-title">Nova Pessoa</div>
    <div class="form-group"><label>Nome</label><input id="f-nome" placeholder="Ex: Ana, Carlos..."></div>
    <div class="form-group"><label>Cor</label><input id="f-cor" type="color" value="#e8ff5a" style="height:42px;width:100%;"></div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="savePessoa()">Salvar</button>
    </div>`;
}

function modalCategoria() {
  return `<div class="modal-title">Nova Categoria</div>
    <div class="form-group"><label>Nome</label><input id="f-nome" placeholder="Ex: Alimentação, Saúde..."></div>
    <div class="form-group"><label>Emoji</label><input id="f-emoji" placeholder="🍔" style="font-size:20px;text-align:center;"></div>
    <div class="form-group"><label>Cor</label><input id="f-cor" type="color" value="#f59e0b" style="height:42px;width:100%;"></div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveCategoria()">Salvar</button>
    </div>`;
}

// ═══════════════════════════════════════════
// SAVE FUNCTIONS (chamam a API)
// ═══════════════════════════════════════════
async function saveCompra() {
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
    await apiFetch("/api/compras", {
      method: "POST",
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
    toast("Compra adicionada!", true);
  } catch (e) {
    toast("Erro ao salvar compra: " + e.message, false);
  }
}

async function saveCartao() {
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
    await apiFetch("/api/cartoes", {
      method: "POST",
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
    toast("Cartão adicionado!", true);
  } catch (e) {
    toast("Erro ao salvar cartão: " + e.message, false);
  }
}

async function savePessoa() {
  const nome = document.getElementById("f-nome").value.trim();
  const cor = document.getElementById("f-cor").value;

  if (!nome) {
    toast("Informe o nome", false);
    return;
  }

  try {
    await apiFetch("/api/pessoas", {
      method: "POST",
      body: JSON.stringify({ nome, cor }),
    });
    closeModal();
    await loadState();
    renderAll();
    toast("Pessoa adicionada!", true);
  } catch (e) {
    toast("Erro ao salvar pessoa: " + e.message, false);
  }
}

async function saveCategoria() {
  const nome = document.getElementById("f-nome").value.trim();
  const emoji = document.getElementById("f-emoji").value.trim() || "📦";
  const cor = document.getElementById("f-cor").value;

  if (!nome) {
    toast("Informe o nome", false);
    return;
  }

  try {
    await apiFetch("/api/categorias", {
      method: "POST",
      body: JSON.stringify({ nome, emoji, cor }),
    });
    closeModal();
    await loadState();
    renderAll();
    toast("Categoria adicionada!", true);
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
