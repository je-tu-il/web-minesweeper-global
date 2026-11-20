# Démineur Ultime — Plan d'implémentation v2

## Résumé

20+ correctifs et nouvelles fonctionnalités demandés, regroupés par domaine. Après analyse complète du code, voici les problèmes identifiés, leurs causes racines, et les solutions proposées.

---

## User Review Required

> [!IMPORTANT]
> **Mode Pure Logique** : L'algorithme actuel est un simple placement de mines aléatoire avec zone safe. Un vrai mode "pure logique" nécessite un solveur CSP (Constraint Satisfaction Problem) qui vérifie après placement que chaque étape est déductible. C'est un changement algorithmique majeur dans `gameEngine.ts`. Confirmer que vous voulez cette approche ?

> [!IMPORTANT]
> **Mur de profil (style Steam)** : Cela nécessite une nouvelle collection Firestore `wallPosts/{uid}/posts/{postId}` et des règles de sécurité associées. Valider le concept : n'importe qui peut poster sur le mur d'un autre joueur, ou seulement les followers ?

> [!IMPORTANT]
> **Messages privés — Firebase** : Il y a un **bug critique de path** : `PrivateChat.tsx` écrit à `privateChats/{chatId}` tandis que `ChatPanel.tsx` écrit à `privateChats/{chatId}/messages`. Les deux composants ne voient pas les messages de l'autre. La solution est d'unifier sur un seul path (`privateChats/{chatId}/messages`) et supprimer l'ancien `PrivateChat.tsx` standalone.

> [!WARNING]
> **Performances grandes grilles** : Le `GameBoard` actuel rend TOUS les boutons dans le DOM sans virtualisation. Pour une grille 50×50 = 2500 boutons. La solution proposée est un mode "basse performance" qui réduit les animations/effets + du canvas rendering optionnel, ET l'optimisation du composant existant (batch updates, meilleur memo).

## Open Questions

> [!IMPORTANT]
> **Mur de profil** : Qui peut poster ? Tout le monde ? Seulement les abonnés ? Peut-on supprimer les posts des autres sur son propre mur ?

> [!IMPORTANT]  
> **Winrate multi** : Vous confirmez que les duels 1v1 doivent impacter le winrate global (pas un winrate séparé) ? Et le co-op aussi ? Actuellement `addGameToHistory` ne met à jour les stats (`updateStats`) que pour le mode solo.

---

## Changements proposés

---

### 1. Catégorie Messages dans les sous-menus (Profil, Communauté) + Persistence état

**Problème** : Le `ChatPanel` n'est affiché que sur la page Index. Les pages Profile et Community n'ont pas accès aux messages. De plus, l'état ouvert/fermé n'est pas persisté.

**Solution** :
- Extraire `<ChatPanel>` du layout de Index et le rendre **global** dans `App.tsx` (disponible sur toutes les pages quand connecté)
- Ajouter `isChatOpen: boolean` dans `uiStore.ts` avec persistance `localStorage`
- Restaurer l'état à l'ouverture de l'app

#### [MODIFY] [App.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/App.tsx)
- Importer `ChatPanel`, `useAuth`, `useUiStore`
- Rendre `<ChatPanel>` conditionnellement (si user connecté) au niveau global, en dehors des routes

#### [MODIFY] [uiStore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/store/uiStore.ts)
- Ajouter `isChatOpen: boolean`, `setIsChatOpen`, `chatView` (pour se souvenir de la vue active)
- Ajouter middleware `persist` avec `localStorage`

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)
- Retirer le `<ChatPanel>` local (désormais global dans App)

#### [MODIFY] [ChatPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/ChatPanel.tsx)
- Utiliser `isChatOpen` de uiStore pour la persistence
- Positionner l'icône plus bas sur l'écran (bottom: ~20% au lieu du haut)

---

### 2. Icône message plus bas sur l'écran

**Problème** : Le bouton toggle du chat est positionné trop haut.

**Solution** : Modifier le CSS du bouton toggle dans `ChatPanel.tsx` — le positionner en `bottom: 6rem` ou `top: auto; bottom: 20vh` sur le côté droit.

#### [MODIFY] [ChatPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/ChatPanel.tsx)

---

### 3. Création de partie parfois très lente

**Problème** : `CreateRoomModal` fait 3 appels Firestore séquentiels : `getGlobalSettings()`, query count rooms actives, `createRoom()`, puis `joinRoom()`, puis init game local. Chaque appel est un aller-retour réseau.

