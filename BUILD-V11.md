# Stocklana V11 — Visual Product System

## Product design change
V11 replaces the infrastructure-card look with a visual operating system built around user intent.

### Visual worlds
- Home: command center with living account orbit + eight-action dock.
- Invest: tokenized-equity gallery with direct Buy/Auto/Use actions.
- Markets: multiplayer Market Arena for collateralized payoff games.
- Money: premium private-account surface for MAQUE, cards, send/request/offline pay.
- Agent: Agent Commerce control room with purchase-policy visualization.
- Launch: live Pons/Robinhood + Solana launch terminal.
- System: proof, accounting, PQ security, settlement and infrastructure inspection.

### New user-facing concepts
- Real payoff games are shown as sides, prices, pool depth, participants and settlement state—not generic contract rows.
- Agent internet purchases are shown as an explicit cage: max spend, approved merchants, approval threshold, no-subscription policy, one-time payment authority, and receipt/reconciliation timeline.
- The home screen visually demonstrates that invested value can move into markets, money, credit, agents and launches without exposing internal token/accounting vocabulary.

## Functionality preserved
V11 keeps the V10 execution routes, IDs and API wiring. Existing Buy, Auto, Borrow, Play, Send, Spend, Agent, Launch and system routes remain wired to the same backend modules.

## Validation
- Node syntax check: pass.
- Python compile: pass.
- HTTP health: pass.
- 9 systems exposed: pass.
- command queue/bridge: pass.
- Static site certification: pass.
- Headless screenshot automation was attempted but Chromium did not complete capture in the current container, so visual QA is code- and DOM-verified rather than claimed browser-screenshot verified.