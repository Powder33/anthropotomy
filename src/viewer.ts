import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Layer, Manifest, ModelChunk, Muscle, Part, Region, View } from './types';

export class AnatomyViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(33, 1, 0.01, 30);
  private controls: OrbitControls;
  private meshes: THREE.Mesh[] = [];
  private skeleton = new THREE.Group();
  private definitions: Map<string, Muscle>;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private selected = 'pectoralis-major';
  private isolated = false;
  private bonesVisible = true;
  private layer: Layer = 'all';
  private region: Region | 'all' = 'all';
  private hovered: THREE.Mesh | null = null;
  private scheduled = false;
  private animation = 0;
  private tooltip: HTMLElement;
  private materials: Record<string, THREE.MeshStandardMaterial>;
  ready = false;

  constructor(private container: HTMLElement, muscles: Muscle[], private onPick: (id: string, part: Part) => void) {
    this.definitions = new Map(muscles.map(m => [m.id, m]));
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.setAttribute('aria-label', '可旋转的人体肌肉模型；也可使用左侧肌肉列表选择');
    this.renderer.domElement.setAttribute('role', 'img');
    container.append(this.renderer.domElement);
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'model-tooltip';
    this.tooltip.hidden = true;
    container.append(this.tooltip);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8aa95, 2.4));
    const key = new THREE.DirectionalLight(0xfff3e5, 3.5);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe8f0f0, 2);
    fill.position.set(2, 1, -3);
    this.scene.add(fill);
    this.materials = {
      base: new THREE.MeshStandardMaterial({ color: '#a56f60', roughness: 0.72, metalness: 0 }),
      alt: new THREE.MeshStandardMaterial({ color: '#b47e6d', roughness: 0.75, metalness: 0 }),
      selected: new THREE.MeshStandardMaterial({ color: '#dd7545', emissive: '#6a240b', emissiveIntensity: 0.12, roughness: 0.58 }),
      hover: new THREE.MeshStandardMaterial({ color: '#c79673', roughness: 0.7 }),
      muted: new THREE.MeshStandardMaterial({ color: '#d2c7b9', roughness: 0.85 }),
      bone: new THREE.MeshStandardMaterial({ color: '#e7e0cc', roughness: 0.85 }),
    };
    this.scene.add(this.skeleton);
    // A translucent ellipse grounds the model without an expensive shadow pass.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const context = shadowCanvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(60,70,45,0.17)');
    gradient.addColorStop(1, 'rgba(60,70,45,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.72), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.006;
    this.scene.add(shadow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.342, 96), new THREE.MeshBasicMaterial({ color: '#d9ddcf', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.005;
    this.scene.add(ring);
    this.camera.position.set(0, 0.94, 3.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.88, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 5.5;
    this.controls.maxPolarAngle = Math.PI * 0.95;
    this.controls.addEventListener('change', () => this.render());
    this.controls.addEventListener('start', () => { cancelAnimationFrame(this.animation); this.tooltip.hidden = true; });
    this.controls.update();
    new ResizeObserver(() => this.resize()).observe(container);
    this.bindPicking();
    this.resize();
  }

  async load(onProgress: (percent: number) => void) {
    const base = `${import.meta.env.BASE_URL}models/`;
    const response = await fetch(base + 'manifest.json');
    if (!response.ok) throw new Error('模型目录读取失败');
    const manifest: Manifest = await response.json();
    let finished = 0;
    const total = manifest.muscles.compressedBytes + manifest.skeleton.compressedBytes;
    const progress = (bytes: number) => { finished += bytes; onProgress(Math.min(99, Math.round(finished / total * 100))); };
    const [muscles, bones] = await Promise.all([
      this.loadChunk(base, manifest.muscles, progress),
      this.loadChunk(base, manifest.skeleton, progress),
    ]);
    for (const part of manifest.muscles.parts) {
      const geometry = this.geometry(muscles, part);
      const mesh = new THREE.Mesh(geometry, this.materials.base);
      mesh.userData.part = part;
      this.meshes.push(mesh);
      this.scene.add(mesh);
    }
    for (const part of manifest.skeleton.parts) {
      this.skeleton.add(new THREE.Mesh(this.geometry(bones, part), this.materials.bone));
    }
    this.ready = true;
    this.container.dataset.ready = 'true';
    this.updateVisibility();
    onProgress(100);
  }

  private async loadChunk(base: string, chunk: ModelChunk, progress: (bytes: number) => void) {
    const response = await fetch(base + chunk.url);
    if (!response.ok || !response.body) throw new Error('模型下载失败，请重试');
    const reader = response.body.getReader();
    const segments: Uint8Array<ArrayBuffer>[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      segments.push(new Uint8Array(value));
      progress(value.byteLength);
    }
    const compressed = new Blob(segments);
    const uncompressed = compressed.stream().pipeThrough(new DecompressionStream('gzip'));
    const buffer = await new Response(uncompressed).arrayBuffer();
    if (buffer.byteLength !== chunk.bytes) throw new Error('模型数据不完整，请重试');
    return buffer;
  }

  private geometry(buffer: ArrayBuffer, part: Part) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  select(id: string, turn = true) {
    this.selected = id;
    this.updateVisibility();
    if (this.isolated) this.focusSelection();
    else if (turn) this.setView(this.definitions.get(id)?.view === 'back' ? 'back' : 'front');
  }

  setOptions(options: { isolated?: boolean; bones?: boolean; layer?: Layer; region?: Region | 'all' }) {
    const previous = this.isolated;
    if (options.isolated !== undefined) this.isolated = options.isolated;
    if (options.bones !== undefined) this.bonesVisible = options.bones;
    if (options.layer) this.layer = options.layer;
    if (options.region) this.region = options.region;
    this.updateVisibility();
    if (this.isolated) this.focusSelection();
    else if (previous) this.setView(this.definitions.get(this.selected)?.view === 'back' ? 'back' : 'front');
  }

  private updateVisibility() {
    this.skeleton.visible = this.bonesVisible && !this.isolated;
    this.meshes.forEach((mesh, index) => {
      const id = mesh.userData.part.muscleId;
      const definition = this.definitions.get(id)!;
      mesh.visible = this.isolated ? id === this.selected : (this.layer === 'all' || definition.layer === this.layer || id === this.selected);
      mesh.material = id === this.selected ? this.materials.selected : this.region !== 'all' && definition.region !== this.region ? this.materials.muted : index % 3 ? this.materials.base : this.materials.alt;
    });
    this.render();
  }

  setView(view: View) {
    const direction = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] }[view];
    const target = this.isolated ? this.selectionBounds().getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0.88, 0);
    const distance = this.isolated ? this.fittedDistance(this.selectionBounds()) : this.fullDistance();
    this.moveCamera(target, new THREE.Vector3(...direction).multiplyScalar(distance).add(target));
  }

  private fullDistance() {
    return Math.max(3.25, 0.65 / this.camera.aspect / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }

  private selectionBounds() {
    const box = new THREE.Box3();
    for (const mesh of this.meshes) if (mesh.userData.part.muscleId === this.selected) box.expandByObject(mesh);
    return box;
  }

  private fittedDistance(box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3());
    return Math.max(size.y, size.x / this.camera.aspect, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.5 + size.z / 2;
  }

  private focusSelection() {
    if (!this.ready) return;
    const box = this.selectionBounds();
    const center = box.getCenter(new THREE.Vector3());
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.moveCamera(center, direction.multiplyScalar(Math.max(0.35, this.fittedDistance(box))).add(center));
  }

  private moveCamera(target: THREE.Vector3, position: THREE.Vector3) {
    cancelAnimationFrame(this.animation);
    const fromPosition = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const start = performance.now();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480;
    // Stop residual orbit damping before preset transitions.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = damping;
    const tick = () => {
      const t = duration ? Math.min(1, (performance.now() - start) / duration) : 1;
      const ease = 1 - (1 - t) ** 3;
      this.camera.position.lerpVectors(fromPosition, position, ease);
      this.controls.target.lerpVectors(fromTarget, target, ease);
      this.controls.update();
      this.render();
      if (t < 1) this.animation = requestAnimationFrame(tick);
    };
    tick();
  }

  zoom(direction: number) {
    cancelAnimationFrame(this.animation);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * (direction > 0 ? 0.82 : 1.22), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
    this.controls.update();
    this.render();
  }

  private pick(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.meshes.filter(m => m.visible), false)[0]?.object as THREE.Mesh | undefined;
  }

  private bindPicking() {
    const canvas = this.renderer.domElement;
    let start: { x: number; y: number } | null = null;
    let gesture = false;
    const pointers = new Set<number>();
    canvas.addEventListener('pointerdown', event => {
      pointers.add(event.pointerId);
      if (pointers.size === 1) { start = { x: event.clientX, y: event.clientY }; gesture = false; }
      else gesture = true;
    });
    canvas.addEventListener('pointerup', event => {
      pointers.delete(event.pointerId);
      if (!gesture && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6 && event.button === 0) {
        const mesh = this.pick(event);
        if (mesh) this.onPick(mesh.userData.part.muscleId, mesh.userData.part);
      }
      if (!pointers.size) start = null;
    });
    canvas.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); start = null; gesture = true; });
    canvas.addEventListener('pointermove', event => {
      if (pointers.size || event.pointerType === 'touch') return;
      const mesh = this.pick(event);
      if (mesh !== this.hovered) {
        this.hovered = mesh ?? null;
        this.updateVisibility();
        if (mesh && mesh.userData.part.muscleId !== this.selected) mesh.material = this.materials.hover;
        canvas.style.cursor = mesh ? 'pointer' : 'grab';
      }
      this.tooltip.hidden = !mesh;
      if (mesh) {
        const part: Part = mesh.userData.part;
        const rect = this.container.getBoundingClientRect();
        this.tooltip.textContent = `${part.side === 'left' ? '左侧' : part.side === 'right' ? '右侧' : ''} ${this.definitions.get(part.muscleId!)!.name}`;
        this.tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, rect.width - 160)}px`;
        this.tooltip.style.top = `${event.clientY - rect.top - 38}px`;
      }
    });
    canvas.addEventListener('pointerleave', () => { this.tooltip.hidden = true; this.hovered = null; this.updateVisibility(); });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.container.dispatchEvent(new CustomEvent('modelerror', { detail: '3D 显示暂时中断，请刷新页面；肌肉列表仍可使用。' }));
    });
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (!this.ready) { this.camera.position.set(0, 0.94, this.fullDistance()); this.controls.update(); }
    this.render();
  }

  private render() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      const changed = this.controls.update();
      this.renderer.render(this.scene, this.camera);
      if (changed) this.render();
    });
  }
}
