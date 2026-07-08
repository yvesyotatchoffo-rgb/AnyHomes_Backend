# Coach IA — Data Model & Schemas

**Date:** 2026-07-06  
**Version:** 1.0  
**Format:** Mongoose ODM (MongoDB)

---

## 📋 Overview

7 entités principales:
1. **CoachTriggerDefinition** - Référentiel de mapping triggers
2. **CoachMessageRequest** - Demande de génération (temp)
3. **CoachMessageRecord** - Message généré + envoyé (permanent)
4. **CoachMessageHistory** - Vue d'audit pour déduplication

---

## 🗂️ Modèles Mongoose

### 1. CoachTriggerDefinition

Référentiel statique : mapping entre triggers métier et intents coach.

```javascript
{
  _id: ObjectId,
  
  // Identification
  trigger_ref: String,            // "OC_V12", "OC_L03", etc.
  transaction_type: String,       // "VENTE" ou "LOCATION"
  funnel_status: String,          // Statut métier auquel le trigger correspond
  
  // Mapping vers coach intent
  coach_intent: String,           // "respond_to_offer_sale", "prepare_visit_rental", etc.
  coach_need_family: String,      // "onboarding", "visit_preparation", "post_visit", etc.
  
  // Règles de répétition
  multi_intent_allowed_in_family: Boolean,  // true si famille autorise plusieurs intents
  context_transition_key: String,          // clé métier pour dédupli (ex: "offer_received_sale")
  
  // Activation
  message_coach_ia: Boolean,      // true = ce trigger déclenche un message
  learning_center_recommended: Boolean,   // true = recommander Learning Center link
  
  // Configuration
  dedupe_window_months: Number,   // Fenêtre de blocage (toujours 12 en V1)
  active: Boolean,                // true = ce trigger est actif
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ trigger_ref: 1 }  // lookup principal
{ coach_intent: 1, active: 1 }
{ transaction_type: 1, message_coach_ia: 1 }
```

**Données de seed (17 rows):**

| trigger_ref | coach_intent | family | multi | transition_key |
|---|---|---|---|---|
| OC_V01 | welcome_first_lead_sale | onboarding | ❌ | first_lead_received_sale |
| OC_V02 | welcome_first_lead_sale | onboarding | ❌ | first_lead_received_sale |
| OC_V03 | welcome_first_lead_sale | onboarding | ❌ | first_lead_received_sale |
| OC_V04 | prepare_visit_sale | visit_preparation | ❌ | visit_booked_sale |
| OC_V07 | prepare_visit_sale | visit_preparation | ❌ | visit_booked_sale |
| OC_V08 | post_visit_next_steps_sale | post_visit | ✅ | visit_completed_waiting_feedback |
| OC_V09 | analyze_visit_feedback_sale | post_visit | ✅ | visit_feedback_received_sale |
| OC_V10 | prepare_seller_file | offer_management | ✅ | seller_file_requested |
| OC_V12 | respond_to_offer_sale | offer_management | ✅ | offer_received_sale |
| OC_V15 | handle_refused_counter_offer_sale | offer_management | ✅ | counter_offer_refused_sale |
| OC_V16 | prepare_pre_contract_sale | transaction_signing | ✅ | offer_accepted_pre_contract |
| OC_V17 | prepare_pre_contract_sale | transaction_signing | ✅ | offer_accepted_pre_contract |
| OC_V29 | prepare_final_signing_sale | transaction_signing | ✅ | pre_contract_signed_final |
| OC_V32 | celebrate_sale_closed | transaction_closure | ✅ | final_sale_signed_transfer |
| OC_V33 | celebrate_sale_closed | transaction_closure | ✅ | final_sale_signed_transfer |
| OC_L01 | welcome_first_lead_rental | onboarding | ❌ | first_lead_received_rental |
| OC_L03 | prepare_visit_rental | visit_preparation | ❌ | visit_booked_rental |
| OC_L12 | prepare_rental_application_review | rental_candidate_review | ✅ | visit_completed_waiting_app |
| OC_L14 | analyze_rental_application | rental_candidate_review | ✅ | application_received_review |
| OC_L15 | prepare_lease_signing | transaction_signing | ✅ | application_accepted_lease |
| OC_L23 | celebrate_lease_signed | transaction_closure | ✅ | lease_signed_inventory |
| OC_L33 | celebrate_rental_closed | transaction_closure | ✅ | renter_assigned_closed |

---

### 2. CoachMessageRequest

Demande de génération temporaire. Cycle de vie court (~5-10 minutes).

