import './style.css'
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- CONFIGURATION GLOBALE ---
const video = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;

// --- PARTIE 1 : CONFIGURATION DE THREE.JS (LE RENDU 3D) ---

// 1. Créer la scène
const scene = new THREE.Scene();
// Ajout d'un brouillard léger pour donner de la profondeur et cacher les bords
scene.fog = new THREE.FogExp2(0x000000, 0.035);

// 2. Créer la caméra
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

// 3. Créer le renderer (le moteur d'affichage)
const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// 4. Créer l'objet 3D (similaire à la structure en fil de fer de la vidéo)
// On utilise un TorusKnot pour une forme complexe intéressante
const geometry = new THREE.TorusKnotGeometry(10, 3, 100, 16);
// Matériau en fil de fer (wireframe) bleu cyan brillant
const material = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    wireframe: true,
    transparent: true,
    opacity: 0.8
});
const torusKnot = new THREE.Mesh(geometry, material);
scene.add(torusKnot);

// Ajout d'un système de particules pour l'ambiance "espace"
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);
for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 200; // Répandre les particules
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
    size: 0.2,
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending
});
const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);


// Gérer le redimensionnement de la fenêtre
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// --- PARTIE 2 : CONFIGURATION DE MEDIAPIPE (IA DE SUIVI DES MAINS) ---

// Fonction asynchrone pour charger le modèle IA
async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        // Utilisation du CDN officiel de Google pour charger les fichiers WASM nécessaires
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU" // Utiliser le GPU pour de meilleures performances
        },
        runningMode: "VIDEO",
        numHands: 1 // On ne suit qu'une seule main
    });
    
    // Une fois le modèle chargé, on active la webcam
    enableCam();
}

// Fonction pour activer la webcam
function enableCam() {
    if (!handLandmarker) {
        console.log("Attendez ! HandLandmarker n'est pas encore chargé.");
        return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720,
                frameRate: { ideal: 30 }
            }
        }).then(function (stream) {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
            webcamRunning = true;
        }).catch(err => {
            console.error("Erreur d'accès à la webcam: ", err);
            alert("L'accès à la webcam est nécessaire pour que la démo fonctionne.");
        });
    }
}


// --- PARTIE 3 : BOUCLE D'ANIMATION PRINCIPALE ---

// Cette fonction tourne en boucle le plus vite possible (ex: 60fps)
async function predictWebcam() {
    // 1. Mettre à jour la détection IA si une nouvelle frame vidéo est disponible
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        // Envoyer l'image vidéo à MediaPipe
        results = handLandmarker.detectForVideo(video, performance.now());
    }

    // 2. Utiliser les résultats pour contrôler l'objet 3D
    if (results && results.landmarks && results.landmarks.length > 0) {
        // Nous avons détecté une main
        const landmarks = results.landmarks[0];

        // Calculer un point central approximatif de la main (la paume)
        // Le point 0 est le poignet, 9 est l'articulation centrale du majeur
        const palmBaseX = landmarks[0].x;
        const palmBaseY = landmarks[0].y;
        const middleFingerX = landmarks[9].x;
        const middleFingerY = landmarks[9].y;

        // Calculer le centre moyen entre le poignet et le milieu de la main
        const centerX = (palmBaseX + middleFingerX) / 2;
        const centerY = (palmBaseY + middleFingerY) / 2;

        // --- MAPPAGE DES MOUVEMENTS ---
        // Les coordonnées de MediaPipe vont de 0.0 à 1.0.
        // 0.5 est le centre de l'écran.
        // On mappe la position X de la main sur la rotation Y de l'objet (gauche/droite)
        // On inverse la direction pour un effet "miroir" naturel
        const targetRotationY = (centerX - 0.5) * (Math.PI * 2); // Rotation complète possible
        
        // On mappe la position Y de la main sur la rotation X de l'objet (haut/bas)
        const targetRotationX = (centerY - 0.5) * (Math.PI); // Demi-rotation

        // --- INTERPOLATION (LISSAGE) ---
        // Au lieu de téléporter l'objet à la nouvelle rotation, on s'en approche doucement
        // pour éviter les tremblements. Le facteur 0.1 détermine la vitesse de suivi.
        torusKnot.rotation.y += (targetRotationY - torusKnot.rotation.y) * 0.1;
        torusKnot.rotation.x += (targetRotationX - torusKnot.rotation.x) * 0.1;
        
        // Changer légèrement la couleur si le poing est fermé (bonus, comme dans la vidéo)
        // On mesure la distance entre le bout de l'index (8) et la paume (0)
        const dx = landmarks[8].x - landmarks[0].x;
        const dy = landmarks[8].y - landmarks[0].y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 0.15) {
             // Poing fermé (approximatif) -> teinte plus bleue/foncée
             material.color.setHex(0x0055ff);
        } else {
             // Main ouverte -> retour au cyan brillant
             material.color.setHex(0x00ffff);
        }

    } else {
        // Si aucune main n'est détectée, on ajoute une rotation automatique lente
        torusKnot.rotation.y += 0.005;
        torusKnot.rotation.x += 0.002;
        material.color.setHex(0x00ffff); // Reset couleur
    }

    // Animation lente des particules d'arrière-plan
    particlesMesh.rotation.y += 0.0005;

    // 3. Rendre la scène 3D
    renderer.render(scene, camera);

    // Relancer la boucle pour la prochaine frame
    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// --- Lancement de l'application ---
// On démarre le chargement du modèle IA dès que le script est lu.
createHandLandmarker();