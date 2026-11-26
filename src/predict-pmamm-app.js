import { AnchorProvider } from "https://esm.sh/@anchor-lang/core?bundle";
import { PmAmmClient, PROTOCOL_DAO, SWAP_FEE_BPS } from "https://esm.sh/@pm-amm/sdk?bundle";
import { estimateSwapOutput, i80f48ToNumber } from "https://esm.sh/@pm-amm/sdk/math?bundle";
import {
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
} from "https://esm.sh/@solana/web3.js@1.98.4";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "https://esm.sh/@solana/spl-token@0.4.14";

const runtime = window.STOCKLANA_RUNTIME || {};
const PROGRAM_ID = String(runtime.predictProgramId || "GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");
const DEVNET_USDC = "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ";
const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FAUCET_URL = "https://pm-amm-devnet.vercel.app/api/faucet";
const MICRO_USDC = 1_000_000;
const CLUSTER_KEY = "stocklana:predict-cluster:v2";

let selectedCluster = localStorage.getItem(CLUSTER_KEY) || String(runtime.predictCluster || "mainnet-beta");
let client = null;
let walletProvider = null;
let connection = null;

const el = (id) => document.getElementById(id);
const text = (id, value) => { const n = el(id); if (n) n.textContent = String(value ?? ""); };
const short = (value) => {
  const s = String(value || "");
  return s.length > 14 ? s.slice(0, 6) + "..." + s.slice(-6) : s;
};
const cfg = () => selectedCluster === "devnet"
  ? {
      cluster: "devnet",
      rpc: String(runtime.predictDevnetRpcUrl || runtime.predictRpcUrl || "https://api.devnet.solana.com"),
      collateralMint: DEVNET_USDC,
      label: "DEVNET",
      realMoney: false,
    }
  : {
      cluster: "mainnet-beta",
      rpc: String(runtime.predictMainnetRpcUrl || "https://api.mainnet-beta.solana.com"),
      collateralMint: MAINNET_USDC,
      label: "MAINNET",
      realMoney: true,
    };
const stateKey = () => "stocklana:predict-pmamm:v2:" + cfg().cluster;
const readState = () => {
  try { return JSON.parse(localStorage.getItem(stateKey()) || "{}"); }
  catch { return {}; }
};
const writeState = (patch) => {
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  localStorage.setItem(stateKey(), JSON.stringify(next));
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
const txUrl = (signature) => {
  const q = cfg().cluster === "devnet" ? "?cluster=devnet" : "";
  return signature
    ? "https://solscan.io/tx/" + encodeURIComponent(signature) + q
    : "https://solscan.io/account/" + encodeURIComponent(PROGRAM_ID) + q;
};
const minOutput = (quoteRaw, slippageBps) =>
  Math.max(1, Math.floor(Number(quoteRaw) * (10_000 - Number(slippageBps)) / 10_000));

function resetClient() {
  client = null;
  connection = null;
}
function validateClusterConfig() {
  const c = cfg();
  if (c.cluster === "devnet" && c.collateralMint !== DEVNET_USDC) throw new Error("predict_devnet_collateral_mismatch");
  if (c.cluster === "mainnet-beta" && c.collateralMint !== MAINNET_USDC) throw new Error("predict_mainnet_collateral_mismatch");
  return c;
}

async function ensureClient({ connect = true } = {}) {
  const c = validateClusterConfig();
  if (client && walletProvider?.publicKey) return client;
  const provider = window.phantom?.solana || window.solana;
  if (!provider) throw new Error("phantom_wallet_not_found");
  if (connect) await provider.connect();
  if (!provider.publicKey) throw new Error("phantom_wallet_not_connected");

  walletProvider = provider;
  connection = new Connection(c.rpc, { commitment: "confirmed" });
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
    new PublicKey(c.collateralMint),
    { commitment: "confirmed" },
  );

  writeState({ wallet: provider.publicKey.toString(), cluster: c.cluster, rpc: c.rpc });
  render();
  return client;
}

