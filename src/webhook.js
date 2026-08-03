const express = require("express");
const { getData, saveData } = require("./db");
const { pickRule, pickCommentRule } = require("./automation");
const { sendTextMessage, sendPrivateReply } = require("./metaApi");

const router = express.Router();

// 1) Verificação do webhook — a Meta chama esse GET uma única vez quando
//    você salva a URL no App Dashboard, para confirmar que você é o dono.
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("[Webhook] Webhook verificado com sucesso.");
    return res.status(200).send(challenge);
  }
  console.warn("[Webhook] Falha na verificação do token do Webhook.");
  return res.sendStatus(403);
});

// 2) Recebimento de eventos — toda DM e todo comentário chegam aqui via POST.
router.post("/webhook", async (req, res) => {
  // Responder 200 rapidamente é importante: a Meta reenvia o evento
  // se não receber confirmação em poucos segundos.
  res.sendStatus(200);

  try {
    const body = req.body;

    // LOG OBRIGATÓRIA: Webhook recebido
    console.log("\n========================================");
    console.log("↓ Webhook recebido:", JSON.stringify(body));
    console.log("========================================");

    if (body.object !== "instagram") return;

    for (const entry of body.entry || []) {
      // Mensagens diretas (DirectFlow)
      for (const event of entry.messaging || []) {
        await handleMessagingEvent(event);
      }

      // Comentários em posts/reels (automação estilo CreatorFlow)
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          await handleCommentEvent(change.value);
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

  // Ignora eco de mensagens enviadas pela própria página e eventos sem texto
  if (!senderId || !text || event.message?.is_echo) return;

  // LOG OBRIGATÓRIA: Etapas da Mensagem
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
      console.log("↓ Sucesso ou erro: Sucesso ao enviar DM de texto");

      convo.messages.push({
        from: "bot",
        text: rule.reply,
        ruleId: rule.id,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("↓ Sucesso ou erro: Falha ao enviar resposta automática:", err.message);
    }
  }

  saveData(data);
  console.log("↓ Banco atualizado");
  console.log("↓ Dashboard atualizado");
}

/**
 * Trata um comentário recebido em post/reels. Se o texto bater com uma
 * palavra-chave cadastrada, manda uma DM privada pra quem comentou —
 * igual ManyChat/CreatorFlow ("comente X e receba o link no direct").
 */
async function handleCommentEvent(value) {
  const commentId = value?.id;
  const text = value?.text;
  const fromId = value?.from?.id;
  const fromUsername = value?.from?.username;

  if (!commentId || !text) return;

  // LOG OBRIGATÓRIA: Comentário recebido
  console.log("↓ Comentário recebido");
  console.log("↓ Usuário:", fromUsername || fromId || "desconhecido");
  console.log("↓ Texto recebido:", text);

  const data = getData();

  // Nunca responder 2x o mesmo comentário (a Meta também só permite 1x)
  if (data.commentReplies[commentId]) return;

  // Evita responder aos próprios comentários da página
  if (fromId && fromId === process.env.META_IG_ACCOUNT_ID) return;

  const rule = pickCommentRule({ text, rules: data.rules });
  if (!rule) return;

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
    console.log(`DM privada enviada para comentário ${commentId} (regra: ${rule.name})`);
  } catch (err) {
    console.error("↓ Sucesso ou erro: Falha ao enviar resposta privada de comentário:", err.message);
  }
}

module.exports = router;