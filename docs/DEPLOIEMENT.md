# Déploiement sur GitHub Pages

L'app est construite et publiée par GitHub Actions à chaque push sur `main`
(`.github/workflows/deploy.yml`). Elle est servie à l'adresse
<https://lmcfly.github.io/nutry/>. Aucun secret n'est nécessaire : le workflow utilise le
jeton OIDC fourni par GitHub (`id-token: write`) et la permission `pages: write`.

## 1. Créer le dépôt distant (une seule fois)

Le dépôt local pointe déjà vers `https://github.com/lMcfly/nutry`. Si le dépôt n'existe pas
encore sur GitHub :

```bash
# Avec GitHub CLI (connecté au compte lMcfly)
gh repo create lMcfly/nutry --public \
  --description "PWA de rééquilibrage alimentaire en douceur, 100 % locale" \
  --homepage "https://lmcfly.github.io/nutry/"
git push -u origin main
```

Ou manuellement : sur <https://github.com/new>, nom `nutry`, visibilité **Public** (GitHub
Pages est gratuit pour un dépôt public), **sans** README, licence ni `.gitignore` (ils sont
déjà dans le projet), puis `git push -u origin main`.

## 2. Activer GitHub Pages (une seule fois)

1. Sur GitHub : **Settings → Pages**.
2. **Build and deployment → Source** : choisir **GitHub Actions** (et non « Deploy from a
   branch »).
3. C'est tout : aucune branche `gh-pages`, aucun secret.

En ligne de commande, l'équivalent est :

```bash
gh api -X POST repos/lMcfly/nutry/pages -f build_type=workflow
# si Pages existe déjà avec une autre source :
gh api -X PUT repos/lMcfly/nutry/pages -f build_type=workflow
```

L'environnement `github-pages` est créé automatiquement au premier déploiement. Par défaut,
il n'accepte que la branche par défaut (`main`) : c'est voulu.

### Réglages conseillés (facultatifs)

- **Settings → Code security → Private vulnerability reporting** : activer, pour le lien
  « Faille de sécurité » des modèles d'issues.
- **Settings → Branches** : protéger `main` en exigeant les vérifications
  « Lint, types, format, tests et build » et « Tests de bout en bout (Playwright) ».
- Étiquettes utilisées par les modèles d'issues :

  ```bash
  gh label create "idée" --color 3d6b4f --description "Proposition d'amélioration"
  gh label create contenu --color a9502f --description "Recettes et quiz"
  gh label create recette --color e4eee3 --description "Proposition de recette"
  gh label create quiz --color f8e4da --description "Question de quiz"
  ```

## 3. Premier déploiement et vérification

1. Pousser sur `main` (ou **Actions → Déploiement GitHub Pages → Run workflow**) :

   ```bash
   gh workflow run deploy.yml
   gh run watch
   ```

2. Le job **Déploiement** affiche l'URL publiée (environnement `github-pages`).
3. Vérifier en ligne :

   ```bash
   curl -sI https://lmcfly.github.io/nutry/ | head -1                      # 200
   curl -sI https://lmcfly.github.io/nutry/manifest.webmanifest | head -1  # 200
   curl -sI https://lmcfly.github.io/nutry/sw.js | head -1                 # 200
   curl -sI https://lmcfly.github.io/nutry/icons/icon-512.png | head -1    # 200
   ```

4. Dans Chrome : ouvrir l'app, **Outils de développement → Application** :
   - **Manifest** : nom, icônes (dont la maskable) et aucune erreur d'installabilité ;
   - **Service workers** : `sw.js` activé ; cocher **Offline** puis recharger : l'app
     s'affiche.
5. Sur téléphone : installer l'app (voir le README), activer le mode avion, la rouvrir.

## 4. Mettre à jour

Chaque push sur `main` redéploie automatiquement. Le service worker de la nouvelle version
se télécharge en arrière-plan chez les personnes qui ont déjà l'app, puis s'active quand
elles ferment l'app ou la passent en arrière-plan (voir `vite.config.ts`). Leurs données
(IndexedDB) ne sont jamais touchées par un déploiement.

Pour annuler une mise en ligne : `git revert <commit>` puis push sur `main` ; le
déploiement suivant remplace la version fautive.

## Notes techniques

- **`base: '/nutry/'`** est fixé dans `vite.config.ts`. Si le dépôt est renommé, mettre à
  jour cette constante (le manifest en dérive) et `BASE_PATH` dans `playwright.config.ts`
  et `e2e/offline.spec.ts`.
- **Pas de `404.html`** : l'app utilise `HashRouter` (`…/nutry/#/courses`), donc toutes ses
  routes sont servies par `index.html` et un rechargement ne produit jamais de 404 côté
  GitHub Pages ([ADR 0003](adr/0003-routing-hashrouter-github-pages.md)). Une fois l'app
  visitée, le service worker répond aussi `index.html` à toute navigation dans `/nutry/`.
- **Cache HTTP** : GitHub Pages sert les fichiers avec un cache de 10 minutes ; le service
  worker, lui, est revérifié par le navigateur à chaque ouverture de l'app. Les fichiers de
  `assets/` sont nommés par empreinte, donc jamais périmés.
