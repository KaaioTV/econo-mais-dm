const express = require('express');
const path = require('path');
const { getData, saveData } = require('./db');

const router = express.Router();

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

    if (!name || !type || !reply) {
        return res.status(400).json({ error: "Campos obrigatórios: name, type, reply." });
    }

    const data = getData();
    const newRule = {
        id: Date.now().toString(),
        name,
        type,
        keywords: keywords || "",
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
        name: name || data.rules[ruleIndex].name,
        type: type || data.rules[ruleIndex].type,
        keywords: keywords !== undefined ? keywords : data.rules[ruleIndex].keywords,
        reply: reply || data.rules[ruleIndex].reply,
        enabled: enabled !== undefined ? enabled : data.rules[ruleIndex].enabled,
        scope: scope || data.rules[ruleIndex].scope
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