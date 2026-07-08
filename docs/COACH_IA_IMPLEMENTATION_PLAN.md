# Coach IA Transactionnel — Plan d'Implémentation V1

**Date:** 2026-07-06  
**Version:** 1.0  
**Statut:** En préparation — Phase 1 Backend

---

## 📋 Synthèse Exécutive

Le Coach IA transactionnel est un système d'assistance automatisée qui génère des messages contextualisés et personnalisés pour propriétaires et leads à chaque étape critique de la transaction immobilière.

### Périmètre V1
- ✅ **Messages automatiques uniquement** (auto-triggered by events)
- ✅ **17 intents** : 10 pour VENTE + 7 pour LOCATION
- ✅ **Déduplication** : 12 mois, 3 niveaux (intent, famille, transition métier)
- ✅ **LLM** : DeepSeek V4 Flash (low-cost, pragmatique)
- ✅ **Chat libre** : Stub (future Phase 2)

### Hors périmètre V1
- ❌ Questions/réponses bidirectionnelles
- ❌ WebSocket real-time (polling initially)
- ❌ Learning Center deep linking
- ❌ Message ratings/reactions

---

## 🎯 Objectifs métier

1. **Réduire l'attrition** : Guider propriétaires/leads aux moments critiques
2. **Augmenter les conversions** : Conseils pragmatiques et actionnables
3. **Décharger support** : Automatiser les réponses répétitives
4. **Coût minimal** : ~0.05-0.10€ par message avec DeepSeek
5. **Zéro hallucination** : Validation stricte, aucune invention

---

## 🏗️ Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSACTIONAL EVENTS                         │
│  funnelStatus change (OC_V12, OC_L03, etc.)                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────┐
         │  Event Ingestor          │
         │  + Normalizer            │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │  Trigger Router          │
         │  trigger_ref → intent    │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │  Dedupe Engine           │
         │  12 months history       │
         └─┬──────────────────────┬─┘
           │ BLOCKED              │ ALLOWED
           │                      │
           ▼                      ▼
        [SKIP]          ┌────────────────────┐
                        │  Prompt Builder    │
                        │  minimal context   │
                        └────────┬───────────┘
                                 │
                        ┌────────▼──────────┐
                        │  LLM Adapter      │
                        │  DeepSeek V4 Flash│
                        └────────┬──────────┘
                                 │
                        ┌────────▼──────────┐
                        │  Validator        │
                        │  JSON strict      │
                        └─┬────────────────┬┘
                          │ INVALID      │ VALID
                          │              │
                          ▼              ▼
                     [REPAIR/FAIL]  ┌──────────────┐
                                    │ Message Store│
                                    │ + History    │
                                    └──────┬───────┘
                                           │
                                    ┌──────▼───────┐
                                    │UI Dispatch   │
                                    │(WS/Polling)  │
                                    └──────────────┘
