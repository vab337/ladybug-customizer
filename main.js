import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';



let model, basePart, wingsPart, hookPart;


const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f0e6); // light beige


// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0.5, 2);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
renderer.outputEncoding = THREE.sRGBEncoding;



// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = true;

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
const ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);
light.position.set(5, 5, 7.5);
scene.add(light);

light.castShadow = true;
// Optional: improve shadow quality
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 50;
light.shadow.radius = 8;


// Load texture config and model
const textureLoader = new THREE.TextureLoader();
let textureConfig = {};



fetch('/config/texture-options.json')
  .then(res => res.json())
  .then(config => {
    textureConfig = config;
    createMaterialButtons(textureConfig);
    const texturePath = textureConfig.base.lightwood;
    const texture = textureLoader.load(texturePath);

    const loader = new GLTFLoader();
    loader.load('/models/ladybug_3.glb', (gltf) => {
      model = gltf.scene;
      model.position.set(0, 0.2, 0);

      // Find parts by name and apply texture to 'Base'
model.traverse((child) => {
  if (!child.isMesh) return;

  console.log('Mesh found:', child.name); // Debug log

  const name = child.name.toLowerCase();

  if (child.isMesh) {
  child.castShadow = true;
  child.receiveShadow = true;
}


  if (name === 'base') {
    basePart = child;
    basePart.material = basePart.material.clone(); // ensure independent material
    basePart.material.map = texture;
    basePart.material.metalness = 0;
    basePart.material.needsUpdate = true;
  }

  if (name === 'wings') {
    wingsPart = child;
    wingsPart.material = wingsPart.material.clone();
    wingsPart.material.metalness = 0;
  }

  if (name === 'hook') {
    hookPart = child;
    hookPart.material = hookPart.material.clone();
     hookPart.material.metalness = 0;
  }
});


      scene.add(model);

      const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.ShadowMaterial({ opacity: 0.2 }) // transparent shadow-only surface
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1; // adjust based on model
ground.receiveShadow = true;
scene.add(ground);


    }, undefined, (error) => {
      console.error('Failed to load model:', error);
    });
  });

function applyTexture(part, variant) {
  const entry = textureConfig[part]?.[variant];
  if (!entry || typeof entry !== 'object') return;

  const baseMap = textureLoader.load(entry.color);
  const roughnessMap = entry.roughness ? textureLoader.load(entry.roughness) : null;
  const normalMap = entry.normal ? textureLoader.load(entry.normal) : null;

  [baseMap, roughnessMap, normalMap].forEach((tex) => {
  if (tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2); // adjust to fit your model
  }
});

  // Optional: ensure sRGB color encoding for color map
  baseMap.encoding = THREE.sRGBEncoding;

  let target = null;
  if (part === 'base') target = basePart;
  else if (part === 'wings') target = wingsPart;
  else if (part === 'hook') target = hookPart;

  if (!target) {
    console.warn(`No mesh assigned for part: ${part}`);
    return;
  }

  // Clone and update material
  target.material = target.material.clone();
  target.material.map = baseMap;

  if (roughnessMap) {
    target.material.roughnessMap = roughnessMap;
    target.material.roughness = 1.0; // let the map control it
  }

  if (normalMap) {
    target.material.normalMap = normalMap;
    target.material.normalScale = new THREE.Vector2(1, 1); // tweak if too bumpy
  }

  target.material.metalness = 0;
  target.material.needsUpdate = true;
}





// Button events
function createMaterialButtons(textureConfig) {
  const container = document.getElementById('material-selector');
  if (!container) {
    console.error("⚠️ Couldn't find #material-selector in the DOM");
    return;
  }

  Object.entries(textureConfig).forEach(([part, options]) => {
    const partBtn = document.createElement('div');
    partBtn.className = 'part-button';

    const title = document.createElement('div');
    title.className = 'part-title';
    title.textContent = part.toUpperCase();
    partBtn.appendChild(title);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'material-options';

    Object.entries(options).forEach(([key, value]) => {
      const option = document.createElement('div');
      option.className = 'material-option';

      const img = document.createElement('img');
      img.src = value.preview;
      img.alt = value.label || key;

      const label = document.createElement('span');
      label.textContent = value.label || key;

      option.appendChild(img);
      option.appendChild(label);

      option.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent click from bubbling up
        applyTexture(part, key);
        partBtn.classList.remove('expanded');
      });

      optionsContainer.appendChild(option);
    });

    partBtn.appendChild(optionsContainer);

    partBtn.addEventListener('click', () => {
      // Toggle expansion
      document.querySelectorAll('.part-button').forEach(btn => {
        if (btn !== partBtn) btn.classList.remove('expanded');
      });
      partBtn.classList.toggle('expanded');
    });

    container.appendChild(partBtn);
  });
}




// Mouse-drag rotation for full model
let isMouseDown = false;
let previousX = 0;

window.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  previousX = e.clientX;
});

window.addEventListener('mouseup', () => {
  isMouseDown = false;
});

window.addEventListener('mousemove', (e) => {
  if (!isMouseDown || !model) return;
  const deltaX = e.clientX - previousX;
  previousX = e.clientX;
  model.rotation.y += deltaX * 0.01;
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// Add helpers for debugging

const helper = new THREE.DirectionalLightHelper(light, 1);
scene.add(helper)