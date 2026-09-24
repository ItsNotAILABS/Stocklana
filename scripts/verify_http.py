#!/usr/bin/env python3
"""Verify the Medina Sovereign Atlas static/API scaffold."""

from __future__ import annotations

import argparse
import http.client
import json
import socket
import subprocess
import sys
import time
from pathlib import Path


REQUIRED = [
    "index.html",
    "server.py",
    "certification.json",
    "src/systems.js",
    "src/app-three.js",
    "src/app.js",
    "src/styles.css",
    "mobile/pythonista_remote.py",
]


def run(command: list[str], cwd: Path | None = None) -> tuple[int, str]:
    process = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return process.returncode, process.stdout.strip()


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def get_json(port: int, path: str) -> tuple[int, dict]:
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=4)
    conn.request("GET", path)
    response = conn.getresponse()
    data = response.read()
    conn.close()
    payload = json.loads(data.decode("utf-8")) if data else {}
    return response.status, payload


def post_json(port: int, path: str, payload: dict) -> tuple[int, dict]:
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=4)
    conn.request("POST", path, body=body, headers=headers)
    response = conn.getresponse()
    data = response.read()
    conn.close()
    decoded = json.loads(data.decode("utf-8")) if data else {}
    return response.status, decoded


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()

    missing = [path for path in REQUIRED if not (root / path).exists()]
    if missing:
        print("Missing required files: " + ", ".join(missing))
        return 1

    checks = [
        ["node", "--check", "src/systems.js"],
        ["node", "--check", "src/app-three.js"],
        ["node", "--check", "src/app.js"],
        [sys.executable, "-m", "py_compile", "server.py", "mobile/pythonista_remote.py"],
    ]
    for command in checks:
        code, output = run(command, cwd=root)
        label = " ".join(command)
        if code:
            print(output)
            return code
        print(f"OK: {label}")

    server = None
    if not port_open(args.port):
        server = subprocess.Popen(
            [sys.executable, "-u", "server.py", "--host", "127.0.0.1", "--port", str(args.port)],
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 5
        while time.time() < deadline:
            if port_open(args.port):
                break
            if server.poll() is not None:
                output = server.stdout.read() if server.stdout else ""
                print("Server exited before opening port:")
                print(output)
                return 1
            time.sleep(0.1)
        if not port_open(args.port):
            output = ""
            if server.stdout:
                try:
                    output = server.stdout.read(500)
                except Exception:
                    output = ""
            print("Server did not open port in time.")
            if output:
                print(output)
            return 1

    try:
        status, health = get_json(args.port, "/api/health")
        if status != 200 or not health.get("ok"):
            print(f"Health check failed: {status} {health}")
            return 1
        print(f"OK: /api/health {health.get('version')}")

        status, systems = get_json(args.port, "/api/systems")
        if status != 200 or systems.get("count", 0) < 1:
            print(f"Systems check failed: {status} {systems}")
            return 1
        print(f"OK: /api/systems {systems.get('count')} systems")

        status, posted = post_json(args.port, "/api/command", {"type": "focus", "id": "medina-memory"})
        if status != 200 or not posted.get("accepted"):
            print(f"Command post failed: {status} {posted}")
            return 1
        print("OK: /api/command accepts focus")

        status, commands = get_json(args.port, "/api/commands?after=0")
        if status != 200 or not commands.get("commands"):
            print(f"Command poll failed: {status} {commands}")
            return 1
        print("OK: /api/commands returns queue")
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)

    print("CERTIFIED: Medina Sovereign Atlas HTTP/API scaffold")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