```

---

## 📊 Mapping Triggers → Intents

### VENTE (10 intents)

| Intent | Triggers | Famille | Multi-intent | Contexte |
|--------|----------|---------|--------------|----------|
| `welcome_first_lead_sale` | OC_V01, V02, V03 | `onboarding` | ❌ | First lead |
| `prepare_visit_sale` | OC_V04, V07 | `visit_preparation` | ❌ | Visit booked |
| `post_visit_next_steps_sale` | OC_V08 | `post_visit` | ✅ | Visit completed |
| `analyze_visit_feedback_sale` | OC_V09 | `post_visit` | ✅ | Feedback received |
| `prepare_seller_file` | OC_V10 | `offer_management` | ✅ | Seller file requested |
| `respond_to_offer_sale` | OC_V12 | `offer_management` | ✅ | Offer received |
| `handle_refused_counter_offer_sale` | OC_V15 | `offer_management` | ✅ | Counter refused |
| `prepare_pre_contract_sale` | OC_V16, V17 | `transaction_signing` | ✅ | Offer accepted |
| `prepare_final_signing_sale` | OC_V29 | `transaction_signing` | ✅ | Pre-contract signed |
| `celebrate_sale_closed` | OC_V32, V33 | `transaction_closure` | ✅ | Sale finalized |

### LOCATION (7 intents)

| Intent | Triggers | Famille | Multi-intent | Contexte |
|--------|----------|---------|--------------|----------|
| `welcome_first_lead_rental` | OC_L01 | `onboarding` | ❌ | First lead |
| `prepare_visit_rental` | OC_L03 | `visit_preparation` | ❌ | Visit booked |
| `prepare_rental_application_review` | OC_L12 | `rental_candidate_review` | ✅ | Application received |
| `analyze_rental_application` | OC_L14 | `rental_candidate_review` | ✅ | Application review |
| `prepare_lease_signing` | OC_L15 | `transaction_signing` | ✅ | Lease signing pending |
| `celebrate_lease_signed` | OC_L23 | `transaction_closure` | ✅ | Lease signed |
| `celebrate_rental_closed` | OC_L33 | `transaction_closure` | ✅ | Rental finalized |

---

## 🔐 Règles de déduplication

### Niveau 1: Intent identique
```
Si coach_intent envoyé au même user dans les 12 derniers mois → BLOQUER
```

### Niveau 2: Famille stricte
Familles concernées:
- `onboarding`
- `visit_preparation`

```
Si coach_need_family envoyée au même user dans les 12 derniers mois → BLOQUER
(même si intent différent)
```

### Niveau 3: Famille multi-intents
Familles concernées:
- `post_visit`
- `offer_management`
- `rental_candidate_review`
- `transaction_signing`
- `transaction_closure`

```
Si context_transition_key identique au user dans les 12 derniers mois → BLOQUER
Sinon → AUTORISER (plusieurs intents possibles si contexte change)
```

### Fenêtre temporelle
- **Toutes les familles**: 12 mois glissants depuis `sent_at`

---

## 📤 Format de sortie JSON

Tous les messages du Coach IA respectent ce schéma stricte:

```json
{
  "title": "string",
  "intro": "string (1-2 phrases max)",
  "advice_points": [
    "string (conseil 1)",
    "string (conseil 2)",
    "string (conseil 3)",
    "string (conseil 4 optionnel)",
    "string (conseil 5 optionnel)"
  ],
  "next_action": "string (une seule action prioritaire)",
  "resource_cta": "string | null"
}
```

### Contraintes
- `title`: court, actionnable, pas de ponctuation marketing
- `intro`: 1-2 phrases maximum, contexte clair
- `advice_points`: 3-5 points concrets et non redondants
- `next_action`: une seule action immédiate et réaliste
- `resource_cta`: lien optionnel vers Learning Center si pertinent

---

## 🛠️ Stack technique

### Backend
- **Runtime**: Node.js v18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Job Queue**: Agenda (cron-like jobs)
- **Queue Processing**: BullMQ (async tasks)
- **LLM**: DeepSeek V4 Flash (via API)
- **Logging**: Winston + structured JSON
- **Testing**: Jest + Supertest

### Frontend (Phase 1.5)
- **Framework**: React 18+
- **State**: Redux Toolkit
- **HTTP**: Axios
- **Real-time**: Polling (WebSocket future)
- **UI**: Headless UI + Tailwind

### Infrastructure
- **Dev Server**: Port 6089 (backend)
- **Database**: MongoDB local/cloud
- **API Documentation**: Postman + OpenAPI/Swagger

---

## 📋 Phases d'implémentation

### ✅ Phase 1 — Socle technique (4 sprints)

**Sprint 1.1 — Data Model & Foundation**
- [ ] Créer 4 modèles Mongoose
- [ ] Charger trigger registry (17 intents)
- [ ] Ajouter indexes performance
- [ ] Tests unitaires modèles

**Sprint 1.2 — Core Services**
- [ ] Trigger Resolver service
- [ ] Deduplication Engine
- [ ] Prompt Builder
- [ ] JSON Validator
- [ ] Tests unitaires services

**Sprint 1.3 — LLM Integration**
- [ ] LLM Adapter (DeepSeek)
- [ ] Mock adapter pour tests
- [ ] Error handling + retries
- [ ] Token counting + cost tracking

**Sprint 1.4 — API & Orchestration**
- [ ] `POST /coach/events/ingest`
- [ ] `POST /coach/messages/plan`
- [ ] `POST /coach/messages/generate`
- [ ] `POST /coach/messages/validate`
- [ ] `POST /coach/messages/send`
- [ ] `GET /coach/messages/history`
- [ ] Logging structuré
- [ ] Tests d'intégration

### 📋 Phase 1.5 — Frontend UI (3 sprints)

**Sprint 1.5.1 — Components**
- [ ] CoachWindow component
- [ ] CoachHeader component
- [ ] CoachMessageList component
- [ ] Redux slice + actions

**Sprint 1.5.2 — Integration Transactionnel**
- [ ] Icon + hook dans LeadCard.jsx
- [ ] Icon + hook dans LanderCard.jsx
- [ ] useCoachIntegration hook
- [ ] Auto-open logic

**Sprint 1.5.3 — Chat Integration**
- [ ] Coach dans messagerie (/chat)
- [ ] Historique par bien
- [ ] CoachInput stub (disabled)

### 🚀 Phase 2 — Orchestration & Monitoring

**Sprint 2.1 — Job Queue & Async**
- [ ] Découpler étapes en jobs BullMQ
- [ ] Retry policy robuste
- [ ] Repair loop unique
- [ ] Dead letter queue

**Sprint 2.2 — Observability**
- [ ] Métriques Prometheus
- [ ] Dashboard Grafana
- [ ] Alerting (latency, costs, validation fail rate)
- [ ] Traces distribuées (OpenTelemetry optionnel)

**Sprint 2.3 — Chat Libre (future)**
- [ ] Endpoint `POST /coach/messages/ask`
- [ ] LLM call avec question context
- [ ] Historique par bien

### 🔒 Phase 3 — Qualité & Sécurité

- [ ] Injection de prompt : tests adversariels
- [ ] Input validation renforcée
- [ ] Rate limiting
- [ ] Audit logging complet
- [ ] Tests de charge (load testing)

### 🎯 Phase 4 — Rollout Progressif

- [ ] Staging: activation sur 2-3 triggers
- [ ] Observation des logs + coûts pendant 1 semaine
- [ ] Production: rollout par intent
- [ ] Monitoring continu

---

## 🔄 Flux d'exécution standard

```
1. Event métier arrive (funnelStatus changé)
   ↓
