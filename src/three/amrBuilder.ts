import * as THREE from 'three';

export interface AmrBuildOptions {
  hasCargo?: boolean;
  accentColor?: 'orange' | 'green';
  visorTexture?: THREE.Texture;
  cardboardTexture?: THREE.Texture;
  scale?: number;
  highDetail?: boolean;
}

/**
 * Builds a composite multi-part AMR autonomous warehouse robot (`THREE.Group`)
 * grounded at bottom-center (y = 0) with realistic PBR material contrast.
 */
export function buildAmrRobot(options: AmrBuildOptions = {}): THREE.Group {
  const {
    hasCargo = true,
    accentColor = 'orange',
    visorTexture,
    cardboardTexture,
    scale = 1,
    highDetail = true,
  } = options;

  const root = new THREE.Group();

  // Materials with deliberate roughness/metalness contrast
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x7b846e, // Matte sage-olive composite armor matching reference
    roughness: 0.65,
    metalness: 0.06,
  });

  const darkChassisMat = new THREE.MeshStandardMaterial({
    color: 0x242625, // Matte anodized chassis & bumper
    roughness: 0.48,
    metalness: 0.35,
  });

  const deckTrimMat = new THREE.MeshStandardMaterial({
    color: 0x353836,
    roughness: 0.4,
    metalness: 0.5,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1c1d1d,
    roughness: 0.88,
    metalness: 0.04,
  });

  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x525654,
    roughness: 0.28,
    metalness: 0.85,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: visorTexture ?? null,
    emissive: new THREE.Color(accentColor === 'orange' ? 0x3a1408 : 0x0d2d18),
    emissiveMap: visorTexture ?? null,
    emissiveIntensity: 1.15,
    roughness: 0.14,
    metalness: 0.1,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf6f5f0,
    emissive: new THREE.Color(0xf4f0e4),
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.1,
  });

  const ledStripMat = new THREE.MeshStandardMaterial({
    color: accentColor === 'orange' ? 0x70b87d : 0x69c77b,
    emissive: new THREE.Color(accentColor === 'orange' ? 0x4ba862 : 0x4bc86c),
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.1,
  });

  // 1. Lower chassis & underbody clearance (sits above wheel axles)
  const chassisGeo = new THREE.BoxGeometry(1.42, 0.24, 1.62);
  const chassis = new THREE.Mesh(chassisGeo, darkChassisMat);
  chassis.position.set(0, 0.24, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  root.add(chassis);

  // 2. Sculpted outer sage-olive armored shell (chamfered extruded profile)
  const shellShape = new THREE.Shape();
  const hw = 0.78;
  const hh = 0.34;
  const r = 0.11;
  shellShape.moveTo(-hw + r, -hh);
  shellShape.lineTo(hw - r, -hh);
  shellShape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shellShape.lineTo(hw - 0.04, hh - r);
  shellShape.quadraticCurveTo(hw - 0.04, hh, hw - 0.04 - r, hh);
  shellShape.lineTo(-hw + 0.04 + r, hh);
  shellShape.quadraticCurveTo(-hw + 0.04, hh, -hw + 0.04, hh - r);
  shellShape.lineTo(-hw, -hh + r);
  shellShape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
    depth: 1.56,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.05,
    bevelSegments: highDetail ? 4 : 2,
  });
  shellGeo.center();
  const shell = new THREE.Mesh(shellGeo, armorMat);
  shell.position.set(0, 0.58, 0);
  shell.castShadow = true;
  shell.receiveShadow = true;
  root.add(shell);

  // 3. Recessed front black visor fascia
  const visorGeo = new THREE.BoxGeometry(1.12, 0.42, 0.12);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.62, 0.8);
  root.add(visor);

  // Visor outer frame bezel
  const bezelGeo = new THREE.BoxGeometry(1.22, 0.48, 0.08);
  const bezel = new THREE.Mesh(bezelGeo, darkChassisMat);
  bezel.position.set(0, 0.62, 0.78);
  root.add(bezel);

  // 4. Lower front sensor bumper + central LiDAR lens + dual pill headlights
  const frontLipGeo = new THREE.BoxGeometry(1.36, 0.14, 0.14);
  const frontLip = new THREE.Mesh(frontLipGeo, darkChassisMat);
  frontLip.position.set(0, 0.31, 0.79);
  frontLip.castShadow = true;
  root.add(frontLip);

  const lidarGeo = new THREE.CylinderGeometry(0.065, 0.07, 0.08, highDetail ? 20 : 12);
  lidarGeo.rotateX(Math.PI / 2);
  const lidar = new THREE.Mesh(lidarGeo, hubMat);
  lidar.position.set(0, 0.31, 0.84);
  root.add(lidar);

  const lidarLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.08, metalness: 0.9 })
  );
  lidarLens.position.set(0, 0.31, 0.87);
  root.add(lidarLens);

  [-0.5, 0.5].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.05), headlightMat);
    lamp.position.set(lx, 0.31, 0.855);
    root.add(lamp);
  });

  // 5. Side recessed vents & wheel well cutouts
  [-0.81, 0.81].forEach((sx) => {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.42), darkChassisMat);
    vent.position.set(sx, 0.6, 0.05);
    root.add(vent);
  });

  // 6. Four heavy-duty industrial wheels (protruding cleanly like reference AMR)
  const wheelRadius = 0.27;
  const wheelWidth = 0.25;
  const wheelPositions: Array<[number, number]> = [
    [-0.84, 0.5],
    [0.84, 0.5],
    [-0.84, -0.5],
    [0.84, -0.5],
  ];

  const wheelGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    wheelWidth,
    highDetail ? 28 : 14
  );
  wheelGeo.rotateZ(Math.PI / 2);

  const hubGeo = new THREE.CylinderGeometry(0.11, 0.11, wheelWidth + 0.02, highDetail ? 18 : 10);
  hubGeo.rotateZ(Math.PI / 2);

  wheelPositions.forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, wheelRadius, wz);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    root.add(wheel);

    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(wx, wheelRadius, wz);
    root.add(hub);
  });

  // 7. Upper lift deck + subtle LED side telemetry trim
  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.1, 1.56), deckTrimMat);
  upperDeck.position.set(0, 0.99, 0);
  upperDeck.castShadow = true;
  upperDeck.receiveShadow = true;
  root.add(upperDeck);

  [-0.745, 0.745].forEach((lx) => {
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 1.16), ledStripMat);
    ledStrip.position.set(lx, 0.95, 0);
    root.add(ledStrip);
  });

  // 8. Optional Pallet Tray + 4 Kraft Cardboard Cargo Boxes
  if (hasCargo) {
    const palletMat = new THREE.MeshStandardMaterial({
      color: 0x3b3d3c,
      roughness: 0.72,
      metalness: 0.15,
    });
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.09, 1.54), palletMat);
    pallet.position.set(0, 1.09, 0);
    pallet.castShadow = true;
    pallet.receiveShadow = true;
    root.add(pallet);

    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: cardboardTexture ?? null,
      roughness: 0.85,
      metalness: 0.02,
    });
    if (!cardboardTexture) {
      boxMat.color.setHex(0xc8a47c);
    }

    // 4 neat boxes matching the reference AMR-024 top cargo with clear seam separation
    const boxSpecs: Array<[number, number, number, number, number, number]> = [
      [-0.37, 1.38, 0.35, 0.64, 0.48, 0.66],
      [0.37, 1.38, 0.35, 0.64, 0.48, 0.66],
      [-0.37, 1.38, -0.36, 0.64, 0.48, 0.62],
      [0.37, 1.38, -0.36, 0.64, 0.48, 0.62],
    ];

    boxSpecs.forEach(([bx, by, bz, bw, bh, bd], idx) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), boxMat);
      box.position.set(bx, by, bz);
      box.rotation.y = idx % 2 === 0 ? 0.012 : -0.01;
      box.castShadow = true;
      box.receiveShadow = true;
      root.add(box);
    });
  } else {
    // Free-loader clean recessed top docking pad
    const dockPad = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 1.24), darkChassisMat);
    dockPad.position.set(0, 1.05, 0);
    root.add(dockPad);
  }

  root.scale.setScalar(scale);
  return root;
}