**Solution** :
- Mettre en cache `globalSettings` au niveau du store (valide 30s)
- Paralléliser les vérifications (settings + count) avec `Promise.all`
- Afficher un état "Création en cours..." immédiat pour le feedback utilisateur

#### [MODIFY] [CreateRoomModal.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/CreateRoomModal.tsx)

---

### 4. Ne pas afficher la map en 1v1 tant que personne n'a rejoint

**Problème** : En mode 1v1, le créateur voit la grille immédiatement même en attente d'adversaire. Si l'adversaire rejoint puis quitte sans action, la map reste visible.

**Solution** :
- Dans `Index.tsx`, conditionner l'affichage du `<GameBoard>` : si le mode est duel et `room.status === "waiting"` ou si `Object.keys(room.players).length < 2`, afficher un écran d'attente au lieu du board
- Quand un joueur rejoint puis quitte (aucun click fait par personne) : remettre la room en `waiting` et masquer le board

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

### 5. Messages privés disparaissent — Bug Firebase path

**Problème critique** : `PrivateChat.tsx` écrit à `privateChats/{chatId}` (directement), `ChatPanel.tsx` écrit à `privateChats/{chatId}/messages`. Les deux ne voient pas les messages de l'autre. De plus, les messages écrits directement sous `privateChats/{chatId}` peuvent être écrasés.

**Solution** :
- Unifier sur le path `privateChats/{chatId}/messages` (celui de ChatPanel)
- Supprimer ou refactorer `PrivateChat.tsx` pour utiliser le même path
- Ajouter des règles RTDB pour `privateChats` (actuellement aucune restriction)

#### [MODIFY] [PrivateChat.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/PrivateChat.tsx)
- Changer le path d'écoute/écriture vers `privateChats/{chatId}/messages`
- Ajouter le champ `uid` aux messages envoyés
- Ajouter la gestion de `userPrivateUnread`

---

### 6. Suppression de rooms — Permissions insuffisantes

**Problème** : Les règles Firestore actuelles autorisent `delete` pour tout utilisateur authentifié (`allow create, update, delete: if request.auth != null`). Le problème vient probablement du cleanup RTDB dans `deleteRoom()` qui appelle `remove(rtdbRef)` — les règles RTDB n'autorisent peut-être pas la suppression.

**Solution** :
- Vérifier et publier les règles RTDB (Realtime Database) pour autoriser la suppression de `liveRoom/{roomId}` par les participants
- S'assurer que `deleteRoom` dans `firestore.ts` gère gracieusement les erreurs RTDB (déjà un `catch` mais il pourrait silencer le vrai problème)
- Aussi : s'assurer que les règles Firestore publiées correspondent bien au fichier local

#### [MODIFY] [firestore.rules](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/firestore.rules)
#### [NEW] [database.rules.json](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/database.rules.json)
- Créer les règles RTDB pour `liveRoom`, `globalChat`, `privateChats`, `status`, `userPrivateUnread`

---

### 7. Suppression room sans découverte = Pas de défaite

**Problème** : `LobbyPanel.tsx` traite toute suppression d'une partie commencée comme une défaite. Même si le joueur n'a rien découvert.

**Solution** :
- Dans `LobbyPanel.tsx` `handleDelete` : vérifier si le joueur a des `revealedCells` et/ou un `firstClick`. Si aucune cellule n'a été découverte → supprimer sans comptabiliser de défaite ni ajouter à l'historique
- Modifier le message de confirmation en conséquence

#### [MODIFY] [LobbyPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/LobbyPanel.tsx)

---

### 8. Mode 1v1 même grille — Whitescreen pour le rejoignant

**Problème** : En mode duel "shared", quand le deuxième joueur rejoint, `LobbyPanel.tsx` appelle `initDuelGame(config, seed)`. Si le seed ou la configuration n'est pas correctement transmis, le board se génère mal → écran blanc (erreur de rendu).

**Solution** :
- Tracer le bug exact : dans `LobbyPanel.handleJoin`, pour le mode duel, vérifier que `room.seed` est bien défini et que `generateDuelBoard` produit un board valide
- Ajouter un garde : si le board n'a pas de mines après init, log une erreur et ne pas crasher
- S'assurer que le status passe à `"playing"` pour les deux joueurs quand le 2ème rejoint

#### [MODIFY] [LobbyPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/LobbyPanel.tsx)
#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

### 9. Reprendre parties 1v1 après refresh

**Problème** : Après un F5, le joueur perd sa partie en cours. `restoreFromSync` existe dans `LobbyPanel` mais il faut que `selectedRoomId` survive au refresh.

