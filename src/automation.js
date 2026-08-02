// Motor de decisão das automações.
// Ordem de prioridade: welcome (só na 1ª mensagem do usuário) > keyword > fallback.

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

/**
 * @param {object} params
 * @param {string} params.text - texto recebido do usuário
 * @param {boolean} params.isFirstMessage - true se for a primeira msg dessa conversa
 * @param {Array} params.rules - lista de regras cadastradas no dashboard
 * @returns {object|null} a regra escolhida, ou null se nenhuma regra ativa combinar
 */
function pickRule({ text, isFirstMessage, rules }) {
  const enabledRules = rules.filter((r) => r.enabled);

  if (isFirstMessage) {
    const welcome = enabledRules.find((r) => r.type === "welcome");
    if (welcome) return welcome;
  }

  const normalizedText = normalize(text);
  const keywordMatch = enabledRules.find((r) => {
    if (r.type !== "keyword" || !r.keywords?.length) return false;
    return r.keywords.some((kw) => normalizedText.includes(normalize(kw)));
  });
  if (keywordMatch) return keywordMatch;

  const fallback = enabledRules.find((r) => r.type === "fallback");
  return fallback || null;
}

module.exports = { pickRule, normalize };
