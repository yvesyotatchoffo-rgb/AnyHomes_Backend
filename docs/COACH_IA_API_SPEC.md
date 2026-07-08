# Coach IA — API Specification

**Date:** 2026-07-06  
**Version:** 1.0  
**Base URL:** `http://localhost:6089/api/v1/coach`

---

## 🔑 Authentication

Tous les endpoints nécessitent:
- **Header:** `Authorization: Bearer {token}` (JWT utilisateur)
- **Validation:** User doit être propriétaire ou lead actif

---

## 📌 Endpoints

### 1. Ingestion d'événement

**POST** `/events/ingest`

Déclenche l'orchestration complète du coach pour un événement transactionnel.

#### Request

```json
{
  "event_id": "uuid-unique-dont-replicate",
  "trigger_ref": "OC_V12",
  "user_id": "userId",
  "property_id": "propertyId",
  "transaction_id": "transactionId",
  "event_at": "2026-07-06T14:30:00Z",
  "payload": {
    "source_status": "offer submitted by user",
    "offer_price": 450000,
    "lead_maturity_score": 85,
    "additional_context": "buyer_trusted_agent: true"
  }
}
```

#### Response (201 Created)

```json
{
  "accepted": true,
  "request_id": "request-uuid",
  "status": "received",
  "message": "Event queued for processing"
}
```

#### Error Responses

```json
// 400 Bad Request
{
  "error": "INVALID_PAYLOAD",
  "message": "trigger_ref OC_X99 not found"
}

// 409 Conflict (idempotent duplicate)
{
  "error": "DUPLICATE_EVENT",
  "message": "Event {event_id} already processed",
  "request_id": "previously-stored-id"
}

// 401 Unauthorized
{
  "error": "AUTH_FAILED",
  "message": "Invalid or missing authorization token"
}
```

#### Notes
- **Idempotence:** `event_id` garantit pas de double traitement
- **Async:** Réponse immédiate, traitement en background
- **Queue:** Event mis en queue, polling le statut via `/messages/status`

---

### 2. Planification du message

**POST** `/messages/plan`

Calcule si un message doit être généré (après dedupe check).

#### Request

```json
{
  "request_id": "request-uuid"
}
```

#### Response (200 OK)

```json
{
  "request_id": "request-uuid",
  "trigger_ref": "OC_V12",
  "coach_intent": "respond_to_offer_sale",
  "coach_need_family": "offer_management",
  "context_transition_key": "offer_received_sale",
  "dedupe_result": "allowed",
  "next_step": "generate"
}
```

#### Dedupe Results

```json
// BLOCKED - même intent
{
  "dedupe_result": "blocked_same_intent",
  "reason": "respond_to_offer_sale already sent 2 months ago",
  "next_step": "skip"
}

// BLOCKED - famille stricte
{
  "dedupe_result": "blocked_strict_family",
  "family": "visit_preparation",
  "reason": "visit preparation already sent 4 months ago",
  "next_step": "skip"
}

// BLOCKED - famille multi, même transition
{
  "dedupe_result": "blocked_same_family_same_context",
  "family": "post_visit",
  "context": "visit_feedback_received_sale",
  "reason": "Same context already processed",
  "next_step": "skip"
}

// ALLOWED
{
  "dedupe_result": "allowed",
  "reason": "Different context within multi-intent family",
  "next_step": "generate"
}
```

---

### 3. Génération du message

**POST** `/messages/generate`

Appelle le LLM pour générer le message structuré.

#### Request

```json
{
  "request_id": "request-uuid",
  "coach_intent": "respond_to_offer_sale",
  "context": {
    "user": {
      "id": "userId",
      "first_name": "Jean",
      "locale": "fr-FR"
    },
    "property": {
      "id": "propertyId",
      "surface": 120,
      "rooms": 4,
      "condition": "bon état",
      "asking_price": 500000,
      "property_type": "sale"
    },
    "transaction": {
      "id": "transactionId",
      "status": "offer_received",
      "type": "VENTE"
    },
    "lead": {
      "maturity_score": 85,
      "trust_score": 78,
      "offer_price": 450000,
      "offer_type": "below_asking"
    }
  }
}
```

#### Response (200 OK)

