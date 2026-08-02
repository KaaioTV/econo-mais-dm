// Persistência simples em arquivo JSON.
// Suficiente para começar; se o volume crescer, trocar por SQLite/Postgres
// mantendo a mesma interface (getData / saveData) usada pelo resto do app.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const DEFAULT_DATA = {
  rules: [
    {
      id: "welcome",
      name: "Boas-vindas (primeira mensagem)",
      type: "welcome",
      enabled: true,
      reply: "Oi! 👋 Bem-vindo(a) à EconoMais. Posso te ajudar a entender como funciona o Insights Packet, tirar dúvidas sobre preço, garantia ou o que você vai aprender. É só perguntar!",
    },
    {
      id: "rule_preco",
      name: "Preço",
      type: "keyword",
      enabled: true,
      keywords: ["preço", "preco", "valor", "quanto custa", "quanto e", "quanto é"],
      reply: "O Insights Packet custa apenas R$19,90 e inclui acesso ao treinamento completo, atualizações e comunidade exclusiva.",
    },
    {
      id: "rule_como_funciona",
      name: "Como funciona",
      type: "keyword",
      enabled: true,
      keywords: ["como funciona", "como e", "como é"],
      reply: "Após a compra você recebe acesso imediato ao conteúdo e pode começar a estudar no mesmo dia.",
    },
    {
      id: "rule_garantia",
      name: "Garantia",
      type: "keyword",
      enabled: true,
      keywords: ["garantia"],
      reply: "Sim! Você tem garantia de 7 dias conforme as condições da plataforma.",
    },
    {
      id: "rule_aparecer",
      name: "Precisa aparecer",
      type: "keyword",
      enabled: true,
      keywords: ["aparecer", "mostrar o rosto", "sem aparecer"],
      reply: "Não! O método pode ser aplicado sem aparecer, todo o processo é feito por trás da página.",
    },
    {
      id: "rule_iniciante",
      name: "Funciona para iniciante",
      type: "keyword",
      enabled: true,
      keywords: ["iniciante", "do zero", "nunca fiz", "sei nada"],
      reply: "Sim! O treinamento foi desenvolvido pensando em quem está começando do zero.",
    },
    {
      id: "rule_conteudo",
      name: "O que vou aprender",
      type: "keyword",
      enabled: true,
      keywords: ["vou aprender", "o que tem", "conteudo", "conteúdo", "modulos", "módulos", "aulas"],
      reply: "Você vai aprender Instagram Orgânico, Shopee Afiliados, Cakto, Google Apps Script, automações, Telegram, Claude Code e Graph API.",
    },
    {
      id: "rule_suporte",
      name: "Suporte",
      type: "keyword",
      enabled: true,
      keywords: ["suporte", "duvida", "dúvida", "ajuda"],
      reply: "Sim! Você terá acesso à comunidade para tirar dúvidas e acompanhar as atualizações.",
    },
    {
      id: "rule_entrega",
      name: "Como recebe",
      type: "keyword",
      enabled: true,
      keywords: ["como recebo", "entrega", "acesso imediato", "recebo o material"],
      reply: "O acesso é liberado automaticamente após a confirmação do pagamento.",
    },
    {
      id: "rule_pagamento",
      name: "Formas de pagamento",
      type: "keyword",
      enabled: true,
      keywords: ["pix", "boleto", "cartao", "cartão", "forma de pagamento", "pagamento"],
      reply: "Você pode pagar via Pix, cartão ou boleto, conforme disponibilidade da plataforma.",
    },
    {
      id: "rule_anuncios",
      name: "Precisa investir em anúncios",
      type: "keyword",
      enabled: true,
      keywords: ["anuncio", "anúncio", "trafego pago", "tráfego pago", "investir dinheiro", "preciso investir"],
      reply: "Não obrigatoriamente. O treinamento mostra estratégias focadas em tráfego orgânico.",
    },
    {
      id: "rule_comprar",
      name: "Interesse em comprar",
      type: "keyword",
      enabled: true,
      keywords: ["comprar", "comprar agora", "quero comprar", "como compro", "link"],
      reply: "Que ótimo! O checkout oficial do Insights Packet está disponível no link da nossa bio. Qualquer dúvida antes de finalizar, é só chamar por aqui.",
    },
    {
      id: "fallback",
      name: "Resposta padrão (nenhuma regra bateu)",
      type: "fallback",
      enabled: true,
      reply: "Recebi sua mensagem! Pode me contar um pouco mais sobre o que você gostaria de saber sobre o Insights Packet? Se preferir, em breve alguém do time responde por aqui também. 🙂",
    },
  ],
  conversations: {},
  // conversations[igScopedUserId] = {
  //   userId, firstSeenAt, lastMessageAt, messages: [{from, text, at}], tags: []
  // }
};

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function getData() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function saveData(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { getData, saveData };
