/**
 * DirectFlow Quantum Engine v2.5 - Frontend Client Script
 * Otimizado para alta performance em Desktop, iOS e Android.
 */

const API = "/api";
let currentEditingId = null;
let currentEditingScope = "dm";

// --- Navegação entre Views (Otimizada para Toque e Clique) ---
document.querySelectorAll(".nav-item").forEach((btn) => {
  const activateView = (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    btn.classList.add("is-active");
    const targetView = document.getElementById(`view-${btn.dataset.view}`);
    if (targetView) targetView.classList.add("is-active");
  };
  btn.addEventListener("click", activateView);
  btn.addEventListener("touchend", activateView);
});

// --- Status de Conexão com o Backend ---
async function checkConnection() {
  const pill = document.getElementById("connStatus");
  if (!pill) return;
  try {
    const res = await fetch(`${API}/stats`, { cache: "no-store" });
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
    const res = await fetch(`${API}/stats`, { cache: "no-store" });
    if (!res.ok) return;
    const stats = await res.json();
    
    const setSafeText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? 0;
    };

    setSafeText("statConversations", stats.totalConversations);
    setSafeText("statMessages", stats.totalMessages);
    setSafeText("statActive", stats.activeLast24h);
    setSafeText("statRules", stats.activeRules);
    setSafeText("statCommentRules", stats.activeCommentRules);
    setSafeText("statCommentReplies", stats.totalCommentReplies);
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
  }
}

