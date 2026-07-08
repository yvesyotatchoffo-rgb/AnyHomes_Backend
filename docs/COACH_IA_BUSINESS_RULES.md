# Coach IA — Règles Métier & Business Logic

**Date:** 2026-07-06  
**Version:** 1.0  
**Scope:** Triggers, Déduplication, Intent Mapping

---

## 📌 Principes fondamentaux

1. **Un message par transition métier** : Ne pas spammer l'utilisateur
2. **Contexte change = message possible** : Même famille, mais transition différente
3. **12 mois = oubli** : Après un an, le coaching peut se répéter
4. **Zéro hallucination** : Valider strictement avant envoi
5. **Pragmatique > Pédagogue** : Conseils actionnables, pas théoriques

---

## 🎯 Mapping Complet Triggers → Intents

### VENTE — 10 intents

#### 1. `welcome_first_lead_sale`
**Triggers:** OC_V01, OC_V02, OC_V03  
**Condition:** Premier lead vendeur reçu  
**Famille:** `onboarding` (strict, pas de répétition)  
**Contexte transition:** `first_lead_received_sale`  
**Multiintent:** ❌  
**Dédup window:** 12 mois  

**Métier :**
- Accueillir propriétaire dans expérience Coach IA
- Rassurer sur processus
- Donner réflexes prioritaires (réactivité, courtoisie)

**Ton:** Enjoué, rassurant  
**Longueur:** Court (< 200 mots)

---

#### 2. `prepare_visit_sale`
**Triggers:** OC_V04, OC_V07  
**Condition:** Visite de vente planifiée/confirmée  
**Famille:** `visit_preparation` (strict)  
**Contexte transition:** `visit_booked_sale`  
**Multiintent:** ❌  

**Métier:**
- Aider propriétaire à préparer bien physiquement
- Déroulé de visite (ce qui va se passer)
- Points forts à mettre en avant
- Posture lors de visite

**Données à joindre:**
- Date visite
- Caractéristiques bien (standing, surface, etc.)
- Prix affichage
- Historique lead (nb visites précédentes, feedback)

**Ton:** Professionnel (coach immobilier)  
**Longueur:** Moyen (150-300 mots)

---

#### 3. `post_visit_next_steps_sale`
**Triggers:** OC_V08  
**Condition:** Visite vient d'être réalisée  
**Famille:** `post_visit` (multi-intents autorisés)  
**Contexte transition:** `visit_completed_waiting_feedback_or_offer_sale`  
**Multiintent:** ✅  

**Métier:**
- Guider immédiatement post-visite
- Actions prioritaires dans les 24-48h
- Cas positif vs neutre vs négatif
- Suivi simple (relance, etc.)

**Ton:** Rassurant et positif  
**Longueur:** Court

---

#### 4. `analyze_visit_feedback_sale`
**Triggers:** OC_V09  
**Condition:** Évaluation post-visite reçue de lead  
**Famille:** `post_visit` (multi-intents)  
**Contexte transition:** `visit_feedback_received_sale`  
**Multiintent:** ✅  

**Métier:**
- Aider propriétaire à interpréter retour acquéreur
- Distinguer feedback positif / neutre / négatif
- Rebondir pour déclencher offre ou améliorer visites suivantes

**Données à joindre:**
- Détail évaluation (texto exact si possible)
- Caractéristiques bien

**Ton:** Professionnel, empathique  
**Longueur:** Moyen

---

#### 5. `prepare_seller_file`
**Triggers:** OC_V10  
**Condition:** Acquéreur demande dossier vendeur  
**Famille:** `offer_management`  
**Contexte transition:** `seller_file_requested`  
**Multiintent:** ✅  

**Métier:**
- Lister documents à préparer (conforme bien)
- Structures et où trouver
- Éviter conseil juridique (rester informatif)

**Données à joindre:**
- Toutes caractéristiques bien
- Année construction
- Travaux rénovation
- Diagnostics disponibles

**Ton:** Professionnel  
**Longueur:** Moyen (structured list)

---

#### 6. `respond_to_offer_sale`
**Triggers:** OC_V12  
**Condition:** Offre d'achat reçue  
**Famille:** `offer_management`  
**Contexte transition:** `offer_received_sale`  
**Multiintent:** ✅  

**Métier:**
- Méthode simple décider réaction
- Cas: offre au prix vs offre sous prix
- Si au prix → rapidité essentiel
- Si sous prix → aide à arbitrer (accepter / contre-proposer)

**Données à joindre:**
- Prix demandé vs prix annoncé
- Indicateurs fiabilité acquéreur si dispo

