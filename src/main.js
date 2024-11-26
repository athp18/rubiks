import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import dat from 'dat.gui';

// -------------------- Scene Setup -------------------- //
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

// -------------------- Camera Setup -------------------- //
const camera = new THREE.PerspectiveCamera(
    45, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
);

const defaultPosition = [8, 3, 7.5];
camera.position.set(...defaultPosition);
camera.lookAt(0, 0, 0);

// -------------------- Renderer Setup -------------------- //
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// -------------------- Controls Setup -------------------- //
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// -------------------- Lighting Setup -------------------- //
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Increased from 0.8 to 1.2
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased from 0.8 to 1.0
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Increase intensity of additional lights
const frontLight = new THREE.DirectionalLight(0xffffff, 0.8); // Increased from 0.5 to 0.8
frontLight.position.set(0, 0, 10);
scene.add(frontLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.6); // Increased from 0.3 to 0.6
backLight.position.set(0, 0, -10);
scene.add(backLight);

// Add two new lights for better coverage
const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
topLight.position.set(0, 10, 0);
scene.add(topLight);

const bottomLight = new THREE.DirectionalLight(0xffffff, 0.3);
bottomLight.position.set(0, -10, 0);
scene.add(bottomLight);

// -------------------- Rubik's Cube Setup -------------------- //
const colors = {
    'U': 0xFFFFFF,  // Up - White
    'D': 0xFFD500,  // Down - Yellow
    'F': 0x009B48,  // Front - Green
    'B': 0x0046AD,  // Back - Blue
    'R': 0xB71234,  // Right - Red
    'L': 0xFF5800   // Left - Orange
};

// Function to create materials for each face
const createMaterials = () => {
    const materials = {};
    Object.entries(colors).forEach(([face, color]) => {
        materials[face] = new THREE.MeshPhongMaterial({
            color,
            shininess: 80,
            specular: 0x666666,
            emissive: 0x111111
        });
    });
    // Material for internal faces (no color)
    materials[''] = new THREE.MeshPhongMaterial({
        color: 0x222222,
        shininess: 80,
        specular: 0x666666,
        emissive: 0x111111
    });
    return materials;
};

const materials = createMaterials();
const cubieStates = new Map();

// -------------------- Cubie Creation -------------------- //
function createCubie(x, y, z, size, bevelSize) {
    const position = new THREE.Vector3(x, y, z);

    const geometry = new THREE.BoxGeometry(
        size - bevelSize * 2,
        size - bevelSize * 2,
        size - bevelSize * 2
    );

    const materialsArray = [
        (x === 1) ? materials.R : materials[''], // Right Face
        (x === -1) ? materials.L : materials[''], // Left Face
        (y === 1) ? materials.U : materials[''], // Top Face
        (y === -1) ? materials.D : materials[''], // Bottom Face
        (z === 1) ? materials.F : materials[''], // Front Face
        (z === -1) ? materials.B : materials['']  // Back Face
    ];

    const cubie = new THREE.Mesh(geometry, materialsArray);

    const borderGeometry = new THREE.BoxGeometry(size, size, size);
    const border = new THREE.Mesh(
        borderGeometry,
        new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 0.9,
            roughness: 0.2,
            clearcoat: 0.4,
            transparent: true,
            opacity: 0.5
        })
    );
    border.scale.set(1.02, 1.02, 1.02);

    const cubieGroup = new THREE.Group();
    cubieGroup.add(border);
    cubieGroup.add(cubie);
    cubieGroup.position.copy(position);

    cubieStates.set(cubieGroup.uuid, {
        initialPosition: position.clone(),
        materials: materialsArray.map(m => m.clone())
    });

    return cubieGroup;
}

// -------------------- Complete Cube Creation -------------------- //
function createRubiksCube() {
    const rubiksCube = new THREE.Group();
    const size = 1;
    const bevelSize = 0.04;

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const cubie = createCubie(x, y, z, size, bevelSize);
                rubiksCube.add(cubie);
            }
        }
    }

    return rubiksCube;
}

