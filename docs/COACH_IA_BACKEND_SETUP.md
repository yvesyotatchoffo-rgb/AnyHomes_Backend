# 🎯 Coach IA Backend Implementation - Phase 1

Complete backend implementation for Coach IA system (17 coaching intents for real estate transactions).

## 📦 What's Included

### Models (4 Mongoose schemas)
- **CoachTriggerDefinition**: Registry of 17 trigger→intent mappings
- **CoachMessageRequest**: Temporary tracking of event ingestion (90-day TTL)
- **CoachMessageRecord**: Permanent store of generated messages
- **CoachMessageHistory**: 12-month deduplication index with automatic cleanup

### Services (6 core services)
- **coach.service.js**: Main orchestration (ingest → plan → generate → validate → send)
- **coachTrigger.service.js**: Trigger resolution (OC_V01 → welcome_first_lead_sale)
- **coachDedupe.service.js**: 3-level deduplication logic with history tracking
- **coachPrompt.service.js**: LLM prompt building (system + intent-specific + context)
- **coachLLM.service.js**: DeepSeek API client with retry logic & cost estimation
- **coachValidator.service.js**: Message validation against strict constraints

### API Endpoints (7 routes)
```
POST   /coach/events/ingest              # Start message generation pipeline
POST   /coach/messages/plan              # Check deduplication
POST   /coach/messages/generate          # Call LLM
POST   /coach/messages/validate          # Validate output
POST   /coach/messages/send              # Mark as sent, record in history
GET    /coach/messages/history/:user_id  # Get message history
GET    /coach/messages/status/:request_id # Check message status
GET    /coach/triggers                   # List available triggers
```

### Background Jobs (Agenda)
- **coach.process-pending-messages**: Every 5 minutes - process pending events through full pipeline
- **coach.cleanup-old-records**: Daily at 2 AM - cleanup records > 13 months old

### Utilities
- **coachConstants.js**: 17 trigger definitions, dedup rules, LLM config
- **coachLogger.js**: Structured logging for Coach IA

## 🚀 Quick Start

### 1. Setup Environment Variables
```bash
# Add to .env
DEEPSEEK_API_KEY=sk_xxxx...
LOG_LEVEL=info
```

### 2. Initialize Database
```bash
# Seed 17 trigger definitions
node scripts/seed_coach_triggers.js

# Create MongoDB indexes
node scripts/create_coach_indexes.js

# Run integration tests
node scripts/test_coach_integration.js
```

### 3. Start Server
```bash
# Server automatically loads Coach routes on startup
npm start
```

## 📋 API Examples

### Ingest Event
```bash
curl -X POST http://localhost:6089/coach/events/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_123456",
    "user_id": "user_789",
    "property_id": "prop_456",
    "transaction_id": "txn_789",
    "trigger_ref": "OC_V01",
    "payload_json": {
      "transaction_type": "VENTE",
      "lead_name": "Jean Dupont"
    }
  }'
```

Response:
```json
{
  "success": true,
  "request_id": "req_507f...",
  "event_id": "evt_123456",
  "status": "received"
}
```

### Get Message Status
```bash
curl http://localhost:6089/coach/messages/status/evt_123456
```

Response:
```json
{
  "success": true,
  "request_id": "req_507f...",
  "event_id": "evt_123456",
  "status": "sent",
  "created_at": "2026-07-06T10:30:00Z",
  "record": {
    "id": "rec_123...",
    "status": "sent",
    "output": {
      "title": "Bienvenue à votre premier prospect!",
      "intro": "C'est une grande étape...",
      "advice_points": [...],
      "next_action": "...",
      "resource_cta": "..."
    },
    "sent_at": "2026-07-06T10:31:15Z"
  }
}
```

### Get Message History
```bash
curl "http://localhost:6089/coach/messages/history/user_789?coach_intent=welcome_first_lead_sale&months=12"
```

## 🏗️ Architecture

### 8-Stage Pipeline
```
1. INGEST     → CoachMessageRequest created (status: received)
2. TRIGGER    → Resolve trigger_ref to coach_intent + metadata
3. DEDUPE     → Check 3-level dedup, may block here
4. PROMPT     → Build system + intent-specific + context prompt
5. LLM        → Call DeepSeek with retry logic
6. VALIDATE   → Check constraints, quality flags
7. REPAIR     → If JSON invalid, attempt repair
8. SEND       → Mark sent, record in history
```

### Deduplication Logic (3-Level)
```javascript
// LEVEL 1: Block if same intent sent in 12mo window
if (history.find(h => h.coach_intent === intent && h.sent_at > 12moAgo)) {
  block("blocked_same_intent");
}

// LEVEL 2: Block if strict family (onboarding, visit_prep, etc.)
if (STRICT_FAMILIES.includes(family) && 
    history.find(h => h.coach_need_family === family && h.sent_at > 12moAgo)) {
  block("blocked_strict_family");
}

// LEVEL 3: For multi-intent families, allow if context_transition_key different
if (!STRICT_FAMILIES.includes(family) &&
    history.find(h => h.coach_need_family === family && 
                       h.context_transition_key === key && 
                       h.sent_at > 12moAgo)) {
  block("blocked_same_family_same_context");
}
```

