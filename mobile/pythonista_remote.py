#!/usr/bin/env python3
"""Pythonista/mobile remote for Medina Sovereign Atlas.

1. Run the atlas on your computer:
   python3 server.py --host 0.0.0.0 --port 5173
2. Put the computer LAN URL into BASE_URL below, for example:
   http://192.168.1.42:5173
3. Run this file in Pythonista and send focus/surface/phase commands.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:5173"
TOKEN = ""  # Match ATLAS_TOKEN if you start server.py with one.


def send(command: dict) -> dict:
    url = BASE_URL.rstrip("/") + "/api/command"
    body = json.dumps(command).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        return {"ok": False, "error": str(exc)}


def focus(system_id: str) -> dict:
    return send({"type": "focus", "id": system_id})


def surface(surface_id: str) -> dict:
    return send({"type": "surface", "surface": surface_id})


def wphase(value: float) -> dict:
    return send({"type": "wphase", "value": max(0, min(1, float(value)))})


def orbit(enabled: bool) -> dict:
    return send({"type": "orbit", "enabled": bool(enabled)})


def capture() -> dict:
    return send({"type": "capture"})


if __name__ == "__main__":
    print("Medina Sovereign Atlas Pythonista remote")
    print("BASE_URL:", BASE_URL)
    print(surface("forge"))
    print(focus("phantom-sdk"))
    print(wphase(0.72))