async function connectWallet() {
  try {
    setStatus("Connecting Phantom to " + cfg().label + "...", true);
    await ensureClient();
    setStatus("Phantom connected. " + (cfg().realMoney ? "Mainnet uses real SOL and Circle USDC." : "Devnet uses test funds."));
    await loadMarkets();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function loadMarkets() {
  try {
    const c = await ensureClient();
    setStatus("Loading live PREDICT markets from " + cfg().label + "...", true);
    const rows = await c.fetchAllMarkets();
    const wantedMint = cfg().collateralMint;
    const markets = rows
      .map((row) => ({ publicKey: row.publicKey.toString(), account: row.account }))
      .filter((row) => row.account?.collateralMint?.toString?.() === wantedMint)
      .sort((a, b) => bnNumber(b.account.startTs) - bnNumber(a.account.startTs))
      .slice(0, 100)
      .map((row) => ({
        publicKey: row.publicKey,
        name: decodeName(row.account.name) || short(row.publicKey),
        endTs: bnNumber(row.account.endTs),
        resolved: Boolean(row.account.resolved),
        winningSide: Number(row.account.winningSide || 0),
      }));
    writeState({ discoveredMarkets: markets, marketDiscoveryAt: new Date().toISOString() });
    renderMarketSelector();
    setStatus("Loaded " + markets.length + " live PREDICT markets from " + cfg().label + ".");
  } catch (error) {
    setStatus("Market discovery failed: " + String(error?.message || error));
  } finally {
    render();
  }
}

function renderMarketSelector() {
  const select = el("predictMarketSelect");
  if (!select) return;
  const state = readState();
  const markets = state.discoveredMarkets || [];
  const current = state.marketPda || "";
  select.innerHTML = '<option value="">Select live market...</option>' + markets.map((m) => {
    const status = m.resolved ? "RESOLVED" : "OPEN";
    return '<option value="' + m.publicKey + '">' + status + ' · ' + m.name + '</option>';
  }).join("");
  if (current && markets.some((m) => m.publicKey === current)) select.value = current;
}

async function selectMarket(publicKey) {
  if (!publicKey) return;
  writeState({ marketPda: publicKey, marketId: null, marketName: null });
  setStatus("Selected live market " + short(publicKey) + ". Reading on-chain state...", true);
  await refreshMarket();
}

async function changeCluster(value) {
  selectedCluster = value === "devnet" ? "devnet" : "mainnet-beta";
  localStorage.setItem(CLUSTER_KEY, selectedCluster);
  resetClient();
  if (walletProvider?.publicKey) {
    try { await ensureClient({ connect: false }); } catch {}
  }
  setStatus(selectedCluster === "mainnet-beta"
    ? "Mainnet ready. Transactions use real SOL and real Circle USDC."
    : "Devnet ready. Use the Predict faucet for test SOL and mUSDC.");
  render();
  if (walletProvider?.publicKey) await loadMarkets();
  if (readState().marketPda && walletProvider?.publicKey) refreshMarket();
}

async function claimFaucet() {
  try {
    if (cfg().cluster !== "devnet") throw new Error("faucet_is_devnet_only");
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
    const c = await ensureClient();
    const network = cfg();
    const name = String(el("predictMarketName")?.value || "").trim();
    const durationSecs = Math.max(300, Math.min(30 * 86400, Number(el("predictDuration")?.value || 86400)));
    const initialPriceBps = Math.max(100, Math.min(9900, Number(el("predictInitialPrice")?.value || 5000)));
    const depositUsdc = Math.max(1, Number(el("predictLiquidity")?.value || 50));
    if (!name || new TextEncoder().encode(name).length > 64) throw new Error("market_name_must_be_1_to_64_bytes");

    if (network.realMoney) {
      const ok = confirm(
        "Create this market on Solana MAINNET with " + depositUsdc +
        " real USDC of starting liquidity? Phantom will show the transaction before signing."
      );
      if (!ok) return;
    }

    setStatus("Creating a real pm-AMM market on Solana " + network.label + "...", true);
    const result = await c.send.createMarket({
      name,
      durationSecs,
      initialPriceBps,
      depositUsdc,
      collateralMint: new PublicKey(network.collateralMint),
    });
    writeState({
      marketId: Number(result.marketId),
      marketPda: String(result.marketPda),
      marketName: name,
      createSignature: result.signature,
      lastSignature: result.signature,
      createdAt: new Date().toISOString(),
    });
    setStatus("Market confirmed on " + network.label + ": " + short(result.signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function marketAuthority(c, market) {
  const m = await c.fetchMarket(market);
  return m?.authority || null;
}

async function tokenBalanceRaw(ata) {
  const info = await connection.getAccountInfo(ata, "confirmed");
  if (!info || info.data.length < 72) return 0;
  const view = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
  return Number(view.getBigUint64(64, true));
}

async function exactSwapQuote(c, market, direction, amountInRaw) {
  const user = walletProvider.publicKey;
  const marketAccount = await c.fetchMarket(market);
  if (!marketAccount) throw new Error("pm_amm_market_not_found");

  const yesMint = c.yesMint(market);
  const noMint = c.noMint(market);
  const collateralMint = new PublicKey(cfg().collateralMint);
  const userUsdc = await getAssociatedTokenAddress(collateralMint, user);
  const userYes = await getAssociatedTokenAddress(yesMint, user);
  const userNo = await getAssociatedTokenAddress(noMint, user);
  const outputAta = direction === "usdcToYes" ? userYes
    : direction === "usdcToNo" ? userNo
    : userUsdc;

  const ataIxs = [];
  for (const [ata, mint] of [[userUsdc, collateralMint], [userYes, yesMint], [userNo, noMint]]) {
    if (!(await connection.getAccountInfo(ata, "confirmed"))) {
      ataIxs.push(createAssociatedTokenAccountInstruction(user, ata, user, mint));
    }
  }

  const creator = marketAccount.authority;
  if (!creator) throw new Error("market_authority_missing");
  const creatorUsdc = await getAssociatedTokenAddress(collateralMint, creator, true);
  if (!creator.equals(user) && !(await connection.getAccountInfo(creatorUsdc, "confirmed"))) {
    ataIxs.push(createAssociatedTokenAccountInstruction(user, creatorUsdc, creator, collateralMint));
  }

  const daoUsdc = await getAssociatedTokenAddress(collateralMint, PROTOCOL_DAO, true);
  if (!(await connection.getAccountInfo(daoUsdc, "confirmed"))) {
    ataIxs.push(createAssociatedTokenAccountInstruction(user, daoUsdc, PROTOCOL_DAO, collateralMint));
  }

  const preBal = await tokenBalanceRaw(outputAta);
  const ix = await c.ix.swap({
    signer: user,
    market,
    direction,
    amountIn: amountInRaw,
    minOutput: 0,
    creatorAuthority: creator,
    collateralMint,
  });

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...ataIxs,
    ix,
  );
  tx.feePayer = user;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

  const sim = await connection.simulateTransaction(tx, undefined, [outputAta]);
  if (!sim.value.err) {
    const post = sim.value.accounts?.[0];
    if (post?.data?.[0]) {
      const bytes = Uint8Array.from(atob(post.data[0]), (ch) => ch.charCodeAt(0));
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const postBal = Number(view.getBigUint64(64, true));
      const out = Math.max(0, postBal - preBal);
      if (out > 0) return { out, source: "onchain-simulation", feeBps: SWAP_FEE_BPS };
    }
  }

  // Production fallback: use PREDICT's exported pm-AMM math against reserves
  // accrued forward to the current timestamp. Buy fees are skimmed from input;
  // sell fees are skimmed from output, matching the reference app.
  const now = Math.floor(Date.now() / 1000);
  const lZero = i80f48ToNumber(marketAccount.lZero);
  const endTs = bnNumber(marketAccount.endTs);
  const lastAccrualTs = bnNumber(marketAccount.lastAccrualTs);
  const lEff = lZero * Math.sqrt(Math.max(endTs - now, 1));
  const lLast = lZero * Math.sqrt(Math.max(endTs - lastAccrualTs, 1));
  const scale = lLast > 0 ? lEff / lLast : 1;
  const reserveYes = i80f48ToNumber(marketAccount.reserveYes) * scale;
  const reserveNo = i80f48ToNumber(marketAccount.reserveNo) * scale;
  const netNum = 10_000 - Number(SWAP_FEE_BPS);
  const isSell = direction === "yesToUsdc" || direction === "noToUsdc";
  let out = 0;
  if (isSell) {
    const sellSide = direction === "yesToUsdc" ? "no" : "yes";
    const est = estimateSwapOutput(reserveYes, reserveNo, lEff, amountInRaw, sellSide);
    out = Math.max(0, Math.floor(est.output * netNum / 10_000));
  } else {
    const netIn = Math.floor(amountInRaw * netNum / 10_000);
    const side = direction === "usdcToYes" ? "yes" : "no";
    const est = estimateSwapOutput(reserveYes, reserveNo, lEff, netIn, side);
    out = Math.max(0, Math.floor(est.output));
  }
  if (!out) throw new Error("swap_quote_zero_output");
  return { out, source: "protocol-math", feeBps: SWAP_FEE_BPS };
}

async function previewTrade(direction, amountInputId = "predictTradeAmount") {
  try {
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("create_or_select_a_market_first");
    const amount = Math.max(0.000001, Number(el(amountInputId)?.value || 0));
    const amountMicro = Math.round(amount * MICRO_USDC);
    setStatus("Quoting against live " + cfg().label + " state...", true);
    const quote = await exactSwapQuote(c, new PublicKey(state.marketPda), direction, amountMicro);
    const slip = Math.max(1, Math.min(5000, Number(el("predictSlippageBps")?.value || 100)));
    const minimum = minOutput(quote.out, slip);
    writeState({
      lastQuote: {
        direction,
        amountMicro,
        outMicro: quote.out,
        minOutputMicro: minimum,
        slippageBps: slip,
        source: quote.source,
        at: new Date().toISOString(),
      },
    });
    const outputUnit = direction === "yesToUsdc" || direction === "noToUsdc" ? "USDC" : "outcome tokens";
    text("predictQuote", (quote.out / MICRO_USDC).toFixed(6) + " " + outputUnit + " · min " + (minimum / MICRO_USDC).toFixed(6) + " · " + quote.source);
    setStatus("Quote ready from " + quote.source + ". Review and sign in Phantom.");
    return { quote, minimum, amount, amountMicro };
  } catch (error) {
    setStatus(String(error?.message || error));
    return null;
  } finally {
    render();
  }
}

async function trade(direction, amountInputId = "predictTradeAmount") {
  try {
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("create_or_select_a_market_first");
    const quoted = await previewTrade(direction, amountInputId);
    if (!quoted) return;

    const network = cfg();
    const isSell = direction === "yesToUsdc" || direction === "noToUsdc";
    const side = direction === "usdcToYes" || direction === "yesToUsdc" ? "YES" : "NO";
    const inputUnit = isSell ? side + " tokens" : "USDC";
    const outputUnit = isSell ? "USDC" : "outcome tokens";
    if (network.realMoney) {
      const ok = confirm(
        "MAINNET: " + (isSell ? "sell " : "spend ") + quoted.amount + " " + inputUnit + " " +
        (isSell ? "from " : "to buy ") + side +
        "? Minimum output is " + (quoted.minimum / MICRO_USDC).toFixed(6) + " " + outputUnit +
        ". Phantom will show the final transaction."
      );
      if (!ok) return;
    }

    setStatus("Sending " + quoted.amount + " " + inputUnit + " " + direction + " swap on " + network.label + "...", true);
    const signature = await c.send.swap(
      new PublicKey(state.marketPda),
      direction,
      quoted.amountMicro,
      quoted.minimum,
    );
    const confirmed = await connection.confirmTransaction(signature, "confirmed");
    if (confirmed.value?.err) throw new Error("swap_confirmation_failed");
    writeState({
      lastSignature: signature,
      lastTradeDirection: direction,
      lastTradeAmount: quoted.amount,
      lastTradeMinOutput: quoted.minimum,
      lastTradeQuoteSource: quoted.quote.source,
    });
    setStatus("Swap confirmed on " + network.label + ": " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally {
    render();
  }
}

async function depositLiquidity() {
  try {
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("market_not_selected");
    const amount = Math.max(1, Number(el("predictLpAmount")?.value || 25));
    if (cfg().realMoney && !confirm("MAINNET: deposit " + amount + " real USDC as pm-AMM liquidity?")) return;
    setStatus("Depositing liquidity on " + cfg().label + "...", true);
    const signature = await c.send.depositLiquidity(new PublicKey(state.marketPda), amount);
    await connection.confirmTransaction(signature, "confirmed");
    writeState({ lastSignature: signature, lastLpDeposit: amount });
    setStatus("Liquidity deposit confirmed: " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally { render(); }
}

async function resolve(side) {
  try {
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("market_not_selected");
    if (cfg().realMoney && !confirm("MAINNET: resolve this market " + side.toUpperCase() + "? This action determines settlement.")) return;
    setStatus("Resolving " + side.toUpperCase() + " on " + cfg().label + "...", true);
    const signature = await c.send.resolveMarket(new PublicKey(state.marketPda), side);
    await connection.confirmTransaction(signature, "confirmed");
    writeState({ lastSignature: signature, resolveSignature: signature, resolvedSide: side });
    setStatus("Resolution confirmed: " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally { render(); }
}

async function claimWinnings() {
  try {
    const c = await ensureClient();
    const state = readState();
    if (!state.marketPda) throw new Error("market_not_selected");
    setStatus("Claiming winnings on " + cfg().label + "...", true);
    const signature = await c.send.claimWinnings(new PublicKey(state.marketPda));
    await connection.confirmTransaction(signature, "confirmed");
    writeState({ lastSignature: signature, claimSignature: signature });
    setStatus("Claim confirmed: " + short(signature));
    await refreshMarket();
  } catch (error) {
    setStatus(String(error?.message || error));
  } finally { render(); }
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
      lastAccrualTs: bnNumber(account.lastAccrualTs),
      resolved: Boolean(account.resolved),
      winningSide: Number(account.winningSide || 0),
      initialPriceBps: Number(account.initialPriceBps || 0),
      collateralMint: account.collateralMint?.toString?.() || cfg().collateralMint,
      authority: account.authority?.toString?.() || "",
    };
    writeState({ marketSnapshot: snapshot, lastReadAt: new Date().toISOString() });
  } catch (error) {
    setStatus("Read failed: " + String(error?.message || error));
  }
  renderMarketSelector();
  render();
}

function render() {
  if (!el("predictPmAmmRail")) return;
  const network = cfg();
  const state = readState();
  const snapshot = state.marketSnapshot || {};
  const provider = window.phantom?.solana || window.solana;
  const wallet = provider?.publicKey?.toString?.() || state.wallet || "";

  const selector = el("predictNetwork");
  if (selector && selector.value !== network.cluster) selector.value = network.cluster;
  text("predictCluster", network.label);
  text("predictProgramId", short(PROGRAM_ID));
  text("predictCollateralMint", short(network.collateralMint));
  text("predictWallet", wallet ? short(wallet) : "Not connected");
  text("predictMarketPda", state.marketPda ? short(state.marketPda) : "Create or select a market");
  text("predictMarketState", state.marketPda
    ? (snapshot.resolved
      ? "RESOLVED " + (snapshot.winningSide === 1 ? "YES" : snapshot.winningSide === 2 ? "NO" : "")
      : (snapshot.endTs ? "OPEN · ends " + new Date(snapshot.endTs * 1000).toLocaleString() : "OPEN"))
    : "NO MARKET");
  text("predictLastProof", state.lastSignature ? short(state.lastSignature) : "No receipt yet");

  const proof = el("predictProofLink");
  if (proof) {
    proof.href = txUrl(state.lastSignature);
    proof.textContent = state.lastSignature ? "Open latest Solana receipt" : "Open Predict program";
  }

  const faucet = el("predictFaucetBtn");
  if (faucet) {
    faucet.hidden = network.cluster !== "devnet";
    faucet.disabled = !wallet || network.cluster !== "devnet";
  }
  const create = el("predictCreateBtn");
  if (create) {
    create.disabled = !wallet;
    create.textContent = network.realMoney ? "Create MAINNET market" : "Create devnet market";
  }

  renderMarketSelector();
  const hasMarket = Boolean(state.marketPda);
  for (const id of ["predictBuyYesBtn", "predictBuyNoBtn", "predictSellYesBtn", "predictSellNoBtn", "predictResolveYesBtn", "predictResolveNoBtn", "predictClaimBtn", "predictRefreshBtn", "predictLpBtn"]) {
    const b = el(id); if (b) b.disabled = !wallet || !hasMarket;
  }

  const risk = el("predictNetworkNotice");
  if (risk) risk.textContent = network.realMoney
    ? "MAINNET · real SOL + Circle USDC · PREDICT is live but currently has centralized resolution, a single-key upgrade authority and no third-party audit."
    : "DEVNET · test SOL + mock USDC · same PREDICT program ID and transaction flow.";
}

el("predictNetwork")?.addEventListener("change", (e) => changeCluster(e.target.value));
el("predictConnectBtn")?.addEventListener("click", connectWallet);
el("predictDiscoverBtn")?.addEventListener("click", loadMarkets);
el("predictMarketSelect")?.addEventListener("change", (e) => selectMarket(e.target.value));
el("predictFaucetBtn")?.addEventListener("click", claimFaucet);
el("predictCreateBtn")?.addEventListener("click", createMarket);
el("predictBuyYesBtn")?.addEventListener("click", () => trade("usdcToYes"));
el("predictBuyNoBtn")?.addEventListener("click", () => trade("usdcToNo"));
el("predictSellYesBtn")?.addEventListener("click", () => trade("yesToUsdc", "predictSellAmount"));
el("predictSellNoBtn")?.addEventListener("click", () => trade("noToUsdc", "predictSellAmount"));
el("predictLpBtn")?.addEventListener("click", depositLiquidity);
el("predictResolveYesBtn")?.addEventListener("click", () => resolve("yes"));
el("predictResolveNoBtn")?.addEventListener("click", () => resolve("no"));
el("predictClaimBtn")?.addEventListener("click", claimWinnings);
el("predictRefreshBtn")?.addEventListener("click", refreshMarket);
el("predictTradeAmount")?.addEventListener("change", () => { text("predictQuote", "Quote refreshes when you trade."); });
el("predictSellAmount")?.addEventListener("change", () => { text("predictQuote", "Quote refreshes when you sell."); });

const phantom = window.phantom?.solana || window.solana;
phantom?.on?.("accountChanged", () => {
  resetClient();
  walletProvider = phantom;
  render();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && readState().marketPda && phantom?.publicKey) refreshMarket();
});
setInterval(() => {
  if (!document.hidden && readState().marketPda && phantom?.publicKey) refreshMarket();
}, 15000);

render();
