import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MergedData, CurveMode, AddressStatus } from '../types';
import { DIMENSIONS, COLORS } from '../constants';
import { ZoomIn, ZoomOut, Move, LocateFixed } from 'lucide-react';

interface Scene2DProps {
  data: MergedData[];
  onSelect: (data: MergedData) => void;
  selectedId: string | null;
  mode: '2D_PLAN' | '2D_APANHA_ONLY';
  curveMode: CurveMode;
  blinkId?: string | null; // ID para piscar (destino sugestivo)
}

export const Scene2D: React.FC<Scene2DProps> = ({ data, onSelect, selectedId, mode, curveMode, blinkId }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 }); 
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Filter Logic inside Component to handle mode specific filtering
  const visibleData = useMemo(() => {
      if (mode === '2D_APANHA_ONLY') {
          return data.filter(d => d.rawAddress.ESP === 'A');
      }
      return data;
  }, [data, mode]);

  const { bounds, streetLabels } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const streets = new Map<string, { sumX: number, maxZ: number, count: number }>(); 

    visibleData.forEach(d => {
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
        bounds: { minX: minX - margin, minZ: minZ - margin, w: w || 100, h: h || 100 },
        streetLabels: labels
    };
  }, [visibleData]);

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

  const baseScale = 15; 

  const getFillColor = (item: MergedData) => {
      if (curveMode === 'CURRENT_PQR') {
          return item.heatmapColor || COLORS.HEATMAP_EMPTY;
      }
      if (curveMode === 'SUGGESTED_PQR') {
          if (item.suggestedCurve === 'P') return COLORS.HEATMAP_P;
          if (item.suggestedCurve === 'Q') return COLORS.HEATMAP_Q;
          if (item.suggestedCurve === 'R') return COLORS.HEATMAP_R;
          return COLORS.HEATMAP_EMPTY;
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
       <div className="absolute top-4 left-4 text-slate-500 font-mono text-sm z-10 pointer-events-none select-none bg-white/80 p-2 rounded backdrop-blur">
         {mode === '2D_APANHA_ONLY' ? 'VISÃO EXCLUSIVA: APANHA' : 'VISÃO GERAL (PLANTA)'}
         <br/>
         <span className="text-[10px]">Scroll p/ Zoom • Arraste p/ Mover</span>
       </div>

       <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
          <button onClick={() => setTransform(p => ({ ...p, k: p.k * 1.2 }))} className="p-2 bg-white shadow rounded hover:bg-slate-50"><ZoomIn size={20} className="text-slate-600"/></button>
          <button onClick={() => setTransform(p => ({ ...p, k: p.k / 1.2 }))} className="p-2 bg-white shadow rounded hover:bg-slate-50"><ZoomOut size={20} className="text-slate-600"/></button>
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
          </defs>
          <rect x={bounds.minX * baseScale} y={bounds.minZ * baseScale} width={bounds.w * baseScale} height={bounds.h * baseScale} fill="url(#grid)" />

          {streetLabels.map(s => (
              <text key={s.name} x={s.x * baseScale} y={s.z * baseScale} textAnchor="middle" fontSize={baseScale * 1.5} fontWeight="bold" fill="#475569" style={{ pointerEvents: 'none' }}>{s.name}</text>
          ))}

          {visibleData.map(item => {
             const sx = item.x * baseScale;
             const sy = item.z * baseScale;
             const w = 1.6 * baseScale;
             const h = DIMENSIONS.RACK_DEPTH * baseScale;
             const isSelected = selectedId === item.id;
             const isBlinking = blinkId === item.id;
             const color = getFillColor(item);

             return (
               <g key={item.id} onClick={(e) => { e.stopPropagation(); onSelect(item); }} className={isBlinking ? "animate-pulse" : ""}>
                 <rect
                    x={sx - w/2} 
                    y={sy}
                    width={w}
                    height={h}
                    fill={color}
                    stroke={isSelected || isBlinking ? (isBlinking ? 'red' : 'black') : '#fff'}
                    strokeWidth={isSelected || isBlinking ? 2 : 1}
                    rx={2}
                 />
                 {transform.k > 1.5 && (
                     <text x={sx} y={sy + h/2} fontSize={baseScale * 0.4} fill={'black'} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" fontWeight="bold">
                        {item.rawAddress.SL}
                     </text>
                 )}
                 <title>{`Rua: ${item.rawAddress.RUA} | P: ${item.rawAddress.PRED} | AP: ${item.rawAddress.AP} | Status: ${item.rawAddress.STATUS}`}</title>
               </g>
             );
          })}
       </svg>
    </div>
  );
};
