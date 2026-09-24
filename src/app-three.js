import { systems, surfaces, engineRegistry } from "./systems.js";

const canvas = document.querySelector("#atlas-canvas");
const rail = document.querySelector("#system-rail");
const inspector = document.querySelector("#inspector");
const orbitToggle = document.querySelector("#orbit-toggle");
const orbitLabel = document.querySelector("#orbit-label");
const orbitIcon = document.querySelector("#orbit-icon");
const captureButton = document.querySelector("#capture-4k");
const runtimeLabel = document.querySelector("#runtime-label");
const httpLabel = document.querySelector("#http-label");
const apiStatusLabel = document.querySelector("#api-status-label");
const apiStatusDot = document.querySelector("#api-status-dot");
const bridgeCopy = document.querySelector("#bridge-copy");
const surfaceTitle = document.querySelector("#surface-title");
const surfaceKicker = document.querySelector("#surface-kicker");
const sceneLabel = document.querySelector("#scene-label");
const phaseSlider = document.querySelector("#phase-slider");
const phaseValue = document.querySelector("#phase-value");
const surfaceButtons = Array.from(document.querySelectorAll(".surface-button"));

const cdn = {
  three: "https://esm.sh/three@0.181.2",
  controls: "https://esm.sh/three@0.181.2/examples/jsm/controls/OrbitControls.js?deps=three@0.181.2",
  webgpu: "https://esm.sh/three@0.181.2/webgpu?deps=three@0.181.2"
};

const state = {
  selectedId: systems[0].id,
  hoveredId: null,
  surface: "atlas",
  autoOrbit: true,
  wPhase: Number.parseFloat(phaseSlider.value),
  runtime: "renderer probing",
  apiState: "probing",
  apiUrl: "",
  lastCommandId: 0,
  commandPollFailures: 0,
  captureRequested: false
};

function selectedSystem() {
  return systems.find((system) => system.id === state.selectedId) || systems[0];
}

function currentSurface() {
  return surfaces[state.surface] || surfaces.atlas;
}

function setRuntime(label) {
  state.runtime = label;
  runtimeLabel.textContent = label;
}

function setApiState(label, extra = "") {
  state.apiState = label;
  apiStatusLabel.textContent = label;
  apiStatusDot.textContent = label === "online" ? "LIVE" : label === "static" ? "HTTP" : "API";
  apiStatusDot.className = label === "online" ? "live" : label === "static" ? "static" : "";
  httpLabel.textContent = extra || (label === "online" ? "API bridge online" : "static mode");
}

function renderRail() {
  rail.innerHTML = systems
    .map((system) => `
      <button class="rail-item${system.id === state.selectedId ? " active" : ""}" data-id="${system.id}" style="--system-color:${system.color}" type="button">
        <span class="rail-dot"></span>
        <span>${system.label}</span>
      </button>
    `)
    .join("");
}

function renderSurface() {
  const surface = currentSurface();
  surfaceTitle.textContent = surface.title;
  surfaceKicker.textContent = surface.kicker;
  sceneLabel.textContent = surface.geometry;
  surfaceButtons.forEach((button) => button.classList.toggle("active", button.dataset.surface === state.surface));
}

function renderInspector() {
  const system = selectedSystem();
  const surface = currentSurface();
  inspector.style.setProperty("--selected-color", system.color);
  inspector.innerHTML = `
    <div class="inspector-heading">
      <span class="repo-pill">${system.repo}</span>
      <h2>${system.label}</h2>
      <p>${state.surface === "forge" ? system.surfacePitch : system.thesis}</p>
    </div>
    <div class="metrics-row">
      <div><span>Role</span><strong>${system.role}</strong></div>
      <div><span>Heartbeat</span><strong>${system.heartbeat}</strong></div>
      <div><span>Surface</span><strong>${surface.label}</strong></div>
    </div>
    <div class="signal-list">
      <div class="section-kicker">Active signals</div>
      ${system.signals.map((signal) => `<span>${signal}</span>`).join("")}
    </div>
    <div class="bridge-card">
      <div>
        <span>Mobile/API command</span>
        <code>${system.apiAction}</code>
      </div>
      <div>
        <span>Renderer ladder</span>
        <strong>${engineRegistry.map((engine) => engine.label).join(" -> ")}</strong>
      </div>
    </div>
  `;
}

