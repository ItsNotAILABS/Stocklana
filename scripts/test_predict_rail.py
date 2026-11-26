#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
loader = (ROOT / "src" / "predict-pmamm.js").read_text(encoding="utf-8")
app = (ROOT / "src" / "predict-pmamm-app.js").read_text(encoding="utf-8")
index = (ROOT / "index.html").read_text(encoding="utf-8")
runtime = (ROOT / "runtime-config.js").read_text(encoding="utf-8")
build = (ROOT / "scripts" / "build_static_release.mjs").read_text(encoding="utf-8")

checks = {
    "buffer_before_dynamic_app": 'import("./predict-pmamm-app.js")' in loader and 'Buffer' in loader,
    "official_program_id": "GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y" in app,
    "official_devnet_musdc": "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ" in app,
    "real_create": "client.send.createMarket" not in app and ".send.createMarket" in app,
    "real_swap": ".send.swap" in app,
    "real_resolve": ".send.resolveMarket" in app,
    "real_claim": ".send.claimWinnings" in app,
    "devnet_guard": "predict_mainnet_locked_exact_quote_required" in app,
    "mainnet_not_faked": "minOutputMicro = 1" in app and "assertDevnet()" in app,
    "faucet": "pm-amm-devnet.vercel.app/api/faucet" in app,
    "ui_mounted": 'id="predictPmAmmRail"' in index,
    "loader_mounted": "./src/predict-pmamm.js" in index,
    "runtime_predict_cluster": 'predictCluster: "devnet"' in runtime,
    "static_build_includes_predict": "src/predict-pmamm.js" in build and "src/predict-pmamm-app.js" in build,
    "no_secret_key_path": "secretKey" not in app and "PRIVATE_KEY" not in app,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("predict rail verification failed: " + ", ".join(failed))
print("predict rail verification passed:", len(checks), "checks")