```json
{
  "request_id": "request-uuid",
  "status": "generated",
  "output_json": {
    "title": "Une offre en dessous du prix demandé – comment réagir ?",
    "intro": "Vous avez reçu une offre à 450 000€ pour un bien affiché à 500 000€. C'est une situation très courante. Voici une méthode simple pour décider.",
    "advice_points": [
      "Prenez du recul 24h avant de répondre. Les décisions à chaud sont rarement les meilleures.",
      "Évaluez le rapport: baisse de 10% est-elle acceptable? Quelle est votre marge minimale?",
      "Demandez à votre agent la fiabilité de ce candidat. Déjà une autre offre ailleurs?",
      "Si vous contre-proposez, restez raisonnable (+30 à 50k€). Les surenchères tuent les négociations."
    ],
    "next_action": "Discutez avec l'agent pour évaluer la fiabilité du candidat et votre marge acceptable avant de répondre.",
    "resource_cta": null
  },
  "metadata": {
    "llm_latency_ms": 1240,
    "token_input": 340,
    "token_output": 187,
    "estimated_cost_usd": 0.0084,
    "model_version": "deepseek-v4-flash"
  }
}
```

#### Error Responses

```json
// 500 LLM Failure
{
  "error": "LLM_GENERATION_FAILED",
  "message": "DeepSeek API timeout after 30 seconds",
  "retry_count": 1,
  "next_step": "retry or fallback"
}

// 500 LLM Rate Limit
{
  "error": "LLM_RATE_LIMIT",
  "message": "Rate limit exceeded, backing off",
  "retry_after_seconds": 60
}
```

---

### 4. Validation du message

**POST** `/messages/validate`

Valide le JSON généré et lance repair loop si nécessaire.

#### Request

```json
{
  "request_id": "request-uuid",
  "output_json": { /* message JSON */ }
}
```

#### Response (200 OK)

```json
{
  "request_id": "request-uuid",
  "valid": true,
  "validation_result": "valid",
  "quality_flags": [],
  "next_step": "send"
}
```

#### Response (Repair Needed)

```json
{
  "request_id": "request-uuid",
  "valid": false,
  "validation_result": "invalid_json",
  "error": "missing_fields: ['title']",
  "quality_flags": ["missing_mandatory_fields"],
  "repair_attempt": "pending",
  "next_step": "repair_loop"
}
```

#### Validation Rules

```
Mandatory fields: title, intro, advice_points, next_action
Optional: resource_cta

Constraints:
- title: 10-100 chars
- intro: 50-300 chars
- advice_points: 3-5 items, each 20-200 chars
- next_action: 20-150 chars
- resource_cta: null or 1-500 chars (URL format)

Tone checks:
- No "you should" → use imperative or declarative
- No excessive punctuation marks (!!!???)
- No invented amounts/dates/names not in context

Length violations:
- Total JSON string > 2000 chars → invalid
```

---

### 5. Envoi du message

**POST** `/messages/send`

Persiste le message généré et le notifie à l'UI.

#### Request

```json
{
  "request_id": "request-uuid"
}
```

#### Response (200 OK)

```json
{
  "sent": true,
  "message_id": "message-record-id",
  "status": "sent",
  "sent_at": "2026-07-06T14:35:21Z",
  "notification_method": "realtime",
  "user_notification_sent": true
}
```

#### Response (Already Sent)

```json
{
  "sent": false,
  "error": "ALREADY_SENT",
  "message_id": "original-id",
  "sent_at": "2026-07-06T14:30:00Z"
}
```

---

### 6. Consultation de l'historique

**GET** `/messages/history`

Récupère l'historique des messages coach pour un utilisateur.

#### Query Parameters

```
?user_id={userId}
&property_id={propertyId} [optional]
&limit=50 [default: 50, max: 100]
&offset=0 [default: 0]
```

#### Response (200 OK)

```json
{
  "total": 23,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id": "message-record-id",
      "trigger_ref": "OC_V12",
      "coach_intent": "respond_to_offer_sale",
      "coach_need_family": "offer_management",
      "sent_at": "2026-07-06T14:35:21Z",
      "status": "sent",
      "output_json": {
        "title": "...",
        "intro": "...",
        "advice_points": [...],
        "next_action": "...",
        "resource_cta": null
      },
      "property_id": "propertyId",
      "transaction_id": "transactionId"
    },
    { /* previous messages... */ }
  ]
}
```

#### Error Responses

```json
// 400 Bad Request
{
  "error": "INVALID_QUERY",
  "message": "user_id is required"
}

// 401 Unauthorized
{
  "error": "FORBIDDEN",
  "message": "Cannot access history for another user"
}
```

---