2. POST /coach/events/ingest { trigger_ref, user_id, property_id, transaction_id, payload }
   ↓
3. Créer CoachMessageRequest { status: 'received' }
   ↓
4. Trigger Resolution: OC_V12 → respond_to_offer_sale
   ↓
5. Dedupe Check:
   - Même intent envoyé? → BLOCKER
   - Famille stricte répétée? → BLOCKER
   - Famille multi-intents, transition existante? → BLOCKER
   - Sinon → AUTORISER
   ↓
6. Prompt Building:
   - Charger context: user, property, transaction, lead
   - Minimiser données envoyées au LLM
   - Construire system + intent prompt
   ↓
7. LLM Generation:
   - Appel DeepSeek V4 Flash
   - Timeout: 30s
   - Retry: 1 fois en cas de rate limit
   ↓
8. JSON Validation:
   - Parse JSON
   - Vérifier clés obligatoires
   - Vérifier longueurs
   - Détecter hallucinations évidentes
   ↓
9. En cas d'erreur validation:
   - Repair loop unique (correction IA)
   - Si nouvel échec → SKIP (log comme failed)
   ↓
10. Persistance:
   - Créer CoachMessageRecord { status: 'generated' }
   - Ajouter à CoachMessageHistory
   ↓
11. Envoi UI:
   - WebSocket / Polling notification
   - Frontend affiche message
   - User peut agir (cliquer CTA, etc.)
   ↓
12. Audit:
   - Log tous les événements
   - Métriques: latency, tokens, cost
   - Trace erreurs + fallbacks
