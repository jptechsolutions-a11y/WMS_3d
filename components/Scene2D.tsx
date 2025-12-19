import React, { useMemo, useState, useRef } from 'react';
import { MergedData } from '../types';
import { DIMENSIONS } from '../constants';
import { ZoomIn, ZoomOut, LocateFixed } from 'lucide-react';

interface Scene2DProps {
  data: MergedData[];
  onSelect: (item: MergedData) => void;
  selectedId: string | null;
}

export const Scene2D: React.FC<Scene2DProps> = ({ data, onSelect, selectedId }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Calcular limites do armazém para centralizar a visualização
  const { bounds, streetLabels } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const streets = new Map<string, { sumX: number, maxZ: number, count: number }>();

    if (data.length === 0) {
        return { bounds: { minX: 0, minZ: 0, w: 100, h: 100 }, streetLabels: [] };
    }

    data.forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.z < minZ) minZ = d.z;
      if (d.z > maxZ) maxZ = d.z;

      // Agrupar para labels de rua
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
        name, x: val.sumX / val.count, z: val.maxZ + 2
    }));

    return { bounds: { minX: minX - margin, minZ: minZ - margin, w, h }, streetLabels: labels };
  }, [data]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const newK = e.deltaY < 0 ? transform.k * scaleFactor : transform.k / scaleFactor;
    setTransform(prev => ({ ...prev, k: Math.max(0.1, Math.min(20, newK)) }));
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

  const handleMouseUp = () => isDragging.current = false;
  
  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });

  const baseScale = 15; // Pixels por metro

  return (
    <div 
        ref={containerRef}
        className="w-full h-full bg-slate-900 overflow-hidden relative cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
    >
       <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
          <button onClick={() => setTransform(p => ({ ...p, k: p.k * 1.2 }))} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><ZoomIn size={20}/></button>
          <button onClick={() => setTransform(p => ({ ...p, k: p.k / 1.2 }))} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><ZoomOut size={20}/></button>
          <button onClick={resetView} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><LocateFixed size={20}/></button>
       </div>

       <svg 
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
               <path d={`M ${baseScale * 5} 0 L 0 0 0 ${baseScale * 5}`} fill="none" stroke="#1e293b" strokeWidth="2"/>
             </pattern>
          </defs>
          <rect x={bounds.minX * baseScale} y={bounds.minZ * baseScale} width={bounds.w * baseScale} height={bounds.h * baseScale} fill="url(#grid)" />

          {/* Labels das Ruas */}
          {streetLabels.map(s => (
              <text key={s.name} x={s.x * baseScale} y={s.z * baseScale} textAnchor="middle" fontSize={baseScale * 1.5} fontWeight="bold" fill="#64748b" style={{ pointerEvents: 'none' }}>
                  {s.name}
              </text>
          ))}

          {/* Posições */}
          {data.map(item => {
             const sx = item.x * baseScale;
             const sy = item.z * baseScale;
             const w = 1.6 * baseScale; // Largura do rack visual
             const h = DIMENSIONS.RACK_DEPTH * baseScale;
             
             const isSelected = selectedId === item.id;

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
                    fill={item.color}
                    stroke={isSelected ? 'white' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                    rx={2}
                 />
                 {/* Mostrar nível se tiver zoom suficiente */}
                 {transform.k > 1.5 && (
                     <text x={sx} y={sy + h/2} fontSize={baseScale * 0.4} fill="black" textAnchor="middle" dominantBaseline="middle" pointerEvents="none" fontWeight="bold">
                        {item.rawAddress.SL}
                     </text>
                 )}
                 <title>{`${item.rawAddress.RUA}-${item.rawAddress.PRED}-${item.rawAddress.AP}`}</title>
               </g>
             );
          })}
       </svg>
    </div>
  );
};