**Ton:** Pragmatique  
**Longueur:** Court

---

#### 7. `handle_refused_counter_offer_sale`
**Triggers:** OC_V15  
**Condition:** Contre-proposition propriétaire refusée  
**Famille:** `offer_management`  
**Contexte transition:** `counter_offer_refused_sale`  
**Multiintent:** ✅  

**Métier:**
- Aider décider comment poursuivre sans réagir à chaud
- Options: relancer, ajuster, arrêter
- Garder relationnel

**Ton:** Rassurant, professionnel  
**Longueur:** Court

---

#### 8. `prepare_pre_contract_sale`
**Triggers:** OC_V16, OC_V17  
**Condition:** Offre acceptée → avant-contrat pending  
**Famille:** `transaction_signing`  
**Contexte transition:** `offer_accepted_pre_contract_pending_sale`  
**Multiintent:** ✅  

**Métier:**
- Expliquer étapes avant-contrat
- Rôle notaire / étapes administratives
- Délais typiques
- Documents nécessaires

**Ton:** Professionnel, rassurant  
**Longueur:** Moyen

---

#### 9. `prepare_final_signing_sale`
**Triggers:** OC_V29  
**Condition:** Avant-contrat signé → acte final pending  
**Famille:** `transaction_signing`  
**Contexte transition:** `pre_contract_signed_final_signing_pending_sale`  
**Multiintent:** ✅  

**Métier:**
- Déroulé du jour de signature
- Qui sera présent
- Documents à apporter
- Frais supplémentaires éventuels
- Déménagement/occupation

**Ton:** Professionnel, rassurant  
**Longueur:** Moyen

---

#### 10. `celebrate_sale_closed`
**Triggers:** OC_V32, OC_V33  
**Condition:** Acte final signé, transaction complétée  
**Famille:** `transaction_closure`  
**Contexte transition:** `final_sale_signed_transfer_pending`  
**Multiintent:** ✅  

**Métier:**
- Féliciter propriétaire pour réussite
- Inviter à laisser avis (reviews)
- Opportunité: vendre autre bien?
- Proposition Learning Center (future rehab, placement, etc.)

**Ton:** Enthousiaste, célébrant  
**Longueur:** Court

---

### LOCATION — 7 intents

#### 11. `welcome_first_lead_rental`
**Triggers:** OC_L01  
**Condition:** Premier candidat location reçu  
**Famille:** `onboarding` (strict)  
**Contexte transition:** `first_lead_received_rental`  
**Multiintent:** ❌  

**Métier:** (identique VENTE, adapté location)

---

#### 12. `prepare_visit_rental`
**Triggers:** OC_L03  
**Condition:** Visite location planifiée  
**Famille:** `visit_preparation` (strict)  
**Contexte transition:** `visit_booked_rental`  
**Multiintent:** ❌  

**Métier:** (identique VENTE prep visit)

---

#### 13. `prepare_rental_application_review`
**Triggers:** OC_L12  
**Condition:** Visite complétée, candidat doit envoyer dossier  
**Famille:** `rental_candidate_review`  
**Contexte transition:** `visit_completed_waiting_application`  
**Multiintent:** ✅  

**Métier:**
- Préparer propriétaire pour phase dossier
- Types documents candidat doit envoyer
- Timeline attente
- Critères évaluation (revenus, jobs, etc.)

**Ton:** Professionnel  
**Longueur:** Moyen

---

#### 14. `analyze_rental_application`
**Triggers:** OC_L14  
**Condition:** Dossier candidat location reçu  
**Famille:** `rental_candidate_review`  
**Contexte transition:** `application_received_review_pending`  
**Multiintent:** ✅  

**Métier:**
- Aider évaluer candidat (revenus, stabilité, etc.)
- Points forts/faibles
- Risque impayés
- Décision: accepter, refuser, négocier

**Données à joindre:**
- Détails dossier (si disponibles sans PII excessive)
- Caractéristiques bien (loyer, surface)

**Ton:** Professionnel  
**Longueur:** Moyen

---

#### 15. `prepare_lease_signing`
**Triggers:** OC_L15  
**Condition:** Candidat accepté → signature bail  
**Famille:** `transaction_signing`  
**Contexte transition:** `application_accepted_lease_signing_pending`  
**Multiintent:** ✅  

**Métier:**
- Déroulé signature bail
- Documents à préparer
- Dépôt de garantie
- État des lieux initial
- Assurance

**Ton:** Professionnel, rassurant  
**Longueur:** Moyen

---

