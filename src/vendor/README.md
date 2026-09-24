# Vendor path

This scaffold loads Three.js from an ESM CDN first so it can run without an npm install. For locked-down or production deployments, place local vendor modules here and update `src/app-three.js` imports.

Suggested production path:

1. Install or download Three.js and OrbitControls.
2. Replace the CDN map in `src/app-three.js` with local module URLs.
3. Keep the Canvas fallback for resilience.
4. Run `python3 scripts/verify_http.py --root . --port 5173` after vendoring.