// -------------------- Rotation Functions -------------------- //
// Helper function to update world matrices
function updateMatrices(object) {
    object.updateMatrix();
    object.updateMatrixWorld(true);
}

// Function to attach a cubie to a rotation group
function attachToGroup(cubie, group) {
    updateMatrices(cubie);
    updateMatrices(group);
    
    const matrix = new THREE.Matrix4();
    matrix.copy(group.matrixWorld).invert().multiply(cubie.matrixWorld);
    
    cubie.matrix.copy(matrix);
    cubie.matrix.decompose(cubie.position, cubie.quaternion, cubie.scale);
    
    group.add(cubie);
    updateMatrices(group);
}

// Function to detach a cubie from a rotation group back to the main cube
function detachFromGroup(cubie, group, mainCube) {
    updateMatrices(cubie);
    updateMatrices(group);
    
    const matrix = new THREE.Matrix4();
    matrix.copy(mainCube.matrixWorld).invert().multiply(cubie.matrixWorld);
    
    cubie.matrix.copy(matrix);
    cubie.matrix.decompose(cubie.position, cubie.quaternion, cubie.scale);
    
    mainCube.add(cubie);
    updateMatrices(mainCube);
}

// -------------------- Shuffling Functions -------------------- //

const rotationQueue = [];
let isShuffling = false;

// -------------------- GUI Setup -------------------- //
const gui = new dat.GUI();
const rotationFolder = gui.addFolder('Rotation Controls');

// GUI parameters object
const guiParams = {
    isRotating: false,
    speed: 1,
    shuffleSpeed: 1, // Added shuffleSpeed parameter
    axis: {
        x: 0,
        y: 0,
        z: 0
    },
    presets: 'None',
    resetRotation: () => {
        cubeGroup.rotation.set(0, 0, 0);
        camera.position.set(...defaultPosition);
    }
};

// Add rotation toggle
rotationFolder.add(guiParams, 'isRotating').name('Rotation Active')
    .onChange(value => {
        isRotating = value;
        infoDiv.innerText = `Rotation: ${value ? 'On' : 'Off'}`;
    });

// Add speed control
rotationFolder.add(guiParams, 'speed', 0.1, 5).name('Rotation Speed')
    .onChange(value => {
        rotationSpeed = (Math.PI / 180) * value;
    });

// Add shuffle speed control
rotationFolder.add(guiParams, 'shuffleSpeed', 0.1, 5).name('Shuffle Speed'); // Added shuffleSpeed control

// Add axis controls
const axisFolder = rotationFolder.addFolder('Rotation Axis');
axisFolder.add(guiParams.axis, 'x', -1, 1).name('X Axis')
    .step(1)
    .onChange(value => rotationAxis.x = value);
axisFolder.add(guiParams.axis, 'y', -1, 1).name('Y Axis')
    .step(1)
    .onChange(value => rotationAxis.y = value);
axisFolder.add(guiParams.axis, 'z', -1, 1).name('Z Axis')
    .step(1)
    .onChange(value => rotationAxis.z = value);

// Add preset rotations
const presets = {
    'None': [0, 0, 0],
    'X Axis': [1, 0, 0],
    'Y Axis': [0, 1, 0],
    'Z Axis': [0, 0, 1],
    'Diagonal': [1, 1, 1]
};

rotationFolder.add(guiParams, 'presets', Object.keys(presets))
    .name('Preset Rotations')
    .onChange(value => {
        const [x, y, z] = presets[value];
        guiParams.axis.x = x;
        guiParams.axis.y = y;
        guiParams.axis.z = z;
        rotationAxis.x = x;
        rotationAxis.y = y;
        rotationAxis.z = z;
        for (const controller of axisFolder.__controllers) {
            controller.updateDisplay();
        }
    });

// Add reset button
rotationFolder.add(guiParams, 'resetRotation').name('Reset Position');

// Open the folder by default
rotationFolder.open();

