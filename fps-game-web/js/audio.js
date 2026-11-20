// Small Web Audio wrapper: loads the original game's sound effects and plays them
// with optional pitch, volume and simple 3D attenuation/panning.
const FILES = ['gunshot', 'hit', 'heartbeat', 'explosion', 'flashbang-explosion', 'footstep', 'ringing'];

export class Sound {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.master = null;
    this.volume = 0.7;
  }

  async load(base, onProgress) {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    let done = 0;
    await Promise.all(FILES.map(async (n) => {
      try {
        const res = await fetch(`${base}/${n}.wav`);
        const arr = await res.arrayBuffer();
        this.buffers[n] = await this.ctx.decodeAudioData(arr);
      } catch (e) { console.warn('sound failed', n, e); }
      onProgress && onProgress(++done / FILES.length);
    }));
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  // listener: {pos: Vector3, yaw: number}
  play(name, { volume = 1, rate = 1, pos = null, listener = null, maxDist = 60, loop = false } = {}) {
    const buf = this.buffers[name];
    if (!buf || !this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = loop;
    const gain = this.ctx.createGain();
    let g = volume;
    let node = gain;
    if (pos && listener) {
      const dx = pos.x - listener.pos.x, dy = pos.y - listener.pos.y, dz = pos.z - listener.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      g *= Math.max(0, 1 - d / maxDist) ** 2 * (1 / (1 + d * 0.05));
      if (g < 0.003) return null;
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        // right vector of listener (yaw around Y, forward = -Z)
        const rx = Math.cos(listener.yaw), rz = -Math.sin(listener.yaw);
        p.pan.value = d > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
        gain.connect(p); p.connect(this.master);
        node = gain;
      } else gain.connect(this.master);
    } else gain.connect(this.master);
    gain.gain.value = g;
    src.connect(node);
    src.start();
    return { src, gain };
  }
}
