// Decorative fungal colonies react to Molotov heat; checkpoint restores their original state.
import * as THREE from 'three';
export class Scorch {
  constructor(meshes, fx) {
    this.fx = fx; this.cells = new Map(); this.touched = new Map();
    for (const mesh of meshes) for (let id = 0; id < mesh.count; id++) {
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(id, matrix);
      const pos = new THREE.Vector3(), rot = new THREE.Quaternion(), scale = new THREE.Vector3(); matrix.decompose(pos, rot, scale);
      const color = new THREE.Color(0xffffff); if (mesh.instanceColor) mesh.getColorAt(id, color);
      const entry = {mesh, id, matrix, pos, rot, scale, color, age: 0};
      const key = `${Math.floor(pos.x / 3)},${Math.floor(pos.z / 3)}`;
      if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(entry);
    }
  }
  ignite(pos) {
    const x = Math.floor(pos.x / 3), z = Math.floor(pos.z / 3); let added = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const e of this.cells.get(`${x+dx},${z+dz}`) || []) {
      if (this.touched.has(e) || added >= 160 || e.pos.y > 2.5 || Math.hypot(e.pos.x-pos.x, e.pos.z-pos.z) > 2.5) continue;
      this.touched.set(e, e); added++;
    }
  }
  update(dt) {
    const dirty = new Set(), m = new THREE.Matrix4(), roll = new THREE.Quaternion(), color = new THREE.Color();
    for (const e of this.touched.values()) {
      if (e.age >= 2) continue;
      e.age = Math.min(2, e.age + dt); const k = e.age / 2;
      roll.setFromAxisAngle(new THREE.Vector3(0, 0, 1), k * 0.9);
      m.compose(e.pos.clone().add(new THREE.Vector3(0, -k * 0.12, 0)), e.rot.clone().multiply(roll), e.scale.clone().multiplyScalar(1 - k * 0.82));
      e.mesh.setMatrixAt(e.id, m); color.copy(e.color).lerp(new THREE.Color(0x241a15), k); e.mesh.setColorAt(e.id, color); dirty.add(e.mesh);
      if (e.age === 2 && e.id % 4 === 0) this.fx.emit(e.pos, 3, {color: [0.4, 0.32, 0.22], spread: 0.6, up: 0.8, grav: 1.5, life: 0.7});
    }
    for (const mesh of dirty) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
  reset() {
    for (const e of this.touched.values()) { e.mesh.setMatrixAt(e.id, e.matrix); e.mesh.setColorAt(e.id, e.color); e.mesh.instanceMatrix.needsUpdate = true; e.mesh.instanceColor.needsUpdate = true; e.age = 0; }
    this.touched.clear();
  }
}
