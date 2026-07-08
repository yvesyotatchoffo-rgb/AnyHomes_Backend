/**
 * Coach IA Constants
 * Centralized trigger mappings, deduplication rules, and configuration
 */

const COACH_TRIGGER_REGISTRY = [
  // VENTE (10 intents)
  {
    trigger_ref: "OC_V01",
    transaction_type: "VENTE",
    funnel_status: "first_lead_received",
    coach_intent: "welcome_first_lead_sale",
    coach_need_family: "onboarding",
    multi_intent_allowed_in_family: false,
    context_transition_key: "first_lead_sale",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V02",
    transaction_type: "VENTE",
    funnel_status: "visit_scheduled",
    coach_intent: "prepare_visit_sale",
    coach_need_family: "visit_preparation",
    multi_intent_allowed_in_family: false,
    context_transition_key: "visit_prepared_sale",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V03",
    transaction_type: "VENTE",
    funnel_status: "visit_completed",
    coach_intent: "post_visit_next_steps_sale",
    coach_need_family: "post_visit",
    multi_intent_allowed_in_family: true,
    context_transition_key: "post_visit_${lead_id}",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V04",
    transaction_type: "VENTE",
    funnel_status: "visit_feedback_collected",
    coach_intent: "analyze_visit_feedback_sale",
    coach_need_family: "post_visit",
    multi_intent_allowed_in_family: true,
    context_transition_key: "feedback_analysis_${lead_id}",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V07",
    transaction_type: "VENTE",
    funnel_status: "seller_file_incomplete",
    coach_intent: "prepare_seller_file",
    coach_need_family: "offer_management",
    multi_intent_allowed_in_family: true,
    context_transition_key: "seller_file_stage_${transaction_id}",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V08",
    transaction_type: "VENTE",
    funnel_status: "offer_received",
    coach_intent: "respond_to_offer_sale",
    coach_need_family: "offer_management",
    multi_intent_allowed_in_family: true,
    context_transition_key: "offer_received_${offer_id}",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V09",
    transaction_type: "VENTE",
    funnel_status: "offer_refused_counter_sent",
    coach_intent: "handle_refused_counter_offer_sale",
    coach_need_family: "offer_management",
    multi_intent_allowed_in_family: true,
    context_transition_key: "counter_offer_${counter_id}",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V10",
    transaction_type: "VENTE",
    funnel_status: "pre_contract_stage",
    coach_intent: "prepare_pre_contract_sale",
    coach_need_family: "transaction_signing",
    multi_intent_allowed_in_family: false,
    context_transition_key: "pre_contract_sale",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V12",
    transaction_type: "VENTE",
    funnel_status: "final_signing_stage",
    coach_intent: "prepare_final_signing_sale",
    coach_need_family: "transaction_signing",
    multi_intent_allowed_in_family: false,
    context_transition_key: "final_signing_sale",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_V15",
    transaction_type: "VENTE",
    funnel_status: "transaction_closed",
    coach_intent: "celebrate_sale_closed",
    coach_need_family: "transaction_closure",
    multi_intent_allowed_in_family: false,
    context_transition_key: "transaction_closed_sale",
    dedupe_window_months: 12,
  },

  // LOCATION (7 intents)
  {
    trigger_ref: "OC_L01",
    transaction_type: "LOCATION",
    funnel_status: "first_lead_received",
    coach_intent: "welcome_first_lead_rental",
    coach_need_family: "onboarding",
    multi_intent_allowed_in_family: false,
    context_transition_key: "first_lead_rental",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_L03",
    transaction_type: "LOCATION",
    funnel_status: "visit_completed",
    coach_intent: "prepare_visit_rental",
    coach_need_family: "visit_preparation",
    multi_intent_allowed_in_family: false,
    context_transition_key: "visit_prepared_rental",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_L12",
    transaction_type: "LOCATION",
    funnel_status: "rental_application_ready",
    coach_intent: "prepare_rental_application_review",
    coach_need_family: "rental_candidate_review",
    multi_intent_allowed_in_family: false,
    context_transition_key: "rental_application_ready",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_L14",
    transaction_type: "LOCATION",
    funnel_status: "rental_application_analyzed",
    coach_intent: "analyze_rental_application",
    coach_need_family: "rental_candidate_review",
    multi_intent_allowed_in_family: true,
    context_transition_key: "application_analysis_${application_id}",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_L15",
    transaction_type: "LOCATION",
    funnel_status: "pre_lease_stage",
    coach_intent: "prepare_lease_signing",
    coach_need_family: "transaction_signing",
    multi_intent_allowed_in_family: false,
    context_transition_key: "pre_lease_signing",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_L23",
    transaction_type: "LOCATION",
    funnel_status: "lease_signed",
    coach_intent: "celebrate_lease_signed",
    coach_need_family: "transaction_closure",
    multi_intent_allowed_in_family: false,
    context_transition_key: "lease_signed_rental",
    dedupe_window_months: 12,
  },
  {
    trigger_ref: "OC_L33",
    transaction_type: "LOCATION",
    funnel_status: "transaction_closed",
    coach_intent: "celebrate_rental_closed",
    coach_need_family: "transaction_closure",
    multi_intent_allowed_in_family: false,
    context_transition_key: "transaction_closed_rental",
    dedupe_window_months: 12,
  },
];

