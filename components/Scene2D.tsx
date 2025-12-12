import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MergedData } from '../types';
import { DIMENSIONS, COLORS } from '../constants';
import { ZoomIn, ZoomOut, Move, LocateFixed } from 'lucide-react';

interface Scene2DProps {
  data: MergedData[];
  onSelect: (data: MergedData) => void;
  selectedId: string | null;
  colorMode: 'REALISTIC' | 'STATUS' | 'PQR' | 'ABC' | 'SUGGESTION_PQR'; 
  allData?: MergedData[]; // [NOVO] Necessário para achar coordenadas do alvo
}

export const Scene2D: React.FC<Scene2DProps> = ({ data, onSelect, selectedId, colorMode, allData }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 }); 
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // [NOVO] Lookup Map para encontrar coordenadas de qualquer endereço rapidamente
  const addressLookup = useMemo(() => {
     const map = new Map<string, { x: number, z: number }>();
     const source = allData || data;
     source.forEach(d => {
         const addrKey = `${d.rawAddress.RUA}-${d.rawAddress.PRED}-${d.rawAddress.AP}`;
         map.set(addrKey, { x: d.x, z: d.z });
     });
     return map;
  }, [allData, data]);

  // [NOVO] Dados do Item Selecionado e seu Alvo (se houver sugestão)
  const selectionInfo = useMemo(() => {
     if (!selectedId) return null;
     const selected = data.find(d => d.id === selectedId);
     if (!selected || !selected.analysis?.suggestionMove) return null;

     const targetAddr = selected.analysis.suggestionMove.toAddress; // "RUA-PRED-AP"
     // Normalizar string para bater com a chave do mapa (remover zeros se necessario, mas aqui assumimos consistencia)
     // O suggestionMove.toAddress vem do gerador que usa o mesmo formato.
     const targetCoords = addressLookup.get(targetAddr);
     
     if (!targetCoords) return null;

     return {
         source: { x: selected.x, z: selected.z },
         target: targetCoords
     };
  }, [selectedId, data, addressLookup]);

  const { bounds, streetLabels } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const streets = new Map<string, { sumX: number, maxZ: number, count: number }>(); 

    data.forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.z < minZ) minZ = d.z;
      if (d.z > maxZ) maxZ = d.z;

      if (!streets.has(d.rawAddress.RUA)) {
          streets.set(d.rawAddress.RUA, { sumX: 0, maxZ: -Infinity, count: 0 });
      }
      const s = streets.get(d.rawAddress.RUA)!;
      s.sumX += d.x;
      if (d.z > s.maxZ) s.maxZ = d.z; 
      s.count++;
    });

    const margin = 5;
    const w = (maxX - minX) + margin * 2;
    const h = (maxZ - minZ) + margin * 2;

    const labels = Array.from(streets.entries()).map(([name, val]) => ({
        name,
        x: val.sumX / val.count,
        z: val.maxZ + 2 
    }));

    return { 
        bounds: { minX: minX - margin, minZ: minZ - margin, w, h },
        streetLabels: labels
    };
  }, [data]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const newK = e.deltaY < 0 ? transform.k * scaleFactor : transform.k / scaleFactor;
    const k = Math.max(0.5, Math.min(10, newK));
    setTransform(prev => ({ ...prev, k }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const resetView = () => {
      setTransform({ x: 0, y: 0, k: 1 });
  };

  const baseScale = 15; 

  const getItemColor = (item: MergedData) => {
    if (colorMode === 'SUGGESTION_PQR' && item.analysis?.suggestedClass) {
       if (item.analysis.suggestedClass === 'P') return COLORS.PQR_P;
       if (item.analysis.suggestedClass === 'Q') return COLORS.PQR_Q;
       if (item.analysis.suggestedClass === 'R') return COLORS.PQR_R;
    }
    
    if (colorMode === 'PQR' && item.analysis?.pqrClass) {
       if (item.analysis.pqrClass === 'P') return COLORS.PQR_P;
       if (item.analysis.pqrClass === 'Q') return COLORS.PQR_Q;
       if (item.analysis.pqrClass === 'R') return COLORS.PQR_R;
       return COLORS.PQR_NULL;
    }
    return item.color;
  };

  return (
    <div 
        ref={containerRef}
        className="w-full h-full bg-slate-100 overflow-hidden relative cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
    >
       {/* CSS para Animação de Piscar */}
       <style>{`
         @keyframes neonBlink {
           0%, 100% { stroke: #06b6d4; stroke-width: 2px; fill-opacity: 1; }
           50% { stroke: #22d3ee; stroke-width: 4px; fill-opacity: 0.5; }
         }
         .target-blink {
           animation: neonBlink 1s infinite alternate;
         }
         @keyframes dashDraw {
           to { stroke-dashoffset: 0; }
         }
       `}</style>

       <div className="absolute top-4 left-4 text-slate-500 font-mono text-sm z-10 pointer-events-none select-none bg-white/80 px-2 py-1 rounded shadow backdrop-blur-sm">
         TOP DOWN VIEW • 
         {colorMode === 'PQR' && <span className="text-purple-600 font-bold ml-2">MODO ATUAL</span>}
         {colorMode === 'SUGGESTION_PQR' && <span className="text-emerald-600 font-bold ml-2">MODO SUGESTÃO</span>}
       </div>

       <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
          <button onClick={() => setTransform(p => ({ ...p, k: p.k * 1.2 }))} className="p-2 bg-white shadow rounded hover:bg-slate-50"><ZoomIn size={20} className="text-slate-600"/></button>
          <button onClick={() => setTransform(p => ({ ...p, k: p.k / 1.2 }))} className="p-2 bg-white shadow rounded hover:bg-slate-50"><ZoomOut size={20} className="text-slate-600"/></button>
          <button onClick={resetView} className="p-2 bg-white shadow rounded hover:bg-slate-50"><LocateFixed size={20} className="text-slate-600"/></button>
       </div>
       
       <svg 
         ref={svgRef}
         width="100%" 
         height="100%"
         viewBox={`${bounds.minX * baseScale} ${bounds.minZ * baseScale} ${bounds.w * baseScale} ${bounds.h * baseScale}`}
         style={{ 
             transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
             transformOrigin: 'center center',
             transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
         }}
       >
          <defs>
             <pattern id="grid" width={baseScale * 5} height={baseScale * 5} patternUnits="userSpaceOnUse">
               <path d={`M ${baseScale * 5} 0 L 0 0 0 ${baseScale * 5}`} fill="none" stroke="#e2e8f0" strokeWidth="2"/>
             </pattern>
             <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
             </marker>
          </defs>
          <rect 
            x={bounds.minX * baseScale} 
            y={bounds.minZ * baseScale} 
            width={bounds.w * baseScale} 
            height={bounds.h * baseScale} 
            fill="url(#grid)" 
          />

          {streetLabels.map(s => (
              <text
                key={s.name}
                x={s.x * baseScale}
                y={s.z * baseScale}
                textAnchor="middle"
                fontSize={baseScale * 1.5}
                fontWeight="bold"
                fill="#475569"
                style={{ pointerEvents: 'none' }}
              >
                  {s.name}
              </text>
          ))}

          {/* Render Items */}
          {data.map(item => {
             const sx = item.x * baseScale;
             const sy = item.z * baseScale;
             const w = 1.6 * baseScale;
             const h = DIMENSIONS.RACK_DEPTH * baseScale;
             const isSelected = selectedId === item.id;
             const fillColor = getItemColor(item); 

             // Verifica se este item é o ALVO da sugestão do item selecionado
             let isTarget = false;
             if (selectionInfo && 
                 Math.abs(item.x - selectionInfo.target.x) < 0.01 && 
                 Math.abs(item.z - selectionInfo.target.z) < 0.01) {
                 isTarget = true;
             }

             return (
               <g 
                  key={item.id} 
                  onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
               >
                 <rect
                    x={sx - w/2} 
                    y={sy}
                    width={w}
                    height={h}
                    fill={fillColor}
                    stroke={isSelected ? 'black' : isTarget ? '#06b6d4' : '#fff'}
                    strokeWidth={isSelected ? 2 : isTarget ? 3 : 1}
                    rx={2}
                    className={isTarget ? "target-blink" : ""}
                 />
                 {transform.k > 1.5 && (
                     <text 
                        x={sx} 
                        y={sy + h/2} 
                        fontSize={baseScale * 0.4} 
                        fill={isSelected || fillColor === '#22c55e' || fillColor === '#eab308' ? 'black' : 'white'} 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                        pointerEvents="none"
                     >
                        {item.rawAddress.SL}
                     </text>
                 )}
               </g>
             );
          })}

          {/* [NOVO] Linha de Conexão De -> Para */}
          {selectionInfo && (
              <line 
                x1={selectionInfo.source.x * baseScale}
                y1={selectionInfo.source.z * baseScale + (DIMENSIONS.RACK_DEPTH * baseScale / 2)}
                x2={selectionInfo.target.x * baseScale}
                y2={selectionInfo.target.z * baseScale + (DIMENSIONS.RACK_DEPTH * baseScale / 2)}
                stroke="#06b6d4"
                strokeWidth={baseScale * 0.2}
                strokeDasharray="10,5"
                markerEnd="url(#arrowhead)"
                style={{ animation: 'dashDraw 1s linear infinite' }}
              />
          )}

       </svg>
    </div>
  );
};
