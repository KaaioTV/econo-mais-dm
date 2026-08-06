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
