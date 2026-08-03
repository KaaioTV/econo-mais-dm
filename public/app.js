const API = "/api";
let currentEditingId = null;
let currentEditingScope = "dm";

// --- Navegação entre Views ---
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("is-active");
  });
});

// --- Status de Conexão com o Backend ---
async function checkConnection() {
  const pill = document.getElementById("connStatus");
  try {
    const res = await fetch(`${API}/stats`);
    if (!res.ok) throw new Error();
    pill.classList.add("is-live");
    pill.innerHTML = `<span class="pulse"></span> <span>sistema online</span>`;
  } catch {
    pill.classList.remove("is-live");
    pill.innerHTML = `<span class="pulse"></span> <span>backend offline</span>`;
  }
}

// --- Métricas e Estatísticas ---
async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const stats = await res.json();
    document.getElementById("statConversations").textContent = stats.totalConversations;
    document.getElementById("statMessages").textContent = stats.totalMessages;
    document.getElementById("statActive").textContent = stats.activeLast24h;
    document.getElementById("statRules").textContent = stats.activeRules;
    document.getElementById("statCommentRules").textContent = stats.activeCommentRules;
    document.getElementById("statCommentReplies").textContent = stats.totalCommentReplies;
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
  }
}

// --- Conversas (DM) ---
async function loadInbox() {
  const list = document.getElementById("inboxList");
  try {
    const res = await fetch(`${API}/conversations`);
    const conversations = await res.json();

    if (!conversations.length) {
      list.innerHTML = `<div class="empty-state">Nenhuma conversa registrada até o momento.</div>`;
      return;
    }

    list.innerHTML = conversations
      .map((c) => {
        const last = c.messages[c.messages.length - 1];
        const lastText = last ? escapeHtml(last.text) : "";
        const fromClass = last?.from === "bot" ? "from-bot" : "";
        const time = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString("pt-BR") : "";
        return `
          <div class="convo-card">
            <div class="convo-head">
              <span class="convo-id">@${escapeHtml(c.userId)}</span>
              <span class="convo-time">${time}</span>
            </div>
            <div class="convo-last ${fromClass}">${lastText}</div>
          </div>`;
      })
      .join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Erro ao carregar o inbox de conversas.</div>`;
  }
}

// --- Log de DMs Enviadas por Comentário ---
async function loadCommentLog() {
  const list = document.getElementById("commentLogList");
  try {
    const res = await fetch(`${API}/comment-replies`);
    const replies = await res.json();

    if (!replies.length) {
      list.innerHTML = `<div class="empty-state">Nenhuma DM disparada por comentário ainda.</div>`;
      return;
    }

    list.innerHTML = replies
      .map((r) => {
        const time = r.repliedAt ? new Date(r.repliedAt).toLocaleString("pt-BR") : "";
        return `
          <div class="convo-card">
            <div class="convo-head">
              <span class="convo-id">@${escapeHtml(r.username)}</span>
              <span class="convo-time">${time}</span>
            </div>
            <div class="convo-last">Gatilho acionado: <strong>${escapeHtml(r.keyword)}</strong></div>
          </div>`;
      })
      .join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Erro ao carregar logs de comentários.</div>`;
  }
}

// --- Regras de DM ---
async function loadRules() {
  const list = document.getElementById("rulesList");
  try {
    const res = await fetch(`${API}/rules?scope=dm`);
    const rules = await res.json();
    renderRulesList(list, rules, "dm");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Erro ao carregar regras de DM.</div>`;
  }
}

// --- Regras de Comentário ---
async function loadCommentRules() {
  const list = document.getElementById("commentRulesList");
  try {
    const res = await fetch(`${API}/rules?scope=comment`);
    const rules = await res.json();
    renderRulesList(list, rules, "comment");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Erro ao carregar regras de comentário.</div>`;
  }
}

function renderRulesList(list, rules, scope) {
  if (!rules.length) {
    list.innerHTML = `<div class="empty-state">Nenhuma regra cadastrada nesta categoria.</div>`;
    return;
  }

  const typeLabels = { welcome: "Boas-Vindas", keyword: "Palavra-Chave", fallback: "Fallback Padrão" };

  list.innerHTML = rules
    .map(
      (r) => `
      <div class="rule-card ${r.enabled ? "" : "is-disabled"}">
        <div class="rule-main">
          <div class="rule-name">${escapeHtml(r.name)}</div>
          <span class="rule-type">${typeLabels[r.type] || r.type}</span>
          ${r.keywords?.length ? `<div class="rule-keywords">Gatilhos: ${r.keywords.map(escapeHtml).join(", ")}</div>` : ""}
          <div class="rule-reply">${escapeHtml(r.reply)}</div>
        </div>
        <div class="rule-actions">
          <button data-action="edit" data-id="${r.id}">Editar</button>
          <button data-action="toggle" data-id="${r.id}">${r.enabled ? "Desligar" : "Ligar"}</button>
          <button data-action="delete" data-id="${r.id}">Excluir</button>
        </div>
      </div>`
    )
    .join("");

  list.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleRuleAction(btn.dataset.action, btn.dataset.id, rules, scope));
  });
}

