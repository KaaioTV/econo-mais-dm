const express = require('express');
const path = require('path');
const { getData, saveData } = require('./db');

const router = express.Router();

// --- Estatísticas e Métricas para o Dashboard ---
router.get("/stats", (req, res) => {
    try {
        const data = getData();
        const rules = data.rules || [];
        const conversations = data.conversations || {};
        const commentReplies = data.commentReplies || {};

        const totalConversations = Object.keys(conversations).length;
        
        let totalMessages = 0;
        let activeLast24h = 0;
        const now = Date.now();

        for (const userId in conversations) {
            const convo = conversations[userId];
            if (convo.messages && Array.isArray(convo.messages)) {
                totalMessages += convo.messages.length;
            }
            if (convo.lastMessageAt && (now - new Date(convo.lastMessageAt).getTime() < 24 * 60 * 60 * 1000)) {
                activeLast24h++;
            }
        }

        const activeRules = rules.filter(r => (r.scope || "dm") === "dm" && r.enabled).length;
        const activeCommentRules = rules.filter(r => r.scope === "comment" && r.enabled).length;
        
        const commentRepliesList = Object.values(commentReplies);
        const totalCommentReplies = commentRepliesList.length;

        res.json({
            totalConversations,
            totalMessages,
            activeLast24h,
            activeRules,
            activeCommentRules,
            totalCommentReplies
        });
    } catch (error) {
        console.error("Erro ao gerar stats:", error);
        res.status(500).json({ error: "Erro interno ao buscar estatísticas." });
    }
});

// --- Conversas (Inbox DM) ---
router.get("/conversations", (req, res) => {
    const data = getData();
    const conversationsObj = data.conversations || {};
    
    // Transforma o objeto de conversas em array formatado para o front
    const conversationsArray = Object.keys(conversationsObj).map(userId => ({
        userId,
        ...conversationsObj[userId]
    })).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    res.json(conversationsArray);
});

// --- Logs de DMs por Comentário ---
router.get("/comment-replies", (req, res) => {
    const data = getData();
    const repliesObj = data.commentReplies || {};
    const repliesArray = Object.values(repliesObj).sort((a, b) => new Date(b.repliedAt || 0) - new Date(a.repliedAt || 0));
    res.json(repliesArray);
});

// --- Regras de automação ---
router.get("/rules", (req, res) => {
    const data = getData();
    const { scope } = req.query;
    const rules = scope ? data.rules.filter((r) => (r.scope || "dm") === scope) : data.rules;
    res.json(rules);
});

router.post("/rules", (req, res) => {
    const { name, type, keywords, reply, enabled, scope } = req.body;
    const ruleScope = scope === "comment" ? "comment" : "dm";

    if (!name || !reply) {
        return res.status(400).json({ error: "Campos obrigatórios: name e reply." });
    }

    const data = getData();
    const newRule = {
        id: "rule_" + Date.now(),
        name,
        type: type || "keyword",
        keywords: Array.isArray(keywords) ? keywords : (keywords ? [keywords] : []),
        reply,
        enabled: enabled !== undefined ? enabled : true,
        scope: ruleScope
    };

    data.rules.push(newRule);
    saveData(data);
    res.status(201).json(newRule);
});

router.put("/rules/:id", (req, res) => {
    const { id } = req.params;
    const { name, type, keywords, reply, enabled, scope } = req.body;
    const data = getData();
    
    const ruleIndex = data.rules.findIndex(r => r.id === id);
    if (ruleIndex === -1) {
        return res.status(404).json({ error: "Regra não encontrada." });
    }

    data.rules[ruleIndex] = {
        ...data.rules[ruleIndex],
        name: name !== undefined ? name : data.rules[ruleIndex].name,
        type: type !== undefined ? type : data.rules[ruleIndex].type,
        keywords: keywords !== undefined ? (Array.isArray(keywords) ? keywords : [keywords]) : data.rules[ruleIndex].keywords,
        reply: reply !== undefined ? reply : data.rules[ruleIndex].reply,
        enabled: enabled !== undefined ? enabled : data.rules[ruleIndex].enabled,
        scope: scope !== undefined ? scope : data.rules[ruleIndex].scope
    };

    saveData(data);
    res.json(data.rules[ruleIndex]);
});

router.delete("/rules/:id", (req, res) => {
    const { id } = req.params;
    const data = getData();
    
    const filteredRules = data.rules.filter(r => r.id !== id);
    if (filteredRules.length === data.rules.length) {
        return res.status(404).json({ error: "Regra não encontrada." });
    }

    data.rules = filteredRules;
    saveData(data);
    res.json({ success: true });
});

module.exports = router;