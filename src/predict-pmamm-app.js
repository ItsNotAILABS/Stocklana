import { AnchorProvider } from "@anchor-lang/core";
import { PmAmmClient } from "@pm-amm/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

const runtime = window.STOCKLANA_RUNTIME || {};
const CLUSTER = String(runtime.predictCluster || "devnet");
const RPC_URL = String(runtime.predictRpcUrl || "https://api.devnet.solana.com");
const PROGRAM_ID = String(runtime.predictProgramId || "GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");
const COLLATERAL_MINT = String(runtime.predictCollateralMint || "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ");
const FAUCET_URL = "https://pm-amm-devnet.vercel.app/api/faucet";
const STATE_KEY = "stocklana:predict-pmamm:v1";
const MICRO_USDC = 1_000_000;

let client = null;
let walletProvider = null;
let connection = null;

const el = (id) => document.getElementById(id);
const text = (id, value) => { const n = el(id); if (n) n.textContent = String(value ?? ""); };
const short = (value) => {
  const s = String(value || "");
  return s.length > 14 ? s.slice(0, 6) + "..." + s.slice(-6) : s;
};
const readState = () => {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); }
  catch { return {}; }
};
const writeState = (patch) => {
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
};
const bnNumber = (value) => {
  if (value == null) return 0;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
};
const decodeName = (value) => {
  if (Array.isArray(value) || value instanceof Uint8Array) {
    return new TextDecoder().decode(Uint8Array.from(value)).replace(/\0/g, "").trim();
  }
  return String(value || "");
};
const setStatus = (message, busy = false) => {
  text("predictStatus", message);
  const rail = el("predictPmAmmRail");
  if (rail) rail.dataset.busy = busy ? "true" : "false";
};
const txUrl = (signature) => signature
  ? "https://solscan.io/tx/" + encodeURIComponent(signature) + "?cluster=devnet"
  : "https://solscan.io/account/" + encodeURIComponent(PROGRAM_ID) + "?cluster=devnet";

function assertDevnet() {
  if (CLUSTER !== "devnet") {
    throw new Error("predict_mainnet_locked_exact_quote_required");
  }
  if (COLLATERAL_MINT !== "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ") {
    throw new Error("predict_devnet_collateral_mismatch");
  }
}

async function ensureClient({ connect = true } = {}) {
  if (client && walletProvider?.publicKey) return client;
  const provider = window.phantom?.solana || window.solana;
  if (!provider) throw new Error("phantom_wallet_not_found");
  if (connect) await provider.connect();
  if (!provider.publicKey) throw new Error("phantom_wallet_not_connected");

  walletProvider = provider;
  connection = new Connection(RPC_URL, { commitment: "confirmed" });

  const wallet = {
    publicKey: provider.publicKey,
    signTransaction: (tx) => provider.signTransaction(tx),
    signAllTransactions: (txs) => provider.signAllTransactions
      ? provider.signAllTransactions(txs)
      : Promise.all(txs.map((tx) => provider.signTransaction(tx))),
  };

  const anchor = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  client = PmAmmClient.fromProvider(
    anchor,
    new PublicKey(PROGRAM_ID),
    new PublicKey(COLLATERAL_MINT),
    { commitment: "confirmed" },
  );

  writeState({ wallet: provider.publicKey.toString(), cluster: CLUSTER, rpc: RPC_URL });
  render();
  return client;
}

