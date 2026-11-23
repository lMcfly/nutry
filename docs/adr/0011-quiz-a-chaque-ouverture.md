# ADR 0011 — Quiz : une nouvelle question à chaque ouverture

- Statut : accepté (validé par l'utilisateur)
- Date : 2026-11-23
- Remplace : la « question du jour » (même question toute la journée)

## Contexte

PROMPT.md §3.7 demande une question « à chaque ouverture de l'app ». La première version
tirait une **question du jour** (`QuizState.daily`, clé = date locale) : rouvrir l'app le
même jour remontrait la même question. L'utilisateur veut une nouvelle question à chaque
ouverture, sans en tirer une nouvelle à chaque rechargement ni à chaque changement d'onglet.

## Décision

### Ouverture = session

- Une **ouverture** est une session de navigateur (onglet ou lancement de l'app installée).
  Elle est identifiée par un identifiant opaque (`createQuizSessionId`, `s-` + 20 caractères
  base 36 tirés du port `RandomSource`), gardé dans la portée `session` du stockage
  d'appareil (`DEVICE_KEYS.quizSessionId` → `sessionStorage`, clé `nutry.quiz.session-id`).
  Une nouvelle ouverture n'en a pas : le premier appel de `getQuiz` en crée un.
- Pendant une session, `getQuiz` rend toujours la même question et, si elle a été répondue,
  son résultat (rechargements de page compris). La carte s'ouvre une fois par session
  (`claimQuizForSession`, inchangé) ; la fin de l'onboarding la saute (`markQuizShown`).
- Sans `sessionStorage` (navigation privée stricte), l'adaptateur se replie en mémoire :
  une nouvelle question par chargement de page, sans erreur.

### Tirage (`domain/quiz/quiz.ts`, `pickNextQuestion`)

- Même `sessionId` que `QuizState.current` → même question, état inchangé.
- Sinon : tirage parmi les questions **non répondues** du cycle, en excluant la question
  précédente (`current`, répondue ou non) tant qu'il reste un autre choix ; cycle épuisé →
  nouveau cycle sans reposer la dernière question répondue. Part de cuisine visée : 20 %
  des questions répondues du cycle (règle inchangée). Une banque d'une seule question la
  repose.

### Réponse, série, question ignorée

- **Vue = répondue** : `seenIds` ne contient que les questions répondues dans le cycle.
  Tirer une question ne la marque pas ; une question fermée sans réponse reste « non vue »
  et pourra revenir dans une ouverture ultérieure (jamais l'ouverture suivante, si un autre
  choix existe).
- **Série** = bonnes réponses **consécutives** (plus de notion de jour) : bonne réponse
  → +1, mauvaise → 0, question ignorée → inchangée. Le record (`bestStreak`) est conservé.
- Répondre deux fois dans la même session renvoie la première réponse sans rien changer ;
  une réponse à une question qui n'est pas celle de la session est refusée.
- Textes : « La question du moment », « Nouvelle série à la prochaine question ! »,
  « Pas grave : maintenant tu sais ! Une autre question t'attend à ta prochaine visite. »

### Données et migrations

- `QuizState.daily { date, questionId, answerIndex? }` devient
  `QuizState.current { sessionId, questionId, answerIndex? }`.
- Règle de migration commune (`infrastructure/migrations/quizSessions.ts`, sans exception
  sur une donnée inattendue) : `daily` → `current` avec la session `jour-AAAA-MM-JJ` (qui
  ne correspond à aucune ouverture réelle : la prochaine ouverture tire une autre
  question) ; une question du jour **sans réponse** est retirée de `seenIds` (elle
  redevient « non vue ») ; série et record inchangés.
- IndexedDB : `DB_VERSIONS` version **2** (tables et index inchangés, `upgrade` transforme
  la ligne du quiz). Test : `db/migrations.test.ts` (v1 → v2).
- Sauvegardes : `SNAPSHOT_SCHEMA_VERSION` = **2**, `SNAPSHOT_MIGRATIONS[1]` applique la
  même règle avant la validation Zod ; le schéma valide `quiz.current` (`daily` est une
  clé inconnue, ignorée en v2). Tests : `backupSchema.test.ts`, import complet d'un
  fichier v1 dans `backup.qa.test.ts`.

### Renommages

`pickDailyQuestion` → `pickNextQuestion` (`DailyQuestion` → `QuizPick`), `getDailyQuiz` →
`getQuiz` (`DailyQuizView` → `QuizView`), `claimDailyQuizForSession` →
`claimQuizForSession`, `markDailyQuizShown` → `markQuizShown`, composant `DailyQuiz` →
`QuizCard`.

## Conséquences

- La banque (464 questions) s'épuise plus vite pour qui ouvre l'app souvent ; le cycle
  repart alors sans répétition immédiate.
- Un onglet dupliqué hérite du `sessionStorage` : il montre la même question (même
  ouverture). Une session restaurée par le navigateur aussi.
- L'identifiant de session ne quitte jamais l'appareil et n'identifie personne ; il est
  effacé par « Tout effacer » (portée `session`) et exporté seulement dans `quiz.current`.
