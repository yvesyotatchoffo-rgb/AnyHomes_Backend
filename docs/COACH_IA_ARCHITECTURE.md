# Coach IA — Architecture Technique

**Date:** 2026-07-06  
**Version:** 1.0  
**Focus:** Structure backend, services, jobs, composants

---

## 🏗️ Architecture générale

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - CoachWindow component                                     │
│  - useCoachIntegration hook                                  │
│  - Redux state management                                    │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP/WebSocket
         ┌───────────────▼──────────────────┐
         │   Express.js Routes & Middleware │
         │  /api/v1/coach/* endpoints       │
         └────────────────┬─────────────────┘
                          │
         ┌────────────────▼──────────────────────────────────────────┐
         │              COACH IA SERVICES LAYER                      │
         │                                                            │
         │  ┌─────────────────────────────────────────────────────┐  │
         │  │ Coach Service (Orchestration)                      │  │
         │  │ - Route ingest → decision tree                     │  │
         │  │ - Coordinate services                             │  │
         │  └──────────────────┬──────────────────────────────────┘  │
         │                     │                                      │
         │  ┌──────────────────┼──────────────────────────┐          │
         │  │                  │                          │          │
         │  ▼                  ▼                          ▼          │
         │  ┌──────────┐  ┌──────────────┐  ┌────────────────┐     │
         │  │ Trigger  │  │ Dedupe       │  │ Prompt         │     │
         │  │ Service  │  │ Service      │  │ Builder        │     │
         │  │          │  │              │  │                │     │
         │  │ - Resolve│  │ - 12mo       │  │ - Minimal ctx  │     │
         │  │   intent │  │   history    │  │ - System+      │     │
         │  │ - Map    │  │ - Block if   │  │   intent       │     │
         │  │   trigger│  │   duplicate  │  │ - Filter input │     │
         │  └──────────┘  └──────────────┘  └────────────────┘     │
         │                                                            │
         │  ┌────────────────────────────────────────────────────┐  │
         │  │ LLM Adapter (DeepSeek V4 Flash)                  │  │
         │  │ - Call LLM with timeout                          │  │
         │  │ - Retry on rate limit                            │  │
         │  │ - Token counting                                 │  │
         │  │ - Cost tracking                                  │  │
         │  └────────────────┬────────────────────────────────┘  │
         │                   │                                     │
         │  ┌────────────────▼────────────────────────────────┐  │
         │  │ Validator Service                              │  │
         │  │ - Strict JSON parse                            │  │
         │  │ - Schema validation                            │  │
         │  │ - Tone check                                   │  │
         │  │ - Hallucination detection                      │  │
         │  │ - Repair loop (max 1 attempt)                  │  │
         │  └────────────────┬────────────────────────────────┘  │
         │                   │                                     │
         │  ┌────────────────▼────────────────────────────────┐  │
         │  │ Message Dispatch Service                       │  │
         │  │ - Persist record                               │  │
         │  │ - Add to history                               │  │
         │  │ - Notify UI (WebSocket/Polling)               │  │
         │  └────────────────────────────────────────────────┘  │
         │                                                            │
         └────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────▼─────────────────┐
         │   BullMQ / Job Queue             │
         │  - coach.ingest_event            │
         │  - coach.generate_message        │
         │  - coach.validate_message        │
         │  - coach.send_message            │
         │  - coach.log_metrics             │
         └────────────────┬────────────────┘
                          │
         ┌────────────────▼─────────────────┐
         │   MongoDB                        │
         │  - Triggers definition           │
         │  - Message requests/records      │
         │  - History (dedupe index)        │
         │  - Audit logs                    │
         └──────────────────────────────────┘
```

---

## 📂 Structure de fichiers

```
Backend/
├── app/
│   ├── models/
│   │   ├── index.js  ← ajouter exports
│   │   ├── coachTriggerDefinition.model.js
│   │   ├── coachMessageRequest.model.js
│   │   ├── coachMessageRecord.model.js
│   │   └── coachMessageHistory.model.js
│   │
│   ├── services/
│   │   ├── index.js  ← ajouter exports
│   │   ├── coach.service.js  ← main orchestration
│   │   ├── coachTrigger.service.js
│   │   ├── coachDedupe.service.js
│   │   ├── coachPrompt.service.js
│   │   ├── coachLLM.service.js
│   │   └── coachValidator.service.js
│   │
│   ├── controllers/
│   │   └── CoachController.js
│   │
│   ├── routes/
│   │   ├── index.js  ← ajouter router.use('/coach')
│   │   └── coach.routes.js
│   │
│   ├── jobs/
│   │   └── coach.jobs.js  ← ajouter à agenda
│   │
│   ├── utils/
│   │   ├── coachConstants.js  ← enums, mappings
│   │   └── coachLogger.js  ← structured logging
│   │
│   └── middleware/
│       └── coachAuth.middleware.js  ← optional
│
├── docs/
│   ├── COACH_IA_IMPLEMENTATION_PLAN.md
│   ├── COACH_IA_DATA_MODEL.md
│   ├── COACH_IA_BUSINESS_RULES.md
│   ├── COACH_IA_API_SPEC.md
│   ├── COACH_IA_ARCHITECTURE.md
│   ├── COACH_IA_PROMPTS.md
│   └── coach_ia.postman_collection.json
│
├── tests/
│   ├── unit/
│   │   ├── coachTrigger.service.test.js
│   │   ├── coachDedupe.service.test.js
│   │   ├── coachValidator.service.test.js
│   │   └── coachLLM.service.test.js
│   │
│   └── integration/
│       ├── coach.ingest.integration.test.js
│       ├── coach.dedupe.integration.test.js
│       ├── coach.end-to-end.integration.test.js
│       └── coach.fixture.js  ← test data
│
├── migrations/
│   └── 2026_07_06_create_coach_collections.js
│
└── scripts/
    ├── seed_coach_triggers.js  ← load 17 triggers
    └── create_coach_indexes.js  ← performance indexes
```

---

## 🔧 Services détaillés

### 1. Coach Service (Orchestration)

**File:** `app/services/coach.service.js`

```javascript
// Exports
exports.ingestEvent = async (eventPayload)
  // → crée CoachMessageRequest
  // → queue coach.resolve_trigger job
  
exports.planMessage = async (requestId)
  // → trigger resolve
  // → dedupe check
  // → retourne decision

exports.generateMessage = async (requestId, context)
  // → prompt builder
  // → LLM call
  // → retourne JSON brut

exports.validateMessage = async (requestId, outputJson)
  // → validation strict
  // → repair loop si besoin
  // → retourne valid/invalid

exports.sendMessage = async (requestId)
  // → persister record
  // → add to history
  // → dispatch UI
  // → log metrics

exports.getMessageHistory = async (userId, filters)
  // → query CoachMessageHistory
  // → apply filters
  // → retourne paginated results
```

### 2. Trigger Service

**File:** `app/services/coachTrigger.service.js`

```javascript
exports.resolveTrigger = async (triggerRef)
  // Input: "OC_V12"
  // Output: 
  //   {
  //     coach_intent: "respond_to_offer_sale",
  //     coach_need_family: "offer_management",
  //     context_transition_key: "offer_received_sale",
  //     multi_intent_allowed: true,
  //     dedupe_window_months: 12
  //   }
  
exports.getTriggerRegistry = async ()
  // Retourne tous les triggers avec status
  // Cache en memory avec TTL 1 jour
```

### 3. Dedupe Service

**File:** `app/services/coachDedupe.service.js`

```javascript
exports.isAllowed = async (userId, coachIntent, needFamily, contextKey)
  // Implémente la logique 3-level dedupe
  // Retourne: { allowed: boolean, reason: string, blockedAt: Date }

exports.recordSent = async (userId, record)
  // Ajoute message à CoachMessageHistory
  
exports.cleanupOldRecords = async (olderThan12Months)
  // Housekeeping via TTL index (automatique)
```

### 4. Prompt Builder Service

**File:** `app/services/coachPrompt.service.js`

```javascript
exports.buildPrompt = async (coachIntent, context)
  // Input: intent + context (user, property, transaction, lead)
  // Construit:
  //   - system_prompt (global, stable)
  //   - intent_prompt (spécifique à intent)
  //   - payload_json (données à envoyer au LLM)
  // Output: { systemPrompt, intentPrompt, payloadJson }

exports.getIntentTemplate = (coachIntent)
  // Retourne le template prompt pré-défini pour intent
  // Loaded from COACH_IA_PROMPTS.md
```

### 5. LLM Adapter Service

**File:** `app/services/coachLLM.service.js`

```javascript
exports.generateMessage = async (systemPrompt, intentPrompt, context, options)
  // Call DeepSeek V4 Flash
  // Timeout: 30 secondes
  // Retry rate limit: max 3 attempts
  // Retourne: { text, tokenInput, tokenOutput, estimatedCost, latencyMs }

exports.repairMessage = async (brokenJson, errorMessage, options)
  // Tentative unique de correction
  // Append error context au prompt
  // Retourne: { text, ... } ou ERROR

exports.countTokens = (text)
  // Estimation token count
  // Format: ~ char_length / 4

exports.estimateCost = (tokenInput, tokenOutput)
  // DeepSeek V4 Flash pricing
  // Retourne: { costUsd, pricePerMillionInput, pricePerMillionOutput }
```

### 6. Validator Service

**File:** `app/services/coachValidator.service.js`

```javascript
exports.validateMessage = (outputJson, intent, language)
  // Strict JSON parse
  // Schema validation (mandatory fields)
  // Tone check
  // Length constraints
  // Hallucination detection
  // Retourne: { valid: boolean, errors: [], quality_flags: [] }

exports.repairMessage = (invalidJson, errors)
  // Tentative unique correction via LLM
  // Append validation errors au context
  // Retourne: { repaired: boolean, output: {...} }
```

---

## 🔄 Job Queue (BullMQ/Agenda)

```javascript
// Job definitions in app/jobs/coach.jobs.js

agenda.define('coach.ingest_event', async (job) => {
  // 1. Créer CoachMessageRequest
  // 2. Queue coach.resolve_trigger
  // 3. Track progress
});

agenda.define('coach.resolve_trigger', async (job) => {
  // 1. Trigger resolve
  // 2. Check if coach_ia = true
  // 3. Queue coach.check_dedupe
});

agenda.define('coach.check_dedupe', async (job) => {
  // 1. Query 12mo history
  // 2. Apply dedupe logic
  // 3. Update CoachMessageRequest.status
  // 4. If BLOCKED → end
  // 5. If ALLOWED → queue coach.build_prompt
});

agenda.define('coach.build_prompt', async (job) => {
  // 1. Fetch context (user, property, transaction)
  // 2. Minimize payload
  // 3. Build system + intent prompt
  // 4. Queue coach.generate_llm
});

agenda.define('coach.generate_llm', async (job) => {
  // 1. Call DeepSeek
  // 2. Handle timeout/rate limit
  // 3. Retour brut JSON
  // 4. Queue coach.validate_message
});

agenda.define('coach.validate_message', async (job) => {
  // 1. Validation stricte
  // 2. If VALID → queue coach.send_message
  // 3. If INVALID → queue coach.repair_message
});

agenda.define('coach.repair_message', async (job) => {
  // 1. Tentative unique correction
  // 2. Retour validation
  // 3. If VALID → queue coach.send_message
  // 4. If FAILED → mark failed, end
});

agenda.define('coach.send_message', async (job) => {
  // 1. Create CoachMessageRecord
  // 2. Add to CoachMessageHistory
  // 3. Dispatch UI notification
  // 4. Update CoachMessageRequest.status = 'sent'
  // 5. Queue coach.log_metrics
});

agenda.define('coach.log_metrics', async (job) => {
  // 1. Collect all metrics from pipeline
  // 2. Send to monitoring system
  // 3. Check if any alerts trigger
});
```

---

## 🛡️ Error Handling Strategy

### Exception Types

```javascript
// Custom exceptions
class CoachError extends Error {}
class TriggerNotFoundError extends CoachError {}
class DeduplicatedError extends CoachError {}
class ValidationError extends CoachError {}
class LLMError extends CoachError {}
class LLMTimeoutError extends LLMError {}
class LLMRateLimitError extends LLMError {}
class DatabaseError extends CoachError {}
```

### Handling by layer

```javascript
// Coach Service (catch & log all)
try {
  await coachService.ingestEvent(payload);
} catch (error) {
  if (error instanceof DeduplicatedError) {
    // OK, expected → log with INFO
  } else if (error instanceof LLMTimeoutError) {
    // Retry auto → log with WARN
  } else {
    // Unexpected → log with ERROR, alert
  }
}

// LLM Service (retry on transient)
const MAX_RETRIES = 3;
let attempt = 0;
while (attempt < MAX_RETRIES) {
  try {
    return await callDeepSeek(...);
  } catch (error) {
    if (error.code === 'RATE_LIMIT') {
      await backoff(2 ** attempt);
      attempt++;
    } else if (error.code === 'TIMEOUT') {
      attempt++;
    } else {
      throw error; // non-retriable
    }
  }
}

// Validator Service (no retry, just mark failed)
try {
  validate(json);
  return { valid: true };
} catch (error) {
  const repaired = await attemptRepair(json, error);
  if (!repaired.valid) {
    throw new ValidationError('Repair failed');
  }
  return repaired;
}
```

---

## 📊 Observability

### Structured Logging

```javascript
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'coach-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'coach-combined.log' })
  ]
});

logger.info('coach.message.sent', {
  request_id: '...',
  trigger_ref: 'OC_V12',
  coach_intent: 'respond_to_offer_sale',
  user_id: '...',
  duration_ms: 1420,
  llm_latency_ms: 1240,
  token_input: 340,
  token_output: 187,
  cost_usd: 0.0084,
  dedupe_result: 'allowed',
  validation_result: 'valid',
  send_status: 'sent'
});
```

### Metrics

```javascript
// Prometheus / OpenMetrics format
coach_events_ingested_total { trigger_ref="OC_V12" } 42
coach_messages_deduplicated_total { reason="same_intent" } 15
coach_llm_latency_seconds { quantile="0.95" } 1.24
coach_llm_cost_usd_total 245.67
coach_validation_failures_total { reason="missing_fields" } 3
```

---

## 🧪 Testing Strategy

### Unit Tests (80% coverage target)

```javascript
// coachDedupe.service.test.js
describe('CoachDedupeService', () => {
  it('should block same intent within 12 months', async () => {
    // setup: prior message with same intent
    // test: isAllowed(userId, intent, family, key)
    // expect: allowed = false, reason = 'same_intent'
  });
  
  it('should allow different context in multi-family', async () => {
    // test: isAllowed with same family, diff context
    // expect: allowed = true
  });
});

// coachValidator.service.test.js
describe('CoachValidatorService', () => {
  it('should reject JSON with missing fields', () => {
    // test: validateMessage({ title: '...', /* no intro */ })
    // expect: valid = false, error includes 'missing_fields'
  });
  
  it('should repair message with LLM', async () => {
    // test: repairMessage(broken, errors)
    // expect: output.valid === true
  });
});
```

### Integration Tests

```javascript
// coach.end-to-end.integration.test.js
describe('Coach IA End-to-End', () => {
  it('should process event through complete pipeline', async () => {
    // 1. POST /coach/events/ingest
    // 2. Wait for job queue
    // 3. Verify CoachMessageRecord created
    // 4. Verify CoachMessageHistory updated
    // 5. Verify UI notification sent
  });
  
  it('should block duplicate messages', async () => {
    // 1. Send event 1 → message generated
    // 2. Send event 2 (same intent) → blocked
    // 3. Verify only 1 message in history
  });
});
```

---

## 🚀 Deployment

### Environment Variables

```bash
# .env
COACH_IA_ENABLED=true
COACH_IA_LLM_PROVIDER=deepseek
COACH_IA_LLM_API_KEY=${DEEPSEEK_API_KEY}
COACH_IA_LLM_MODEL=deepseek-v4-flash
COACH_IA_LLM_TIMEOUT_MS=30000
COACH_IA_DEDUPE_MONTHS=12
COACH_IA_LOG_LEVEL=info
COACH_IA_QUEUE_CONCURRENCY=5
```

### Startup Checklist

```
[ ] Load trigger registry from DB
[ ] Verify MongoDB connections
[ ] Initialize job queue (BullMQ/Agenda)
[ ] Warm up LLM adapter (test call)
[ ] Start listening on /api/v1/coach/* routes
[ ] Enable monitoring dashboards
```

---

**Dernière mise à jour:** 2026-07-06  
**Version:** 1.0