// --- Conversas (DM) ---
async function loadInbox() {
  const list = document.getElementById("inboxList");
  if (!list) return;
  try {
    const res = await fetch(`${API}/conversations`, { cache: "no-store" });
    const conversations = await res.json();

    if (!Array.isArray(conversations) || !conversations.length) {
      list.innerHTML = `<div class="empty-state">Nenhuma conversa registrada até o momento.</div>`;
      return;
    }

    list.innerHTML = conversations
      .map((c) => {
        const last = c.messages?.[c.messages.length - 1];
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
  if (!list) return;
  try {
    const res = await fetch(`${API}/comment-replies`, { cache: "no-store" });
    const replies = await res.json();

    if (!Array.isArray(replies) || !replies.length) {
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
  if (!list) return;
  try {
    const res = await fetch(`${API}/rules?scope=dm`, { cache: "no-store" });
    const rules = await res.json();
    renderRulesList(list, rules, "dm");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Erro ao carregar regras de DM.</div>`;
  }
}

// --- Regras de Comentário ---
async function loadCommentRules() {
  const list = document.getElementById("commentRulesList");
  if (!list) return;
  try {
    const res = await fetch(`${API}/rules?scope=comment`, { cache: "no-store" });
    const rules = await res.json();
    renderRulesList(list, rules, "comment");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Erro ao carregar regras de comentário.</div>`;
  }
}

// --- Renderizador de Regras Blindado para Mobile/Desktop ---
function renderRulesList(list, rules, scope) {
  if (!Array.isArray(rules) || !rules.length) {
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
          <button type="button" class="btn-action" data-action="edit" data-id="${r.id}">Editar</button>
          <button type="button" class="btn-action" data-action="toggle" data-id="${r.id}">${r.enabled ? "Desligar" : "Ligar"}</button>
          <button type="button" class="btn-action" data-action="delete" data-id="${r.id}">Excluir</button>
        </div>
      </div>`
    )
    .join("");

  // Delegação de eventos robusta compatível com click e touch
  list.querySelectorAll(".btn-action").forEach((btn) => {
    const triggerAction = (e) => {
      e.preventDefault();
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      handleRuleAction(action, id, rules, scope);
    };
    btn.addEventListener("click", triggerAction);
  });
}

async function handleRuleAction(action, id, rules, scope) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;

  const reload = scope === "comment" ? loadCommentRules : loadRules;

  if (action === "edit") {
    openModal(rule, scope);
  } else if (action === "toggle") {
    try {
      await fetch(`${API}/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      reload();
      loadStats();
    } catch (err) {
      console.error("Erro ao alterar status da regra:", err);
    }
  } else if (action === "delete") {
    if (!confirm(`Deseja realmente excluir a regra "${rule.name}"?`)) return;
    try {
      await fetch(`${API}/rules/${id}`, { method: "DELETE" });
      reload();
      loadStats();
    } catch (err) {
      console.error("Erro ao excluir regra:", err);
    }
  }
}

// --- Gerenciamento Seguro do Modal ---
const backdrop = document.getElementById("modalBackdrop");
const ruleTypeSelect = document.getElementById("ruleType");
const ruleTypeField = document.getElementById("ruleTypeField");
const keywordsField = document.getElementById("keywordsField");

function toggleKeywordsField() {
  if (keywordsField && ruleTypeSelect) {
    keywordsField.style.display = ruleTypeSelect.value === "keyword" ? "flex" : "none";
  }
}

if (ruleTypeSelect) {
  ruleTypeSelect.addEventListener("change", toggleKeywordsField);
}

function openModal(rule = null, scope = "dm") {
  currentEditingId = rule?.id || null;
  currentEditingScope = rule?.scope || scope;
  
  const scopeInput = document.getElementById("ruleScope");
  if (scopeInput) scopeInput.value = currentEditingScope;

  const isComment = currentEditingScope === "comment";

  const modalTitle = document.getElementById("modalTitle") || document.getElementById("modalTitletextContent");
  if (modalTitle) {
    modalTitle.textContent = rule
      ? "Editar Configuração de Regra"
      : isComment
      ? "Nova Regra de Comentário para DM"
      : "Nova Regra de Mensagem Direta";
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal("ruleName", rule?.name || "");
  setVal("ruleKeywords", Array.isArray(rule?.keywords) ? rule.keywords.join(", ") : (rule?.keywords || ""));
  setVal("ruleReply", rule?.reply || "");
  setCheck("ruleEnabled", rule ? rule.enabled : true);

  const replyLabel = document.getElementById("ruleReplyLabel");
  if (replyLabel) {
    replyLabel.textContent = isComment ? "DM Privada Automática Enviada" : "Resposta Automática na Direct";
  }

  if (isComment) {
    if (ruleTypeField) ruleTypeField.style.display = "none";
    if (ruleTypeSelect) ruleTypeSelect.value = "keyword";
    if (keywordsField) keywordsField.style.display = "flex";
  } else {
    if (ruleTypeField) ruleTypeField.style.display = "flex";
    if (ruleTypeSelect) ruleTypeSelect.value = rule?.type || "keyword";
    toggleKeywordsField();
  }

  if (backdrop) backdrop.classList.add("is-open");
}

function closeModal() {
  if (backdrop) backdrop.classList.remove("is-open");
  currentEditingId = null;
}

// Listeners de Abertura/Fechamento do Modal
const bindClickOrTouch = (id, handler) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", handler);
    el.addEventListener("touchend", (e) => { e.preventDefault(); handler(e); });
  }
};

bindClickOrTouch("newRuleBtn", () => openModal(null, "dm"));
bindClickOrTouch("newCommentRuleBtn", () => openModal(null, "comment"));
bindClickOrTouch("cancelRuleBtn", closeModal);
bindClickOrTouch("cancelRuleBtnSecondary", closeModal);

if (backdrop) {
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
}

// --- Salvar Regra (POST / PUT) ---
const saveBtn = document.getElementById("saveRuleBtn");
if (saveBtn) {
  const handleSave = async (e) => {
    e.preventDefault();
    
    const nameEl = document.getElementById("ruleName");
    const scopeEl = document.getElementById("ruleScope");
    const keywordsEl = document.getElementById("ruleKeywords");
    const replyEl = document.getElementById("ruleReply");
    const enabledEl = document.getElementById("ruleEnabled");

    const name = nameEl ? nameEl.value.trim() : "";
    const scope = scopeEl ? scopeEl.value : "dm";
    const type = scope === "comment" ? "keyword" : (ruleTypeSelect ? ruleTypeSelect.value : "keyword");
    const keywordsRaw = keywordsEl ? keywordsEl.value.trim() : "";
    const reply = replyEl ? replyEl.value.trim() : "";
    const enabled = enabledEl ? enabledEl.checked : true;

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

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Falha ao salvar regra no servidor.");

      closeModal();
      if (scope === "comment") {
        loadCommentRules();
      } else {
        loadRules();
      }
      loadStats();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar a regra. Verifique a conexão.");
    }
  };

  saveBtn.addEventListener("click", handleSave);
  saveBtn.addEventListener("touchend", handleSave);
}

// --- Utilitário de Escape HTML ---
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Inicialização e Sincronização Automática ---
function refreshAll() {
  checkConnection();
  loadStats();
  loadInbox();
  loadRules();
  loadCommentRules();
  loadCommentLog();
}

// Executa na carga inicial
refreshAll();

// Loop inteligente de atualização em background (a cada 10 segundos)
setInterval(refreshAll, 10000);