#### 16. `celebrate_lease_signed`
**Triggers:** OC_L23  
**Condition:** Bail signé  
**Famille:** `transaction_closure`  
**Contexte transition:** `lease_signed_inventory_pending`  
**Multiintent:** ✅  

**Métier:**
- Féliciter pour signature
- Prochaines étapes (état lieux, remise clés, etc.)
- Inviter avis
- Conseils location (relations avec locataire, etc.)

**Ton:** Enthousiaste  
**Longueur:** Court

---

#### 17. `celebrate_rental_closed`
**Triggers:** OC_L33  
**Condition:** Location finalisée (locataire assigné, transaction complète)  
**Famille:** `transaction_closure`  
**Contexte transition:** `renter_assigned_transaction_closed`  
**Multiintent:** ✅  

**Métier:** (identique celebrate sale)

---

## 🔐 Règles de déduplication détaillées

### Algorithme de décision

```
Input: user_id, coach_intent, coach_need_family, context_transition_key

1. Query CoachMessageHistory pour last 12 months:
   WHERE user_id = ? AND sent_at >= NOW() - 12 months

2. Loop sur résultats:
   
   a) EXACT INTENT MATCH?
      IF coach_intent = result.coach_intent THEN
        RETURN BLOCKED("same_intent")
      
   b) FAMILLE STRICTE?
      IF coach_need_family IN ["onboarding", "visit_preparation"] THEN
        IF coach_need_family = result.coach_need_family THEN
          RETURN BLOCKED("strict_family")
   
   c) FAMILLE MULTI-INTENTS?
      IF coach_need_family IN ["post_visit", "offer_management", "rental_candidate_review", "transaction_signing", "transaction_closure"] THEN
        IF coach_need_family = result.coach_need_family THEN
          IF context_transition_key = result.context_transition_key THEN
            RETURN BLOCKED("same_family_same_context")
          ELSE
            CONTINUE (autoriser, contexte différent)
        ELSE
          CONTINUE (famille différente)
      
      ELSE (famille non reconnue)
        RETURN ERROR("unknown_family")

3. RETURN ALLOWED()
```

### Exemples d'exécution

**Cas 1: Même intent dans 12 mois → BLOQUÉ**
```
Situation: User reçoit OC_V12 (offer received)
Histoire: 5 mois avant, même user a reçu OC_V12 pour autre property

Query: user_id = 123, coach_intent = "respond_to_offer_sale", coach_need_family = "offer_management"
Résultat historique: coach_intent = "respond_to_offer_sale" FOUND

→ RETURN BLOCKED("same_intent")
```

**Cas 2: Famille stricte répétée → BLOQUÉ**
```
Situation: User reçoit OC_V04 (prepare visit)
Histoire: 6 mois avant, même user a reçu OC_V07 (aussi prepare_visit_sale)

Query: coach_need_family = "visit_preparation"
Résultat: coach_need_family = "visit_preparation" FOUND

→ RETURN BLOCKED("strict_family")
  (Même si intent différent, famille stricte = pas de répétition)
```

**Cas 3: Famille multi-intents, transition nouvelle → AUTORISÉ**
```
Situation: User reçoit OC_V12 (offer received, first time)
Famille: "offer_management" (multi-intents)
context_transition_key: "offer_received_sale"

Histoire: 2 mois avant, même user a reçu OC_V08 (post_visit)
context_transition_key: "visit_completed_waiting_feedback_or_offer_sale"

Query: coach_need_family = "offer_management", context_transition_key = "offer_received_sale"
Résultat: coach_need_family = "post_visit" (DIFFÉRENT!)

→ CONTINUE (pas de match sur famille, autres results non-relevant)
→ RETURN ALLOWED()
  (Transition nouvelle, autorisé même si famille post_visit existait)
```

**Cas 4: Famille multi-intents, transition identique → BLOQUÉ**
```
Situation: User reçoit OC_V09 (analyze_visit_feedback)
Famille: "post_visit"
context_transition_key: "visit_feedback_received_sale"

Histoire: 2 mois avant, même user a reçu OC_V08 (post_visit_next_steps)
context_transition_key: "visit_completed_waiting_feedback_or_offer_sale"

- Query first iteration: coach_need_family = "post_visit", context = "visit_completed..." FOUND
  context_transition_key DIFFÉRENT ("visit_feedback_received" vs "visit_completed_waiting") → CONTINUE

- Pas d'autres résultats dans histoire

→ RETURN ALLOWED()
  (Contexte différent dans même famille = autorisé)
```

