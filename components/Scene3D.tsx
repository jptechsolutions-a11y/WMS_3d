import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Environment, 
  Html, 
  KeyboardControls,
  useKeyboardControls,
  PointerLockControls,
  Sky,
  Text
} from '@react-three/drei';
import * as THREE from 'three';
import { MergedData } from '../types';
import { DIMENSIONS, COLORS } from '../constants';
import { extractNumber } from '../utils/dataProcessor';

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['Shift'] },
];

interface SceneProps {
  data: MergedData[];
  visibleStatus: string[]; 
  visibleTypes: string[]; 
  visibleItemIds: Set<string>;
  mode: 'WALK' | 'ORBIT';
  onSelect: (data: MergedData) => void;
  selectedId: string | null;
  teleportPos: { x: number, y: number, z: number } | null;
  isMobileOpen: boolean;
  colorMode: 'REALISTIC' | 'STATUS' | 'PQR' | 'ABC'; // [ATUALIZADO]
}

// ... (Geometry generators unchanged) ...
const mergeGeometries = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  let totalPos = 0, totalNorm = 0, totalUV = 0, totalInd = 0;
  geometries.forEach(g => {
    totalPos += g.attributes.position.array.length;
    totalNorm += g.attributes.normal.array.length;
    totalUV += g.attributes.uv.array.length;
    if (g.index) totalInd += g.index.array.length;
  });

  const posArr = new Float32Array(totalPos);
  const normArr = new Float32Array(totalNorm);
  const uvArr = new Float32Array(totalUV);
  const indArr = new Uint32Array(totalInd);

  let offsetPos = 0, offsetNorm = 0, offsetUV = 0, offsetInd = 0, indexOffset = 0;

  geometries.forEach(g => {
    posArr.set(g.attributes.position.array, offsetPos);
    normArr.set(g.attributes.normal.array, offsetNorm);
    uvArr.set(g.attributes.uv.array, offsetUV);
    
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++) {
        indArr[offsetInd + i] = g.index.array[i] + indexOffset;
      }
      offsetInd += g.index.array.length;
    }
    
    indexOffset += g.attributes.position.array.length / 3;
    
    offsetPos += g.attributes.position.array.length;
    offsetNorm += g.attributes.normal.array.length;
    offsetUV += g.attributes.uv.array.length;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  merged.setIndex(new THREE.BufferAttribute(indArr, 1));
  
  return merged;
};

const createDetailedPalletGeometry = () => {
  const width = 1.65; 
  const depth = 1.2;
  const runnerHeight = 0.10;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const zPos = (i - 1) * (depth * 0.45); 
    const g = new THREE.BoxGeometry(width, runnerHeight, 0.1);
    g.translate(0, runnerHeight/2, zPos);
    parts.push(g);
  }
  const boardHeight = 0.05;
  const boardWidth = 0.2;
  const gap = (width - (5 * boardWidth)) / 4;
  for (let i = 0; i < 5; i++) {
    const xPos = (i - 2) * (boardWidth + gap);
    const g = new THREE.BoxGeometry(boardWidth, boardHeight, depth);
    g.translate(xPos, runnerHeight + boardHeight/2, 0);
    parts.push(g);
  }
  return mergeGeometries(parts);
};

const createBoxStackGeometry = () => {
  const boxW = 0.78; 
  const boxH = 0.48; 
  const boxD = 0.54; 
  const gap = 0.02;
  const parts: THREE.BufferGeometry[] = [];
  for (let x = -1; x <= 1; x += 2) {
    for (let y = 0; y < 2; y++) {
        for (let z = -1; z <= 1; z += 2) {
            const g = new THREE.BoxGeometry(boxW, boxH, boxD);
            const px = x * (boxW/2 + gap/2);
            const py = y * (boxH + gap) + (boxH/2);
            const pz = z * (boxD/2 + gap/2);
            g.translate(px, py, pz);
            parts.push(g);
        }
    }
  }
  return mergeGeometries(parts);
};