// Family rules: strict families block ALL intents in family within window
const STRICT_FAMILIES = [
  "onboarding", // Only one welcome per user, 12 months
  "visit_preparation", // Only one visit prep per transaction, 12 months
];

// Deduplication rules by family
const DEDUPE_RULES = {
  onboarding: {
    type: "strict", // strict = no intent in family allowed
    window_months: 12,
    allows_context_transition: false,
  },
  visit_preparation: {
    type: "strict",
    window_months: 12,
    allows_context_transition: false,
  },
  post_visit: {
    type: "context", // context = allow if context_transition_key different
    window_months: 12,
    allows_context_transition: true,
  },
  offer_management: {
    type: "context",
    window_months: 12,
    allows_context_transition: true,
  },
  rental_candidate_review: {
    type: "context",
    window_months: 12,
    allows_context_transition: true,
  },
  transaction_signing: {
    type: "strict",
    window_months: 12,
    allows_context_transition: false,
  },
  transaction_closure: {
    type: "strict",
    window_months: 12,
    allows_context_transition: false,
  },
};

// LLM Configuration
const LLM_CONFIG = {
  model: "meta/llama-3.2-11b-vision-instruct",
  temperature: 0.5,
  max_tokens: 900,
  perplexity_max_tokens: 700, // Réduit pour maîtriser les coûts Perplexity
  timeout_ms: 20000,
  max_retries: 2,
  retry_delay_ms: 500,
  // Seuls ces intents nécessitent des données live (Perplexity) — tous les autres → NVIDIA gratuit
  live_data_intents: ["user_question"],
  // Limite anti-abus : max questions libres par utilisateur par jour
  user_question_daily_limit: 20,
};

// Cost estimation (in USD)
const LLM_PRICING = {
  // Perplexity — modèles avec web search
  "sonar": { input_per_1m_tokens: 1.0, output_per_1m_tokens: 1.0 },
  "sonar-pro": { input_per_1m_tokens: 3.0, output_per_1m_tokens: 15.0 },
  // NVIDIA NIM — modèles statiques (messages spontanés)
  "meta/llama-3.2-11b-vision-instruct": { input_per_1m_tokens: 0.10, output_per_1m_tokens: 0.10 },
  "mistralai/mistral-medium-3.5-128b": { input_per_1m_tokens: 0.40, output_per_1m_tokens: 1.20 },
  "meta/llama-3.3-70b-instruct": { input_per_1m_tokens: 0.23, output_per_1m_tokens: 0.23 },
  "meta/llama-3.1-8b-instruct": { input_per_1m_tokens: 0.10, output_per_1m_tokens: 0.10 },
};

// Quality validation constraints
const VALIDATION_CONSTRAINTS = {
  title: {
    min_chars: 10,
    max_chars: 100,
    required: true,
  },
  intro: {
    min_sentences: 1,
    max_sentences: 2,
    required: true,
  },
  advice_points: {
    min_items: 3,
    max_items: 5,
    required: true,
  },
  next_action: {
    min_chars: 10,
    max_chars: 150,
    required: true,
  },
  resource_cta: {
    min_chars: 5,
    max_chars: 100,
    required: false,
  },
};

module.exports = {
  COACH_TRIGGER_REGISTRY,
  STRICT_FAMILIES,
  DEDUPE_RULES,
  LLM_CONFIG,
  LLM_PRICING,
  VALIDATION_CONSTRAINTS,
};