**Solution** :
- Ajouter `persist` middleware au `uiStore` pour sauver `selectedRoomId` et `activePanel` dans `localStorage`
- Au chargement, si un `selectedRoomId` existe, auto-souscrire à la room et restaurer l'état via `restoreFromSync`
- Afficher un bouton "Reprendre la partie" visible dans le lobby

#### [MODIFY] [uiStore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/store/uiStore.ts)
#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

### 10. Mur de profil (style Steam)

**Problème** : Pas de fonctionnalité de "wall/mur" sur les profils.

**Solution** :
- Nouvelle collection Firestore `wallPosts` sous-collection du user : `users/{uid}/wall/{postId}`
- Chaque post : `{ authorUid, authorUsername, text, timestamp }`
- UI dans `Profile.tsx` : nouveau tab "Mur" avec :
  - Formulaire de post (textarea + bouton)
  - Liste des posts avec auteur cliquable, date relative, texte
  - Bouton supprimer (pour l'auteur du post OU le propriétaire du profil)

#### [MODIFY] [Profile.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Profile.tsx)
#### [MODIFY] [firestore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/firestore.ts)
- Ajouter `addWallPost`, `getWallPosts`, `deleteWallPost`, `subscribeWallPosts`

#### [MODIFY] [firestore.rules](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/firestore.rules)
- Ajouter règles pour `users/{uid}/wall/{postId}` : lecture publique, écriture authentifiée, suppression par auteur ou propriétaire du profil

---

### 11. Mode Pure Logique activé par défaut + correction algorithme

**Problème double** :
1. Le toggle `pureLogic` n'est pas coché par défaut dans `CreateRoomModal`
2. L'algorithme ne garantit pas que le board soit résolvable par pure logique — il place les mines aléatoirement puis met juste un flag dans `gridConfig.pureLogic` sans vérification

**Solution** :
1. Mettre `pureLogic: true` par défaut dans `CreateRoomModal`
2. Implémenter un vrai solveur dans `gameEngine.ts` :
   - Après placement des mines, exécuter un solveur qui simule le jeu case par case
   - Si le solveur ne peut pas résoudre complètement → re-générer le board (avec un nouveau seed ou en déplaçant des mines)
   - Limiter les tentatives (max 100) pour éviter les boucles infinies
   - Pour les grandes grilles, le solveur pourrait être lent → utiliser un worker ou accepter un temps de génération plus long

#### [MODIFY] [gameEngine.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/gameEngine.ts)
- Ajouter `solvePureLogic(cells, config)` et `generatePureLogicBoard(config, safeX, safeY, seed)`

#### [MODIFY] [CreateRoomModal.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/CreateRoomModal.tsx)
- Mettre `pureLogic: true` par défaut

---

### 12. Mode basse performance (option dans les paramètres profil)

**Problème** : Les grandes grilles rament — pas de virtualisation, animations CSS lourdes, ResizeObserver cascade.

**Solution** :
- Ajouter un champ `lowPerformance: boolean` au `UserProfile` et dans les settings du profil
- En mode basse performance :
  - Désactiver les animations CSS (hover glow, scale, transitions)
  - Réduire la taille minimum des cellules
  - Utiliser des couleurs plates sans gradients
  - Désactiver le ResizeObserver (scale fixe)
  - Limiter les re-renders avec `React.memo` renforcé sur chaque cellule
- Stocker dans `localStorage` aussi pour lecture rapide sans attendre Firebase

#### [MODIFY] [Profile.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Profile.tsx)
- Ajouter toggle "Mode basse performance" dans les paramètres

#### [MODIFY] [GameBoard.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/GameBoard.tsx)
- Conditionner animations, gradients, glow selon le mode
- Optimiser le rendu : batch les mises à jour de cellules, réduire les classes CSS dynamiques

#### [MODIFY] [types/index.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/types/index.ts)
- Ajouter `lowPerformance?: boolean` à `UserProfile`

---

### 13. Co-op — Drapeaux ne se synchronisent pas

**Problème** : En co-op, `mergeOpponentState` dans `gameStore.ts` applique les `flaggedIds` de l'adversaire MAIS la synchro ne se déclenche que quand l'adversaire **révèle** une case (car `syncGameState` est appelé après `handleReveal`). Placer un drapeau seul ne déclenche pas `syncGameState`.

**Solution** :
- Dans `Index.tsx`, après `handleFlag`, appeler aussi `syncGameState` (push les flags vers Firestore)
- Actuellement `syncGameState` n'est appelé que dans le flux de reveal — l'ajouter aussi au flux de flag

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

### 14. Revanche co-op — Ne s'affiche pas pour l'autre joueur

**Problème** : Le système de `rematchProposal` dans la room n'est pas écouté/affiché correctement pour le partenaire en co-op. Le bouton "Nouvelle partie" reste au lieu de "Accepter la revanche".

**Solution** :
- Dans `Index.tsx`, vérifier la logique de détection de `room.rematchProposal` : le UI doit afficher "Accepter / Refuser" quand `rematchProposal` existe ET n'est pas l'UID du joueur courant
- S'assurer que cette logique s'applique aussi au mode `coop`, pas seulement `duel`

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

### 15. Spectateur — Afficher le badge 👀 aussi pour le joueur actif

**Problème** : Le compteur de spectateurs `👀 N` est visible dans Spectate.tsx mais pas pour le joueur qui joue dans Index.tsx (même si le code existe — vérifier qu'il est bien rendu).

**Solution** :
- Dans `Index.tsx`, s'assurer que le badge `👀 {spectatorCount}` est visible dans la barre d'info de la room quand `spectatorCount > 0`

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

### 16. Performances grandes grilles

**Problème** : Plus la map est grande, plus ça rame. Causes identifiées :
- Pas de virtualisation (tous les 2500 boutons en DOM pour 50×50)
- `cells.map()` crée de nouveaux éléments à chaque render
- `revealedCount` et `flagsCount` filtrent tout le tableau à chaque render
- Animations CSS (hover glow, transitions) lourdes

**Solution** (combinée avec le mode basse performance #12) :
- Optimiser `CellComponent` : mémoiser plus agressivement les props
- Remplacer les `useMemo` de comptage par des compteurs incrémentaux dans le store
- Pour les grilles > 30×16 : réduire automatiquement les animations
- Utiliser `will-change: transform` sur les cellules pour le GPU compositing
- Considérer `requestAnimationFrame` batching pour les révélations en cascade (BFS)

#### [MODIFY] [GameBoard.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/GameBoard.tsx)
#### [MODIFY] [gameStore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/store/gameStore.ts)

---

### 17. Bombes rouges uniquement si pas de drapeau dessus

**Problème** : Quand on perd, toutes les mines sont révélées en rouge, y compris celles correctement marquées par un drapeau.

**Solution** :
- Dans `GameBoard.tsx` `CellComponent`, modifier la logique d'affichage des mines révélées : si `cell.hasMine && cell.status === "revealed" && cell.mark === "flag"` → afficher en vert (drapeau correct) au lieu de rouge
- Si `cell.hasMine && cell.status === "revealed" && cell.mark !== "flag"` → afficher en rouge
- Dans `gameEngine.ts` `revealCell` (quand mine hit) : ne pas changer le `mark` des cellules flaggées quand on révèle toutes les mines

#### [MODIFY] [GameBoard.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/GameBoard.tsx)
#### [MODIFY] [gameEngine.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/gameEngine.ts)

---

### 18. Winrate multi — Impact sur tous les joueurs

**Problème** : Actuellement `addGameToHistory` n'appelle `updateStats` que pour le mode `solo`. Les duels et co-op n'impactent pas le winrate.

**Solution** :
- Modifier `addGameToHistory` dans `firestore.ts` : appeler `updateStats` pour TOUS les modes
- Pour le duel : le gagnant +1 win, le perdant +1 loss
- Pour le co-op : les deux joueurs gagnent ou perdent ensemble
- Ajouter le temps de jeu pour tous les modes aussi

#### [MODIFY] [firestore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/firestore.ts)

---

### 19. Mode côte à côte — Les 2 joueurs en attente permanente

**Problème** : En mode duel "separate", les deux joueurs restent en "attente de l'adversaire" sans jamais démarrer. Le status de la room ne passe probablement pas à `"playing"` quand le 2ème joueur rejoint.

**Solution** :
- Dans `LobbyPanel.tsx` `handleJoin` pour le mode duel : quand le 2ème joueur rejoint, mettre `room.status = "playing"` via `updateRoom`
- Vérifier que `Index.tsx` détecte correctement le passage `waiting → playing` et lance le jeu

#### [MODIFY] [LobbyPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/LobbyPanel.tsx)

---

### 20. Sécurité admin — Limiter les essais + blocage

**Problème** : Le panel admin accepte des essais de mot de passe illimités.

**Solution** :
- Ajouter un compteur de tentatives échouées dans `localStorage` avec timestamp
- Après 5 tentatives échouées : bloquer pendant 5 minutes
- Après 10 tentatives : bloquer pendant 30 minutes
- Afficher un message avec le temps restant

#### [MODIFY] [Admin.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Admin.tsx)

---

### 21. 1v1 — Adversaire quitte avant le début → Room redevient disponible

**Problème** : Si un adversaire rejoint une room 1v1 puis quitte sans que personne n'ait cliqué, la room reste "playing" avec un seul joueur.

**Solution** :
- Dans `Index.tsx`, écouter les changements de `room.players` : si on passe de 2 à 1 joueur ET que personne n'a de `revealedCells` ni de `firstClick` :
  - Remettre `room.status = "waiting"`
  - Réinitialiser le game state du joueur restant
  - Ne pas compter de victoire/défaite
- Le joueur restant doit voir un écran d'attente, pas un board

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)
#### [MODIFY] [firestore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/firestore.ts)

---

### 22. Refus de revanche → Room dans la liste avec possibilité de rejoindre

**Problème** : Si un joueur refuse la revanche, la room disparaît ou reste bloquée.

**Solution** :
- Quand un joueur refuse la revanche :
  - Le joueur qui refuse quitte la room (`leaveRoom`)
  - La room est remise en `status: "waiting"` avec le joueur restant
  - Le seed est regénéré (nouveau board)
  - La room apparaît dans la liste du lobby, ouverte à tous
- Le joueur restant voit "En attente d'un adversaire..." au lieu du board

#### [MODIFY] [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx)

---

## Fichiers modifiés (résumé)

| Fichier | Modifications |
|---------|---------------|
| [App.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/App.tsx) | Chat global, AuthContext wrapper |
| [Index.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Index.tsx) | Masquer board 1v1 attente, sync flags co-op, revanche co-op, spectateur badge, adversaire quitte, refus revanche, retirer ChatPanel local |
| [Profile.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Profile.tsx) | Mur Steam, toggle basse perf, settings |
| [Admin.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/pages/Admin.tsx) | Sécurité tentatives |
| [ChatPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/ChatPanel.tsx) | Icône plus bas, persistence état |
| [PrivateChat.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/PrivateChat.tsx) | Fix path Firebase messages |
| [GameBoard.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/GameBoard.tsx) | Bombes rouges conditionnelles, mode basse perf, optimisations |
| [LobbyPanel.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/LobbyPanel.tsx) | Suppress sans défaite, fix côte à côte, fix 1v1 whitescreen |
| [CreateRoomModal.tsx](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/components/CreateRoomModal.tsx) | Pure logique par défaut, perf création |
| [gameEngine.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/gameEngine.ts) | Solveur pure logique, bombes flaggées préservées |
| [firestore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/lib/firestore.ts) | Mur profil, winrate multi, room reset |
| [firestore.rules](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/firestore.rules) | Mur profil rules, room permissions |
| [uiStore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/store/uiStore.ts) | Persist localStorage, isChatOpen |
| [gameStore.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/store/gameStore.ts) | Compteurs optimisés |
| [types/index.ts](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/src/types/index.ts) | `lowPerformance` dans UserProfile |
| [NEW] [database.rules.json](file:///e:/Reste/Faut_trier/PROJET_PERSO/DEMINEUR%20ULTIME/web-minesweeper-global/database.rules.json) | Règles RTDB |

---

## Ordre d'exécution recommandé

1. **Fondations** : uiStore persist, types, database.rules.json (#1, #9, #6, #12)
2. **Bugs critiques** : Messages privés path (#5), suppression rooms (#6), côte à côte (#19)
3. **Gameplay multi** : 1v1 attente (#4), co-op flags (#13), revanche co-op (#14), adversaire quitte (#21), refus revanche (#22)
4. **Game engine** : Pure logique (#11), bombes rouges (#17), winrate multi (#18)
5. **Performance** : Basse perf mode (#12, #16), création rapide (#3)
6. **Features** : Mur profil (#10), chat global (#1, #2), spectateur badge (#15)
7. **Sécurité** : Admin rate limit (#20)

---

## Verification Plan

### Automated Tests
- `npm run build` pour vérifier l'absence d'erreurs de compilation

### Manual Verification
- Tester chaque mode (solo, duel shared, duel separate, co-op, turn-based) avec 2 navigateurs
- Vérifier la persistence du chat après navigation entre pages
- Tester la suppression de room avec/sans cellules découvertes
- Tester le mode pure logique sur grilles beginner/intermediate
- Tester le mode basse performance sur grille 50×50
- Vérifier les messages privés entre 2 utilisateurs
- Tester le flux revanche (proposer, accepter, refuser) en co-op et duel
- Tester F5 pendant une partie et la reprise
- Tester la sécurité admin (6+ tentatives)
