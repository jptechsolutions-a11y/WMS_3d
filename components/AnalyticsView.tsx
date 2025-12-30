import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MergedData, Suggestion } from '../types';
import { COLORS, DIMENSIONS } from '../constants';
import { SlidersHorizontal, Info, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import clsx from 'clsx';

interface AnalyticsViewProps {
  data: MergedData[];
  suggestions: Suggestion[];
  onSelectSuggestion: (s: Suggestion) => void;
  selectedSuggestion: Suggestion | null;
  workDays: number;
  setWorkDays: (n: number) => void;
  viewType: 'ABC' | 'PQR' | 'COMBINED';
  setViewType: (v: 'ABC' | 'PQR' | 'COMBINED') => void;
  filters: { sector: string[] };
}

// Optimized Canvas Map Component
const CanvasMap = ({ 
    data, 
    colorMapping, 
    width, 
    height, 
    bounds, 
    title,
    highlightId
}: { 
    data: MergedData[], 
    colorMapping: Map<string, string>, 
    width: number, 
    height: number, 
    bounds: any, 
    title: string,
    highlightId?: string | null
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [transform, setTransform] = useState({ x: 20, y: 20, k: 0.8 }); // Initial zoom/pan
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    // Draw Logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#020617'; // Slate 950
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Adjust for bounds to center content roughly
        const offsetX = -bounds.minX * 15;
        const offsetZ = -bounds.minZ * 15;
        ctx.translate(offsetX, offsetZ);

        // Grid (Optional - simplified)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1 / transform.k;
        
        const SCALE = 15; // Base scale for world units to pixels
        
        data.forEach(d => {
            const color = colorMapping.get(d.id) || '#334155';
            const sx = d.x * SCALE;
            const sz = d.z * SCALE;
            const w = 1.6 * SCALE; 
            const h = DIMENSIONS.RACK_DEPTH * SCALE;

            ctx.fillStyle = color;
            ctx.fillRect(sx - w/2, sz, w, h);

            // Highlight border if selected
            if (highlightId && (d.id === highlightId)) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4 / transform.k;
                ctx.strokeRect(sx - w/2, sz, w, h);
                
                // Draw target crosshair
                ctx.beginPath();
                ctx.moveTo(sx, sz);
                ctx.lineTo(sx + w, sz + h);
                ctx.stroke();
            }
        });

        ctx.restore();

    }, [data, colorMapping, width, height, transform, bounds, highlightId]);

    // Pan/Zoom Handlers
    const handleWheel = (e: React.WheelEvent) => {
        const newK = Math.max(0.1, Math.min(10, e.deltaY < 0 ? transform.k * 1.1 : transform.k / 1.1));
        setTransform(p => ({ ...p, k: newK }));
    };
    
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setLastPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setTransform(p => ({ 
            ...p, 
            x: p.x + (e.clientX - lastPos.x), 
            y: p.y + (e.clientY - lastPos.y) 
        }));
        setLastPos({ x: e.clientX, y: e.clientY });
    };

    return (
        <div className="relative w-full h-full border border-slate-800 rounded overflow-hidden group">
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white pointer-events-none select-none z-10 backdrop-blur-sm border border-white/10">
                {title}
            </div>
            <canvas 
                ref={canvasRef}
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onWheel={handleWheel}
                className="cursor-move w-full h-full"
            />
        </div>
    );
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ 
    data, suggestions, onSelectSuggestion, selectedSuggestion, 
    workDays, setWorkDays, viewType, setViewType, filters
}) => {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 400 });

  useEffect(() => {
      if (!containerRef) return;
      const resize = () => {
          setDims({ w: containerRef.clientWidth, h: containerRef.clientHeight / 2 }); // Half height for split view
      };
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
  }, [containerRef]);

  // 1. Filter Data by Sector FIRST
  const filteredData = useMemo(() => {
    return data.filter(d => 
        d.rawAddress.ESP === 'A' && // Only Picking
        (filters.sector.length === 0 || filters.sector.includes(d.sector))
    );
  }, [data, filters.sector]);

  // 2. Calculate Bounds
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    filteredData.forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.z < minZ) minZ = d.z;
      if (d.z > maxZ) maxZ = d.z;
    });
    // Fallback if empty
    if (minX === Infinity) return { minX: 0, minZ: 0, w: 100, h: 100 };
    return { minX, minZ, maxX, maxZ, w: maxX - minX, h: maxZ - minZ };
  }, [filteredData]);

  // 3. Prepare Color Maps
  
  // MAP A: Current Scenario
  const currentColors = useMemo(() => {
      const map = new Map<string, string>();
      filteredData.forEach(d => {
          map.set(d.id, getColorForMetric(d, viewType));
      });
      return map;
  }, [filteredData, viewType]);

  // MAP B: Proposed Scenario (Suggestion)
  const proposedColors = useMemo(() => {
      const map = new Map<string, string>();
      
      // Initialize with current colors
      filteredData.forEach(d => {
        map.set(d.id, getColorForMetric(d, viewType));
      });

      // Apply suggestions (move items visually)
      suggestions.forEach(s => {
          // If the suggestion involves items in our filtered set
          const itemData = data.find(d => d.id === s.fromId);
          if (itemData) {
              const color = getColorForMetric(itemData, viewType);
              // Paint the TARGET address with the item's optimal color
              map.set(s.toId, color); 
              
              // Optionally paint the SOURCE address gray (empty) or keep it as is (swapped)
              // For simplicity, we assume source becomes empty or available, let's paint it gray/default
              // Unless it was a swap, but suggestions logic above is simple 1-way move logic.
              map.set(s.fromId, '#1e293b'); // Dark Slate (Empty/Available visual)
          }
      });
      return map;
  }, [filteredData, viewType, suggestions, data]);


  return (
    <div className="flex h-full w-full bg-[#0f172a] overflow-hidden">
        
        {/* LEFT PANEL: CONFIG & SUGGESTIONS */}
        <div className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
            <div className="p-4 border-b border-slate-800">
                <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
                    <SlidersHorizontal size={20} className="text-cyan-400" /> Análise Logística
                </h2>
                <p className="text-slate-500 text-xs">Comparativo de Cenários</p>
            </div>

            <div className="p-4 space-y-4 border-b border-slate-800 bg-slate-900/50">
                {/* Configuration */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Dias Úteis (Média)</label>
                    <input 
                        type="number" 
                        value={workDays} 
                        onChange={(e) => setWorkDays(parseInt(e.target.value) || 1)} 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                    />
                </div>

                {/* View Toggles */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Curva</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setViewType('ABC')} className={clsx("text-[10px] py-1.5 rounded font-bold transition-all", viewType === 'ABC' ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300")}>ABC</button>
                        <button onClick={() => setViewType('PQR')} className={clsx("text-[10px] py-1.5 rounded font-bold transition-all", viewType === 'PQR' ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300")}>PQR</button>
                        <button onClick={() => setViewType('COMBINED')} className={clsx("text-[10px] py-1.5 rounded font-bold transition-all", viewType === 'COMBINED' ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300")}>MIX</button>
                    </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-3 gap-2 text-[10px] text-center mt-2">
                    <div className="bg-green-500/20 text-green-400 py-1 rounded border border-green-500/30">Alta</div>
                    <div className="bg-yellow-500/20 text-yellow-400 py-1 rounded border border-yellow-500/30">Média</div>
                    <div className="bg-red-500/20 text-red-400 py-1 rounded border border-red-500/30">Baixa</div>
                </div>
            </div>

            {/* Suggestions List */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Sugestões ({suggestions.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {suggestions.length === 0 ? (
                        <div className="text-center text-slate-600 text-xs mt-10 p-4 border border-dashed border-slate-800 rounded">
                            <CheckCircle2 size={24} className="mx-auto mb-2 opacity-50"/>
                            Nenhuma sugestão para o filtro atual.
                        </div>
                    ) : (
                        suggestions.map((s, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => onSelectSuggestion(s)}
                                className={clsx(
                                    "p-3 rounded border cursor-pointer transition-all group",
                                    selectedSuggestion === s 
                                      ? "bg-cyan-900/20 border-cyan-500" 
                                      : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", s.priority === 'HIGH' ? "bg-red-500" : s.priority === 'MEDIUM' ? "bg-yellow-500" : "bg-blue-500")} />
                                        <span className="text-xs font-bold text-white truncate">{s.productDesc}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/50 p-2 rounded">
                                    <div>
                                        <div className="text-red-400 font-mono mb-0.5">{s.fromAddress}</div>
                                        <div className="text-[8px] uppercase opacity-50">Origem</div>
                                    </div>
                                    <ArrowRight size={12} className="text-slate-600"/>
                                    <div className="text-right">
                                        <div className="text-green-400 font-mono font-bold mb-0.5">{s.toAddress}</div>
                                        <div className="text-[8px] uppercase opacity-50">Destino</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT PANEL: SPLIT CANVAS MAPS */}
        <div className="flex-1 flex flex-col h-full bg-slate-950" ref={setContainerRef}>
            {/* Top Map: Current */}
            <div className="flex-1 border-b border-slate-800 relative">
                <CanvasMap 
                    data={filteredData} 
                    colorMapping={currentColors} 
                    width={dims.w} 
                    height={dims.h}
                    bounds={bounds}
                    title="CENÁRIO ATUAL"
                    highlightId={selectedSuggestion?.fromId}
                />
            </div>

            {/* Bottom Map: Proposed */}
            <div className="flex-1 relative">
                 <CanvasMap 
                    data={filteredData} 
                    colorMapping={proposedColors} 
                    width={dims.w} 
                    height={dims.h}
                    bounds={bounds}
                    title="PROPOSTA (SUGESTÃO)"
                    highlightId={selectedSuggestion?.toId}
                />
            </div>
        </div>
    </div>
  );
};

function getColorForMetric(item: MergedData, type: 'ABC' | 'PQR' | 'COMBINED'): string {
    if (!item.analytics) return '#334155'; // Default Slate 700

    if (type === 'ABC') {
        if (item.analytics.abcClass === 'A') return COLORS.CLASS_A;
        if (item.analytics.abcClass === 'B') return COLORS.CLASS_B;
        if (item.analytics.abcClass === 'C') return COLORS.CLASS_C;
    } 
    else if (type === 'PQR') {
        if (item.analytics.pqrClass === 'P') return COLORS.CLASS_P;
        if (item.analytics.pqrClass === 'Q') return COLORS.CLASS_Q;
        if (item.analytics.pqrClass === 'R') return COLORS.CLASS_R;
    } 
    else {
        // Combined
        const isHigh = item.analytics.abcClass === 'A' || item.analytics.pqrClass === 'P';
        const isLow = item.analytics.abcClass === 'C' && item.analytics.pqrClass === 'R';
        
        if (isHigh) return COLORS.CLASS_A;
        if (isLow) return COLORS.CLASS_C;
        return COLORS.CLASS_B;
    }
    return '#334155';
}
