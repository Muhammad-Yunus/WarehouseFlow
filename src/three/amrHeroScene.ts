import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildAmrRobot } from './amrBuilder';
import {
  createAmrVisorTexture,
  createCardboardTexture,
  createContactShadowTexture,
  detectSoftwareWebGL,
} from './sharedMaterials';

export interface AmrHeroConfig {
  hasCargo: boolean;
  accentColor: 'orange' | 'green';
}

export class AmrHeroScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private robotGroup: THREE.Group | null = null;
  private shadowMesh: THREE.Mesh;
  private cardboardTex: THREE.CanvasTexture;
  private orangeVisorTex: THREE.CanvasTexture;
  private greenVisorTex: THREE.CanvasTexture;
  private shadowTex: THREE.CanvasTexture;
  private envMap: THREE.Texture;

  private lastW = 0;
  private lastH = 0;
  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(container: HTMLElement, initialConfig: AmrHeroConfig) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xffffff, 0);

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.lastW = width;
    this.lastH = height;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmremGenerator.dispose();

    // Camera positioned to match reference straight-on slight-elevated studio shot
    this.camera = new THREE.PerspectiveCamera(29, width / height, 0.1, 40);
    this.camera.position.set(0.08, 1.48, 4.78);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.74, 0);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minPolarAngle = Math.PI * 0.22;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.update();

    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    // Studio 3-point lighting rig (sculpted contrast without blowing out kraft boxes)
    const hemi = new THREE.HemisphereLight(0xf6f8fb, 0xc8c4ba, 0.65);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.48);
    keyLight.position.set(3.4, 5.2, 4.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xeef4fb, 0.48);
    fillLight.position.set(-4.2, 2.2, 2.2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
    rimLight.position.set(0, 3.6, -4.5);
    this.scene.add(rimLight);

    // Procedural textures
    this.cardboardTex = createCardboardTexture(this.maxAnisotropy);
    this.orangeVisorTex = createAmrVisorTexture(this.maxAnisotropy, '#ff6838');
    this.greenVisorTex = createAmrVisorTexture(this.maxAnisotropy, '#58c977');
    this.shadowTex = createContactShadowTexture();

    // Soft studio contact shadow plane directly beneath robot
    const shadowGeo = new THREE.PlaneGeometry(2.65, 2.45);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.set(0, 0.004, 0);
    this.scene.add(this.shadowMesh);

    this.setRobotConfig(initialConfig);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.requestRender();
  }

  public setRobotConfig(config: AmrHeroConfig): void {
    if (this.robotGroup) {
      this.scene.remove(this.robotGroup);
      this.disposeGroup(this.robotGroup);
    }

    this.robotGroup = buildAmrRobot({
      hasCargo: config.hasCargo,
      accentColor: config.accentColor,
      visorTexture:
        config.accentColor === 'orange' ? this.orangeVisorTex : this.greenVisorTex,
      cardboardTexture: this.cardboardTex,
      scale: 0.96,
      highDetail: true,
    });
    this.robotGroup.rotation.y = 0.04;
    this.scene.add(this.robotGroup);
    this.requestRender();
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
    this.requestRender();
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
          this.frameId = window.setTimeout(cb, 40);
        }
      };
      this.frameId = window.setTimeout(poll, 8);
    } else {
      this.frameId = window.setTimeout(cb, 60);
    }
  }

  public requestRender(): void {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty) this.requestRender();
      };
      if (this.isSoftwareGl) this.afterDraw(done);
      else done();
    });
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((obj) => {
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
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.robotGroup) this.disposeGroup(this.robotGroup);
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    this.cardboardTex.dispose();
    this.orangeVisorTex.dispose();
    this.greenVisorTex.dispose();
    this.shadowTex.dispose();
    this.envMap.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