const boxStackGeometry = createBoxStackGeometry();
const detailedPalletGeometry = createDetailedPalletGeometry();
const uprightPostGeometry = new THREE.BoxGeometry(0.08, 1, 0.08); 
const uprightBaseGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.2, 8); 
const beamGeometry = new THREE.BoxGeometry(DIMENSIONS.BAY_WIDTH, DIMENSIONS.BEAM_THICKNESS, 0.08); 

const StreetLabels = ({ data }: { data: MergedData[] }) => {
  const streets = useMemo(() => {
    const map = new Map<string, { maxZ: number, x: number, sector: string }>();
    data.forEach(d => {
      const rua = d.rawAddress.RUA;
      if (!map.has(rua)) {
        map.set(rua, { maxZ: d.z, x: 0, sector: d.sector || '' }); 
      } else {
        const entry = map.get(rua)!;
        entry.maxZ = Math.max(entry.maxZ, d.z);
      }
    });

    return Array.from(map.entries()).map(([name, val]) => {
        const ruaIdx = extractNumber(name);
        const centerX = ruaIdx * DIMENSIONS.STREET_SPACING;
        return {
            name,
            sector: val.sector,
            x: centerX,
            z: val.maxZ + 4 
        };
    });
  }, [data]);

  return (
    <group>
      {streets.map((s) => (
        <group key={s.name} position={[s.x, 6, s.z]}>
           <mesh position={[0, 1, 0]}>
             <cylinderGeometry args={[0.05, 0.05, 3]} />
             <meshStandardMaterial color="#334155" />
           </mesh>
           <mesh position={[0, 0, 0]}>
             <boxGeometry args={[3, 1.2, 0.1]} />
             <meshStandardMaterial color="#0f172a" />
           </mesh>
           <Text position={[0, 0.25, 0.06]} fontSize={0.5} color="#06b6d4" anchorX="center" anchorY="middle">
             {s.name}
           </Text>
           <Text position={[0, -0.25, 0.06]} fontSize={0.25} color="#94a3b8" anchorX="center" anchorY="middle">
             {s.sector}
           </Text>

           <Text position={[0, 0.25, -0.06]} rotation={[0, Math.PI, 0]} fontSize={0.5} color="#06b6d4" anchorX="center" anchorY="middle">
             {s.name}
           </Text>
           <Text position={[0, -0.25, -0.06]} rotation={[0, Math.PI, 0]} fontSize={0.25} color="#94a3b8" anchorX="center" anchorY="middle">
             {s.sector}
           </Text>
        </group>
      ))}
    </group>
  );
};

interface ItemMetadata {
  span: number;
}