function renderAll() {
  renderSurface();
  renderRail();
  renderInspector();
  orbitLabel.textContent = state.autoOrbit ? "Auto orbit" : "Manual";
  orbitIcon.textContent = state.autoOrbit ? "Pause" : "Play";
  phaseValue.textContent = state.wPhase.toFixed(2);
}

function selectSystem(id) {
  if (!systems.some((system) => system.id === id)) return;
  state.selectedId = id;
  renderAll();
}

function setSurface(surfaceId) {
  if (!surfaces[surfaceId]) return;
  state.surface = surfaceId;
  renderAll();
}

function setWPhase(value) {
  const next = Math.min(1, Math.max(0, Number.parseFloat(value) || 0));
  state.wPhase = next;
  phaseSlider.value = String(next);
  phaseValue.textContent = next.toFixed(2);
}

rail.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (button) selectSystem(button.dataset.id);
});

surfaceButtons.forEach((button) => {
  button.addEventListener("click", () => setSurface(button.dataset.surface));
});

orbitToggle.addEventListener("click", () => {
  state.autoOrbit = !state.autoOrbit;
  renderAll();
});

phaseSlider.addEventListener("input", () => setWPhase(phaseSlider.value));

bridgeCopy.addEventListener("click", async () => {
  const endpoint = state.apiUrl || `${window.location.origin}/api/command`;
  const text = `${endpoint}\nExample: {"type":"focus","id":"${state.selectedId}"}`;
  try {
    await navigator.clipboard.writeText(text);
    setApiState(state.apiState === "online" ? "online" : "static", "endpoint copied");
  } catch {
    window.prompt("Copy API endpoint", text);
  }
});