async function connectWallet() {
  try {
    setStatus("Connecting Phantom...", true);
    await ensureClient();
    setStatus("Phantom connected to the Predict devnet rail.");
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function claimFaucet() {
  try {
    assertDevnet();
    setStatus("Requesting devnet SOL + mUSDC from the official Predict faucet...", true);
    await ensureClient();
    const response = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: walletProvider.publicKey.toString() }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || ("predict_faucet_" + response.status));
    writeState({ faucetSignature: body.signature || null, lastSignature: body.signature || null });
    setStatus("Faucet confirmed: " + Number(body.amount || 0) + " mUSDC; SOL drip " + Number(body.sol || 0) + ".");
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function createMarket() {
  try {
    assertDevnet();
    const c = await ensureClient();
    const name = String(el("predictMarketName")?.value || "").trim();
    const durationSecs = Math.max(300, Math.min(7 * 86400, Number(el("predictDuration")?.value || 900)));
    const initialPriceBps = Math.max(100, Math.min(9900, Number(el("predictInitialPrice")?.value || 5000)));
    const depositUsdc = Math.max(1, Number(el("predictLiquidity")?.value || 50));
    if (!name || new TextEncoder().encode(name).length > 64) throw new Error("market_name_must_be_1_to_64_bytes");

    setStatus("Creating a real pm-AMM market on Solana devnet...", true);
    const result = await c.send.createMarket({ name, durationSecs, initialPriceBps, depositUsdc });
    writeState({
      marketId: Number(result.marketId),
      marketPda: String(result.marketPda),
      marketName: name,
      createSignature: result.signature,
      lastSignature: result.signature,
      createdAt: new Date().toISOString(),
    });
    setStatus("Market created on devnet. Signature: " + short(result.signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function trade(direction) {
  try {
    assertDevnet();
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("create_or_select_a_market_first");
    const amount = Math.max(0.1, Number(el("predictTradeAmount")?.value || 5));
    const amountMicro = Math.round(amount * MICRO_USDC);

    // DEVNET ONLY: minOutput=1 is intentionally prohibited for mainnet by assertDevnet().
    // Before mainnet enablement, vendor Predict's exact quoteSwap/minOutput helper and remove this gate.
    const minOutputMicro = 1;
    setStatus("Sending a real " + amount + " mUSDC " + direction + " swap to pm-AMM...", true);
    const signature = await c.send.swap(
      new PublicKey(state.marketPda),
      direction,
      amountMicro,
      minOutputMicro,
    );
    writeState({ lastSignature: signature, lastTradeDirection: direction, lastTradeAmount: amount });
    setStatus("Swap confirmed on devnet: " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function resolve(side) {
  try {
    assertDevnet();
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("market_not_selected");
    setStatus("Resolving " + side.toUpperCase() + " on the pm-AMM authority path...", true);
    const signature = await c.send.resolveMarket(new PublicKey(state.marketPda), side);
    writeState({ lastSignature: signature, resolveSignature: signature, resolvedSide: side });
    setStatus("Resolution confirmed: " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function claimWinnings() {
  try {
    assertDevnet();
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("market_not_selected");
    setStatus("Claiming resolved pm-AMM winnings...", true);
    const signature = await c.send.claimWinnings(new PublicKey(state.marketPda));
    writeState({ lastSignature: signature, claimSignature: signature });
    setStatus("Claim confirmed: " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function refreshMarket() {
  const state = readState();
  if (!state.marketPda) { render(); return; }
  try {
    const c = await ensureClient();
    const account = await c.fetchMarket(new PublicKey(state.marketPda));
    if (!account) throw new Error("pm_amm_market_not_found");
    const snapshot = {
      name: decodeName(account.name) || state.marketName || "",
      endTs: bnNumber(account.endTs),
      resolved: Boolean(account.resolved),
      winningSide: Number(account.winningSide || 0),
      initialPriceBps: Number(account.initialPriceBps || 0),
      collateralMint: account.collateralMint?.toString?.() || COLLATERAL_MINT,
      authority: account.authority?.toString?.() || "",
    };
    writeState({ marketSnapshot: snapshot, lastReadAt: new Date().toISOString() });
  } catch (error) {
    setStatus("Read failed: " + String(error?.message || error));
  }
  render();
}

function render() {
  if (!el("predictPmAmmRail")) return;
  const state = readState();
  const snapshot = state.marketSnapshot || {};
  const provider = window.phantom?.solana || window.solana;
  const wallet = provider?.publicKey?.toString?.() || state.wallet || "";

  text("predictProgramId", short(PROGRAM_ID));
  text("predictCollateralMint", short(COLLATERAL_MINT));
  text("predictWallet", wallet ? short(wallet) : "Not connected");
  text("predictMarketPda", state.marketPda ? short(state.marketPda) : "Create a market");
  text("predictMarketState", state.marketPda
    ? (snapshot.resolved
      ? "RESOLVED " + (snapshot.winningSide === 1 ? "YES" : snapshot.winningSide === 2 ? "NO" : "")
      : (snapshot.endTs ? "OPEN - ends " + new Date(snapshot.endTs * 1000).toLocaleTimeString() : "OPEN"))
    : "NO MARKET");
  text("predictLastProof", state.lastSignature ? short(state.lastSignature) : "No receipt yet");

  const proof = el("predictProofLink");
  if (proof) {
    proof.href = txUrl(state.lastSignature);
    proof.textContent = state.lastSignature ? "Open latest Solana receipt" : "Open Predict program";
  }

  const hasWallet = Boolean(wallet);
  const hasMarket = Boolean(state.marketPda);
  for (const id of ["predictFaucetBtn", "predictCreateBtn"]) {
    const b = el(id); if (b) b.disabled = !hasWallet;
  }
  for (const id of ["predictBuyYesBtn", "predictBuyNoBtn", "predictResolveYesBtn", "predictResolveNoBtn", "predictClaimBtn", "predictRefreshBtn"]) {
    const b = el(id); if (b) b.disabled = !hasWallet || !hasMarket;
  }

  const cluster = el("predictCluster");
  if (cluster) cluster.textContent = CLUSTER.toUpperCase();
  if (CLUSTER !== "devnet") {
    setStatus("Mainnet execution is locked until exact pm-AMM quote/minOutput handling is vendored and verified.");
  }
}

el("predictConnectBtn")?.addEventListener("click", connectWallet);
el("predictFaucetBtn")?.addEventListener("click", claimFaucet);
el("predictCreateBtn")?.addEventListener("click", createMarket);
el("predictBuyYesBtn")?.addEventListener("click", () => trade("usdcToYes"));
el("predictBuyNoBtn")?.addEventListener("click", () => trade("usdcToNo"));
el("predictResolveYesBtn")?.addEventListener("click", () => resolve("yes"));
el("predictResolveNoBtn")?.addEventListener("click", () => resolve("no"));
el("predictClaimBtn")?.addEventListener("click", claimWinnings);
el("predictRefreshBtn")?.addEventListener("click", refreshMarket);

const phantom = window.phantom?.solana || window.solana;
phantom?.on?.("accountChanged", () => {
  client = null;
  walletProvider = null;
  connection = null;
  render();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && readState().marketPda) refreshMarket();
});

setInterval(() => {
  if (!document.hidden && readState().marketPda && (window.phantom?.solana || window.solana)?.publicKey) {
    refreshMarket();
  }
}, 15000);

render();
