#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
loader = (ROOT / "src" / "predict-pmamm.js").read_text(encoding="utf-8")
app = (ROOT / "src" / "predict-pmamm-app.js").read_text(encoding="utf-8")
index = (ROOT / "index.html").read_text(encoding="utf-8")
runtime = (ROOT / "runtime-config.js").read_text(encoding="utf-8")
build = (ROOT / "scripts" / "build_static_release.mjs").read_text(encoding="utf-8")

checks = {
    "browser_loader": 'import("./predict-pmamm-app.js")' in loader and 'Buffer' in loader,
    "browser_esm": "https://esm.sh/" in app,
    "official_program_id": "GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y" in app,
    "mainnet_circle_usdc": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" in app,
    "devnet_musdc": "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ" in app,
    "mainnet_default": 'predictCluster: "mainnet-beta"' in runtime and 'value="mainnet-beta"' in index,
    "cluster_switch": 'id="predictNetwork"' in index and "changeCluster" in app,
    "real_create": ".send.createMarket" in app,
    "real_swap": ".send.swap" in app,
    "real_lp": ".send.depositLiquidity" in app,
    "real_resolve": ".send.resolveMarket" in app,
    "real_claim": ".send.claimWinnings" in app,
    "live_quote_simulation": "simulateTransaction" in app and "exactSwapQuote" in app,
    "slippage_minimum": "minOutput(quote.out" in app and 'id="predictSlippageBps"' in index,
    "no_mainnet_lock": "predict_mainnet_locked" not in app and "assertDevnet" not in app,
    "no_fake_min_output": "minOutputMicro = 1" not in app,
    "mainnet_confirmations": "MAINNET:" in app and "confirm(" in app,
    "faucet_devnet_only": "faucet_is_devnet_only" in app,
    "receipt_surface": 'id="predictProofLink"' in index and "txUrl" in app,
    "static_build_mainnet": 'predictCluster: "mainnet-beta"' in build and "predictMainnetRpcUrl" in build,
    "static_build_includes_predict": "src/predict-pmamm.js" in build and "src/predict-pmamm-app.js" in build,
    "no_secret_key_path": "secretKey" not in app and "PRIVATE_KEY" not in app,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("predict rail verification failed: " + ", ".join(failed))
print("predict rail verification passed:", len(checks), "checks")
