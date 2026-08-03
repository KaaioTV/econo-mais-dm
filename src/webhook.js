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
    console.log("Webhook verificado com sucesso.");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Recebimento de eventos — toda DM e todo comentário chegam aqui via POST.
router.post("/webhook", async (req, res) => {
  // Responder 200 rapidamente é importante: a Meta reenvia o evento
  // se não receber confirmação em poucos segundos.
  res.sendStatus(200);

  try {
    const body = req.body;

    // Log cru pra diagnóstico — mostra exatamente o que a Meta mandou.
    // Se nada aparecer aqui quando você testar, o problema está antes
    // do nosso servidor (configuração na Meta), não no código.
    console.log("Webhook recebido:", JSON.stringify(body));

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
    console.error("Erro processando evento do webhook:", err);
  }
});

async function handleMessagingEvent(event) {
  const senderId = event.sender?.id;
  const text = event.message?.text;

  // Ignora eco de mensagens enviadas pela própria página e eventos sem texto
  if (!senderId || !text || event.message?.is_echo) return;

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
    try {
      await sendTextMessage(senderId, rule.reply);
      convo.messages.push({
        from: "bot",
        text: rule.reply,
        ruleId: rule.id,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Falha ao enviar resposta automática:", err.message);
    }
  }

  saveData(data);
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

  const data = getData();

  // Nunca responder 2x o mesmo comentário (a Meta também só permite 1x,
  // mas checamos aqui pra não gastar chamada à toa e pra manter histórico).
  if (data.commentReplies[commentId]) return;

  // Evita responder aos próprios comentários da página (ex: quando o
  // bot ou um admin comenta algo na conversa do post).
  if (fromId && fromId === process.env.META_IG_ACCOUNT_ID) return;

  const rule = pickCommentRule({ text, rules: data.rules });
  if (!rule) return;

  try {
    await sendPrivateReply(commentId, rule.reply);
    data.commentReplies[commentId] = {
      commentId,
      username: fromUsername || fromId || "desconhecido",
      keyword: rule.name,
      ruleId: rule.id,
      repliedAt: new Date().toISOString(),
    };
    saveData(data);
    console.log(`DM privada enviada para comentário ${commentId} (regra: ${rule.name})`);
  } catch (err) {
    console.error("Falha ao enviar resposta privada de comentário:", err.message);
  }
}

module.exports = router;