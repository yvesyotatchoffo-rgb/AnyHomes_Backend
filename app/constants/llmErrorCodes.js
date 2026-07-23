const LLM_ERROR_CODES = {
  DEEPSEEK_NO_BALANCE: { code: "LLM-001", label: "Crédit DeepSeek insuffisant" },
  DEEPSEEK_API_ERROR: { code: "LLM-002", label: "Erreur API DeepSeek" },
  NVIDIA_API_ERROR: { code: "LLM-003", label: "Erreur API NVIDIA" },
  ALL_PROVIDERS_FAILED: { code: "LLM-004", label: "Tous les fournisseurs LLM indisponibles" },
  INVALID_RESPONSE: { code: "LLM-005", label: "Réponse invalide du modèle" },
  EMPTY_CONTENT: { code: "LLM-006", label: "Contenu vide généré" },
  COACH_LLM_FAILED: { code: "LLM-007", label: "Échec du Coach IA" },
  CONFIG_ERROR: { code: "LLM-008", label: "Erreur de configuration LLM" },
  PERPLEXITY_API_ERROR: { code: "LLM-009", label: "Erreur API Perplexity" },
};

const INTERACTION_TYPES = {
  LISTING_WRITING: "Titre et description",
  COACH_IA: "Coach IA",
};

module.exports = { LLM_ERROR_CODES, INTERACTION_TYPES };
