import * as THREE from 'three';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createCardboardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Kraft base
  ctx.fillStyle = '#b48d67';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle paper fiber grain
  for (let i = 0; i < 900; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(95, 65, 38, 0.11)' : 'rgba(255, 240, 220, 0.08)';
    ctx.fillRect(x, y, 2, 1);
  }

  // Subtle box border bevel shadow
  ctx.strokeStyle = 'rgba(92, 64, 38, 0.25)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 250);

  // Center flap seam
  ctx.fillStyle = 'rgba(84, 58, 34, 0.42)';
  ctx.fillRect(126, 0, 4, 256);

  // Packing tape strip across center
  ctx.fillStyle = 'rgba(156, 120, 84, 0.62)';
  ctx.fillRect(108, 0, 40, 256);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(108, 0, 40, 256);

  // White shipping label on lower right
  ctx.fillStyle = '#f5f2eb';
  ctx.fillRect(164, 174, 62, 46);
  ctx.fillStyle = '#3a3834';
  for (let b = 0; b < 10; b++) {
    ctx.fillRect(170 + b * 5, 198, b % 2 === 0 ? 3 : 2, 14);
  }
  ctx.fillStyle = '#8b857c';
  ctx.fillRect(170, 182, 44, 4);
  ctx.fillRect(170, 189, 30, 3);

  // Tiny handling icons bottom left
  ctx.fillStyle = 'rgba(84, 60, 38, 0.6)';
  ctx.fillRect(24, 196, 12, 12);
  ctx.fillRect(42, 196, 12, 12);
  ctx.fillRect(60, 196, 12, 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSolarRackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // Deep vibrant solar-orange base
  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, '#ff4d1c');
  grad.addColorStop(1, '#e63b0f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  // 4 x 6 modular cell grid
  const cols = 4;
  const rows = 6;
  const padX = 10;
  const padY = 10;
  const gap = 7;
  const cellW = (256 - padX * 2 - gap * (cols - 1)) / cols;
  const cellH = (384 - padY * 2 - gap * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (cellW + gap);
      const y = padY + r * (cellH + gap);
      ctx.fillStyle = '#ff4917';
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = 'rgba(255, 218, 196, 0.72)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellW, cellH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createGreenRackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#486b51';
  ctx.fillRect(0, 0, 256, 256);

  const cols = 5;
  const rows = 5;
  const pad = 10;
  const gap = 6;
  const cellW = (256 - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (256 - pad * 2 - gap * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cellW + gap);
      const y = pad + r * (cellH + gap);
      ctx.fillStyle = (r + c) % 3 === 0 ? '#5c8165' : '#3d5e46';
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = 'rgba(204, 224, 208, 0.52)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, cellW, cellH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWarehouseFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle architectural slab grid
  ctx.strokeStyle = 'rgba(180, 182, 174, 0.28)';
  ctx.lineWidth = 1.5;
  const step = 64;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAmrVisorTexture(
  maxAnisotropy: number,
  eyeColor = '#ff6838'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian visor screen
  ctx.fillStyle = '#151615';
  ctx.fillRect(0, 0, 512, 192);

  // Subtle glossy top rim reflection
  const sheen = ctx.createLinearGradient(0, 0, 0, 192);
  sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.01)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 512, 192);

  // Dotted LED chevron eyes (^ ^) matching the reference AMR-024 visor
  const drawEye = (cx: number, cy: number) => {
    const offsets = [
      [-34, 14],
      [-26, 4],
      [-17, -6],
      [-8, -14],
      [0, -17],
      [8, -14],
      [17, -6],
      [26, 4],
      [34, 14],
      // inner secondary row for dot-matrix richness
      [-26, 14],
      [-17, 4],
      [-8, -5],
      [0, -8],
      [8, -5],
      [17, 4],
      [26, 14],
    ];
    offsets.forEach(([ox, oy], idx) => {
      ctx.fillStyle = idx < 9 ? eyeColor : 'rgba(255, 118, 68, 0.55)';
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, idx < 9 ? 4.2 : 2.9, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  drawEye(178, 102);
  drawEye(334, 102);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 128, 22, 128, 128, 124);
  grad.addColorStop(0, 'rgba(18, 20, 18, 0.42)');
  grad.addColorStop(0.5, 'rgba(18, 20, 18, 0.16)');
  grad.addColorStop(1, 'rgba(18, 20, 18, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
