import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RobotUnit } from '../types/fleet';
import { buildAmrRobot } from './amrBuilder';
import {
  createAmrVisorTexture,
  createCardboardTexture,
  createContactShadowTexture,
  createGreenRackTexture,
  createSolarRackTexture,
  createWarehouseFloorTexture,
  detectSoftwareWebGL,
} from './sharedMaterials';

interface PathPoint {
  x: number;
  z: number;
}

interface AnimatedRobot {
  unit: RobotUnit;
  group: THREE.Group;
  path: PathPoint[];
  progress: number;
  hitBox: THREE.Mesh;
}

export interface CalloutPosition {
  x: number;
  y: number;
  visible: boolean;
}

export interface WarehouseCallbacks {
  onSelectRobot: (robotId: string) => void;
  onCalloutMove: (pos: CalloutPosition) => void;
}

const _vec3 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

// Default camera matching the exact architectural tilt of the reference image
const DEFAULT_CAM_POS = new THREE.Vector3(-5.2, 22.2, 20.6);
const DEFAULT_TARGET = new THREE.Vector3(0.2, 0.25, 0.55);

export class WarehouseScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;

  private callbacks: WarehouseCallbacks;
  private selectedRobotId: string | null;
  private isLive = true;

  private robots: AnimatedRobot[] = [];
  private hitMeshes: THREE.Mesh[] = [];
  private robotGroupContainer = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private lastTime = performance.now();
  private lastW = 0;
  private lastH = 0;
  private frameId = 0;
  private disposed = false;

  // Camera transition state
  private cameraTransitioning = false;
  private desiredCamPos = DEFAULT_CAM_POS.clone();
  private desiredTarget = DEFAULT_TARGET.clone();

  // Shared procedural textures for cleanup
  private textures: THREE.Texture[] = [];
  private envMap: THREE.Texture;

  constructor(
    container: HTMLElement,
    robotUnits: RobotUnit[],
    initialSelectedId: string | null,
    callbacks: WarehouseCallbacks
  ) {
    this.container = container;
    this.selectedRobotId = initialSelectedId;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.lastW = width;
    this.lastH = height;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(29, width / height, 0.5, 120);
    this.camera.position.copy(DEFAULT_CAM_POS);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 48;
    this.controls.minPolarAngle = Math.PI * 0.14;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.cameraTransitioning = false;
    });

    this.setupLighting();
    this.buildWarehouseArchitecture();
    this.buildFleetRobots(robotUnits);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    const resizeObserver = new ResizeObserver(() => this.handleResize());
    resizeObserver.observe(this.container);
    (this as unknown as { _ro: ResizeObserver })._ro = resizeObserver;

    this.tick();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0xfafbf7, 0xc7c6bc, 0.72);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff9ef, 1.28);
    key.position.set(-14, 28, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 72;
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xeef4fa, 0.45);
    fill.position.set(18, 16, -12);
    this.scene.add(fill);
  }

  private buildWarehouseArchitecture(): void {
    const floorTex = createWarehouseFloorTexture(this.maxAnisotropy);
    const solarTex = createSolarRackTexture(this.maxAnisotropy);
    const greenRackTex = createGreenRackTexture(this.maxAnisotropy);
    const cardboardTex = createCardboardTexture(this.maxAnisotropy);
    const shadowTex = createContactShadowTexture();
    this.textures.push(floorTex, solarTex, greenRackTex, cardboardTex, shadowTex);

    // 1. Soft drop shadow under the entire warehouse slab
    const outerShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const outerShadow = new THREE.Mesh(new THREE.PlaneGeometry(33, 23), outerShadowMat);
    outerShadow.rotation.x = -Math.PI / 2;
    outerShadow.position.set(0.2, -0.35, 0.3);
    this.scene.add(outerShadow);

    // 2. Main Warehouse Floor Slab
    const slabBaseMat = new THREE.MeshStandardMaterial({
      color: 0xe6e6e0,
      roughness: 0.85,
      metalness: 0.02,
    });
    const floorTopMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex,
      roughness: 0.78,
      metalness: 0.03,
    });
    const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.36, 17.6), [
      slabBaseMat,
      slabBaseMat,
      floorTopMat,
      slabBaseMat,
      slabBaseMat,
      slabBaseMat,
    ]);
    floorSlab.position.set(0, -0.18, 0);
    floorSlab.receiveShadow = true;
    this.scene.add(floorSlab);

    // 3. Clean Architectural Cutaway Walls (Back, Left, Right, Partial Front)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf4f4f0,
      roughness: 0.65,
      metalness: 0.02,
    });
    const wallHeight = 3.2;
    const wallThick = 0.5;

    const addWall = (x: number, z: number, w: number, d: number, h = wallHeight) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };

    // Back wall
    addWall(0, -8.55, 27.2, wallThick);
    // Left wall
    addWall(-13.35, 0, wallThick, 17.6);
    // Right wall
    addWall(13.35, 0, wallThick, 17.6);
    // Front-left partial wall up to dock bays
    addWall(-9.35, 8.55, 8.5, wallThick, 2.2);

    // Helper to add soft baked contact shadow on floor under architectural masses
    const contactMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const addContactShadow = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), contactMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x + 0.16, 0.012, z + 0.16);
      this.scene.add(m);
    };

    // 4. Top Row: 6 Solar-Orange Automated High-Bay Pods + White Office/Shelf Bay
    const solarTopMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: solarTex,
      emissive: new THREE.Color(0x521506),
      emissiveIntensity: 0.42,
      roughness: 0.35,
      metalness: 0.08,
    });
    const rackFrameMat = new THREE.MeshStandardMaterial({
      color: 0xeeeee9,
      roughness: 0.6,
      metalness: 0.04,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x323633,
      roughness: 0.45,
      metalness: 0.55,
    });

    const orangePodXs = [-10.0, -6.4, -2.8, 0.8, 4.4, 10.7];
    orangePodXs.forEach((px) => {
      const pod = new THREE.Group();
      // Structural lower cabinet/rack base
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.48, 2.75), rackFrameMat);
      base.position.set(0, 0.74, 0);
      base.castShadow = true;
      base.receiveShadow = true;
      pod.add(base);

      // Slanted bright orange solar-grid cap
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.16, 2.68), solarTopMat);
      panel.position.set(0, 1.66, 0.04);
      panel.rotation.x = 0.22;
      panel.castShadow = true;
      pod.add(panel);

      pod.position.set(px, 0, -5.85);
      this.scene.add(pod);
      addContactShadow(px, -5.85, 3.2, 3.6);
    });

    // White Mezzanine Shelving Unit between pod 5 and pod 6 (x ≈ 7.6)
    const shelfBay = new THREE.Group();
    const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 0.15), wallMat);
    shelfBack.position.set(0, 1.05, -1.25);
    shelfBack.castShadow = true;
    shelfBay.add(shelfBack);

    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: cardboardTex,
      roughness: 0.84,
      metalness: 0.02,
    });
    const lightBinMat = new THREE.MeshStandardMaterial({
      color: 0xd8dad3,
      roughness: 0.65,
      metalness: 0.05,
    });

    for (let row = 0; row < 3; row++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 2.2), rackFrameMat);
      plank.position.set(0, 0.45 + row * 0.72, -0.15);
      plank.castShadow = true;
      shelfBay.add(plank);

      for (let c = -1; c <= 1; c++) {
        const bin = new THREE.Mesh(
          new THREE.BoxGeometry(0.56, 0.42, 0.54),
          (row + c) % 2 === 0 ? lightBinMat : boxMat
        );
        bin.position.set(c * 0.7, 0.7 + row * 0.72, -0.15);
        bin.castShadow = true;
        shelfBay.add(bin);
      }
    }
    shelfBay.position.set(7.6, 0, -5.95);
    this.scene.add(shelfBay);

    // 5. Middle Row: 6 Central Storage Rack Islands (4 Sage Green, 1 Light Gray, 1 Sage Green)
    const greenRackTopMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: greenRackTex,
      roughness: 0.5,
      metalness: 0.12,
    });
    const greenPostMat = new THREE.MeshStandardMaterial({
      color: 0x4b6a53,
      roughness: 0.48,
      metalness: 0.25,
    });

    const middleRackSpecs: Array<{ x: number; type: 'green' | 'gray' }> = [
      { x: -8.0, type: 'green' },
      { x: -4.6, type: 'green' },
      { x: -1.2, type: 'green' },
      { x: 2.2, type: 'green' },
      { x: 5.5, type: 'gray' },
      { x: 8.8, type: 'green' },
    ];

    middleRackSpecs.forEach(({ x, type }) => {
      const island = new THREE.Group();
      const w = 2.05;
      const d = 1.9;
      const h = 1.5;

      if (type === 'green') {
        // 4 corner posts
        [
          [-w / 2 + 0.06, -d / 2 + 0.06],
          [w / 2 - 0.06, -d / 2 + 0.06],
          [-w / 2 + 0.06, d / 2 - 0.06],
          [w / 2 - 0.06, d / 2 - 0.06],
        ].forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), greenPostMat);
          post.position.set(px, h / 2, pz);
          post.castShadow = true;
          island.add(post);
        });

        // Inner stacked inventory cartons
        const core = new THREE.Mesh(new THREE.BoxGeometry(w - 0.22, h - 0.24, d - 0.22), greenPostMat);
        core.position.set(0, (h - 0.24) / 2 + 0.05, 0);
        core.castShadow = true;
        core.receiveShadow = true;
        island.add(core);

        // Top slatted sage-green deck
        const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), greenRackTopMat);
        deck.position.set(0, h - 0.04, 0);
        deck.castShadow = true;
        island.add(deck);
      } else {
        // Light gray open rack with stacked boxes
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h, d - 0.1), rackFrameMat);
        frame.position.set(0, h / 2, 0);
        frame.castShadow = true;
        frame.receiveShadow = true;
        island.add(frame);

        for (let bx = -0.5; bx <= 0.5; bx += 0.5) {
          const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.5), boxMat);
          parcel.position.set(bx, h + 0.2, 0.25);
          parcel.castShadow = true;
          island.add(parcel);
        }
      }

      island.position.set(x, 0, -0.75);
      this.scene.add(island);
      addContactShadow(x, -0.75, 2.95, 2.8);
    });

    // 6. Bottom-Center-Right: 4 Loading Dock Bays + 4 Semi-Trucks
    const dockXs = [-3.9, -0.9, 2.1, 5.1];
    const truckWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8f9f7,
      roughness: 0.36,
      metalness: 0.1,
    });
    const dockWallMat = new THREE.MeshStandardMaterial({
      color: 0xe3e4de,
      roughness: 0.72,
      metalness: 0.02,
    });
    const cabGlassMat = new THREE.MeshStandardMaterial({
      color: 0x1b2024,
      roughness: 0.12,
      metalness: 0.8,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1e201f,
      roughness: 0.88,
      metalness: 0.05,
    });

    // Dock divider walls + recessed dock floor shadows
    [-5.4, -2.4, 0.6, 3.6, 6.6].forEach((wx) => {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.2, 5.5), dockWallMat);
      div.position.set(wx, 1.1, 5.85);
      div.castShadow = true;
      div.receiveShadow = true;
      this.scene.add(div);
    });

    dockXs.forEach((tx) => {
      const truck = new THREE.Group();
      addContactShadow(tx, 5.45, 2.4, 5.8);

      // Long trailer
      const trailer = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.85, 3.65), truckWhiteMat);
      trailer.position.set(0, 1.22, -0.45);
      trailer.castShadow = true;
      trailer.receiveShadow = true;
      truck.add(trailer);

      // Tractor cab facing +Z (out of bay)
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.76, 1.5, 1.35), truckWhiteMat);
      cab.position.set(0, 1.0, 2.05);
      cab.castShadow = true;
      cab.receiveShadow = true;
      truck.add(cab);

      // Windshield
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.54, 0.1), cabGlassMat);
      windshield.position.set(0, 1.24, 2.71);
      truck.add(windshield);

      // Front grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.38, 0.08), darkMetalMat);
      grille.position.set(0, 0.62, 2.71);
      truck.add(grille);

      // Truck tires
      [
        [-0.86, 2.25],
        [0.86, 2.25],
        [-0.86, 0.55],
        [0.86, 0.55],
        [-0.86, -1.6],
        [0.86, -1.6],
      ].forEach(([wx, wz]) => {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14),
          tireMat
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.3, wz);
        truck.add(wheel);
      });

      truck.position.set(tx, 0, 5.45);
      this.scene.add(truck);
    });

    // 7. Bottom-Left & Bottom-Right Pallet / Box Staging Clusters
    // Left wall white storage pallets
    [-11.8, -10.5].forEach((bx) => {
      [4.5, 5.9, 7.2].forEach((bz) => {
        const whiteBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 1.15, 0.95),
          lightBinMat
        );
        whiteBox.position.set(bx, 0.575, bz);
        whiteBox.castShadow = true;
        whiteBox.receiveShadow = true;
        this.scene.add(whiteBox);
      });
    });

    // Kraft carton stacks next to dock wall
    [-7.8, -6.7].forEach((bx) => {
      [5.2, 6.2, 7.2].forEach((bz, idx) => {
        const h = idx === 1 ? 1.55 : 1.05;
        const carton = new THREE.Mesh(new THREE.BoxGeometry(0.85, h, 0.85), boxMat);
        carton.position.set(bx, h / 2, bz);
        carton.castShadow = true;
        carton.receiveShadow = true;
        this.scene.add(carton);
      });
    });

    // Right staging area: kraft boxes & sage-green crates
    const crateGreenMat = new THREE.MeshStandardMaterial({
      color: 0x5c7962,
      roughness: 0.65,
      metalness: 0.08,
    });
    for (let gx = 7.7; gx <= 9.6; gx += 0.95) {
      for (let gz = 3.5; gz <= 7.2; gz += 0.95) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.05, 0.76), boxMat);
        crate.position.set(gx, 0.525, gz);
        crate.castShadow = true;
        crate.receiveShadow = true;
        this.scene.add(crate);
      }
    }
    for (let gx = 10.6; gx <= 12.4; gx += 0.9) {
      for (let gz = 2.6; gz <= 7.2; gz += 0.95) {
        const greenCrate = new THREE.Mesh(
          new THREE.BoxGeometry(0.74, 0.95, 0.74),
          crateGreenMat
        );
        greenCrate.position.set(gx, 0.475, gz);
        greenCrate.castShadow = true;
        greenCrate.receiveShadow = true;
        this.scene.add(greenCrate);
      }
    }

    // 8. Floor Routing Guide Lines (Green & Orange AGV Tracks)
    this.buildGuideLine(
      [
        [-11.0, -3.2],
        [4.5, -3.2],
        [4.5, 1.6],
        [-9.2, 1.6],
        [-9.2, -3.2],
      ],
      0x4e8c5e
    );
    this.buildGuideLine(
      [
        [-6.2, -3.2],
        [-6.2, 1.6],
      ],
      0x4e8c5e
    );
    this.buildGuideLine(
      [
        [-2.8, -3.2],
        [-2.8, 1.6],
      ],
      0x4e8c5e
    );
    this.buildGuideLine(
      [
        [0.8, -3.2],
        [0.8, 1.6],
      ],
      0x4e8c5e
    );
    this.buildGuideLine(
      [
        [4.5, 1.6],
        [9.8, 1.6],
        [9.8, -3.2],
        [4.5, -3.2],
      ],
      0x4e8c5e
    );
    // Orange express loop lines
    this.buildGuideLine(
      [
        [-11.2, -3.5],
        [-11.2, 1.2],
        [-8.6, 1.2],
      ],
      0xe6883e
    );
    this.buildGuideLine(
      [
        [4.5, -3.5],
        [10.8, -3.5],
        [10.8, 1.2],
        [8.4, 1.2],
      ],
      0xe6883e
    );
    this.buildGuideLine(
      [
        [-6.2, 1.6],
        [-6.2, 4.8],
      ],
      0xe6883e
    );
  }

  private buildGuideLine(points: Array<[number, number]>, colorHex: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i];
      const [x2, z2] = points[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;

      const geo = new THREE.PlaneGeometry(len + 0.08, 0.085);
      geo.rotateX(-Math.PI / 2);
      const seg = new THREE.Mesh(geo, mat);
      seg.position.set((x1 + x2) / 2, 0.018, (z1 + z2) / 2);
      seg.rotation.y = -Math.atan2(dz, dx);
      this.scene.add(seg);
    }
  }

  private fleetCardboardTex: THREE.Texture | null = null;
  private fleetOrangeVisor: THREE.Texture | null = null;
  private fleetGreenVisor: THREE.Texture | null = null;

  private buildFleetRobots(units: RobotUnit[]): void {
    if (!this.robotGroupContainer.parent) {
      this.scene.add(this.robotGroupContainer);
    }

    if (!this.fleetCardboardTex) {
      this.fleetCardboardTex = createCardboardTexture(this.maxAnisotropy);
      this.fleetOrangeVisor = createAmrVisorTexture(this.maxAnisotropy, '#ff6838');
      this.fleetGreenVisor = createAmrVisorTexture(this.maxAnisotropy, '#58c977');
      this.textures.push(
        this.fleetCardboardTex,
        this.fleetOrangeVisor,
        this.fleetGreenVisor
      );
    }

    const cardboardTex = this.fleetCardboardTex;
    const orangeVisor = this.fleetOrangeVisor!;
    const greenVisor = this.fleetGreenVisor!;

    const paths: PathPoint[][] = [
      // Path 0 (AMR-024 prominent middle-upper aisle)
      [
        { x: -3.2, z: -2.8 },
        { x: 2.8, z: -2.8 },
        { x: 2.8, z: 1.55 },
        { x: -3.2, z: 1.55 },
      ],
      // Path 1 (AMR-017 lower-mid aisle)
      [
        { x: -6.2, z: 1.6 },
        { x: 1.2, z: 1.6 },
        { x: 1.2, z: -3.15 },
        { x: -6.2, z: -3.15 },
      ],
      // Path 2 (AMR-012 left aisle)
      [
        { x: -11.2, z: -3.3 },
        { x: -11.2, z: 1.2 },
        { x: -8.6, z: 1.2 },
        { x: -8.6, z: -3.3 },
      ],
      // Path 3 (AMR-031 dock approach)
      [
        { x: -6.2, z: 4.5 },
        { x: -6.2, z: 1.6 },
        { x: -2.8, z: 1.6 },
        { x: -2.8, z: 2.6 },
      ],
      // Path 4 (AMR-008 right bay loop)
      [
        { x: 4.5, z: -3.4 },
        { x: 10.6, z: -3.4 },
        { x: 10.6, z: 1.2 },
        { x: 4.5, z: 1.2 },
      ],
      // Path 5 (AMR-019 center-right aisle)
      [
        { x: 0.8, z: -3.2 },
        { x: 4.5, z: -3.2 },
        { x: 4.5, z: 1.6 },
        { x: 0.8, z: 1.6 },
      ],
    ];

    const previousProgress = new Map<string, number>();
    for (const prev of this.robots) {
      previousProgress.set(prev.unit.id, prev.progress);
      this.robotGroupContainer.remove(prev.group);
    }
    this.robots = [];
    this.hitMeshes = [];

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitGeo = new THREE.BoxGeometry(1.7, 1.8, 1.7);

    units.forEach((unit, idx) => {
      const path = paths[unit.pathIndex % paths.length];
      const group = buildAmrRobot({
        hasCargo: unit.hasCargo,
        accentColor: unit.accentColor,
        visorTexture: unit.accentColor === 'orange' ? orangeVisor : greenVisor,
        cardboardTexture: cardboardTex,
        scale: 0.62,
        highDetail: false,
      });

      const hitBox = new THREE.Mesh(hitGeo, hitMat);
      hitBox.position.set(0, 0.9, 0);
      hitBox.userData = { robotId: unit.id };
      group.add(hitBox);
      this.hitMeshes.push(hitBox);

      const animated: AnimatedRobot = {
        unit,
        group,
        path,
        progress: previousProgress.get(unit.id) ?? unit.initialProgress ?? (idx * 0.17) % 1,
        hitBox,
      };
      this.updateRobotOnPath(animated, 0);
      this.robotGroupContainer.add(group);
      this.robots.push(animated);
    });
  }

  public syncRobots(units: RobotUnit[]): void {
    if (this.disposed) return;
    const sameVisualTopology =
      units.length === this.robots.length &&
      units.every((u, i) => {
        const cur = this.robots[i]?.unit;
        return (
          cur &&
          cur.id === u.id &&
          cur.hasCargo === u.hasCargo &&
          cur.accentColor === u.accentColor &&
          cur.pathIndex === u.pathIndex
        );
      });

    if (sameVisualTopology) {
      for (let i = 0; i < units.length; i++) {
        this.robots[i].unit = units[i];
      }
      return;
    }

    this.buildFleetRobots(units);
  }

  private updateRobotOnPath(robot: AnimatedRobot, delta: number): void {
    if (this.isLive) {
      robot.progress = (robot.progress + delta * robot.unit.speed) % 1;
    }

    const pts = robot.path;
    const n = pts.length;
    const scaled = robot.progress * n;
    const idx = Math.floor(scaled) % n;
    const nextIdx = (idx + 1) % n;
    const frac = scaled - Math.floor(scaled);

    const p0 = pts[idx];
    const p1 = pts[nextIdx];
    const x = THREE.MathUtils.lerp(p0.x, p1.x, frac);
    const z = THREE.MathUtils.lerp(p0.z, p1.z, frac);
    robot.group.position.set(x, 0.02, z);

    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    if (Math.hypot(dx, dz) > 0.001) {
      const targetYaw = Math.atan2(dx, dz);
      robot.group.rotation.y = targetYaw;
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length > 0) {
      const robotId = hits[0].object.userData.robotId as string | undefined;
      if (robotId) {
        this.selectedRobotId = robotId;
        this.callbacks.onSelectRobot(robotId);
      }
    }
  };

  public setSelectedRobot(robotId: string | null): void {
    this.selectedRobotId = robotId;
  }

  public setLive(live: boolean): void {
    this.isLive = live;
  }

  public zoomIn(): void {
    const dir = _vec3.subVectors(this.camera.position, this.controls.target);
    dir.multiplyScalar(0.84);
    if (dir.length() >= this.controls.minDistance) {
      this.desiredCamPos.copy(this.controls.target).add(dir);
      this.desiredTarget.copy(this.controls.target);
      this.cameraTransitioning = true;
    }
  }

  public zoomOut(): void {
    const dir = _vec3.subVectors(this.camera.position, this.controls.target);
    dir.multiplyScalar(1.18);
    if (dir.length() <= this.controls.maxDistance) {
      this.desiredCamPos.copy(this.controls.target).add(dir);
      this.desiredTarget.copy(this.controls.target);
      this.cameraTransitioning = true;
    }
  }

  public resetCamera(): void {
    this.desiredCamPos.copy(DEFAULT_CAM_POS);
    this.desiredTarget.copy(DEFAULT_TARGET);
    this.cameraTransitioning = true;
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    if (width === this.lastW && height === this.lastH) return;
    this.lastW = width;
    this.lastH = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.render(this.scene, this.camera);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      let polls = 0;
      const poll = () => {
        if (this.disposed) return;
        polls++;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED && polls < 8) {
          this.frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 60);
        }
      };
      this.frameId = window.setTimeout(poll, 8);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    for (let i = 0; i < this.robots.length; i++) {
      this.updateRobotOnPath(this.robots[i], delta);
    }

    if (this.cameraTransitioning) {
      const factor = 1 - Math.exp(-8 * delta);
      this.camera.position.lerp(this.desiredCamPos, factor);
      this.controls.target.lerp(this.desiredTarget, factor);
      if (this.camera.position.distanceTo(this.desiredCamPos) < 0.05) {
        this.cameraTransitioning = false;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // Project selected robot position to DOM overlay coordinates
    const selected = this.selectedRobotId
      ? this.robots.find((r) => r.unit.id === this.selectedRobotId)
      : undefined;
    if (selected) {
      _vec3.copy(selected.group.position);
      _vec3.y += 1.5;
      _vec3.project(this.camera);
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const sx = (_vec3.x * 0.5 + 0.5) * w;
      const sy = (-_vec3.y * 0.5 + 0.5) * h;
      const visible = _vec3.z < 1 && sx > 30 && sx < w - 30 && sy > 20 && sy < h - 20;
      this.callbacks.onCalloutMove({ x: sx, y: sy, visible });
    } else {
      this.callbacks.onCalloutMove({ x: 0, y: 0, visible: false });
    }

    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.frameId = requestAnimationFrame(this.tick);
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    const ro = (this as unknown as { _ro?: ResizeObserver })._ro;
    ro?.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.controls.dispose();
    this.textures.forEach((t) => t.dispose());
    this.envMap.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