// -------------------- Rotation Functions Continued -------------------- //
async function rotateLayerAnimated(axis, layer, angle) {
    return new Promise((resolve) => {
        const epsilon = 0.1;
        // Modify rotationSpeed based on shuffleSpeed from GUI
        const rotationSpeed = 1.75 * Math.PI * guiParams.shuffleSpeed; // Adjusted rotation speed

        updateMatrices(rubiksCube);
        
        const matrix = new THREE.Matrix4();
        matrix.copy(rubiksCube.matrixWorld).invert();
        
        const cubiesToRotate = [];
        
        rubiksCube.children.forEach(cubie => {
            const localPosition = cubie.getWorldPosition(new THREE.Vector3())
                .applyMatrix4(matrix);
            
            if (Math.abs(localPosition[axis] - layer) < epsilon) {
                cubiesToRotate.push(cubie);
            }
        });

        if (cubiesToRotate.length === 0) {
            console.warn(`No cubies found in layer ${layer} along axis ${axis}`);
            resolve();
            return;
        }

        const rotationGroup = new THREE.Group();
        rotationGroup.updateMatrixWorld();
        rubiksCube.add(rotationGroup);
        
        updateMatrices(rubiksCube);

        cubiesToRotate.forEach(cubie => {
            attachToGroup(cubie, rotationGroup);
        });

        let progress = 0;
        const targetAngle = angle;
        
        function animateRotation() {
            if (progress < Math.abs(targetAngle)) {
                const delta = Math.min(rotationSpeed * (1/60), Math.abs(targetAngle) - progress);
                rotationGroup.rotation[axis] += Math.sign(targetAngle) * delta;
                progress += delta;
                requestAnimationFrame(animateRotation);
            } else {
                // Ensure final angle is exact
                rotationGroup.rotation[axis] = targetAngle;
                
                cubiesToRotate.forEach(cubie => {
                    detachFromGroup(cubie, rotationGroup, rubiksCube);
                    
                    // Round positions and rotations
                    cubie.position.x = Math.round(cubie.position.x);
                    cubie.position.y = Math.round(cubie.position.y);
                    cubie.position.z = Math.round(cubie.position.z);
                    
                    cubie.rotation.x = Math.round(cubie.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
                    cubie.rotation.y = Math.round(cubie.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
                    cubie.rotation.z = Math.round(cubie.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
                    
                    updateMatrices(cubie);
                });

                rubiksCube.remove(rotationGroup);
                updateMatrices(rubiksCube);
                resolve();
            }
        }

        animateRotation();
    });
}

async function processRotationQueue() {
    if (rotationQueue.length === 0) {
        isShuffling = false;
        return;
    }

    const { axis, layer, angle } = rotationQueue.shift();
    await rotateLayerAnimated(axis, layer, angle);
    
    // Process next rotation in queue
    processRotationQueue();
}

// Function to shuffle the cube with animated rotations
async function shuffleCube() {
    if (isShuffling) return; // Prevent multiple shuffle operations
    
    isShuffling = true;
    const numShuffles = 20;
    const axes = ['x', 'y', 'z'];
    const layers = [-1, 0, 1];
    
    // Clear existing queue
    rotationQueue.length = 0;
    
    // Create shuffle moves
    for (let i = 0; i < numShuffles; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const layer = layers[Math.floor(Math.random() * layers.length)];
        const angle = (Math.PI / 2) * (Math.random() < 0.5 ? 1 : -1);
        
        rotationQueue.push({ axis, layer, angle });
    }
    
    // Start processing the queue
    processRotationQueue();
}

// -------------------- UI Elements -------------------- //
// Function to create a shuffle button
function createShuffleButton() {
    const button = document.createElement('button');
    button.innerText = "Shuffle Cube";
    button.style.position = 'absolute';
    button.style.top = '10px';
    button.style.left = '10px';
    button.style.padding = '10px 20px';
    button.style.fontSize = '16px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';
    document.body.appendChild(button);
    
    button.onclick = () => {
        if (!isShuffling) {
            shuffleCube();
        }
    };
}

// Function to create an information div
function createInfoDiv() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'info';
    infoDiv.style.position = 'absolute';
    infoDiv.style.bottom = '10px';
    infoDiv.style.left = '10px';
    infoDiv.style.color = 'white';
    infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    infoDiv.style.padding = '5px';
    infoDiv.style.borderRadius = '5px';
    infoDiv.style.whiteSpace = 'pre-line';
    document.body.appendChild(infoDiv);
    return infoDiv;
}

// Function to display the camera's position
function displayCameraPosition() {
    const { x, y, z } = camera.position;
    let positionDiv = document.getElementById('cameraPosition');
    if (!positionDiv) {
        positionDiv = document.createElement('div');
        positionDiv.id = 'cameraPosition';
        positionDiv.style.position = 'absolute';
        positionDiv.style.bottom = '60px';
        positionDiv.style.left = '10px';
        positionDiv.style.color = 'white';
        positionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        positionDiv.style.padding = '5px';
        positionDiv.style.borderRadius = '5px';
        positionDiv.style.whiteSpace = 'pre-line';
        document.body.appendChild(positionDiv);
    }
    positionDiv.innerText = `Camera Position:\n x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`;
}

// -------------------- Create and Add Cube -------------------- //
// Create a parent group for the cube to handle global rotations
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// Create the Rubik's Cube and add it to the parent group
let rubiksCube = createRubiksCube();
cubeGroup.add(rubiksCube);

// -------------------- Add Helpers -------------------- //
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// -------------------- Rotation Controls -------------------- //
let isRotating = false;
let rotationSpeed = Math.PI / 180 * 1; // Initial rotation speed
const rotationAxis = { x: 0, y: 0, z: 0 };

// -------------------- Event Listeners -------------------- //
const infoDiv = createInfoDiv();

window.addEventListener('keydown', (event) => {
    if (event.key === 'c' || event.key === 'C') {
        guiParams.isRotating = !guiParams.isRotating;
        isRotating = guiParams.isRotating;
        if (isRotating) {
            guiParams.axis.x = 1;
            guiParams.axis.y = 1;
            guiParams.axis.z = 1;
            rotationAxis.x = 1;
            rotationAxis.y = 1;
            rotationAxis.z = 1;
            guiParams.presets = 'Diagonal';
        } else {
            guiParams.axis.x = 0;
            guiParams.axis.y = 0;
            guiParams.axis.z = 0;
            rotationAxis.x = 0;
            rotationAxis.y = 0;
            rotationAxis.z = 0;
            guiParams.presets = 'None';
        }
        // Update GUI controllers
        for (const controller of gui.__controllers) {
            controller.updateDisplay();
        }
        for (const controller of axisFolder.__controllers) {
            controller.updateDisplay();
        }
        infoDiv.innerText = `Rotation: ${isRotating ? 'On' : 'Off'}`;
    }
    if (event.key === 'r' || event.key === 'R') {
        guiParams.resetRotation();
    }
    if (event.key === 's' || event.key === 'S') {
        // Reset the Rubik's Cube
        resetRubiksCube();
        console.log('Unshuffled');
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------- Initialize UI -------------------- //
createShuffleButton();
displayCameraPosition();
controls.addEventListener('change', displayCameraPosition);

// -------------------- Animation Loop -------------------- //
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const delta = clock.getDelta();

    if (isRotating) {
        const axisVector = new THREE.Vector3(rotationAxis.x, rotationAxis.y, rotationAxis.z).normalize();
        if (axisVector.length() === 0) {
            console.log("don't rotate on axis 0")
        } else {
            cubeGroup.rotateOnAxis(axisVector, rotationSpeed);
        }
    }

    renderer.render(scene, camera);
}

animate();

// -------------------- Reset Functionality -------------------- //

// Function to reset the Rubik's Cube to its initial state
function resetRubiksCube() {
    // Remove the existing Rubik's Cube from the scene
    cubeGroup.remove(rubiksCube);

    // Clear the cubieStates map
    cubieStates.clear();

    // Create a new Rubik's Cube
    rubiksCube = createRubiksCube();

    // Add the new Rubik's Cube to the scene
    cubeGroup.add(rubiksCube);
}