### 7. Statut d'une requête

**GET** `/messages/status/:requestId`

Polle le statut d'un message en traitement.

#### Response (200 OK)

```json
{
  "request_id": "request-uuid",
  "status": "generated",
  "trigger_ref": "OC_V12",
  "coach_intent": "respond_to_offer_sale",
  "dedupe_result": "allowed",
  "validation_result": null,
  "message_record_id": null,
  "errors": [],
  "progress": "65%"
}
```

#### Status Values

```
received           → Reçu, en attente
dedupe_blocked     → Bloqué par déduplication
generation_pending → En attente LLM
generated          → LLM terminé, validant
validation_failed  → Validation échouée
repair_pending     → Repair loop en cours
sent               → Envoyé avec succès
failed             → Échoué définitif
```

---

## 🔄 Orchestration Flow (Frontend)

### Flow simple (polling)

```
1. Frontend: POST /coach/events/ingest
   ← { request_id, status: "received" }

2. Frontend: Loop GET /coach/messages/status/{requestId}
   
   Iteration 1: status: "received"
   Iteration 2: status: "generation_pending"
   Iteration 3: status: "generated"
   Iteration 4: status: "sent"
   
   ← { request_id, status: "sent", message_record_id }

3. Frontend: GET /coach/messages/history?property_id={...}
   ← { items: [{ output_json: {...} }] }

4. Frontend: Render message + show CoachWindow
```

### Timing

```
Event ingest → CoachWindow auto-open: 0-30 secondes
Polling interval: 1 second (avec backoff après 10s)
Timeout total: 60 secondes (puis show error)
```

---

## 📊 Error Codes

| Code | HTTP | Meaning | Action |
|---|---|---|---|
| INVALID_PAYLOAD | 400 | Données invalides | Fix & retry |
| DUPLICATE_EVENT | 409 | Event_id exists | Idempotent OK |
| TRIGGER_NOT_FOUND | 400 | Trigger inconnu | Valider trigger_ref |
| COACH_DISABLED | 400 | Coach désactivé | Check registry |
| DEDUPLICATED | 200 | Message bloqué | No action user |
| LLM_TIMEOUT | 500 | LLM timeout | Retry auto |
| LLM_RATE_LIMIT | 429 | Rate limit API | Backoff |
| VALIDATION_FAILED | 500 | JSON invalid | Repair auto |
| REPAIR_FAILED | 500 | Repair échoué | Skip |
| DB_ERROR | 500 | Database error | Retry |
| AUTH_FAILED | 401 | Auth issue | Re-login |
| FORBIDDEN | 403 | Pas d'accès | Check perms |

---

## 🔒 Rate Limiting

**Per user:**
- 100 requests/hour to ingest endpoint
- 1000 requests/hour to history endpoint

**Per server:**
- 10,000 requests/hour total

**Backoff headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1720268400 (unix timestamp)
```

---

## 🔄 Retry Logic

### Automatic retries

| Error | Retries | Backoff | Notes |
|---|---|---|---|
| LLM Timeout | 1 | immediate | Single attempt |
| LLM Rate Limit | 3 | exponential | Max 60s wait |
| DB Write Fail | 3 | exponential | Max 30s wait |
| Network Error | 2 | linear | 5s then 10s |

### Manual retries

User can manually retry via:
```
POST /messages/{messageId}/retry
```

Returns:
```json
{
  "retried": true,
  "new_request_id": "new-uuid",
  "status": "received"
}
```

---

## 📝 Logging

Chaque appel API log:
```javascript
{
  timestamp: "2026-07-06T14:35:21Z",
  method: "POST",
  endpoint: "/events/ingest",
  status_code: 201,
  request_id: "req-uuid",
  event_id: "evt-uuid",
  trigger_ref: "OC_V12",
  coach_intent: "respond_to_offer_sale",
  user_id: "usr-uuid",
  duration_ms: 145,
  dedupe_result: "allowed",
  llm_latency_ms: 1240,
  token_input: 340,
  token_output: 187,
  cost_usd: 0.0084,
  validation_result: "valid",
  send_status: "sent",
  error: null
}
```

---

## 🧪 Postman Collection

[Export disponible en `/docs/coach_ia.postman_collection.json`]

Contains:
- 7 endpoints
- Pre-request scripts (idempotence, auth)
- Tests (response validation)
- Variables (base_url, user_id, etc.)

---

**Dernière mise à jour:** 2026-07-06  
**Version:** 1.0