### 17 Coaching Intents

**VENTE (10 intents):**
1. OC_V01: welcome_first_lead_sale
2. OC_V02: prepare_visit_sale
3. OC_V03: post_visit_next_steps_sale
4. OC_V04: analyze_visit_feedback_sale
5. OC_V07: prepare_seller_file
6. OC_V08: respond_to_offer_sale
7. OC_V09: handle_refused_counter_offer_sale
8. OC_V10: prepare_pre_contract_sale
9. OC_V12: prepare_final_signing_sale
10. OC_V15: celebrate_sale_closed

**LOCATION (7 intents):**
1. OC_L01: welcome_first_lead_rental
2. OC_L03: prepare_visit_rental
3. OC_L12: prepare_rental_application_review
4. OC_L14: analyze_rental_application
5. OC_L15: prepare_lease_signing
6. OC_L23: celebrate_lease_signed
7. OC_L33: celebrate_rental_closed

## 📊 Monitoring

### Key Metrics
- **llm_latency_ms**: Time to call DeepSeek (goal: < 5sec)
- **token_input / token_output**: Usage for billing
- **estimated_cost_usd**: DeepSeek cost per message (~$0.0005-0.001)
- **dedupe_result**: Block reason if message rejected
- **quality_flags_json**: Invention risk, tone mismatch, etc.

### Database Queries
```javascript
// Recent messages sent to user
db.CoachMessageRecord.find({ user_id: ObjectId(...), sent_at: { $gte: startDate } })

// Dedup history for user
db.CoachMessageHistory.find({ user_id: ObjectId(...), sent_at: { $gte: 12moAgo } })

// Failed messages
db.CoachMessageRequest.find({ status: "validation_failed" })
```

## ⚙️ Configuration

### LLM Settings (coachConstants.js)
```javascript
LLM_CONFIG = {
  model: "deepseek-chat",
  temperature: 0.7,
  max_tokens: 800,
  timeout_ms: 10000,
  max_retries: 3,
}
```

### Validation Constraints
- title: 10-100 chars
- intro: 1-2 sentences
- advice_points: 3-5 items
- next_action: 10-150 chars
- resource_cta: optional, 5-100 chars

## 🔄 Processing Flow Example

```
User transaction triggers "visit_completed" event
  ↓
POST /coach/events/ingest
  → Create CoachMessageRequest (status: received)
  → Queue async job
  ↓
Agenda job: coach.process-pending-messages (every 5 min)
  ↓
coachService.planMessage()
  → Check deduplication (3-level)
  → If blocked: status = dedupe_blocked → STOP
  → If allowed: status = generation_pending → NEXT
  ↓
coachService.generateMessage()
  → Build prompt (system + intent + context)
  → Call DeepSeek API with retry
  → Create CoachMessageRecord (status: generated)
  ↓
coachService.validateMessage()
  → Check JSON constraints
  → Check quality flags (invention risk, tone, etc.)
  → If invalid: status = validation_failed → STOP
  → If valid: status = valid
  ↓
coachService.sendMessage()
  → Record in CoachMessageHistory (for dedup)
  → Update status: sent
  → User receives message via real-time or polling
```

## 🧪 Testing

Run integration tests:
```bash
node scripts/test_coach_integration.js
```

Tests cover:
- ✅ All 4 models exist with correct schema
- ✅ All services resolve triggers correctly
- ✅ Prompt building works for all 17 intents
- ✅ Message validation catches invalid messages
- ✅ All 17 triggers registered in constants

## 📚 Related Documentation

- [COACH_IA_IMPLEMENTATION_PLAN.md](./COACH_IA_IMPLEMENTATION_PLAN.md) - Phase planning
- [COACH_IA_DATA_MODEL.md](./COACH_IA_DATA_MODEL.md) - Schema definitions
- [COACH_IA_BUSINESS_RULES.md](./COACH_IA_BUSINESS_RULES.md) - Dedup logic
- [COACH_IA_API_SPEC.md](./COACH_IA_API_SPEC.md) - REST API contracts
- [COACH_IA_ARCHITECTURE.md](./COACH_IA_ARCHITECTURE.md) - System design
- [COACH_IA_PROMPTS.md](./COACH_IA_PROMPTS.md) - LLM prompts

## 🚨 Troubleshooting

### "DEEPSEEK_API_KEY not configured"
Set `DEEPSEEK_API_KEY` in .env

### "Trigger not found: OC_V01"
Run `node scripts/seed_coach_triggers.js` to initialize trigger registry

### "Message blocked by deduplication"
This is expected behavior. Check `dedupe_result` in database to see block reason.

### LLM timeout errors
Default timeout is 10 seconds. Check DEEPSEEK_API_BASE endpoint and network.

## 📝 Next Steps (Phase 1.5+)

- ✅ Phase 1 Backend (COMPLETE)
- ⏳ Phase 1.5: Frontend UI components
- ⏳ Phase 2: Chat Libre integration
- ⏳ Phase 3: Advanced monitoring & analytics
- ⏳ Phase 4: Multi-language support

---

**Created:** 2026-07-06  
**Status:** Phase 1 Complete ✅
