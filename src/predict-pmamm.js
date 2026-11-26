import { Buffer } from "buffer";

if (!globalThis.Buffer) globalThis.Buffer = Buffer;

import("./predict-pmamm-app.js").catch((error) => {
  const status = document.getElementById("predictStatus");
  if (status) status.textContent = "Predict rail failed to load: " + String(error?.message || error);
  console.error("[Stocklana Predict Rail]", error);
});
