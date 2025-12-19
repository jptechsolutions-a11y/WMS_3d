import React, { useMemo, useState, useRef, useEffect } from 'react';
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

  // 1. Filtrar Apenas APANHA (ESP = 'A') e o Setor (se necessário, mas o requisito diz "Todos endereços de apanha")
  const pickingData = useMemo(() => {
    return data.filter(d => d.rawAddress.ESP === 'A' && d.curveData);
  }, [data]);

  // 2. Calcular Layout "Sugerido"
  // O layout sugerido é uma projeção. Nós ordenamos as posições "Físicas" das melhores para as piores
  // E ordenamos os Itens dos melhores (Rank 1) para os piores.
  // Depois mapeamos: Melhor Item -> Melhor Posição.
  const suggestedMapping = useMemo(() => {
    if (config.viewState === 'CURRENT') return null;

    // A. Listar todas posições disponíveis no setor (Agrupadas por setor para não mover item da "Mercearia" para "Bazar")
    const sectors = new Set(pickingData.map(d => d.sector));
    const mapping = new Map<string, string>(); // ItemID -> PositionID (Onde ele deveria estar)
    
    sectors.forEach(sec => {
        const sectorItems = pickingData.filter(d => d.sector === sec);
        
        // Posições "Melhores": Menor Z (frente da rua), Nível 1 (Chão)
        // No nosso sistema 3D, Z negativo cresce para o fundo. Z Maior = Início da Rua.
        // Nível (Y) menor = Chão.
        // Score Posição = (Z * 100) - (Y * 1000). Quanto maior melhor.
        // Maior Z = Mais perto do corredor principal. Menor Y = Mais fácil de pegar.
        const positions = sectorItems.map(d => ({
            posId: d.id,
            score: (d.z * 10) - (d.y * 1000), // Prioriza chão (Y baixo penaliza score menos se for negativo... espera. Y é 0, 1.5, 3.0. Menor Y é melhor.)
            // Vamos simplificar: Score = Z (Início) - (Nível * penalidade gigante)
            // Assumindo Z=0 é o início da rua e vai ficando negativo.
            // Se Z vai de 0 a -50.
            // Nível 1 (y=0), Nível 2 (y=1.5).
            // Posição Ideal: Z=0, Y=0.
            d: d
        })).sort((a, b) => b.score - a.score); // Melhores posições primeiro

        // Itens "Melhores": Menor idealRank (1 é o melhor)
        const items = sectorItems.map(d => ({
            itemId: d.id,
            rank: d.curveData?.idealRank || 999999
        })).sort((a, b) => a.rank - b.rank); // Melhores itens primeiro

        // Mapear
        items.forEach((item, idx) => {
            if (positions[idx]) {
                mapping.set(item.itemId, positions[idx].posId);
            }
        });
    });

    return mapping;

  }, [pickingData, config.viewState]);


  // 3. Preparar dados para renderização (Cores e Posições)
  const renderData = useMemo(() => {
    return pickingData.map(d => {
       let color = '#334155'; // Default Slate
       const curve = d.curveData;

       if (curve) {
           if (config.curveType === 'ABC') {
               if (curve.abcClass === 'A') color = COLORS.CURVE_A;
               else if (curve.abcClass === 'B') color = COLORS.CURVE_B;
               else color = COLORS.CURVE_C;
           } else if (config.curveType === 'PQR') {
               if (curve.pqrClass === 'P') color = COLORS.CURVE_A;
               else if (curve.pqrClass === 'Q') color = COLORS.CURVE_B;
               else color = COLORS.CURVE_C;
           } else {
               // CROSS
               if (curve.combinedClass === 'AA') color = COLORS.CURVE_A;
               else if (curve.combinedClass === 'BB') color = COLORS.CURVE_B;
               else color = COLORS.CURVE_C;
           }
       }

       // Se estivermos vendo o SUGERIDO, precisamos "mover" visualmente o item para sua posição ideal?
       // O usuário pediu: "Mostre o comparativo do atual com as sugestões" e "mapa de calor com ajustes sugestivos".
       // Abordagem: No modo "SUGGESTED", pintamos a POSIÇÃO com a cor do ITEM que DEVERIA estar lá.
       
       let finalColor = color;
       
       if (config.viewState === 'SUGGESTED' && suggestedMapping) {
           // Quem deveria estar AQUI (nesta posição d.id)?
           // O mapping é ItemID -> PosID. Precisamos inverter ou buscar.
           // Vamos buscar qual ItemID aponta para este d.id
           let idealItemId: string | undefined;
           for (let [itemId, posId] of suggestedMapping.entries()) {
               if (posId === d.id) {
                   idealItemId = itemId;
                   break;
               }
           }

           if (idealItemId) {
                const idealItem = pickingData.find(i => i.id === idealItemId);
                if (idealItem && idealItem.curveData) {
                    // Recalcula cor baseada no item ideal
                    if (config.curveType === 'ABC') {
                        finalColor = idealItem.curveData.abcClass === 'A' ? COLORS.CURVE_A : (idealItem.curveData.abcClass === 'B' ? COLORS.CURVE_B : COLORS.CURVE_C);
                    } else if (config.curveType === 'PQR') {
                        finalColor = idealItem.curveData.pqrClass === 'P' ? COLORS.CURVE_A : (idealItem.curveData.pqrClass === 'Q' ? COLORS.CURVE_B : COLORS.CURVE_C);
                    } else {
                         finalColor = (idealItem.curveData.combinedClass === 'AA' || idealItem.curveData.combinedClass === 'MIX') ? COLORS.CURVE_A : (idealItem.curveData.combinedClass === 'BB' ? COLORS.CURVE_B : COLORS.CURVE_C);
                    }
                }
           }
       }

       return { ...d, renderColor: finalColor };
    });
  }, [pickingData, config, suggestedMapping]);


  // --- Viewport Logic (Same as Scene2D) ---
  const { bounds, streetLabels } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const streets = new Map<string, { sumX: number, maxZ: number, count: number }>();

    renderData.forEach(d => {
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
  }, [renderData]);

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
  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });
  const baseScale = 15;

  // --- Sugestão Visual (Piscada) ---
  const blinkTarget = useMemo(() => {
     if (selectedId && suggestedMapping && config.viewState === 'CURRENT') {
         // Se selecionei um item no modo ATUAL, onde ele deveria estar?
         return suggestedMapping.get(selectedId);
     }
     return null;
  }, [selectedId, suggestedMapping, config.viewState]);

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
       {/* UI Overlays */}
       <div className="absolute top-4 left-4 z-10 flex gap-4">
          <div className="bg-slate-800/90 p-4 rounded border border-slate-700 shadow-xl backdrop-blur max-w-sm">
             <div className="flex items-center justify-between mb-2">
                 <h3 className="font-bold text-cyan-400 flex items-center gap-2"><ArrowRightLeft size={16}/> Sugestão de Movimentação</h3>
                 <button onClick={() => setShowHelp(!showHelp)} className="text-slate-400 hover:text-white"><HelpCircle size={16}/></button>
             </div>
             
             {selectedId ? (
                 <div className="text-xs text-slate-300">
                     {(() => {
                         const item = renderData.find(d => d.id === selectedId);
                         const targetId = suggestedMapping?.get(selectedId);
                         const targetPos = renderData.find(d => d.id === targetId);
                         
                         if (!item) return "Item não encontrado.";
                         if (!targetId || targetId === selectedId) return <span className="text-green-400 font-bold">Este item já está na posição ideal!</span>;
                         
                         return (
                             <div className="space-y-2">
                                 <div className="p-2 bg-slate-700/50 rounded border border-slate-600">
                                     <span className="block text-[10px] uppercase text-slate-500">Item Selecionado</span>
                                     <div className="font-bold text-white">{item.rawItem?.DESCRICAO}</div>
                                     <div className="flex gap-2 mt-1">
                                         <span className={clsx("px-1 rounded text-[10px] font-bold text-black", item.curveData?.pqrClass === 'P' ? 'bg-green-400' : 'bg-red-400')}>PQR: {item.curveData?.pqrClass}</span>
                                         <span className={clsx("px-1 rounded text-[10px] font-bold text-black", item.curveData?.abcClass === 'A' ? 'bg-green-400' : 'bg-red-400')}>ABC: {item.curveData?.abcClass}</span>
                                     </div>
                                 </div>
                                 <div className="flex justify-center text-cyan-500"><Target size={20} className="animate-bounce"/></div>
                                 <div className="p-2 bg-cyan-900/20 rounded border border-cyan-500/30">
                                     <span className="block text-[10px] uppercase text-cyan-400">Mover Para</span>
                                     <div className="font-mono text-lg font-bold text-white">{targetPos?.rawAddress.RUA} - {targetPos?.rawAddress.PRED} - {targetPos?.rawAddress.AP}</div>
                                     <div className="text-[10px] text-slate-400">Posição piscando no mapa</div>
                                 </div>
                             </div>
                         );
                     })()}
                 </div>
             ) : (
                 <p className="text-xs text-slate-500 italic">Selecione uma posição no mapa para ver a sugestão de ajuste.</p>
             )}
          </div>
       </div>

       {showHelp && (
           <div className="absolute top-20 left-4 z-20 bg-black/90 text-white p-4 rounded w-80 text-xs border border-slate-600 shadow-2xl animate-in fade-in zoom-in-95">
               <div className="flex justify-between mb-2">
                   <h4 className="font-bold text-cyan-400">Lógica da Curva</h4>
                   <button onClick={() => setShowHelp(false)}><ArrowRightLeft size={14}/></button>
               </div>
               <p className="mb-2 text-slate-300">A classificação é feita dentro do período selecionado:</p>
               <ul className="list-disc pl-4 space-y-1 text-slate-400 mb-3">
                   <li><strong>PQR (Popularidade):</strong> Total Visitas / Dias Úteis. (Frequência de ida ao picking).</li>
                   <li><strong>ABC (Volume):</strong> Total Volumes / Dias Úteis. (Giro físico).</li>
                   <li><strong>Cruzamento:</strong> Prioriza itens que são P (muitas visitas) E A (muito volume).</li>
               </ul>
               <p className="mb-2 text-slate-300"><strong>Sugestão de Layout:</strong></p>
               <p className="text-slate-400">O sistema cruza a classificação com a <strong>Cubagem</strong>. Itens Curva A/P e Pesados/Grandes são sugeridos para o <strong>Início da Rua</strong> (Ergonomia e Produtividade).</p>
           </div>
       )}

       <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
          <button onClick={() => setTransform(p => ({ ...p, k: p.k * 1.2 }))} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><ZoomIn size={20}/></button>
          <button onClick={() => setTransform(p => ({ ...p, k: p.k / 1.2 }))} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><ZoomOut size={20}/></button>
          <button onClick={resetView} className="p-2 bg-slate-800 text-white shadow rounded hover:bg-slate-700"><LocateFixed size={20}/></button>
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
             const isTarget = blinkTarget === item.id;

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
                    stroke={isSelected ? 'white' : (isTarget ? '#06b6d4' : 'none')}
                    strokeWidth={isSelected || isTarget ? 3 : 0}
                    rx={2}
                    className={isTarget ? "animate-pulse" : ""}
                 />
                 {transform.k > 1.5 && (
                     <text x={sx} y={sy + h/2} fontSize={baseScale * 0.4} fill="black" textAnchor="middle" dominantBaseline="middle" pointerEvents="none" fontWeight="bold">
                        {item.rawAddress.SL}
                     </text>
                 )}
                 <title>{`Rua: ${item.rawAddress.RUA} | Curva PQR: ${item.curveData?.pqrClass} | ABC: ${item.curveData?.abcClass}`}</title>
               </g>
             );
          })}
       </svg>
    </div>
  );
};
