// Minimal three.js + VRM runtime for the waifu panel.
// Owns the renderer, scene, camera, render loop, expressions and idle motion.
import * as THREE from "three";
import { GLTFLoader, type GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";

export type BoneName = Parameters<NonNullable<VRM["humanoid"]>["getNormalizedBoneNode"]>[0];

export interface PokeAct {
  type: "tilt" | "turn" | "lean" | "shudder";
  t0: number;
  dur: number;
  dx: number;
}

// Albedo palette: white hair, near-black dress, pale skin, crimson eyes.
const GOTH = {
  skin: new THREE.Color(0xf6ede8),
  hair: new THREE.Color(0xece7ee),
  cloth: new THREE.Color(0x0d0c11),
  eye: new THREE.Color(0x8e1f2c),
};

/** Gothic-palette tint for the fallback sample model (custom models keep their own colors). */
function tintGothic(vrm: VRM): void {
  vrm.scene.traverse((o: THREE.Object3D) => {
    const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mats) return;
    (Array.isArray(mats) ? mats : [mats]).forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m || !(m as THREE.MeshStandardMaterial).color) return;
      const n = (m.name || "").toLowerCase();
      const c = m.color;
      const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
      const mx = Math.max(c.r, c.g, c.b);
      const mn = Math.min(c.r, c.g, c.b);
      const sat = mx ? (mx - mn) / mx : 0;
      if (/ey(e|e_)|iris|hitomi/.test(n) && !/high|light|lash|brow/.test(n)) m.color.copy(GOTH.eye);
      else if (/hair|kami|head_..?$/.test(n)) m.color.copy(GOTH.hair);
      else if (/skin|face|body|hada/.test(n) && l > 0.45) m.color.copy(GOTH.skin);
      else if (l > 0.8 && sat < 0.25) m.color.copy(GOTH.skin);
      else m.color.copy(GOTH.cloth);
      // kill colored emission so the palette stays clean
      if ((m as THREE.MeshStandardMaterial).emissive) {
        m.emissive.multiplyScalar(0.2);
      }
    });
  });
}