**Cas 5: Exact fit dans histoire 12 mois → BLOQUÉ**
```
Situation: User reçoit OC_V12 (respond_to_offer)
Famille: "offer_management"
context_transition_key: "offer_received_sale"

Histoire: 3 mois avant, même user a reçu OC_V12 pour AUTRE property
context_transition_key: "offer_received_sale" (IDENTIQUE!)

→ RETURN BLOCKED("same_intent")
  (Même intent = première règle appliquée, peu importe bien différent)
```

---

## 📊 Fenêtre temporelle 12 mois

```
TODAY = 2026-07-06

ALLOWED:
- Message envoyé: 2025-07-06 (exactly 1 year) → BORDERLINE ALLOWED
- Message envoyé: 2025-07-05 (1 year + 1 day) → ALLOWED
- Message envoyé: 2026-01-06 (6 months) → ALLOWED
- Message envoyé: 2026-06-06 (1 month) → ALLOWED
- Message envoyé: 2026-07-05 (1 day) → ALLOWED

BLOCKED:
- Message envoyé: 2025-07-07 (< 12 months ago) → BLOCKED
- Message envoyé: 2026-01-05 (6 months, 1 day ago) → BLOCKED
- Message envoyé: 2026-07-06 (today) → BLOCKED

Query clause: sent_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
```

---

## 🎯 Matrice décision complète

| Situation | Famille | Prior msg (12m) | Context diff? | Décision |
|-----------|---------|---|---|---|
| First msg ever | any | none | - | ✅ ALLOW |
| Repeat intent | any | YES (exact) | - | ❌ BLOCK (rule 1) |
| Repeat family strict | strict | YES | - | ❌ BLOCK (rule 2) |
| Repeat family multi | multi | YES | YES | ✅ ALLOW (rule 3) |
| Repeat family multi | multi | YES | NO | ❌ BLOCK (same context) |
| Diff family strict | strict | YES (other) | - | ✅ ALLOW (different family) |
| Outside 12m | any | NO (>12m ago) | - | ✅ ALLOW (window expired) |

---

## 🛡️ Edge cases & exceptions

### Edge case 1: Plusieurs transitions dans même famille
```
OC_V08 (visit_completed) → context: "visit_completed_waiting_feedback"
OC_V09 (visit_feedback) → context: "visit_feedback_received"

→ Même famille "post_visit", contextes différents
→ AUTORISÉ car contexts différents
```

### Edge case 2: Annulation & re-booking
```
User cancelle visite, puis re-booke

History: OC_V04 sent 5 months ago, context: "visit_booked"
New: OC_V04 today, context: "visit_booked" (same?)

→ Si context_transition_key est vraiment IDENTIQUE → BLOQUÉ
→ Solution: Contextualiser avec visit_id unique → "visit_booked_v2_property_ABC"
```

### Edge case 3: Multi-properties
```
User proprietaire de 2 propriétés A et B

History: OC_V12 sent 2 months ago pour property_A
New: OC_V12 today pour property_B (DIFFERENT PROPERTY!)

Current rule: Bloquer si intent identique REGARDLESS of property

→ Question: DEVRAIT-ON dédupliquer par property ou global user?

**DÉCISION V1**: Dedupe global user (une personne = un coach, toutes propriétés)
**FUTURE**: Per-property dedupe si métier demande (ex: multiple landlords)
```

---

## 📝 Résumé décision dédup

```javascript
// Pseudo-code
async function isMessageAllowed(userId, coachIntent, needFamily, transitionKey) {
  
  const history = await coachMessageHistory.find({
    user_id: userId,
    sent_at: { $gte: Date.now() - 12_months }
  });
  
  // Rule 1: Same intent exact match
  if (history.some(h => h.coach_intent === coachIntent)) {
    return { allowed: false, reason: 'same_intent' };
  }
  
  // Rule 2 & 3: Family logic
  const strictFamilies = ['onboarding', 'visit_preparation'];
  const multiFamilies = ['post_visit', 'offer_management', 'rental_candidate_review', 'transaction_signing', 'transaction_closure'];
  
  if (strictFamilies.includes(needFamily)) {
    if (history.some(h => h.coach_need_family === needFamily)) {
      return { allowed: false, reason: 'strict_family_repeated' };
    }
  }
  
  if (multiFamilies.includes(needFamily)) {
    if (history.some(h => 
      h.coach_need_family === needFamily && 
      h.context_transition_key === transitionKey
    )) {
      return { allowed: false, reason: 'multi_family_same_context' };
    }
  }
  
  return { allowed: true, reason: 'ok' };
}
```

---

**Dernière mise à jour:** 2026-07-06  
**Version:** 1.0
