/* ============================================================
 *  THREE-JS SCENE  (tablet + soft neon lighting + bloom)
 * ============================================================
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";

const canvas = document.getElementById("bg");
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06080e, 10, 50);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.25, 3.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap.enabled = true;

/* ---------- Lights ------------------------------------------------- */
const ambient = new THREE.AmbientLight(0x0c1640, 1.2);
scene.add(ambient);

const key = new THREE.PointLight(0x11f4ff, 3, 10);
key.position.set(2, 3, 2);
scene.add(key);

const rim = new THREE.PointLight(0x0040ff, 2, 10);
rim.position.set(-2, 2, -2);
scene.add(rim);

/* ---------- GLTF load ---------------------------------------------- */
const loader = new GLTFLoader();
loader.load(
  "./scene.gltf",
  gltf => {
    const tablet = gltf.scene;
    tablet.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = obj.receiveShadow = true;
        // Subtle emissive bloom:
        obj.material.emissive = new THREE.Color(0x11f4ff).multiplyScalar(0.15);
        obj.material.metalness = 0.6;
        obj.material.roughness = 0.2;
      }
    });
    scene.add(tablet);
  },
  undefined,
  err => console.error("GLTF load error:", err)
);

/* ---------- Post-processing bloom ---------------------------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.8,   // strength
  0.4,   // radius
  0.85   // threshold
);
composer.addPass(bloomPass);

/* ---------- Interaction -------------------------------------------- */
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 5;
controls.target.set(0, 1, 0);
controls.update();

/* ---------- Resize -------------------------------------------------- */
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* ---------- Animation loop ----------------------------------------- */
(function anim() {
  requestAnimationFrame(anim);
  composer.render();
})();

/* ============================================================
 *  UI LOGIC  (unchanged core — only DOM selectors differ)
 * ============================================================
 */
document.addEventListener("DOMContentLoaded", () => {
  //  ▸ Toggle gradient vs solid colour
  const solidRadio = document.getElementById("colorModeSolid");
  const gradientRadio = document.getElementById("colorModeGradient");
  const solidBlock = document.getElementById("solidColorOptions");
  const gradBlock  = document.getElementById("gradientOptions");

  function refreshColourUI() {
    solidBlock.classList.toggle("d-none", !solidRadio.checked);
    gradBlock.classList.toggle("d-none", !gradientRadio.checked);
  }
  solidRadio.onchange = gradientRadio.onchange = refreshColourUI;
  refreshColourUI();

  //  ▸ Dark / light mode toggle
  const themeBtn = document.getElementById("theme-toggle");
  themeBtn.onclick = () => {
    document.body.classList.toggle("light");
    themeBtn.innerHTML = document.body.classList.contains("light")
      ? '<i class="bi bi-brightness-low-fill"></i>'
      : '<i class="bi bi-moon-stars"></i>';
  };
});

/* ---------- Generate QR code --------------------------------------- */
async function generateQRCode() {
  const url = document.getElementById("url").value.trim();
  if (!url) { alert("Please enter a URL"); return; }

  const moduleShape = document.getElementById("moduleShape").value;
  const colorMode   = document.querySelector("input[name=colorMode]:checked").value;
  const backColor   = document.getElementById("backColor").value;
  const logoFile    = document.getElementById("logo").files[0];

  const payload = { url, moduleShape, colorMode, backColor };

  if (colorMode === "solid") {
    payload.fillColor = document.getElementById("fillColor").value;
  } else {
    payload.gradientType   = document.getElementById("gradientType").value;
    payload.gradientColor1 = document.getElementById("gradientColor1").value;
    payload.gradientColor2 = document.getElementById("gradientColor2").value;
  }

  if (logoFile) {
    payload.logo = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(logoFile);
    });
  }

  try {
    const resp = await fetch("/api/qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const { error = "Server error" } = await resp.json();
      alert(error); return;
    }

    const { image } = await resp.json();
    displayQRCode(image);
  } catch (err) {
    console.error(err);
    alert("Failed to reach server.");
  }
}

function displayQRCode(dataURL) {
  const wrap = document.getElementById("qrcode");
  wrap.innerHTML = "";

  const img = new Image();
  img.src = dataURL;
  img.alt = "QR Code";
  img.style.maxWidth = "100%";
  img.style.borderRadius = "var(--radius)";
  img.style.boxShadow = "var(--shadow)";
  wrap.appendChild(img);

  // Download button
  const dl = document.createElement("button");
  dl.textContent = "Download";
  dl.className = "btn btn-secondary mt-3";
  dl.onclick = () => {
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "qr_code.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  wrap.appendChild(dl);
}
