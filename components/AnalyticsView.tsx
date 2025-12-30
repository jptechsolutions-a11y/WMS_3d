import React, { useMemo, useState } from 'react';
import { MergedData, Suggestion } from '../types';
import { COLORS, DIMENSIONS } from '../constants';
import { AlertCircle, ArrowRight, CheckCircle2, SlidersHorizontal, Info, Target } from 'lucide-react';
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
  showSuggestionMap: boolean;
  setShowSuggestionMap: (b: boolean) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ 
    data, suggestions, onSelectSuggestion, selectedSuggestion, 
    workDays, setWorkDays, viewType, setViewType,
    showSuggestionMap, setShowSuggestionMap
}) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Filtering for Heatmap (Only Picking)
  const heatmapData = useMemo(() => {
    return data.filter(d => d.rawAddress.ESP === 'A');
  }, [data]);

  // Bounds Calculation
  const { bounds } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    heatmapData.forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.z < minZ) minZ = d.z;
      if (d.z > maxZ) maxZ = d.z;
    });
    const margin = 5;
    return { bounds: { minX: minX - margin, minZ: minZ - margin, w: (maxX - minX) + margin * 2, h: (maxZ - minZ) + margin * 2 } };
  }, [heatmapData]);

  // --- Map Suggestion Logic ---
  // Create a map of AddressID -> SuggestedColor for the "Future State" view
  const suggestionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!showSuggestionMap) return map;

    // We simulate the suggestions. 
    // We need to know which ITEM ends up in which ADDRESS.
    // The generateSuggestions logic paired (Best Item) -> (Best Address).
    // So we iterate suggestions to paint the TARGET address with the ITEM'S color.
    
    // Initialize with current colors
    heatmapData.forEach(d => {
        map.set(d.id, getColorForMetric(d, viewType));
    });

    suggestions.forEach(s => {
        // Find the item being moved
        const itemData = data.find(d => d.id === s.fromId);
        if (itemData) {
            const color = getColorForMetric(itemData, viewType);
            map.set(s.toId, color); // The Target gets the Item's color
        }
    });
    return map;
  }, [suggestions, showSuggestionMap, data, viewType, heatmapData]);

  // Interaction Handlers
  const handleWheel = (e: React.WheelEvent) => {
    const newK = Math.max(0.5, Math.min(5, e.deltaY < 0 ? transform.k * 1.1 : transform.k / 1.1));
    setTransform(p => ({ ...p, k: newK }));
  };
  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(p => ({ ...p, x: p.x + (e.clientX - lastPos.x), y: p.y + (e.clientY - lastPos.y) }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const baseScale = 15;

  return (
    <div className="flex h-full w-full bg-[#0f172a] overflow-hidden">
        
        {/* LEFT PANEL: CONFIG & SUGGESTIONS */}
        <div className="w-96 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
            <div className="p-4 border-b border-slate-800">
                <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
                    <SlidersHorizontal size={20} className="text-cyan-400" /> Análise ABC / PQR
                </h2>
                <p className="text-slate-500 text-xs">Otimização de Picking por Curva</p>
            </div>

            <div className="p-4 space-y-4 border-b border-slate-800 bg-slate-900/50">
                {/* Configuration */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Dias Úteis (Período)</label>
                        <div className="group relative">
                             <Info size={12} className="text-slate-600 cursor-help" />
                             <div className="absolute right-0 top-4 w-48 bg-slate-800 p-2 rounded border border-slate-700 text-[10px] text-slate-300 hidden group-hover:block z-50 shadow-xl">
                                 Define o divisor para média diária. <br/>
                                 PQR = Visitas / Dias <br/>
                                 ABC = Volume / Dias
                             </div>
                        </div>
                    </div>
                    <input 
                        type="number" 
                        value={workDays} 
                        onChange={(e) => setWorkDays(parseInt(e.target.value) || 1)} 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                    />
                </div>

                {/* View Toggles */}
                <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setViewType('ABC')} className={clsx("text-[10px] py-1.5 rounded font-bold transition-all", viewType === 'ABC' ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300")}>Curva ABC</button>
                    <button onClick={() => setViewType('PQR')} className={clsx("text-[10px] py-1.5 rounded font-bold transition-all", viewType === 'PQR' ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300")}>Curva PQR</button>
                    <button onClick={() => setViewType('COMBINED')} className={clsx("text-[10px] py-1.5 rounded font-bold transition-all", viewType === 'COMBINED' ? "bg-cyan-600 text-white" : "text-slate-500 hover:text-slate-300")}>Mix</button>
                </div>

                {/* Compare Toggle */}
                <button 
                    onClick={() => setShowSuggestionMap(!showSuggestionMap)}
                    className={clsx(
                        "w-full py-2 px-4 rounded text-xs font-bold flex items-center justify-center gap-2 border transition-all",
                        showSuggestionMap 
                         ? "bg-purple-600/20 border-purple-500 text-purple-400" 
                         : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    )}
                >
                    {showSuggestionMap ? "Visualizando: SUGESTÃO" : "Visualizando: ATUAL"}
                </button>
                
                {/* Legend */}
                <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                    <div className="bg-green-500/20 text-green-400 py-1 rounded border border-green-500/30">Alta (A/P)</div>
                    <div className="bg-yellow-500/20 text-yellow-400 py-1 rounded border border-yellow-500/30">Média (B/Q)</div>
                    <div className="bg-red-500/20 text-red-400 py-1 rounded border border-red-500/30">Baixa (C/R)</div>
                </div>
            </div>

            {/* Suggestions List */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Sugestões de Troca</span>
                    <span className="bg-cyan-900 text-cyan-400 px-2 py-0.5 rounded-full text-[9px]">{suggestions.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {suggestions.length === 0 ? (
                        <div className="text-center text-slate-600 text-xs mt-10 p-4 border border-dashed border-slate-800 rounded">
                            <CheckCircle2 size={24} className="mx-auto mb-2 opacity-50"/>
                            Nenhuma sugestão encontrada. O armazém parece otimizado para os parâmetros atuais!
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
                                    <div className="flex items-center gap-2">
                                        <span className={clsx("w-2 h-2 rounded-full", s.priority === 'HIGH' ? "bg-red-500" : s.priority === 'MEDIUM' ? "bg-yellow-500" : "bg-blue-500")} />
                                        <span className="text-xs font-bold text-white line-clamp-1">{s.productDesc}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-500">{s.productCode}</span>
                                </div>
                                
                                <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/50 p-2 rounded">
                                    <div className="text-center">
                                        <div className="text-red-400 font-mono mb-0.5">{s.fromAddress}</div>
                                        <div className="text-[8px] uppercase">Origem</div>
                                    </div>
                                    <ArrowRight size={12} className="text-slate-600"/>
                                    <div className="text-center">
                                        <div className="text-green-400 font-mono font-bold mb-0.5">{s.toAddress}</div>
                                        <div className="text-[8px] uppercase">Destino</div>
                                    </div>
                                </div>
                                {selectedSuggestion === s && (
                                    <div className="mt-2 text-[10px] text-cyan-400 animate-in fade-in">
                                        {s.reason}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT PANEL: HEATMAP */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden cursor-move"
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={() => setIsDragging(false)}
             onMouseLeave={() => setIsDragging(false)}
             onWheel={handleWheel}
        >
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="text-white font-bold text-xl drop-shadow-md">
                    MAPA DE CALOR: <span className={showSuggestionMap ? "text-purple-400" : "text-cyan-400"}>{showSuggestionMap ? "CENÁRIO FUTURO (SUGESTÃO)" : "CENÁRIO ATUAL"}</span>
                </h3>
            </div>

            <svg 
                width="100%" 
                height="100%"
                viewBox={`${bounds.minX * baseScale} ${bounds.minZ * baseScale} ${bounds.w * baseScale} ${bounds.h * baseScale}`}
                style={{ 
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <defs>
                   <pattern id="gridAnaly" width={baseScale * 5} height={baseScale * 5} patternUnits="userSpaceOnUse">
                     <path d={`M ${baseScale * 5} 0 L 0 0 0 ${baseScale * 5}`} fill="none" stroke="#1e293b" strokeWidth="1"/>
                   </pattern>
                </defs>
                <rect x={bounds.minX * baseScale} y={bounds.minZ * baseScale} width={bounds.w * baseScale} height={bounds.h * baseScale} fill="url(#gridAnaly)" />

                {heatmapData.map(item => {
                    const sx = item.x * baseScale;
                    const sy = item.z * baseScale;
                    const w = 1.6 * baseScale;
                    const h = DIMENSIONS.RACK_DEPTH * baseScale;
                    
                    // Determine Color
                    let fill = '#334155'; // Default gray
                    
                    if (showSuggestionMap) {
                        fill = suggestionColorMap.get(item.id) || '#334155';
                    } else {
                        fill = getColorForMetric(item, viewType);
                    }

                    // Blinking Logic for Selection
                    const isSource = selectedSuggestion?.fromId === item.id;
                    const isTarget = selectedSuggestion?.toId === item.id;
                    
                    return (
                        <g key={item.id}>
                            <rect
                                x={sx - w/2} 
                                y={sy}
                                width={w}
                                height={h}
                                fill={fill}
                                opacity={0.9}
                                stroke={isSource || isTarget ? 'white' : 'black'}
                                strokeWidth={isSource || isTarget ? 2 : 0.5}
                                rx={2}
                            >
                                {(isSource || isTarget) && (
                                    <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
                                )}
                            </rect>
                            
                            {/* Target Icon for Destination */}
                            {isTarget && (
                                <g transform={`translate(${sx}, ${sy + h/2}) scale(0.1)`}>
                                     <circle r="50" fill="none" stroke="white" strokeWidth="10" />
                                     <line x1="-70" y1="0" x2="70" y2="0" stroke="white" strokeWidth="10" />
                                     <line x1="0" y1="-70" x2="0" y2="70" stroke="white" strokeWidth="10" />
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    </div>
  );
};

function getColorForMetric(item: MergedData, type: 'ABC' | 'PQR' | 'COMBINED'): string {
    if (!item.analytics) return '#334155';

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
        // Combined Logic (Simplified for visualization)
        // If High Priority (A or P) -> Green
        // If Medium (B or Q) -> Yellow
        // If Low (C or R) -> Red
        const isHigh = item.analytics.abcClass === 'A' || item.analytics.pqrClass === 'P';
        const isLow = item.analytics.abcClass === 'C' && item.analytics.pqrClass === 'R';
        
        if (isHigh) return COLORS.CLASS_A;
        if (isLow) return COLORS.CLASS_C;
        return COLORS.CLASS_B;
    }
    return '#334155';
}
