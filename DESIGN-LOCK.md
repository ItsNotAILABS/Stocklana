# STOCKLANA DESIGN LOCK

**Status:** canonical visual contract  
**Locked:** 2026-09-25  
**Product source of truth:** this repository

The user-approved Stocklana dashboard image is the visual source of truth for the product shell. Do not reinterpret it into a generic crypto dashboard and do not rebuild Stocklana as a parallel project.

## Non-negotiable visual contract

The desktop composition is:

1. fixed black/navy left rail;
2. Stocklana mark and brand at the top;
3. Home, PreStocks, Convert, Play, Shop, AI Agent, Send, Portfolio;
4. bottom rail promotional visual, which also opens the separate CMESH platform-token surface;
5. top-center command/search bar;
6. top-right activity + Connect Phantom;
7. large left hero headline:
   - Your money shouldn’t
   - **stop working** after
   - you invest it.
8. approved neon planet/orbit media on the right;
9. six compact action cards;
10. two-row dashboard:
    - Wallet
    - Featured PreStocks
    - Play / prediction payoff
    - Shop
    - AI budget
    - Activity

Visual material: near-black field, cyan edge light, acid-lime primary accent, violet secondary accent, subtle glass, 13–19px radii, dense but calm spacing.

## Canonical assets

- `assets/hero-reference.webp` — approved hero-media crop from the design lock.
- `assets/shop-products-clean.webp` — approved shop-product artwork crop.
- The rest of the experience stays live HTML/CSS/JS. Never replace the full app with a screenshot.

## Product integrity

Visual work must not delete or bypass:

- Phantom wallet ownership/signing boundary;
- PreStocks exact-mint eligibility;
- Jupiter routes;
- Stocklana market / settlement engines;
- Play and the Solana judging loop;
- Money / MAQUE;
- Shop / one-time commerce controls;
- Agent Vault policies;
- Credit;
- Launch;
- Portfolio;
- System / Proof;
- CMESH.

CMESH is **not a PreStock**. It stays in the separate Pons / Robinhood Chain platform-token lane.

## Internal pages

Every internal page must use the same design grammar as Home. It may have its own product-world visual, but it must not regress into generic white-label panels.

The locked shell and internal-page design rules live at the bottom of `src/styles.css` under:

- `ONE-TO-ONE MOCKUP LOCK V3`
- `INTERNAL ONE-TO-ONE EXPERIENCE LOCK`

The internal product-world renderer is `src/surface-motion.js`.

## Safety / rollback

Do not delete these branches:

- `backup/pre-one-to-one-design-lock-2026-09-25`
- `checkpoint/one-to-one-home-lock-2026-09-25`

They preserve the product before and at the one-to-one visual checkpoint.

Design changes are targeted patches to the canonical app. Never create V14/V15/side-app replacements unless explicitly requested.

## Verification rule

A page is not visually certified because the CSS exists. Compare a real browser render to the approved design reference at the target desktop viewport before calling the pass complete.

External financial or chain actions are not complete without their real provider / chain receipt.