export class VrmEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  vrm: VRM | null = null;

  private raf = 0;
  private clock = new THREE.Clock();
  private lookTarget = new THREE.Object3D();
  private blinkNext = 0;
  private blinkVal = 0;
  private act: PokeAct | null = null;
  private talk = 0;
  private flick = 0;
  private expr = "";
  private disposed = false;
  private resizeOb: ResizeObserver | null = null;

  talkLevel(): number {
    return this.talk;
  }

  constructor(mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(mount.clientWidth || 290, mount.clientHeight || 420, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
    this.camera.position.set(0, 1.32, 2.6);

    const key = new THREE.DirectionalLight(0xd8d2e8, 1.1);
    key.position.set(-1, 2, 3);
    this.scene.add(key);
    // subtle cool rim (a strong red light here was tinting the whole model maroon)
    const rim = new THREE.DirectionalLight(0x7a5590, 0.4);
    rim.position.set(0, 1.7, -2.6);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x5a5464, 0.9));

    this.lookTarget.position.set(0, 1.35, 2.6);
    this.scene.add(this.lookTarget);

    const size = () => {
      const w = mount.clientWidth || 290;
      const h = mount.clientHeight || 420;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this.resizeOb = new ResizeObserver(size);
    this.resizeOb.observe(mount);
    size();
  }

  async loadModel(url: string, ownColors: boolean): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser: GLTFParser) => new VRMLoaderPlugin(parser));
    const gltf = await new Promise<any>((ok, no) => loader.load(url, ok, undefined, no));
    const vrm: VRM = gltf.userData.vrm;
    if (this.disposed) throw new Error("disposed");
    // VRM0 models (VRoid Studio default export) face away from the camera; rotate them.
    VRMUtils.rotateVRM0(vrm);
    this.vrm = vrm;
    if (!ownColors) tintGothic(vrm);
    vrm.scene.traverse((o: THREE.Object3D) => {
      o.frustumCulled = false;
    });
    this.scene.add(vrm.scene);
    if (vrm.lookAt) vrm.lookAt.target = this.lookTarget;
    // relaxed A-pose
    const la = this.bone("leftUpperArm");
    const ra = this.bone("rightUpperArm");
    if (la) la.rotation.z = 1.15;
    if (ra) ra.rotation.z = -1.15;
    return vrm;
  }

  bone(n: BoneName): THREE.Object3D | null {
    return this.vrm?.humanoid?.getNormalizedBoneNode(n) ?? null;
  }

  setExpression(e: string): void {
    this.expr = e;
  }

  setTalk(level: number): void {
    this.talk = Math.min(5, level);
  }

  poke(dx: number): void {
    const acts: PokeAct["type"][] = ["tilt", "turn", "lean", "shudder"];
    const type = acts[Math.floor(Math.random() * acts.length)];
    this.act = { type, t0: performance.now() / 1000, dur: type === "shudder" ? 1.6 : type === "tilt" ? 1.8 : 2.6, dx };
    this.flick = 1.1;
  }

  start(): void {
    this.stop();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick(): void {
    const vrm = this.vrm;
    if (!vrm) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = performance.now() / 1000;
    this.talk = Math.max(0, this.talk - dt);
    this.flick = Math.max(0, this.flick - dt * 1.1);

    if (t >= this.blinkNext) {
      const p = (t - this.blinkNext) / 0.15;
      if (p >= 1) {
        this.blinkNext = t + 1.5 + Math.random() * 4;
        this.blinkVal = 0;
      } else this.blinkVal = Math.sin(p * Math.PI);
    }

    let rv = 0, side = 1, rtp = "";
    if (this.act) {
      const p = (t - this.act.t0) / this.act.dur;
      if (p >= 1) this.act = null;
      else {
        rv = Math.sin(p * Math.PI);
        side = this.act.dx < 0 ? -1 : 1;
        rtp = this.act.type;
      }
    }

    const em = vrm.expressionManager;
    if (em) {
      const e = this.expr;
      if (e) {
        em.setValue("happy", e === "happy" ? 0.85 : 0);
        em.setValue("angry", e === "angry" ? 0.85 : 0);
        em.setValue("sad", e === "sad" ? 0.85 : 0);
        em.setValue("relaxed", e === "relaxed" ? 0.85 : 0);
        em.setValue("surprised", e === "surprised" ? 0.85 : 0);
        em.setValue("aa", e === "happy" ? 0 : this.talk > 0 ? 0.25 + 0.65 * Math.abs(Math.sin(t * 11)) : 0);
        em.setValue("blink", this.blinkVal);
      } else {
        em.setValue("happy", this.talk > 0 ? 0.35 : 0.12);
        em.setValue("angry", Math.min(1, 0.3 + 0.55 * this.flick));
        em.setValue("relaxed", Math.max(0, 0.3 - 0.22 * this.flick));
        em.setValue("sad", 0);
        em.setValue("surprised", 0);
        em.setValue("aa", this.talk > 0 ? 0.25 + 0.65 * Math.abs(Math.sin(t * 11)) : 0);
        em.setValue("blink", this.blinkVal);
      }
    }

    const ch = this.bone("chest"), nk = this.bone("neck"), hd = this.bone("head");
    const la = this.bone("leftUpperArm"), ra = this.bone("rightUpperArm"), hp = this.bone("hips");
    if (hp) hp.rotation.y = 0.035 * Math.sin(t * 0.45) + (rtp === "turn" ? -side * 0.85 * rv : 0);
    if (ch) {
      ch.rotation.z = 0.02 * Math.sin(t * 1.1) + (rtp === "shudder" ? 0.05 * Math.sin(t * 26) * rv : 0);
      ch.rotation.y = rtp === "turn" ? side * 0.5 * rv : 0;
      ch.rotation.x = rtp === "lean" ? -0.12 * rv : 0;
    }
    if (nk) {
      nk.rotation.z = 0.05 * Math.sin(t * 0.9 + 1.3) + (rtp === "shudder" ? 0.04 * Math.sin(t * 31) * rv : 0);
      nk.rotation.y = 0.06 * Math.sin(t * 0.7 + 0.4) + (rtp === "turn" ? side * 0.3 * rv : 0);
    }
    if (hd) {
      hd.rotation.y = 0.04 * Math.sin(t * 0.55 + 2) + (rtp === "turn" ? side * 0.35 * rv : 0);
      hd.rotation.z = (rtp === "tilt" ? side * 0.3 * rv : 0) + (rtp === "shudder" ? 0.05 * Math.sin(t * 29) * rv : 0);
      hd.rotation.x = rtp === "lean" ? -0.1 * rv : 0;
    }
    if (la) la.rotation.z = 1.15 + 0.05 * Math.sin(t * 1.3) + (rtp === "lean" ? 0.1 * rv : 0);
    if (ra) ra.rotation.z = -1.15 - 0.05 * Math.sin(t * 1.3 + 1) - (rtp === "lean" ? 0.1 * rv : 0);

    vrm.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.resizeOb?.disconnect();
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