```javascript
{
  _id: ObjectId,
  
  // Idempotence
  event_id: String,               // UUID unique du domaine métier, idempotent
  
  // Utilisateur & contexte métier
  user_id: ObjectId,              // ref User
  property_id: ObjectId,          // ref Property
  transaction_id: ObjectId,       // ref Transaction
  
  // Trigger & routing
  trigger_ref: String,            // "OC_V12"
  coach_intent: String,           // résolu durant traitement
  coach_need_family: String,      // résolu durant traitement
  context_transition_key: String, // résolu durant traitement
  
  // Payload métier (minimal)
  payload_json: {
    source_status: String,        // Ancien statut → nouveau statut (si disponible)
    offer_price: Number,          // Si applicable
    lead_maturity_score: Number,  // Si applicable
    // ... autres données métier minimalistes
  },
  
  // Traitement
  status: String,                 // received → dedupe_blocked / generation_pending → generated → validation_failed / sent / failed / skipped
  created_at: Date,
  updated_at: Date,
  
  // TTL: auto-purge après 90 jours
  expiresAt: Date  // TTL index
}
```

**Indexes:**
```javascript
{ event_id: 1 }  // lookup idempotence
{ user_id: 1, created_at: -1 }
{ status: 1, created_at: -1 }
{ expiresAt: 1 }  // TTL index
```

**Statuts d'exécution:**
```
received 
  ↓
[dedupe check]
  ├→ dedupe_blocked [STOP]
  └→ generation_pending
      ↓
  [LLM generation]
      ├→ generated
      │   ↓
      │ [validation]
      │   ├→ valid → sent [OK]
      │   └→ invalid_json
      │       ↓
      │     [repair loop]
      │       ├→ valid → sent [OK]
      │       └→ still invalid → failed [STOP]
      └→ failed (LLM error) [STOP]
```

---

### 3. CoachMessageRecord

Message réellement généré. Permanent, pour audit et historique.

```javascript
{
  _id: ObjectId,
  
  // Traçabilité
  request_id: ObjectId,           // ref CoachMessageRequest._id
  event_id: String,               // copie de request pour audit
  
  // Utilisateur & contexte
  user_id: ObjectId,              // ref User
  property_id: ObjectId,          // ref Property
  transaction_id: ObjectId,       // ref Transaction
  
  // Trigger & intent
  trigger_ref: String,            // "OC_V12"
  coach_intent: String,           // "respond_to_offer_sale"
  coach_need_family: String,      // "offer_management"
  context_transition_key: String, // "offer_received_sale"
  
  // Versioning
  prompt_version: String,         // "v1.0" (pour tracking changements prompts)
  model_version: String,          // "deepseek-v4-flash"
  
  // Résultats processing
  status: String,                 // "generated", "sent", "failed", "skipped"
  dedupe_result: String,          // "allowed", "blocked_same_intent", "blocked_family", etc.
  validation_result: String,      // "valid", "invalid_json", "missing_fields", "too_long", etc.
  
  // Quality flags
  quality_flags_json: {
    has_invention_risk: Boolean,    // Détecter hallucination
    has_tone_mismatch: Boolean,     // Ton différent que attendu
    has_length_violation: Boolean,  // Dépasse longueur
    has_prompt_injection_risk: Boolean // Détecté injection?
  },
  
  // Message généré (JSON)
  output_json: {
    title: String,
    intro: String,
    advice_points: [String],
    next_action: String,
    resource_cta: String | null
  },
  
  // Envoi
  sent_at: Date,
  sent_to_channel: String,        // "realtime" (WebSocket) ou "polling"
  
  // LLM metrics
  llm_latency_ms: Number,
  token_input: Number,
  token_output: Number,
  estimated_cost_usd: Number,
  
  // Timestamps
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
```javascript
{ user_id: 1, sent_at: -1 }       // Historique utilisateur
{ user_id: 1, coach_intent: 1, sent_at: -1 }  // Dédup lookup principal
{ user_id: 1, coach_need_family: 1, sent_at: -1 }
{ property_id: 1, sent_at: -1 }
{ status: 1, created_at: -1 }     // Monitoring
{ request_id: 1 }                 // Audit
```

---

### 4. CoachMessageHistory

Vue agrégée simplifiée pour déduplication rapide. Population par trigger depuis CoachMessageRecord.

```javascript
{
  _id: ObjectId,
  
  // Clés de dédup
  user_id: ObjectId,
  coach_intent: String,
  coach_need_family: String,
  context_transition_key: String,
  
  // Source
  source_record_id: ObjectId,     // ref CoachMessageRecord._id
  source_trigger_ref: String,     // "OC_V12"
  
  // Quand envoyé
  sent_at: Date,
  
  // Statut résultat
  status: String,                 // "sent", "failed", "skipped"
  
  // Versions
  prompt_version: String,
  model_version: String,
  
  // Timestamps
  created_at: Date
}
```

**Indexes (CRITIQUES for dedup performance):**
```javascript
{ user_id: 1, sent_at: -1 }
{ user_id: 1, coach_intent: 1, sent_at: -1 }
{ user_id: 1, coach_need_family: 1, sent_at: -1 }
{ user_id: 1, context_transition_key: 1, sent_at: -1 }
{ user_id: 1, coach_need_family: 1, context_transition_key: 1, sent_at: -1 }
```

**Retention Policy:**
- TTL: 12 mois + 30 jours (buffer)
- Après 12 mois: cascade delete CoachMessageRecord

---

## 🔄 Flux données

```
Événement métier (funnelStatus changé)
  ↓
