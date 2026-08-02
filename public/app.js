const API = "/api";
let currentEditingId = null;

// --- Navegação entre views ---
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("is-active");
  });
});

// --- Status de conexão com o backend ---
async function checkConnection() {
  const pill = document.getElementById("connStatus");
  try {
    const res = await fetch(`${API}/stats`);
    if (!res.ok) throw new Error();
    pill.classList.add("is-live");
    pill.innerHTML = `<span class="pulse"></span> backend conectado`;
  } catch {
    pill.classList.remove("is-live");
    pill.innerHTML = `<span class="pulse"></span> backend offline`;
  }
}

// --- Visão geral ---
async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const stats = await res.json();
    document.getElementById("statConversations").textContent = stats.totalConversations;
    document.getElementById("statMessages").textContent = stats.totalMessages;
    document.getElementById("statActive").textContent = stats.activeLast24h;
    document.getElementById("statRules").textContent = stats.activeRules;
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
  }
}

// --- Conversas ---
async function loadInbox() {
  const list = document.getElementById("inboxList");
  try {
    const res = await fetch(`${API}/conversations`);
    const conversations = await res.json();

    if (!conversations.length) {
      list.innerHTML = `<div class="empty-state">Nenhuma conversa ainda.</div>`;
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
              <span class="convo-id">${escapeHtml(c.userId)}</span>
              <span class="convo-time">${time}</span>
            </div>
            <div class="convo-last ${fromClass}">${lastText}</div>
          </div>`;
      })
      .join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Não foi possível carregar as conversas.</div>`;
  }
}

// --- Regras ---
async function loadRules() {
  const list = document.getElementById("rulesList");
  try {
    const res = await fetch(`${API}/rules`);
    const rules = await res.json();

    if (!rules.length) {
      list.innerHTML = `<div class="empty-state">Nenhuma regra cadastrada ainda.</div>`;
      return;
    }

    const typeLabels = { welcome: "Boas-vindas", keyword: "Palavra-chave", fallback: "Padrão" };

    list.innerHTML = rules
      .map(
        (r) => `
        <div class="rule-card ${r.enabled ? "" : "is-disabled"}">
          <div class="rule-main">
            <div class="rule-name">${escapeHtml(r.name)}</div>
            <span class="rule-type">${typeLabels[r.type] || r.type}</span>
            ${r.keywords?.length ? `<div class="rule-reply">Gatilhos: ${r.keywords.map(escapeHtml).join(", ")}</div>` : ""}
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
      btn.addEventListener("click", () => handleRuleAction(btn.dataset.action, btn.dataset.id, rules));
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Não foi possível carregar as regras.</div>`;
  }
}

async function handleRuleAction(action, id, rules) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;

  if (action === "edit") {
    openModal(rule);
  } else if (action === "toggle") {
    await fetch(`${API}/rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    loadRules();
    loadStats();
  } else if (action === "delete") {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return;
    await fetch(`${API}/rules/${id}`, { method: "DELETE" });
    loadRules();
    loadStats();
  }
}

// --- Modal de criação/edição ---
const backdrop = document.getElementById("modalBackdrop");
const ruleTypeSelect = document.getElementById("ruleType");
const keywordsField = document.getElementById("keywordsField");

function toggleKeywordsField() {
  keywordsField.style.display = ruleTypeSelect.value === "keyword" ? "flex" : "none";
}
ruleTypeSelect.addEventListener("change", toggleKeywordsField);

function openModal(rule = null) {
  currentEditingId = rule?.id || null;
  document.getElementById("modalTitle").textContent = rule ? "Editar regra" : "Nova regra";
  document.getElementById("ruleName").value = rule?.name || "";
  document.getElementById("ruleType").value = rule?.type || "keyword";
  document.getElementById("ruleKeywords").value = rule?.keywords?.join(", ") || "";
  document.getElementById("ruleReply").value = rule?.reply || "";
  document.getElementById("ruleEnabled").checked = rule ? rule.enabled : true;
  toggleKeywordsField();
  backdrop.classList.add("is-open");
}

function closeModal() {
  backdrop.classList.remove("is-open");
  currentEditingId = null;
}

document.getElementById("newRuleBtn").addEventListener("click", () => openModal());
document.getElementById("cancelRuleBtn").addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

document.getElementById("saveRuleBtn").addEventListener("click", async () => {
  const name = document.getElementById("ruleName").value.trim();
  const type = document.getElementById("ruleType").value;
  const keywordsRaw = document.getElementById("ruleKeywords").value.trim();
  const reply = document.getElementById("ruleReply").value.trim();
  const enabled = document.getElementById("ruleEnabled").checked;

  if (!name || !reply) {
    alert("Preencha o nome da regra e a resposta.");
    return;
  }

  const payload = {
    name,
    type,
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
  loadRules();
  loadStats();
});

// --- Util ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Boot ---
function refreshAll() {
  checkConnection();
  loadStats();
  loadInbox();
  loadRules();
}
refreshAll();
setInterval(refreshAll, 8000); // atualiza sozinho a cada 8s