```

---

## 📊 Métriques à tracker

### Taux
- Taux de déclenchement par intent
- Taux de blocage par déduplication
- Taux de validation réussie
- Taux de repair (% messages nécessitant correction)
- Taux de send final

### Performance
- Latence médiane (par étape)
- Latence p95 / p99
- Throughput (messages/sec)

### Coûts
- Coût moyen par message (tokens input/output)
- Coût total par jour / semaine / mois

### Qualité
- Taux d'erreur validation
- Taux d'hallucination détectée
- Taux de déduplications (false positive?)

---

## 🔐 Sécurité & Garde-fous

### Validation d'entrée
- Normaliser champs texte
- Retirer caractères dangereux si nécessaire
- Tronquer champs trop longs
- Ignorer données non nécessaires à l'intent

### Prévention prompt injection
- Traiter comme non fiables:
  - Champs saisis par utilisateurs
  - Notes libres
  - Commentaires
- System prompt rappelle au modèle d'ignorer instructions dans les données métier

### Isolation données
- Ne jamais dupliquer données complètes de transactions
- Consulter à la demande via API
- Minimiser payload LLM
- Logs ne doivent pas exposer informations sensibles

---

## 📁 Structure des fichiers

```
Backend/
├── app/
│   ├── models/
│   │   ├── coachTriggerDefinition.model.js
│   │   ├── coachMessageRequest.model.js
│   │   ├── coachMessageRecord.model.js
│   │   └── coachMessageHistory.model.js
│   ├── services/
│   │   ├── coach.service.js (orchestration)
│   │   ├── coachTrigger.service.js
│   │   ├── coachDedupe.service.js
│   │   ├── coachPrompt.service.js
│   │   ├── coachLLM.service.js
│   │   └── coachValidator.service.js
│   ├── controllers/
│   │   └── CoachController.js
│   ├── routes/
│   │   └── coach.routes.js
│   ├── jobs/
│   │   └── coach.jobs.js (ajout à agenda)
│   ├── middleware/
│   │   └── coachAuth.middleware.js (optional)
│   └── utils/
│       └── coachConstants.js (enums, mappings)
├── docs/
│   ├── COACH_IA_IMPLEMENTATION_PLAN.md (ce fichier)
│   ├── COACH_IA_DATA_MODEL.md
│   ├── COACH_IA_BUSINESS_RULES.md
│   ├── COACH_IA_API_SPEC.md
│   ├── COACH_IA_ARCHITECTURE.md
│   └── COACH_IA_PROMPTS.md
└── tests/
    ├── unit/
    │   ├── coach.service.test.js
    │   ├── coachDedupe.service.test.js
    │   └── coachValidator.service.test.js
    └── integration/
        ├── coach.ingest.integration.test.js
        └── coach.end-to-end.integration.test.js
```

---

## ✅ Checklist Pre-Production

### Before Staging
- [ ] Tous les modèles créés et testés
- [ ] Trigger registry chargé avec 17 intents
- [ ] Services unitaires testés à 80%+
- [ ] API endpoints documentés
- [ ] Dedupe logic validée sur cas limites
- [ ] LLM adapter fonctionnel (mock + réel)
- [ ] Validator robuste

### Staging Validation
- [ ] Event valide → message généré ✓
- [ ] Event dupliqué → bloqué ✓
- [ ] JSON invalide → échec propre ✓
- [ ] Logs permettent audit ✓
- [ ] Coût par message mesurable ✓
- [ ] Aucun message sans validation ✓

### Before Production
- [ ] Tests d'intégration e2e passent
- [ ] Performance acceptable (p99 < 5s)
- [ ] Coûts en ligne avec budgets
- [ ] Alerting configuré
- [ ] Runbook de troubleshooting prêt
- [ ] Rollback plan défini

---

## 📞 Points de contact

**Spec métier / Prompts**: Utilisateur (spécifications reçues)  
**Architecture backend**: Coach IA (ce doc + spécifications)  
**Implémentation**: Équipe backend  
**Testing**: QA + Backend  
**Déploiement**: DevOps / Backend lead

---

**Dernière mise à jour:** 2026-07-06  
**Version:** 1.0 (Draft)