POST /coach/events/ingest
  ↓
Create CoachMessageRequest { status: 'received' }
  ↓
[Trigger Resolution] → populate coach_intent, coach_need_family, context_transition_key
  ↓
[Dedupe Check] → query CoachMessageHistory sur 12 mois
  ├→ BLOCKED? → CoachMessageRequest { status: 'dedupe_blocked' }
  └→ ALLOWED? → CoachMessageRequest { status: 'generation_pending' }
      ↓
  [LLM Generation] → call DeepSeek
      ↓
  [Validation] → parse JSON, check schema
      ├→ VALID? → Create CoachMessageRecord { status: 'generated', output_json: {...} }
      │           → Add to CoachMessageHistory
      │           → CoachMessageRequest { status: 'sent' }
      │           → UI Dispatch
      └→ INVALID?
          ↓
      [Repair Loop (unique)]
          ├→ VALID? → Create CoachMessageRecord + Add to History + Dispatch
          └→ STILL INVALID? → CoachMessageRequest { status: 'failed' }
```

---

## 🛡️ Data Integrity

### Constraints
```javascript
// CoachTriggerDefinition
unique: trigger_ref + transaction_type

// CoachMessageRequest
unique: event_id (idempotence)

// CoachMessageHistory
// Pas d'unique constraint (insertions cumulatives historiques)
```

### Cascade Delete
```
CoachMessageRequest deleted
  → NO cascade (keep history)

CoachMessageRecord deleted
  → CASCADE delete from CoachMessageHistory (FK violation prevention)
```

### Validation Rules
```javascript
// Tous les coach_intent doivent exister dans trigger registry
// Tous les coach_need_family doivent être dans liste fermée
// context_transition_key non-vide si multi-intent family
// dedupe_window_months >= 1
// prompt_version format: "v[0-9]+\.[0-9]+" (semver-like)
// tokens positifs ou 0
```

---

## 📊 Storage & Performance Estimates

### Documents
- **CoachTriggerDefinition**: 17 docs (static)
- **CoachMessageRequest**: ~1,000 docs/day (temp, auto-purge)
- **CoachMessageRecord**: ~10,000 docs/day (permanent)
- **CoachMessageHistory**: ~10,000 docs/day (permanent)

### Storage (12 mois)
- CoachMessageRecord: ~3.65M docs × ~2KB = ~7.3GB
- CoachMessageHistory: ~3.65M docs × ~800B = ~2.9GB
- **Total: ~10.2GB** (reasonable for MongoDB)

### Query Performance
- Dedupe lookup: indexed, < 10ms
- Message history fetch: indexed, < 50ms
- Request polling: indexed, < 20ms

---

## 🔐 Data Privacy & Retention

### PII Handling
- Minimiser PII stocké: user_id (ObjectId, anonyme), pas de nom/email
- Payload métier: ne stocker que data nécessaire (prix, notes, pas SMS/phone)

### Deletion Policy
- **After 12 months**: automatic delete via TTL
- **On user request**: cascade delete CoachMessageRecord → CoachMessageHistory

### GDPR Compliance
- User can request audit of all messages
- User can request deletion of message history
- Messages non-identifiants (pas de données perso sensibles)

---

## 📝 Notes d'implémentation

### Loading Trigger Registry (one-time migration)
```javascript
// scripts/seed_coach_triggers.js
const triggerData = [ /* 17 entries */ ];
await db.coachTriggerDefinition.insertMany(triggerData);
```

### TTL Index
```javascript
// CoachMessageRequest: expire après 90 jours
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// CoachMessageHistory: expire après 12.5 mois
schema.index({ created_at: 1 }, { expireAfterSeconds: 36288000 }); // 420 jours
```

### Composite Indexes
Priorités:
1. Dedupe lookups (les plus fréquentes)
2. Monitoring queries (admin dashboards)
3. Audit queries (less frequent)

---

**Dernière mise à jour:** 2026-07-06  
**Version:** 1.0
