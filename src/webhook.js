const express = require("express");
const { getData, saveData } = require("./db");
const { pickRule } = require("./automation");
const { sendTextMessage } = require("./metaApi");

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

// 2) Recebimento de eventos — toda DM nova chega aqui via POST.
router.post("/webhook", async (req, res) => {
  // Responder 200 rapidamente é importante: a Meta reenvia o evento
  // se não receber confirmação em poucos segundos.
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== "instagram") return;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        await handleMessagingEvent(event);
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

module.exports = router;
