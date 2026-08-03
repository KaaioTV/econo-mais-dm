// Wrapper fino sobre a Graph API da Meta para o canal Instagram Direct.
// Documentação de referência: Instagram Messaging API (Send API + Webhooks).

const fetch = require("node-fetch");

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getAccessToken() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "META_PAGE_ACCESS_TOKEN não configurado no .env — gere um token de página com o escopo instagram_manage_messages."
    );
  }
  return token;
}

/**
 * Envia uma mensagem de texto simples para um usuário do Instagram
 * a partir do ID "scoped" que a Meta envia nos eventos de webhook.
 */
async function sendTextMessage(recipientId, text) {
  const token = getAccessToken();
  const url = `${BASE_URL}/me/messages?access_token=${encodeURIComponent(token)}`;

  const body = {
    recipient: { id: recipientId },
    message: { text },
  };

  console.log(`[MetaAPI] Tentando enviar DM para usuário ${recipientId}...`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log(`[MetaAPI] Resposta completa da Meta (sendTextMessage):`, JSON.stringify(data));

  if (!res.ok) {
    console.error("[MetaAPI] Erro ao enviar mensagem via Meta API:", data);
    throw new Error(data?.error?.message || "Falha ao enviar mensagem");
  }
  return data;
}

/**
 * Envia mensagem com botões de resposta rápida (quick replies).
 */
async function sendQuickReplies(recipientId, text, options) {
  const token = getAccessToken();
  const url = `${BASE_URL}/me/messages?access_token=${encodeURIComponent(token)}`;

  const body = {
    recipient: { id: recipientId },
    message: {
      text,
      quick_replies: options.map((opt) => ({
        content_type: "text",
        title: opt.title,
        payload: opt.payload,
      })),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[MetaAPI] Erro ao enviar quick replies via Meta API:", data);
    throw new Error(data?.error?.message || "Falha ao enviar mensagem");
  }
  return data;
}

/**
 * Envia uma DM privada em resposta a um comentário público (Reels/post).
 */
async function sendPrivateReply(commentId, text) {
  const token = getAccessToken();
  // Endpoint correto para private replies no Graph API da Meta
  const url = `${BASE_URL}/${commentId}/private_replies?access_token=${encodeURIComponent(token)}`;

  console.log(`[MetaAPI] Tentando enviar Private Reply para o comentário ID: ${commentId}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });

  const data = await res.json();
  console.log(`[MetaAPI] Resposta completa da Meta (sendPrivateReply):`, JSON.stringify(data));

  if (!res.ok) {
    console.error("[MetaAPI] Erro ao enviar private reply via Meta API:", data);
    throw new Error(data?.error?.message || "Falha ao enviar private reply");
  }
  return data;
}

module.exports = { sendTextMessage, sendQuickReplies, sendPrivateReply };
[cite: 5]```

---

#### 2. `src/webhook.js` (Atualizado com logs em todas as etapas exigidas)

```javascript
const express = require("express");
const { getData, saveData } = require("./db");
const { pickRule, pickCommentRule } = require("./automation");
const { sendTextMessage, sendPrivateReply } = require("./metaApi");

const router = express.Router();

// 1) Verificação do webhook
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("[Webhook] Webhook verificado com sucesso.");
    return res.status(200).send(challenge);
  }
  console.warn("[Webhook] Falha na verificação do webhook (token incorreto).");
  return res.sendStatus(403);
});

// 2) Recebimento de eventos — toda DM e todo comentário chegam aqui via POST.
router.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;

    // LOG OBRIGATÓRIA 1: Webhook recebido
    console.log("\n========================================");
    console.log("↓ Webhook recebido:", JSON.stringify(body, null, 2));
    console.log("========================================");

    if (body.object !== "instagram") {
      console.log("[Webhook] Evento ignorado: objeto não é do Instagram.");
      return;
    }

    for (const entry of body.entry || []) {
      // Mensagens diretas (DirectFlow)
      if (entry.messaging) {
        for (const event of entry.messaging) {
          await handleMessagingEvent(event);
        }
      }

      // Comentários em posts/reels (automação estilo CreatorFlow)
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "comments") {
            await handleCommentEvent(change.value);
          }
        }
      }
    }
  } catch (err) {
    console.error("[Webhook] Erro processando evento do webhook:", err);
  }
});

async function handleMessagingEvent(event) {
  const senderId = event.sender?.id;
  const text = event.message?.text;

  if (!senderId || !text || event.message?.is_echo) return;

  // LOG OBRIGATÓRIA: Etapas de Mensagem
  console.log("↓ Usuário:", senderId);
  console.log("↓ Texto recebido:", text);

  const data = getData();
  const isFirstMessage = !data.conversations[senderId];

  if (isFirstMessage) {
    data.conversations[senderId] = {
      userId: senderId,
      firstSeenAt: new Date().toISOString(),
      messages: [],
      tags: [],
    };
  }

  const convo = data.conversations[senderId];
  convo.lastMessageAt = new Date().toISOString();
  convo.messages.push({ from: "user", text, at: convo.lastMessageAt });

  const rule = pickRule({ text, isFirstMessage, rules: data.rules });

  if (rule) {
    console.log("↓ Palavra encontrada / Regra ID:", rule.id);
    console.log("↓ Automação encontrada:", rule.name);
    console.log("↓ Tentando enviar DM...");

    try {
      await sendTextMessage(senderId, rule.reply);
      console.log("↓ Sucesso ou erro: Sucesso no envio de DM");
      
      convo.messages.push({
        from: "bot",
        text: rule.reply,
        ruleId: rule.id,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("↓ Sucesso ou erro: Erro ao enviar resposta automática:", err.message);
    }
  } else {
    console.log("[Automation] Nenhuma regra correspondente para o texto.");
  }

  saveData(data);
  console.log("↓ Banco atualizado");
  console.log("↓ Dashboard atualizado");
}

/**
 * Trata um comentário recebido em post/reels.
 */
async function handleCommentEvent(value) {
  const commentId = value?.id;
  const text = value?.text;
  const fromId = value?.from?.id;
  const fromUsername = value?.from?.username;

  if (!commentId || !text) {
    console.log("[CommentEvent] Evento de comentário inválido ou incompleto:", value);
    return;
  }

  // LOG OBRIGATÓRIA 2: Comentário recebido
  console.log("↓ Comentário recebido");
  console.log("↓ Usuário:", fromUsername || fromId);
  console.log("↓ Texto recebido:", text);

  const data = getData();

  if (data.commentReplies[commentId]) {
    console.log(`[CommentEvent] O comentário ${commentId} já foi respondido anteriormente.`);
    return;
  }

  if (fromId && fromId === process.env.META_IG_ACCOUNT_ID) {
    console.log("[CommentEvent] Ignorando comentário da própria conta do Instagram.");
    return;
  }

  const rule = pickCommentRule({ text, rules: data.rules });
  if (!rule) {
    console.log(`[CommentEvent] Nenhuma palavra-chave de comentário bateu com o texto: "${text}"`);
    return;
  }

  console.log("↓ Palavra encontrada:", rule.name);
  console.log("↓ Automação encontrada:", rule.id);
  console.log("↓ Tentando enviar DM...");

  try {
    const metaResponse = await sendPrivateReply(commentId, rule.reply);
    console.log("↓ Resposta completa da Meta:", JSON.stringify(metaResponse));
    console.log("↓ Sucesso ou erro: Sucesso ao enviar private reply");

    data.commentReplies[commentId] = {
      commentId,
      username: fromUsername || fromId || "desconhecido",
      keyword: rule.name,
      ruleId: rule.id,
      repliedAt: new Date().toISOString(),
    };
    
    saveData(data);
    console.log("↓ Banco atualizado");
    console.log("↓ Dashboard atualizado");
    console.log(`[CommentEvent] DM privada enviada com sucesso para o comentário ${commentId}`);
  } catch (err) {
    console.error("↓ Sucesso ou erro: Erro ao enviar resposta privada de comentário:", err.message);
  }
}

module.exports = router;
[cite: 6]```