async function probeApi() {
  try {
    const response = await fetch("./api/health", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.apiUrl = `${window.location.origin}/api/command`;
    setApiState("online", payload.message || "API bridge online");
  } catch {
    state.apiUrl = "";
    setApiState("static", "static renderer only");
  }
}

async function pollCommands() {
  if (state.apiState !== "online") return;
  try {
    const response = await fetch(`./api/commands?after=${state.lastCommandId}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    for (const command of payload.commands || []) {
      state.lastCommandId = Math.max(state.lastCommandId, command.id || 0);
      applyCommand(command);
    }
    state.commandPollFailures = 0;
  } catch {
    state.commandPollFailures += 1;
    if (state.commandPollFailures > 3) setApiState("static", "API polling paused");
  }
}

function applyCommand(command) {
  if (!command || typeof command !== "object") return;
  if (command.type === "focus" && command.id) selectSystem(command.id);
  if (command.type === "surface" && command.surface) setSurface(command.surface);
  if (command.type === "wphase") setWPhase(command.value ?? command.phase ?? command.w ?? 0.5);
  if (command.type === "orbit") {
    state.autoOrbit = Boolean(command.value ?? command.enabled);
    renderAll();
  }
  if (command.type === "capture") state.captureRequested = true;
}

function makeCanvasTexture(THREE, lines, color) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 192;
  const ctx = labelCanvas.getContext("2d");
  ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  ctx.fillStyle = "rgba(5,7,10,0.72)";
  roundRect(ctx, 18, 22, 476, 126, 24);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 38px Inter, system-ui, sans-serif";
  ctx.fillText(lines[0], 44, 78);
  ctx.fillStyle = "rgba(238,247,244,0.66)";
  ctx.font = "24px Inter, system-ui, sans-serif";
  ctx.fillText(lines[1], 44, 116);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.needsUpdate = true;
  return texture;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function forgePosition(index) {
  const count = systems.length;
  const x = (index - (count - 1) / 2) * 1.12;
  const y = index % 2 === 0 ? 0.85 : -0.9;
  const z = -0.8 + Math.sin(index * 1.7) * 0.42;
  return [x, y, z];
}

async function createRenderer(THREE) {
  if (navigator.gpu) {
    try {
      const webgpuModule = await import(cdn.webgpu);
      const WebGPURenderer = webgpuModule.WebGPURenderer || webgpuModule.default;
      if (WebGPURenderer) {
        const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: false });
        await renderer.init();
        setRuntime("Three.js WebGPU");
        return renderer;
      }
    } catch (error) {
      console.warn("WebGPU renderer unavailable; falling back to WebGL.", error);
    }
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  setRuntime(navigator.gpu ? "Three.js WebGL fallback" : "Three.js WebGL");
  return renderer;
}

async function bootThreeAtlas() {
  renderAll();
  await probeApi();

  const [THREE, controlsModule] = await Promise.all([import(cdn.three), import(cdn.controls)]);
  const { OrbitControls } = controlsModule;
  const renderer = await createRenderer(THREE);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if ("toneMapping" in renderer && THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if ("toneMappingExposure" in renderer) renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);

  const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.4, 8.8);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 4.2;
  controls.maxDistance = 12;

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0x8aa6b4, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x66d9ef, 16, 18);
  rim.position.set(-3, 1.5, 3.5);
  scene.add(rim);

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x102329,
    emissive: 0x143c48,
    emissiveIntensity: 1.1,
    metalness: 0.62,
    roughness: 0.28
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.52, 4), coreMaterial);
  root.add(core);

  const shell = new THREE.Mesh(
    new THREE.TorusKnotGeometry(2.15, 0.012, 280, 8, 2, 5),
    new THREE.MeshBasicMaterial({ color: 0x78f6ff, transparent: true, opacity: 0.32 })
  );
  root.add(shell);

  const points = [];
  const pointColors = [];
  const colorA = new THREE.Color(0x78f6ff);
  const colorB = new THREE.Color(0xd9b86c);
  for (let i = 0; i < 1600; i += 1) {
    const y = 1 - (i / 1599) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = i * Math.PI * (3 - Math.sqrt(5));
    const r = 2.05 + (i % 9) * 0.025;
    points.push(Math.cos(theta) * radius * r, y * r, Math.sin(theta) * radius * r);
    const mixed = colorA.clone().lerp(colorB, (i % 17) / 17);
    pointColors.push(mixed.r, mixed.g, mixed.b);
  }
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  pointGeometry.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));
  const pointCloud = new THREE.Points(
    pointGeometry,
    new THREE.PointsMaterial({ size: 0.018, vertexColors: true, transparent: true, opacity: 0.78 })
  );
  root.add(pointCloud);

  const nodeObjects = new Map();
  const rayTargets = [];

  systems.forEach((system) => {
    const color = new THREE.Color(system.color);
    const accent = new THREE.Color(system.accent);
    const group = new THREE.Group();
    group.userData.systemId = system.id;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.19 * system.scale, 48, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.35,
        metalness: 0.36,
        roughness: 0.18
      })
    );
    mesh.userData.systemId = system.id;
    group.add(mesh);
    rayTargets.push(mesh);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34 * system.scale, 0.006, 8, 96),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.42 })
    );
    halo.rotation.x = Math.PI / 2.8;
    group.add(halo);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, ...system.position], 3));
    const line = new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.34 })
    );
    root.add(line);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: makeCanvasTexture(THREE, [system.label, system.mode], system.color),
      transparent: true,
      opacity: 0
    });
    const label = new THREE.Sprite(spriteMaterial);
    label.scale.set(1.55, 0.58, 1);
    label.position.set(0, 0.55, 0);
    group.add(label);

    root.add(group);
    nodeObjects.set(system.id, { group, mesh, halo, line, label, system });
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  canvas.addEventListener("pointermove", (event) => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(rayTargets, false)[0];
    state.hoveredId = hit?.object?.userData?.systemId || null;
    canvas.style.cursor = state.hoveredId ? "pointer" : "grab";
  });

  canvas.addEventListener("pointerdown", () => {
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointerup", () => {
    if (state.hoveredId) selectSystem(state.hoveredId);
    canvas.style.cursor = state.hoveredId ? "pointer" : "grab";
  });

  function computePosition(system, index, time) {
    const base = state.surface === "forge" ? forgePosition(index) : system.position;
    const phase = state.wPhase * Math.PI * 2;
    const w = Math.sin(phase + system.w + time * 0.45 + index * 0.31);
    const projection = 1 / (1.42 - w * 0.16);
    const lift = Math.sin(time * 0.9 + index) * 0.055;
    return new THREE.Vector3(base[0], base[1] + lift, base[2]).multiplyScalar(projection);
  }

  async function capture4K() {
    const previous = new THREE.Vector2();
    renderer.getSize(previous);
    const previousPixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
    const previousAspect = camera.aspect;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(3840, 2160, false);
      camera.aspect = 3840 / 2160;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const link = document.createElement("a");
      link.download = `medina-atlas-${state.surface}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setApiState(state.apiState === "online" ? "online" : "static", "4K frame exported");
    } catch (error) {
      console.warn("4K capture failed", error);
      setApiState(state.apiState === "online" ? "online" : "static", "capture blocked by renderer");
    } finally {
      renderer.setPixelRatio(previousPixelRatio);
      renderer.setSize(previous.x, previous.y, false);
      camera.aspect = previousAspect;
      camera.updateProjectionMatrix();
    }
  }

  captureButton.addEventListener("click", capture4K);

  const clock = new THREE.Clock();
  let lastPoll = 0;

  function animate() {
    const elapsed = clock.getElapsedTime();
    const delta = Math.min(clock.getDelta(), 0.033);

    if (state.autoOrbit) root.rotation.y += delta * (state.surface === "forge" ? 0.085 : 0.16);
    root.rotation.x = Math.sin(elapsed * 0.21 + state.wPhase * 2) * 0.055;

    core.rotation.y += delta * 0.18;
    core.rotation.x += delta * 0.07;
    shell.rotation.y -= delta * 0.11;
    shell.rotation.z += delta * 0.05;
    pointCloud.rotation.y += delta * 0.04;

    const selected = selectedSystem();
    let selectedWorld = new THREE.Vector3(0, 0, 0);

    systems.forEach((system, index) => {
      const object = nodeObjects.get(system.id);
      const target = computePosition(system, index, elapsed);
      object.group.position.lerp(target, 0.08);
      object.group.getWorldPosition(system.id === selected.id ? selectedWorld : new THREE.Vector3());

      const active = system.id === state.selectedId;
      const hovered = system.id === state.hoveredId;
      const scalar = active ? 1.34 : hovered ? 1.15 : 1;
      object.group.scale.lerp(new THREE.Vector3(scalar, scalar, scalar), 0.12);
      object.halo.rotation.z += delta * (active ? 1.3 : 0.55);
      object.halo.material.opacity = active ? 0.68 : hovered ? 0.52 : 0.32;
      object.label.material.opacity += ((active || hovered) ? 1 : 0) - object.label.material.opacity;
      object.label.material.opacity = THREE.MathUtils.clamp(object.label.material.opacity, 0, 1);

      const linePositions = object.line.geometry.attributes.position.array;
      linePositions[3] = object.group.position.x;
      linePositions[4] = object.group.position.y;
      linePositions[5] = object.group.position.z;
      object.line.geometry.attributes.position.needsUpdate = true;
      object.line.material.opacity = active ? 0.64 : 0.22;
    });

    const selectedObject = nodeObjects.get(selected.id);
    if (selectedObject) {
      selectedObject.group.getWorldPosition(selectedWorld);
      const desiredTarget = selectedWorld.clone().multiplyScalar(0.34);
      controls.target.lerp(desiredTarget, 0.045);
      if (state.autoOrbit) {
        const desiredCamera = selectedWorld.clone().normalize().multiplyScalar(2.8).add(new THREE.Vector3(0, 1.15, 6.7));
        camera.position.lerp(desiredCamera, 0.018);
      }
    }

    controls.update();
    renderer.render(scene, camera);

    if (elapsed - lastPoll > 0.8) {
      lastPoll = elapsed;
      pollCommands();
    }
    if (state.captureRequested) {
      state.captureRequested = false;
      capture4K();
    }

    requestAnimationFrame(animate);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  animate();
}

bootThreeAtlas().catch(async (error) => {
  console.warn("Three.js/WebGPU boot failed; loading Canvas fallback.", error);
  setRuntime("Canvas 2D fallback");
  await import("./app.js");
});