const RackSystem = ({ 
    data, 
    visibleStatus = [], 
    visibleTypes = [], 
    visibleItemIds = new Set(), 
    onSelect, 
    selectedId, 
    colorMode
}: { 
    data: MergedData[], 
    visibleStatus: string[], 
    visibleTypes: string[], 
    visibleItemIds: Set<string>,
    onSelect: (d: MergedData) => void, 
    selectedId: string | null,
    colorMode: 'REALISTIC' | 'STATUS' | 'PQR' | 'ABC'
}) => {
  const meshRefBoxes = useRef<THREE.InstancedMesh>(null);
  const meshRefPallets = useRef<THREE.InstancedMesh>(null);
  const meshRefUprights = useRef<THREE.InstancedMesh>(null);
  const meshRefUprightBases = useRef<THREE.InstancedMesh>(null);
  const meshRefBeams = useRef<THREE.InstancedMesh>(null);
  
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);

  const { columns, itemMeta, maxBeams, uprightInstances } = useMemo(() => {
    // ... (Existing column logic preserved for brevity) ...
    const stackMap = new Map<string, MergedData[]>();
    const bayMap = new Map<string, { x: number, z: number, maxLevel: number, minLevel: number, blockedLevels: Set<number> }>();

    data.forEach(d => {
      if (!visibleTypes.includes(d.rawAddress.ESP)) return;

      const stackKey = `${d.rawAddress.RUA}-${d.rawAddress.PRED}-${d.rawAddress.SL}`;
      if (!stackMap.has(stackKey)) stackMap.set(stackKey, []);
      stackMap.get(stackKey)!.push(d);

      const bayKey = `${d.rawAddress.RUA}-${d.rawAddress.PRED}`;
      const visualLevel = Math.round(d.y / DIMENSIONS.RACK_HEIGHT) + 1;

      if (!bayMap.has(bayKey)) {
        const predIdx = extractNumber(d.rawAddress.PRED);
        const seq = Math.floor((predIdx - 1) / 2);
        const bayZ = -(seq * DIMENSIONS.BAY_WIDTH);
        bayMap.set(bayKey, { x: d.x, z: bayZ, maxLevel: visualLevel, minLevel: visualLevel, blockedLevels: new Set() });
      } else {
        const existing = bayMap.get(bayKey)!;
        if (visualLevel > existing.maxLevel) existing.maxLevel = visualLevel;
        if (visualLevel < existing.minLevel) existing.minLevel = visualLevel;
      }
    });

    const itemMetaMap = new Map<string, ItemMetadata>();

    stackMap.forEach((items, key) => {
      items.sort((a, b) => a.y - b.y);

      for (let i = 0; i < items.length; i++) {
        const current = items[i];
        const currentLevel = Math.round(current.y / DIMENSIONS.RACK_HEIGHT) + 1;
        let span = 1;

        if (current.rawAddress.ESP === 'A') {
          const next = items[i+1];
          if (next) {
            const nextLevel = Math.round(next.y / DIMENSIONS.RACK_HEIGHT) + 1;
            span = nextLevel - currentLevel;
          } else {
            span = 1; 
          }
        }
        if (span < 1) span = 1;
        itemMetaMap.set(current.id, { span });

        if (span > 1) {
             const bayKey = `${current.rawAddress.RUA}-${current.rawAddress.PRED}`;
             if (bayMap.has(bayKey)) {
                for (let k = 1; k < span; k++) {
                    bayMap.get(bayKey)!.blockedLevels.add(currentLevel + k);
                }
             }
        }
      }
    });

    const cols = Array.from(bayMap.entries()).map(([key, val]) => ({
        ...val,
        key
    }));

    let totalLevels = 0;
    cols.forEach(c => totalLevels += c.maxLevel);

    return { 
      columns: cols, 
      itemMeta: itemMetaMap,
      maxBeams: totalLevels * 2, 
      uprightInstances: cols.length * 4
    };
  }, [data, visibleTypes]);

  useLayoutEffect(() => {
    if (!meshRefBoxes.current || !meshRefUprights.current || !meshRefUprightBases.current || !meshRefBeams.current || !meshRefPallets.current) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const cardColors = [new THREE.Color(COLORS.BOX_CARDBOARD), new THREE.Color(COLORS.BOX_CARDBOARD_DARK), new THREE.Color('#d4b48d')];

    data.forEach((item, i) => {
      const isVisibleStatus = visibleStatus.includes(item.rawAddress.STATUS);
      const isVisibleType = visibleTypes.includes(item.rawAddress.ESP);
      const isVisibleSearchAndExpiry = visibleItemIds && visibleItemIds.has(item.id);
      
      const isVisible = isVisibleStatus && isVisibleType && isVisibleSearchAndExpiry;

      const span = itemMeta.get(item.id)?.span || 1;
      const yBase = item.y;
      
      if (isVisible) {
          // 1. Pallet
          dummy.position.set(item.x, yBase, item.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          meshRefPallets.current!.setMatrixAt(i, dummy.matrix);
          meshRefPallets.current!.setColorAt(i, color.set(COLORS.PALLET_BLUE));

          // 2. Box Stack
          const totalHeightAvailable = (span * DIMENSIONS.RACK_HEIGHT) - DIMENSIONS.PALLET_HEIGHT - 0.2;
          const boxY = yBase + DIMENSIONS.PALLET_HEIGHT; 
          dummy.position.set(item.x, boxY, item.z);
          const scaleY = totalHeightAvailable / 1.0; 
          dummy.scale.set(1, scaleY, 1);
          dummy.updateMatrix();
          meshRefBoxes.current!.setMatrixAt(i, dummy.matrix);

          if (item.id === selectedId) {
            color.set(COLORS.SELECTED);
          } else if (i === hoveredInstance) {
            color.set(COLORS.HOVER);
          } else if (colorMode === 'PQR') {
             // [NOVO] Lógica PQR 3D
             if (item.analysis?.pqrClass === 'P') color.set(COLORS.PQR_P);
             else if (item.analysis?.pqrClass === 'Q') color.set(COLORS.PQR_Q);
             else if (item.analysis?.pqrClass === 'R') color.set(COLORS.PQR_R);
             else color.set(COLORS.PQR_NULL);
          } else if (colorMode === 'STATUS') {
            color.set(COLORS[item.rawAddress.STATUS] || COLORS.DEFAULT);
          } else {
            const charCode = item.id.charCodeAt(item.id.length - 1);
            color.set(cardColors[charCode % 3]);
          }
          meshRefBoxes.current!.setColorAt(i, color);

      } else {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          meshRefBoxes.current!.setMatrixAt(i, dummy.matrix);
          meshRefPallets.current!.setMatrixAt(i, dummy.matrix);
      }
    });
    
    meshRefBoxes.current.instanceMatrix.needsUpdate = true;
    if (meshRefBoxes.current.instanceColor) meshRefBoxes.current.instanceColor.needsUpdate = true;
    meshRefPallets.current.instanceMatrix.needsUpdate = true;
    if (meshRefPallets.current.instanceColor) meshRefPallets.current.instanceColor.needsUpdate = true;


    // --- Structure Generation ---
    // ... (Structure generation unchanged) ...
    let beamIdx = 0;
    let upIdx = 0;
    const depthHalf = DIMENSIONS.RACK_DEPTH / 2;
    const bayHalf = DIMENSIONS.BAY_WIDTH / 2;

    columns.forEach((col) => {
       const height = col.maxLevel * DIMENSIONS.RACK_HEIGHT;
       const isTunnel = col.minLevel > 1;
       const startY = isTunnel ? (col.minLevel - 1) * DIMENSIONS.RACK_HEIGHT : 0;
       const effectiveHeight = height - startY;
       const uprightZLocs = [col.z - bayHalf, col.z + bayHalf];

       uprightZLocs.forEach(zLoc => {
          dummy.rotation.set(0, 0, 0);
          dummy.position.set(col.x - depthHalf, startY + effectiveHeight / 2, zLoc);
          dummy.scale.set(1, effectiveHeight, 1); 
          dummy.updateMatrix();
          meshRefUprights.current!.setMatrixAt(upIdx, dummy.matrix);
          
          if (startY === 0) {
             dummy.position.set(col.x - depthHalf, 0.1, zLoc);
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             meshRefUprightBases.current!.setMatrixAt(upIdx, dummy.matrix);
          } else {
             dummy.scale.set(0,0,0);
             dummy.updateMatrix();
             meshRefUprightBases.current!.setMatrixAt(upIdx, dummy.matrix);
          }
          upIdx++;

          dummy.position.set(col.x + depthHalf, startY + effectiveHeight / 2, zLoc);
          dummy.scale.set(1, effectiveHeight, 1); 
          dummy.updateMatrix();
          meshRefUprights.current!.setMatrixAt(upIdx, dummy.matrix);

          if (startY === 0) {
             dummy.position.set(col.x + depthHalf, 0.1, zLoc);
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             meshRefUprightBases.current!.setMatrixAt(upIdx, dummy.matrix);
          } else {
             dummy.scale.set(0,0,0);
             dummy.updateMatrix();
             meshRefUprightBases.current!.setMatrixAt(upIdx, dummy.matrix);
          }
          upIdx++;
       });

       for (let level = 1; level <= col.maxLevel; level++) {
             if (level < col.minLevel) continue;
             if (col.blockedLevels && col.blockedLevels.has(level)) continue;
             const yLevel = (level - 1) * DIMENSIONS.RACK_HEIGHT;
             dummy.position.set(col.x - depthHalf, yLevel, col.z); 
             dummy.rotation.set(0, 0, 0); 
             dummy.rotation.set(0, Math.PI/2, 0); 
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             meshRefBeams.current!.setMatrixAt(beamIdx++, dummy.matrix);
             dummy.position.set(col.x + depthHalf, yLevel, col.z);
             dummy.updateMatrix();
             meshRefBeams.current!.setMatrixAt(beamIdx++, dummy.matrix);
        }
    });
    
    for(let i=0; i<upIdx; i++) {
        meshRefUprights.current!.setColorAt(i, color.set(COLORS.RACK_UPRIGHT));
        meshRefUprightBases.current!.setColorAt(i, color.set(COLORS.RACK_BASE));
    }
    meshRefUprights.current.instanceMatrix.needsUpdate = true;
    meshRefUprights.current.instanceColor!.needsUpdate = true;
    meshRefUprightBases.current.instanceMatrix.needsUpdate = true;
    meshRefUprightBases.current.instanceColor!.needsUpdate = true;

    for (let i = 0; i < beamIdx; i++) meshRefBeams.current!.setColorAt(i, color.set(COLORS.RACK_BEAM));
    meshRefBeams.current.count = beamIdx;
    meshRefBeams.current.instanceMatrix.needsUpdate = true;
    meshRefBeams.current.instanceColor!.needsUpdate = true;

  }, [data, visibleStatus, visibleTypes, visibleItemIds, selectedId, hoveredInstance, columns, itemMeta, colorMode]);

  return (
    <group>
      <instancedMesh ref={meshRefBoxes} args={[boxStackGeometry, undefined, data.length]} onPointerMove={(e) => {e.stopPropagation(); setHoveredInstance(e.instanceId !== undefined ? e.instanceId : null);}} onPointerOut={() => setHoveredInstance(null)} onClick={(e) => {e.stopPropagation(); if (e.instanceId !== undefined && data[e.instanceId]) onSelect(data[e.instanceId]);}}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={meshRefPallets} args={[detailedPalletGeometry, undefined, data.length]}>
        <meshStandardMaterial color={COLORS.PALLET_BLUE} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={meshRefUprights} args={[uprightPostGeometry, undefined, uprightInstances]}>
        <meshStandardMaterial color={COLORS.RACK_UPRIGHT} roughness={0.3} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={meshRefUprightBases} args={[uprightBaseGeometry, undefined, uprightInstances]}>
        <meshStandardMaterial color={COLORS.RACK_BASE} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={meshRefBeams} args={[beamGeometry, undefined, maxBeams]}>
        <meshStandardMaterial color={COLORS.RACK_BEAM} roughness={0.4} />
      </instancedMesh>

      {hoveredInstance !== null && data[hoveredInstance] && visibleStatus.includes(data[hoveredInstance].rawAddress.STATUS) && visibleTypes.includes(data[hoveredInstance].rawAddress.ESP) && visibleItemIds && visibleItemIds.has(data[hoveredInstance].id) && (
         <Html position={[data[hoveredInstance].x, data[hoveredInstance].y + 1, data[hoveredInstance].z]} distanceFactor={15}>
            <div className="bg-slate-900/95 text-white text-xs p-3 rounded border border-blue-500 shadow-xl pointer-events-none whitespace-nowrap z-50 min-w-[200px]">
               <div className="font-bold text-orange-400 text-sm mb-1 border-b border-slate-700 pb-1">
                  {data[hoveredInstance].rawAddress.RUA} - {data[hoveredInstance].rawAddress.PRED} - {data[hoveredInstance].rawAddress.AP} - {data[hoveredInstance].rawAddress.SL}
               </div>
               
               {/* [NOVO] Badge PQR no Tooltip */}
               {data[hoveredInstance].analysis?.pqrClass && (
                 <div className="absolute top-2 right-2 px-1 rounded bg-slate-800 border border-slate-600 font-bold text-[9px]" style={{
                     color: data[hoveredInstance].analysis.pqrClass === 'P' ? COLORS.PQR_P : 
                            data[hoveredInstance].analysis.pqrClass === 'Q' ? COLORS.PQR_Q : COLORS.PQR_R
                 }}>
                    {data[hoveredInstance].analysis.pqrClass}
                 </div>
               )}

               {itemMeta.get(data[hoveredInstance].id)?.span > 1 && (
                 <div className="text-green-400 text-[10px] mb-2 italic font-bold">Pallet Full</div>
               )}

               {data[hoveredInstance].rawItem && (
                   <div className="mb-2">
                       <div className="text-[10px] text-blue-400 font-bold uppercase">Apanha</div>
                       <div className="font-semibold">{data[hoveredInstance].rawItem.DESCRICAO}</div>
                       <div className="text-slate-400 text-[10px]">Cód: {data[hoveredInstance].rawItem.CODIGO}</div>
                   </div>
               )}

               {!data[hoveredInstance].rawItem && !data[hoveredInstance].pulmaoItem && (
                   <div className="text-slate-500 italic">Posição Vazia</div>
               )}
            </div>
         </Html>
      )}
    </group>
  );
};