async function handleRuleAction(action, id, rules, scope) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;

  const reload = scope === "comment" ? loadCommentRules : loadRules;

  if (action === "edit") {
    openModal(rule, scope);
  } else if (action === "toggle") {
    await fetch(`${API}/rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    reload();
    loadStats();
  } else if (action === "delete") {
    if (!confirm(`Deseja realmente excluir a regra "${rule.name}"?`)) return;
    await fetch(`${API}/rules/${id}`, { method: "DELETE" });
    reload();
    loadStats();
  }
}

// --- Gerenciamento do Modal ---
const backdrop = document.getElementById("modalBackdrop");
const ruleTypeSelect = document.getElementById("ruleType");
const ruleTypeField = document.getElementById("ruleTypeField");
const keywordsField = document.getElementById("keywordsField");

function toggleKeywordsField() {
  keywordsField.style.display = ruleTypeSelect.value === "keyword" ? "flex" : "none";
}
ruleTypeSelect.addEventListener("change", toggleKeywordsField);

function openModal(rule = null, scope = "dm") {
  currentEditingId = rule?.id || null;
  currentEditingScope = rule?.scope || scope;
  document.getElementById("ruleScope").value = currentEditingScope;

  const isComment = currentEditingScope === "comment";

  document.getElementById("modalTitletextContent" || "modalTitle").textContent = rule
    ? "Editar Configuração de Regra"
    : isComment
    ? "Nova Regra de Comentário para DM"
    : "Nova Regra de Mensagem Direta";

  document.getElementById("ruleName").value = rule?.name || "";
  document.getElementById("ruleKeywords").value = rule?.keywords?.join(", ") || "";
  document.getElementById("ruleReply").value = rule?.reply || "";
  document.getElementById("ruleEnabled").checked = rule ? rule.enabled : true;

  document.getElementById("ruleReplyLabel").textContent = isComment
    ? "DM Privada Automática Enviada"
    : "Resposta Automática na Direct";

  if (isComment) {
    ruleTypeField.style.display = "none";
    ruleTypeSelect.value = "keyword";
    keywordsField.style.display = "flex";
  } else {
    ruleTypeField.style.display = "flex";
    ruleTypeSelect.value = rule?.type || "keyword";
    toggleKeywordsField();
  }

  backdrop.classList.add("is-open");
}

function closeModal() {
  backdrop.classList.remove("is-open");
  currentEditingId = null;
}

document.getElementById("newRuleBtn").addEventListener("click", () => openModal(null, "dm"));
document.getElementById("newCommentRuleBtn").addEventListener("click", () => openModal(null, "comment"));
document.getElementById("cancelRuleBtn").addEventListener("click", closeModal);
document.getElementById("cancelRuleBtnSecondary").addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

document.getElementById("saveRuleBtn").addEventListener("click", async () => {
  const name = document.getElementById("ruleName").value.trim();
  const scope = document.getElementById("ruleScope").value;
  const type = scope === "comment" ? "keyword" : document.getElementById("ruleType").value;
  const keywordsRaw = document.getElementById("ruleKeywords").value.trim();
  const reply = document.getElementById("ruleReply").value.trim();
  const enabled = document.getElementById("ruleEnabled").checked;

  if (!name || !reply) {
    alert("Por favor, preencha o nome da regra e o texto da resposta.");
    return;
  }
  if (type === "keyword" && !keywordsRaw) {
    alert("Insira ao menos uma palavra-chave para este gatilho.");
    return;
  }

  const payload = {
    name,
    type,
    scope,
    reply,
    enabled,
    keywords: type === "keyword"
      ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined,
  };

  const url = currentEditingId ? `${API}/rules/${currentEditingId}` : `${API}/rules`;
  const method = currentEditingId ? "PUT" : "POST";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  closeModal();
  if (scope === "comment") {
    loadCommentRules();
  } else {
    loadRules();
  }
  loadStats();
});

// --- Utilitário de Escape HTML ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Inicialização e Refresh Automático ---
function refreshAll() {
  checkConnection();
  loadStats();
  loadInbox();
  loadRules();
  loadCommentRules();
  loadCommentLog();
}

refreshAll();
setInterval(refreshAll, 8000); // Sincronização automática a cada 8 segundos