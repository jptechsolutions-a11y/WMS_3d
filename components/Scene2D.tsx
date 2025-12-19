import React, { useMemo, useState, useRef } from 'react';
import { MergedData, AnalysisConfig } from '../types';
import { COLORS, DIMENSIONS } from '../constants';
import { ZoomIn, ZoomOut, LocateFixed, HelpCircle, ArrowRightLeft, Target } from 'lucide-react';
import clsx from 'clsx';

interface CurveAnalysisProps {
  data: MergedData[];
  onSelect: (data: MergedData) => void;
  selectedId: string | null;
  config: AnalysisConfig;
}

export const CurveAnalysis: React.FC<CurveAnalysisProps> = ({ data, onSelect, selectedId, config }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [showHelp, setShowHelp] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // 1. Filtrar Apenas APANHA (ESP = 'A') para visualização
  const pickingData = useMemo(() => {
    return data.filter(d => d.rawAddress.ESP === 'A');
  }, [data]);

  // 2. Calcular Sugestões de Layout
  // Lógica: Classificar Endereços "Bons" vs Itens "Bons"
  const suggestedMapping = useMemo(() => {
    // Apenas calculamos se necessário ou sempre para ter a sugestão pronta
    const mapping = new Map<string, string>(); // ItemID -> PositionID (Onde este item DEVERIA estar)
    
    // Agrupar por Setor para não sugerir mover item da "Frios" para "Secos"
    const sectors = new Set(pickingData.map(d => d.sector));
    
    sectors.forEach(sec => {
        const sectorData = pickingData.filter(d => d.sector === sec);
        
        // A. Classificar Posições (Endereços)
        // Critério: Início da rua (Maior Z no nosso sistema, pois ruas crescem para Z negativo) e Nível Baixo (Menor Y)
        // Score Posição = Z - (Y * PenalidadeAltura). 
        // Assumindo Z=0 é o início, Z=-100 é o fundo. 
        const positions = sectorData.map(d => ({
            posId: d.id,
            // Score simplificado: Prioriza Z (início) depois Y (chão)
            // No nosso sistema: Z positivo/perto de 0 é inicio.
            // Y: 0 é chão.
            score: (d.z * 10) - (d.y * 50) 
        })).sort((a, b) => b.score - a.score); // Melhores posições primeiro

        // B. Classificar Itens (Produtos atualmente nesses endereços)
        // Baseado no idealRank calculado no DataProcessor (Score = Visitas + Cubagem)
        const items = sectorData.map(d => ({
            itemId: d.id,
            rank: d.curveData?.idealRank || 999999 // Itens sem dados vão pro fim
        })).sort((a, b) => a.rank - b.rank); // Melhores itens (Rank 1) primeiro

        // C. Match: Melhor Item -> Melhor Posição
        items.forEach((item, idx) => {
            if (positions[idx]) {
                mapping.set(item.itemId, positions[idx].posId);
            }
        });
    });

    return mapping;
  }, [pickingData]);

  // 3. Preparar dados de Renderização (Cores)
  const renderData = useMemo(() => {
      // Inverter o mapa para facilitar: PositionID -> IdealItemID
      const positionToIdealItem = new Map<string, string>();
      suggestedMapping.forEach((posId, itemId) => {
          positionToIdealItem.set(posId, itemId);
      });

      return pickingData.map(d => {
          let finalColor = '#334155'; // Base slate
          
          // Determinar qual "Dados de Curva" usar para colorir este endereço
          let sourceCurve = d.curveData;

          // Se estiver no modo SUGGESTED, pegamos a curva do item que DEVERIA estar aqui
          if (config.viewState === 'SUGGESTED') {
              const idealItemId = positionToIdealItem.get(d.id);
              if (idealItemId) {
                  const idealItem = pickingData.find(i => i.id === idealItemId);
                  if (idealItem) sourceCurve = idealItem.curveData;
              }
          }

          if (sourceCurve) {
              if (config.curveType === 'ABC') {
                  if (sourceCurve.abcClass === 'A') finalColor = COLORS.CURVE_A;
                  else if (sourceCurve.abcClass === 'B') finalColor = COLORS.CURVE_B;
                  else finalColor = COLORS.CURVE_C;
              } else if (config.curveType === 'PQR') {
                  if (sourceCurve.pqrClass === 'P') finalColor = COLORS.CURVE_A;
                  else if (sourceCurve.pqrClass === 'Q') finalColor = COLORS.CURVE_B;
                  else finalColor = COLORS.CURVE_C;
              } else {
                  // CROSS
                  if (sourceCurve.combinedClass === 'AA') finalColor = COLORS.CURVE_A;
                  else if (sourceCurve.combinedClass === 'BB') finalColor = COLORS.CURVE_B;
                  else finalColor = COLORS.CURVE_C;
              }
          } else {
              // Sem dados de curva
              finalColor = '#1e293b'; 
          }

          return { ...d, renderColor: finalColor };
      });
  }, [pickingData, config, suggestedMapping]);

  // --- Viewport Logic ---
  const { bounds, streetLabels } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const streets = new Map<string, { sumX: number, maxZ: number, count: number }>();

    pickingData.forEach(d => {
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
        name, x: val.sumX / val.count, z: val.maxZ + 2
    }));

    return { bounds: { minX: minX - margin, minZ: minZ - margin, w, h }, streetLabels: labels };
  }, [pickingData]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const newK = e.deltaY < 0 ? transform.k * scaleFactor : transform.k / scaleFactor;
    setTransform(prev => ({ ...prev, k: Math.max(0.5, Math.min(10, newK)) }));
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
  const baseScale = 15;

  // Lógica de Piscada (Blink) do Alvo Sugerido
  const blinkTargetId = useMemo(() => {
     if (selectedId && config.viewState === 'CURRENT') {
         // Se estou vendo o atual e selecionei um item, qual é a posição sugerida para ele?
         return suggestedMapping.get(selectedId);
     }
     return null;
  }, [selectedId, config.viewState, suggestedMapping]);

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
       {/* UI Helper */}
       <div className="absolute top-4 left-4 z-10 flex gap-4">
          <div className="bg-slate-800/90 p-4 rounded border border-slate-700 shadow-xl backdrop-blur max-w-sm">
             <div className="flex items-center justify-between mb-2">
                 <h3 className="font-bold text-cyan-400 flex items-center gap-2"><ArrowRightLeft size={16}/> Sugestão de Logística</h3>
                 <button onClick={() => setShowHelp(!showHelp)} className="text-slate-400 hover:text-white"><HelpCircle size={16}/></button>
             </div>
             
             {selectedId ? (
                 <div className="text-xs text-slate-300">
                     {(() => {
                         const item = renderData.find(d => d.id === selectedId);
                         const targetId = suggestedMapping.get(selectedId);
                         const targetPos = renderData.find(d => d.id === targetId);
                         
                         if (!item) return "Item não encontrado.";
                         if (!targetId || targetId === selectedId) return <span className="text-green-400 font-bold block p-2 bg-green-900/20 border border-green-500/30 rounded">Este item já está na melhor posição possível!</span>;
                         
                         return (
                             <div className="space-y-3">
                                 <div className="p-2 bg-slate-700/50 rounded border border-slate-600">
                                     <span className="block text-[9px] uppercase text-slate-500 mb-1">Item Selecionado</span>
                                     <div className="font-bold text-white text-sm">{item.rawItem?.DESCRICAO}</div>
                                     <div className="flex gap-2 mt-2">
                                         <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold text-black", item.curveData?.pqrClass === 'P' ? 'bg-green-400' : (item.curveData?.pqrClass === 'Q' ? 'bg-yellow-400' : 'bg-red-400'))}>PQR: {item.curveData?.pqrClass}</span>
                                         <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold text-black", item.curveData?.abcClass === 'A' ? 'bg-green-400' : (item.curveData?.abcClass === 'B' ? 'bg-yellow-400' : 'bg-red-400'))}>ABC: {item.curveData?.abcClass}</span>
                                     </div>
                                 </div>
                                 
                                 <div className="flex flex-col items-center text-cyan-500 gap-1">
                                    <div className="h-4 w-[1px] bg-cyan-500/50"></div>
                                    <Target size={20} className="animate-bounce"/>
                                 </div>
                                 
                                 <div className="p-2 bg-cyan-900/20 rounded border border-cyan-500/30 animate-pulse">
                                     <span className="block text-[9px] uppercase text-cyan-400 mb-1">Mover Para (Sugerido)</span>
                                     <div className="font-mono text-lg font-bold text-white tracking-wider">{targetPos?.rawAddress.RUA} - {targetPos?.rawAddress.PRED} - {targetPos?.rawAddress.AP}</div>
                                     <div className="text-[10px] text-slate-400 mt-1">Localização no mapa está piscando em Ciano.</div>
                                 </div>
                             </div>
                         );
                     })()}
                 </div>
             ) : (
                 <p className="text-xs text-slate-500 italic">Clique em um endereço no mapa para ver a análise e sugestão de movimentação.</p>
             )}
          </div>
       </div>

       {showHelp && (
           <div className="absolute top-4 left-96 z-20 bg-black/95 text-white p-4 rounded w-80 text-xs border border-slate-600 shadow-2xl animate-in slide-in-from-left">
               <div className="flex justify-between mb-2">
                   <h4 className="font-bold text-cyan-400 text-sm">Lógica da Curva</h4>
                   <button onClick={() => setShowHelp(false)}><ArrowRightLeft size={14}/></button>
               </div>
               <p className="mb-2 text-slate-300">A classificação é feita dentro do período selecionado:</p>
               <ul className="list-disc pl-4 space-y-2 text-slate-400 mb-4">
                   <li><strong>PQR (Frequência):</strong> Calculado por Visitas / Dias Úteis. Itens mais visitados são 'P'.</li>
                   <li><strong>ABC (Volume):</strong> Calculado por Volumes / Dias Úteis. Itens com mais caixas movidas são 'A'.</li>
               </ul>
               <p className="mb-2 text-slate-300 font-bold">Lógica de Sugestão:</p>
               <p className="text-slate-400 leading-relaxed">
                  O sistema calcula um <strong>Ranking Ideal</strong> cruzando Visitas e Cubagem. 
                  Itens de alta frequência (P) e grande porte (Cubagem alta) recebem prioridade máxima para o <strong>Início da Rua</strong> (Ergonomia e menor deslocamento).
               </p>
           </div>
       )}

       <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
          <button onClick={() => setTransform(p => ({ ...p, k: p.k * 1.2 }))} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><ZoomIn size={20}/></button>
          <button onClick={() => setTransform(p => ({ ...p, k: p.k / 1.2 }))} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><ZoomOut size={20}/></button>
          <button onClick={() => setTransform({ x: 0, y: 0, k: 1 })} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><LocateFixed size={20}/></button>
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
             <pattern id="grid-dark" width={baseScale * 5} height={baseScale * 5} patternUnits="userSpaceOnUse">
               <path d={`M ${baseScale * 5} 0 L 0 0 0 ${baseScale * 5}`} fill="none" stroke="#1e293b" strokeWidth="2"/>
             </pattern>
          </defs>
          <rect x={bounds.minX * baseScale} y={bounds.minZ * baseScale} width={bounds.w * baseScale} height={bounds.h * baseScale} fill="url(#grid-dark)" />

          {streetLabels.map(s => (
              <text key={s.name} x={s.x * baseScale} y={s.z * baseScale} textAnchor="middle" fontSize={baseScale * 1.5} fontWeight="bold" fill="#64748b" style={{ pointerEvents: 'none' }}>
                  {s.name}
              </text>
          ))}

          {renderData.map(item => {
             const sx = item.x * baseScale;
             const sy = item.z * baseScale;
             const w = 1.6 * baseScale;
             const h = DIMENSIONS.RACK_DEPTH * baseScale;
             const isSelected = selectedId === item.id;
             const isBlinking = blinkTargetId === item.id;

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
                    fill={item.renderColor}
                    stroke={isSelected ? 'white' : (isBlinking ? '#06b6d4' : 'none')}
                    strokeWidth={isSelected ? 3 : (isBlinking ? 4 : 0)}
                    rx={2}
                    className={isBlinking ? "animate-pulse" : ""}
                 />
                 {transform.k > 1.5 && (
                     <text x={sx} y={sy + h/2} fontSize={baseScale * 0.4} fill="black" textAnchor="middle" dominantBaseline="middle" pointerEvents="none" fontWeight="bold">
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
