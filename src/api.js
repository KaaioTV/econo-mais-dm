const express = require("express");
const { getData, saveData } = require("./db");

const router = express.Router();

// --- Regras de automação ---

router.get("/rules", (req, res) => {
  const data = getData();
  res.json(data.rules);
});

router.post("/rules", (req, res) => {
  const { name, type, keywords, reply, enabled } = req.body;

  if (!name || !type || !reply) {
    return res.status(400).json({ error: "Campos obrigatórios: name, type, reply." });
  }
  if (!["welcome", "keyword", "fallback"].includes(type)) {
    return res.status(400).json({ error: "type deve ser welcome, keyword ou fallback." });
  }

  const data = getData();
  const newRule = {
    id: `rule_${Date.now()}`,
    name,
    type,
    keywords: type === "keyword" ? keywords || [] : undefined,
    reply,
    enabled: enabled !== false,
  };
  data.rules.push(newRule);
  saveData(data);
  res.status(201).json(newRule);
});

router.put("/rules/:id", (req, res) => {
  const data = getData();
  const idx = data.rules.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Regra não encontrada." });

  data.rules[idx] = { ...data.rules[idx], ...req.body, id: data.rules[idx].id };
  saveData(data);
  res.json(data.rules[idx]);
});

router.delete("/rules/:id", (req, res) => {
  const data = getData();
  const before = data.rules.length;
  data.rules = data.rules.filter((r) => r.id !== req.params.id);
  if (data.rules.length === before) {
    return res.status(404).json({ error: "Regra não encontrada." });
  }
  saveData(data);
  res.status(204).send();
});

// --- Conversas ---

router.get("/conversations", (req, res) => {
  const data = getData();
  const list = Object.values(data.conversations).sort(
    (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
  );
  res.json(list);
});

router.get("/conversations/:userId", (req, res) => {
  const data = getData();
  const convo = data.conversations[req.params.userId];
  if (!convo) return res.status(404).json({ error: "Conversa não encontrada." });
  res.json(convo);
});

// --- Métricas resumidas para o topo do dashboard ---

router.get("/stats", (req, res) => {
  const data = getData();
  const conversations = Object.values(data.conversations);
  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const last24h = conversations.filter(
    (c) => new Date(c.lastMessageAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  res.json({
    totalConversations: conversations.length,
    totalMessages,
    activeLast24h: last24h,
    activeRules: data.rules.filter((r) => r.enabled).length,
  });
});

module.exports = router;
