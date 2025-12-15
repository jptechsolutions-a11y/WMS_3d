import React, { useState } from 'react';
import { MergedData, ViewMode, FilterState, ReceiptFilterType, CurveMode } from '../types';
import { COLORS, STATUS_LABELS } from '../constants';
import { Settings, Eye, Map, Box, Info, Search, Layers, Palette, CalendarClock, Truck, Tag, X, FileText, Activity, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import logoIcon from '/icon.png';

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  selectedItem: MergedData | null;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  stats: any;
  availableSectors: string[];
  onCloseDetail: () => void;
  onShowReport: () => void; // Novo callback para abrir relatorio
}

const SimplePie = ({ percent, color }: { percent: number, color: string }) => {
    const circumference = 2 * Math.PI * 10; 
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    return (
        <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="#1e293b" strokeWidth="3" fill="none" />
                <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" fill="none" strokeDasharray={strokeDasharray} strokeLinecap="round" />
            </svg>
            <span className="absolute text-[9px] font-bold text-white">{percent}%</span>
        </div>
    )
}

const InfoBubble = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
        <AlertCircle size={10} className="text-slate-500 hover:text-cyan-400 cursor-help" />
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-slate-300 text-[10px] rounded border border-slate-700 shadow-xl z-50 pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
        </div>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
  viewMode, setViewMode, selectedItem, filters, setFilters, stats, availableSectors, onCloseDetail, onShowReport
}) => {

  const toggleStatus = (status: string) => {
    setFilters(prev => {
        const exists = prev.status.includes(status);
        if (exists) return { ...prev, status: prev.status.filter(s => s !== status) };
        return { ...prev, status: [...prev.status, status] };
    });
  };

  const toggleType = (type: string) => {
    setFilters(prev => {
        const exists = prev.type.includes(type);
        if (exists) return { ...prev, type: prev.type.filter(t => t !== type) };
        return { ...prev, type: [...prev.type, type] };
    });
  };

  const handleSectorClick = (sector: string | 'ALL') => {
    if (sector === 'ALL') {
        setFilters(prev => ({ ...prev, sector: availableSectors }));
    } else {
        setFilters(prev => {
            const isAllSelected = prev.sector.length === availableSectors.length;
            if (isAllSelected) return { ...prev, sector: [sector] };
            if (prev.sector.includes(sector)) return { ...prev, sector: prev.sector.filter(s => s !== sector) };
            return { ...prev, sector: [...prev.sector, sector] };
        });
    }
  };

  const setCurveMode = (mode: CurveMode) => {
      setFilters(prev => ({ ...prev, curveMode: mode }));
  };

  const isAllSectorsSelected = availableSectors.length > 0 && filters.sector.length === availableSectors.length;

  return (
    <>
      <div className="w-80 h-full bg-[#0f172a] border-r border-slate-800 flex flex-col text-slate-100 shadow-2xl z-30 font-sans relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center bg-[#0b1120]">
         <img src={logoIcon} alt="JP Logo" className="h-10 w-auto mr-3"/>
          <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight">WMS <span className="text-cyan-400">3D</span></h1>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Visualization</span>
          </div>
        </div>

        {/* View Modes */}
        <div className="p-4 grid grid-cols-4 gap-2 border-b border-slate-800/50">
          <button onClick={() => setViewMode('3D_ORBIT')} className={clsx("p-2 text-[9px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all", viewMode === '3D_ORBIT' ? "bg-cyan-600 text-white" : "bg-slate-800/50 text-slate-400")}>
            <Eye size={14} /> Orbital
          </button>
          <button onClick={() => setViewMode('3D_WALK')} className={clsx("p-2 text-[9px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all", viewMode === '3D_WALK' ? "bg-cyan-600 text-white" : "bg-slate-800/50 text-slate-400")}>
            <Settings size={14} /> Andar
          </button>
          <button onClick={() => setViewMode('2D_PLAN')} className={clsx("p-2 text-[9px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all", viewMode === '2D_PLAN' ? "bg-cyan-600 text-white" : "bg-slate-800/50 text-slate-400")}>
            <Map size={14} /> Planta
          </button>
           <button onClick={() => setViewMode('2D_APANHA_ONLY')} className={clsx("p-2 text-[9px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all", viewMode === '2D_APANHA_ONLY' ? "bg-orange-600 text-white" : "bg-slate-800/50 text-slate-400")}>
            <Layers size={14} /> Apanha
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
          
          {/* CURVA PQR / ABC SECTION */}
          <div className="mb-6 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
             <h3 className="text-[10px] font-bold uppercase text-cyan-500 mb-3 tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-2"><Activity size={12}/> Curva & Sugestão</div>
                <InfoBubble text="PQR baseado no Fator V/V (Visitas/Volumes). ABC em desenvolvimento." />
             </h3>
             
             <div className="space-y-2">
                 <button onClick={() => setCurveMode('NONE')} className={clsx("w-full text-left text-[10px] px-3 py-2 rounded border transition-all flex items-center gap-2", filters.curveMode === 'NONE' ? "bg-slate-700 text-white border-slate-500" : "bg-transparent text-slate-500 border-slate-800")}>
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div> Padrão (Sem Mapa de Calor)
                 </button>
                 
                 <button disabled className={clsx("w-full text-left text-[10px] px-3 py-2 rounded border transition-all flex items-center gap-2 opacity-50 cursor-not-allowed bg-transparent text-slate-600 border-slate-800")}>
                    <div className="w-2 h-2 rounded-full bg-transparent border border-slate-600"></div> Curva ABC (Em Desenv.)
                 </button>

                 <div className="text-[9px] text-slate-500 font-bold mt-2 mb-1 px-1">CURVA PQR</div>
                 <button onClick={() => setCurveMode('CURRENT_PQR')} className={clsx("w-full text-left text-[10px] px-3 py-2 rounded border transition-all flex items-center gap-2", filters.curveMode === 'CURRENT_PQR' ? "bg-cyan-900/30 text-cyan-400 border-cyan-500" : "bg-transparent text-slate-400 border-slate-800 hover:bg-slate-800")}>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_5px_cyan]"></div> Visualizar Atual
                 </button>
                 <button onClick={() => setCurveMode('SUGGESTED_PQR')} className={clsx("w-full text-left text-[10px] px-3 py-2 rounded border transition-all flex items-center gap-2", filters.curveMode === 'SUGGESTED_PQR' ? "bg-purple-900/30 text-purple-400 border-purple-500" : "bg-transparent text-slate-400 border-slate-800 hover:bg-slate-800")}>
                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_purple]"></div> Visualizar Sugestão
                 </button>
             </div>
             
             {/* Legenda Mapa de Calor */}
             {(filters.curveMode.includes('PQR')) && (
                 <div className="mt-3 flex gap-1 justify-between bg-black/20 p-2 rounded">
                     <div className="flex flex-col items-center"><div className="w-3 h-3 bg-red-500 rounded-sm mb-1"></div><span className="text-[8px] text-slate-400">P (Alta)</span></div>
                     <div className="flex flex-col items-center"><div className="w-3 h-3 bg-yellow-500 rounded-sm mb-1"></div><span className="text-[8px] text-slate-400">Q (Média)</span></div>
                     <div className="flex flex-col items-center"><div className="w-3 h-3 bg-green-500 rounded-sm mb-1"></div><span className="text-[8px] text-slate-400">R (Baixa)</span></div>
                 </div>
             )}

             <button onClick={onShowReport} className="mt-4 w-full bg-cyan-700/20 hover:bg-cyan-700/40 text-cyan-400 border border-cyan-700/50 py-2 rounded text-[10px] uppercase font-bold flex items-center justify-center gap-2 transition-all">
                <FileText size={12} /> Relatório de Ajustes
             </button>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider flex items-center gap-2"><Search size={10}/> Filtros</h3>
            
            <div className="relative mb-4 group">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors"/>
              <input type="text" placeholder="Buscar Código, Descrição..." value={filters.search} onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>

            {availableSectors.length > 0 && (
                  <div className="mb-4">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2"><Tag size={12} /> Setores</label>
                      <div className="flex flex-wrap gap-1">
                          <button onClick={() => handleSectorClick('ALL')} className={clsx("text-[9px] px-2 py-1 rounded border transition-all uppercase font-bold", isAllSectorsSelected ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-800/50 border-transparent text-slate-500 hover:text-slate-300")}>TODOS</button>
                          {availableSectors.map(sec => {
                              const isActive = !isAllSectorsSelected && filters.sector.includes(sec);
                              return (
                                  <button key={sec} onClick={() => handleSectorClick(sec)} className={clsx("text-[9px] px-2 py-1 rounded border transition-all uppercase", isActive ? "bg-cyan-900/50 border-cyan-500 text-cyan-300 font-bold" : "bg-slate-800/50 border-transparent text-slate-500 hover:text-slate-300")}>{sec}</button>
                              );
                          })}
                      </div>
                  </div>
              )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-[#0b1120] border-t border-slate-800 text-xs shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30">
          <div className="flex justify-around items-center mb-2">
              <div className="flex flex-col items-center gap-1">
                  <SimplePie percent={stats.validApanha ? Math.round((stats.occupiedApanha / stats.validApanha) * 100) : 0} color="#22d3ee" />
                  <div className="text-center"><div className="text-slate-300 font-bold text-[10px] tracking-widest">APANHA</div></div>
              </div>
              <div className="flex flex-col items-center gap-1">
                  <SimplePie percent={stats.validPulmao ? Math.round((stats.occupiedPulmao / stats.validPulmao) * 100) : 0} color="#a855f7" />
                  <div className="text-center"><div className="text-slate-300 font-bold text-[10px] tracking-widest">PULMÃO</div></div>
              </div>
          </div>
          <div className="text-center pt-2 border-t border-slate-800/50"><p className="text-[9px] text-slate-600">Desenvolvido por <span className="text-cyan-700 font-semibold">Juliano Patrick</span></p></div>
        </div>
      </div>

      {/* Drawer Detalhes */}
      <div className={clsx("absolute top-0 bottom-0 w-80 bg-[#0f172a] border-r border-slate-800 z-20 transition-transform duration-300 ease-in-out shadow-2xl", selectedItem ? "translate-x-80" : "translate-x-0")} style={{ left: 0 }}>
        <div className="h-full flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/50">
             <h3 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wide"><Info size={14} className="text-cyan-400"/> Detalhes</h3>
             <button onClick={onCloseDetail} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
          </div>
          {selectedItem && (
             <div className="space-y-4">
                 <div className="bg-slate-900 p-3 rounded border border-slate-700">
                    <div className="text-cyan-400 font-bold text-lg">{selectedItem.rawAddress.RUA}-{selectedItem.rawAddress.PRED}-{selectedItem.rawAddress.AP}-{selectedItem.rawAddress.SL}</div>
                    <div className="text-slate-500 text-xs uppercase">{selectedItem.sector}</div>
                 </div>

                 {selectedItem.moveSuggestion && (
                     <div className="bg-orange-900/20 border border-orange-500/50 p-3 rounded animate-pulse">
                         <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase mb-1">
                             <AlertCircle size={12}/> Sugestão de Movimento
                         </div>
                         <div className="text-slate-300 text-xs mb-2">
                             Este item <strong>Curva {selectedItem.moveSuggestion.curve}</strong> deveria estar no endereço <strong>{selectedItem.moveSuggestion.suggestedAddressId}</strong>.
                         </div>
                         <button className="w-full py-1 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 text-[10px] rounded uppercase font-bold transition-colors">Ver Destino</button>
                     </div>
                 )}

                 {selectedItem.curveData && (
                     <div className="border-t border-slate-800 pt-3">
                         <div className="text-[10px] uppercase font-bold text-purple-400 mb-2">Dados de Curva</div>
                         <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                             <div className="bg-slate-900/50 p-1 rounded">Visitas: <span className="text-white">{selectedItem.curveData.VISITAS}</span></div>
                             <div className="bg-slate-900/50 p-1 rounded">Volumes: <span className="text-white">{selectedItem.curveData.VOLUMES}</span></div>
                             <div className="bg-slate-900/50 p-1 rounded">Média Dia: <span className="text-white">{selectedItem.curveData.MEDIA_DIA_CX}</span></div>
                             <div className="bg-slate-900/50 p-1 rounded">Curva Calc: <span className={clsx("font-bold text-sm", selectedItem.calculatedCurve === 'P' ? 'text-red-500' : selectedItem.calculatedCurve === 'Q' ? 'text-yellow-500' : 'text-green-500')}>{selectedItem.calculatedCurve || '-'}</span></div>
                         </div>
                     </div>
                 )}
             </div>
          )}
        </div>
      </div>
    </>
  );
};
