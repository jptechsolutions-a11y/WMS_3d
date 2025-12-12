import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MergedData } from '../types';
import { DIMENSIONS, COLORS } from '../constants';
import { ZoomIn, ZoomOut, Move, LocateFixed } from 'lucide-react';

interface Scene2DProps {
  data: MergedData[];
  onSelect: (data: MergedData) => void;
  selectedId: string | null;
  colorMode: 'REALISTIC' | 'STATUS' | 'PQR' | 'ABC' | 'SUGGESTION_PQR'; // [ATUALIZADO]
}

export const Scene2D: React.FC<Scene2DProps> = ({ data, onSelect, selectedId, colorMode }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 }); 
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

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

  // ... (Zoom logic preserved) ...
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

  // [ATUALIZADO] Lógica de Cor
  const getItemColor = (item: MergedData) => {
    if (colorMode === 'SUGGESTION_PQR' && item.analysis?.suggestedClass) {
       // Pinta com a cor da classe SUGERIDA
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
       <div className="absolute top-4 left-4 text-slate-500 font-mono text-sm z-10 pointer-events-none select-none">
         TOP DOWN VIEW • 
         {colorMode === 'PQR' && <span className="text-purple-600 font-bold ml-2">ATUAL</span>}
         {colorMode === 'SUGGESTION_PQR' && <span className="text-emerald-600 font-bold ml-2">SUGESTÃO OTIMIZADA</span>}
       </div>

       {/* ... (Zoom Controls Preserved) ... */}
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

          {data.map(item => {
             const sx = item.x * baseScale;
             const sy = item.z * baseScale;
             const w = 1.6 * baseScale;
             const h = DIMENSIONS.RACK_DEPTH * baseScale;
             const isSelected = selectedId === item.id;
             const fillColor = getItemColor(item); 

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
                    stroke={isSelected ? 'black' : '#fff'}
                    strokeWidth={isSelected ? 2 : 1}
                    rx={2}
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
       </svg>
    </div>
  );
};