// ... (WalkController and Scene3D export logic largely unchanged but includes colorMode prop) ...

function WalkController({ teleportPos, isMobileOpen }: { teleportPos: {x:number, y:number, z:number}|null, isMobileOpen: boolean }) {
  const [, getKeys] = useKeyboardControls();
  const { camera } = useThree();
  const speed = 10; 
  
  useEffect(() => {
    if (teleportPos) {
       camera.position.set(teleportPos.x, teleportPos.y, teleportPos.z); 
       camera.lookAt(teleportPos.x, teleportPos.y, teleportPos.z - 5);
    }
  }, [teleportPos, camera]);

  useFrame((state, delta) => {
    if (isMobileOpen) return;

    const { forward, backward, left, right, run } = getKeys();
    const currentSpeed = run ? speed * 2.5 : speed;
    
    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3(0, 0, (backward ? 1 : 0) - (forward ? 1 : 0));
    const sideVector = new THREE.Vector3((left ? 1 : 0) - (right ? 1 : 0), 0, 0);
    
    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(currentSpeed * delta)
      .applyEuler(camera.rotation);

    direction.y = 0;
    camera.position.add(direction);
    camera.position.y = 1.7; 
  });

  return null;
}

export const Scene3D: React.FC<SceneProps> = ({ data, visibleStatus, visibleTypes, visibleItemIds, mode, onSelect, selectedId, teleportPos, isMobileOpen, colorMode }) => {
  return (
    <div id="canvas-container" className="w-full h-full bg-[#0f172a] relative">
      
      {mode === 'WALK' && !isMobileOpen && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/50 rounded-full z-10 pointer-events-none shadow-[0_0_2px_rgba(255,255,255,0.8)]" />
      )}

      <KeyboardControls map={keyboardMap}>
        <Canvas shadows dpr={[1, 1.5]}>
          <PerspectiveCamera makeDefault position={[40, 30, 40]} fov={60} near={0.1} far={8000} />
          
          <ambientLight intensity={0.8} />
          <directionalLight 
            position={[50, 100, 50]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize={[2048, 2048]} 
          />
          <Sky sunPosition={[100, 20, 100]} turbidity={0.5} rayleigh={0.5} />
          <Environment preset="city" />
          <fog attach="fog" args={['#0f172a', 100, 1500]} />

          {mode === 'ORBIT' && <OrbitControls makeDefault target={[20, 0, 20]} maxPolarAngle={Math.PI / 2.1} />}
          
          {mode === 'WALK' && !isMobileOpen && (
              <>
                <PointerLockControls selector="#canvas-container" />
                <WalkController teleportPos={teleportPos} isMobileOpen={isMobileOpen} />
              </>
          )}

          <group>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                  <planeGeometry args={[5000, 5000]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.8} />
              </mesh>
              <gridHelper args={[5000, 5000, 0x334155, 0x0f172a]} position={[0, 0.01, 0]} />

              <StreetLabels data={data} />
              <RackSystem data={data} visibleStatus={visibleStatus} visibleTypes={visibleTypes} visibleItemIds={visibleItemIds} onSelect={onSelect} selectedId={selectedId} colorMode={colorMode} />
          </group>
        </Canvas>
      </KeyboardControls>
    </div>
  );
};
