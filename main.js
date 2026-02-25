import * as THREE from 'three';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

const video = document.getElementById('webcam');
const canvas3D = document.getElementById('output_canvas');
const canvasHand = document.getElementById('hand_canvas');
const ctxHand = canvasHand.getContext('2d');

let handLandmarker;
let lastVideoTime = -1;

// --- 1. CONFIGURATION SCÈNE 3D (L'ESPACE) ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000005); // Noir profond

// Étoiles de fond (Particules)
const particlesCount = 5000;
const posArray = new Float32Array(particlesCount * 3);
const velocityArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 200;
    velocityArray[i] = 0;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.15,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// L'objet central (Planète/Structure)
const geometry = new THREE.IcosahedronGeometry(10, 2);
const material = new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true, transparent: true, opacity: 0.5 });
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// --- 2. INITIALISATION IA ---
async function initIA() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    startWebcam();
}

function startWebcam() {
    canvasHand.width = window.innerWidth;
    canvasHand.height = window.innerHeight;
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", renderLoop);
    });
}

// --- 3. BOUCLE DE RENDU ---
const drawingUtils = new DrawingUtils(ctxHand);

function renderLoop() {
    ctxHand.clearRect(0, 0, canvasHand.width, canvasHand.height);
    
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, performance.now());
        
        const positions = particlesGeometry.attributes.position.array;

        if (results.landmarks && results.landmarks[0]) {
            const hand = results.landmarks[0];
            
            // DESSIN DU SQUELETTE (Effet néon bleu)
            drawingUtils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color: "#00d4ff", lineWidth: 2 });
            drawingUtils.drawLandmarks(hand, { color: "#ffffff", lineWidth: 1, radius: 2 });

            // INTERACTION PARTICULES
            const centerX = (hand[9].x - 0.5) * 100; // Normalisation vers l'espace 3D
            const centerY = -(hand[9].y - 0.5) * 100;

            for (let i = 0; i < particlesCount; i++) {
                const i3 = i * 3;
                const dx = centerX - positions[i3];
                const dy = centerY - positions[i3 + 1];
                const dist = Math.sqrt(dx*dx + dy*dy);

                if(dist < 30) {
                    positions[i3] -= dx * 0.01; // Attraction vers la main
                    positions[i3+1] -= dy * 0.01;
                }
            }
            particlesGeometry.attributes.position.needsUpdate = true;

            // ROTATION OBJET CENTRAL
            sphere.rotation.x = centerY * 0.05;
            sphere.rotation.y = centerX * 0.05;
            material.opacity = 0.8;
        } else {
            // Animation par défaut
            sphere.rotation.y += 0.01;
            material.opacity = 0.3;
        }
    }

    particlesMesh.rotation.z += 0.001; // Rotation lente de l'univers
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
}

initIA();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvasHand.width = window.innerWidth;
    canvasHand.height = window.innerHeight;
});