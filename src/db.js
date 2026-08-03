const fs = require("fs");
const path = require("path");

// Garante que o db.json fique na pasta 'data' na raiz do projeto (ou ajustado ao contexto)
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const DEFAULT_DATA = {
  rules: [
    {
      id: "comment_eu_quero",
      scope: "comment",
      name: "Comentário: eu quero",
      type: "keyword",
      enabled: true,
      keywords: ["eu quero"],
      reply: "Oi! Vi que você comentou no nosso post 😊 O link do Insights Packet é exclusivo: COLE-SEU-LINK-AQUI. Qualquer dúvida, é só chamar!",
    },
    {
      id: "comment_link",
      scope: "comment",
      name: "Comentário: link",
      type: "keyword",
      enabled: true,
      keywords: ["link"],
      reply: "Oi! Vi que você comentou no nosso post 😊 O link do Insights Packet é exclusivo: COLE-SEU-LINK-AQUI. Qualquer dúvida, é só chamar!",
    },
    {
      id: "rule_economais",
      scope: "comment",
      name: "EconoMais Padrão",
      type: "keyword",
      enabled: true,
      keywords: ["economais"],
      reply: "Fala, meu nobre! Segue o link do EconoMais:",
    },
    {
      id: "welcome",
      scope: "dm",
      name: "Boas-vindas (primeira mensagem)",
      type: "welcome",
      enabled: true,
      reply: "Oi! 👋 Bem-vindo(a). Posso te ajudar a entender como funciona o Insights Packet, preço ou garantia? É só perguntar!",
    },
    {
      id: "rule_preco",
      scope: "dm",
      name: "Preço",
      type: "keyword",
      enabled: true,
      keywords: ["preço", "preco", "valor", "quanto custa", "quanto e", "quanto é"],
      reply: "O Insights Packet custa apenas R$19,90 com acesso imediato e vitalício ao treinamento.",
    },
    {
      id: "fallback",
      scope: "dm",
      name: "Resposta padrão",
      type: "fallback",
      enabled: true,
      reply: "Recebi sua mensagem! Em breve alguém do time responde por aqui também. 🙂",
    },
  ],
  conversations: {},
  commentReplies: {},
};

function ensureDbFile() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
    }
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error);
  }
}

function getData() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler o banco de dados, recuperando estrutura padrão:", error);
    // Retorna os dados padrão e reseta o arquivo caso corrompa
    saveData(DEFAULT_DATA);
    return DEFAULT_DATA;
  }
}

function saveData(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Erro ao salvar os dados no disco:", error);
  }
}

module.exports = { getData, saveData };