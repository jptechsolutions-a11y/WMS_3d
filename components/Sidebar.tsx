import React from 'react';
import { MergedData, ViewMode, AddressStatus, FilterState, ReceiptFilterType, SuggestionMove } from '../types';
import { COLORS, STATUS_LABELS } from '../constants';
import { Settings, Eye, Map, Box, Info, Search, Layers, Palette, CalendarClock, Truck, Tag, X, FileBarChart, TrendingUp, RefreshCw, ArrowRight, Download, SplitSquareVertical, Filter } from 'lucide-react';
import clsx from 'clsx';
import logoIcon from '/icon.png';

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  selectedItem: MergedData | null;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  stats: any;
  colorMode: 'REALISTIC' | 'STATUS' | 'PQR' | 'ABC' | 'SUGGESTION_PQR'; 
  setColorMode: (m: 'REALISTIC' | 'STATUS' | 'PQR' | 'ABC' | 'SUGGESTION_PQR') => void;
  availableSectors: string[];
  onCloseDetail: () => void;
  onImportPQR: () => void;
  onImportABC: () => void;
  hasPQRData: boolean;
  suggestions?: SuggestionMove[]; 
  isSplitView: boolean; 
  onToggleSplit: () => void; 
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

export const Sidebar: React.FC<SidebarProps> = ({ 
  viewMode, setViewMode, selectedItem, filters, setFilters, stats, colorMode, setColorMode, availableSectors, onCloseDetail, onImportPQR, onImportABC, hasPQRData, suggestions = [], isSplitView, onToggleSplit
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

  const togglePQR = (cls: string) => {
     setFilters(prev => {
         const exists = prev.pqr.includes(cls);
         if (exists) return { ...prev, pqr: prev.pqr.filter(c => c !== cls) };
         return { ...prev, pqr: [...prev.pqr, cls] };
     });
  };

  const handleSectorClick = (sector: string | 'ALL') => {
    if (sector === 'ALL') {
        setFilters(prev => ({ ...prev, sector: availableSectors }));
    } else {
        setFilters(prev => {
            const isAllSelected = prev.sector.length === availableSectors.length;
            if (isAllSelected) {
                return { ...prev, sector: [sector] };
            }
            if (prev.sector.includes(sector)) {
                return { ...prev, sector: prev.sector.filter(s => s !== sector) };
            } else {
                return { ...prev, sector: [...prev.sector, sector] };
            }
        });
    }
  };

  const setExpiry = (days: number | null) => {
      setFilters(prev => ({ ...prev, expiryDays: prev.expiryDays === days ? null : days }));
  };

  const setReceipt = (type: ReceiptFilterType) => {
      setFilters(prev => ({ ...prev, receiptType: prev.receiptType === type ? 'ALL' : type }));
  };

  const calcPercent = (val: number, total: number) => {
      if (!total) return 0;
      return Math.round((val / total) * 100);
  };
  
  const handleExport = () => {
      if (!suggestions || suggestions.length === 0) return alert("Não há sugestões para exportar.");
      
      const csvContent = "data:text/csv;charset=utf-8," 
          + "Prioridade;Produto;Descricao;Origem;Destino;Motivo\n"
          + suggestions.map(s => {
              return `${s.priority};${s.productCode};${s.productName};${s.fromAddress};${s.toAddress};${s.reason}`;
          }).join("\n");
          
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "relatorio_movimentacao_pqr.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const isAllSectorsSelected = availableSectors.length > 0 && filters.sector.length === availableSectors.length;

  return (
    <>
      <div className="w-80 h-full bg-[#0f172a] border-r border-slate-800 flex flex-col text-slate-100 shadow-2xl z-30 font-sans relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center bg-[#0b1120]">
         <img src={logoIcon} alt="JP Logo" className="h-10 w-auto mr-3"/>
          <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight">
              WMS <span className="text-cyan-400">3D</span>
              </h1>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Analytics</span>
          </div>
        </div>

        {/* View Modes */}
        <div className={clsx("p-4 grid grid-cols-3 gap-2 border-b border-slate-800/50", isSplitView && "opacity-50 pointer-events-none")}>
          <button onClick={() => setViewMode('3D_ORBIT')} className={clsx("p-2 text-[10px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all duration-200", viewMode === '3D_ORBIT' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/50" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-cyan-400")}>
            <Eye size={16} /> Orbital
          </button>
          <button onClick={() => setViewMode('3D_WALK')} className={clsx("p-2 text-[10px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all duration-200", viewMode === '3D_WALK' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/50" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-cyan-400")}>
            <Settings size={16} /> Andar
          </button>
          <button onClick={() => setViewMode('2D_PLAN')} className={clsx("p-2 text-[10px] uppercase font-bold rounded flex flex-col items-center gap-1 transition-all duration-200", viewMode === '2D_PLAN' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/50" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-cyan-400")}>
            <Map size={16} /> Planta
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
          
          <div className="mb-6 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
             <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider flex items-center gap-2"><FileBarChart size={10}/> Importar Curvas</h3>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={onImportPQR} className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded flex flex-col items-center gap-1 text-[9px] uppercase font-bold transition-all">
                   <TrendingUp size={16} /> Importar PQR
                </button>
                <button onClick={onImportABC} className="p-2 bg-slate-800/50 text-slate-500 border border-slate-800 rounded flex flex-col items-center gap-1 text-[9px] uppercase font-bold cursor-not-allowed opacity-50 relative overflow-hidden">
                   <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                   <TrendingUp size={16} /> Importar ABC
                   <span className="text-[7px] text-yellow-500">Em Desenvolvimento</span>
                </button>
             </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider flex items-center gap-2"><Palette size={10}/> Visualização</h3>
            
             <button 
                  onClick={onToggleSplit}
                  disabled={!hasPQRData} 
                  className={clsx("w-full p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2 mb-4", isSplitView ? "bg-orange-900/40 border-orange-500 text-orange-400" : "bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white", !hasPQRData && "opacity-50 cursor-not-allowed")}
                >
                  <SplitSquareVertical size={14}/> {isSplitView ? 'Fechar Comparação' : 'Comparar Cenários (Split)'}
            </button>

            {!isSplitView && (
                <>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <button onClick={() => setColorMode('REALISTIC')} className={clsx("p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", colorMode === 'REALISTIC' ? "bg-cyan-900/40 border-cyan-500 text-cyan-400" : "bg-slate-800/40 border-transparent text-slate-500 hover:text-slate-300")}>
                        Realista
                        </button>
                        <button onClick={() => setColorMode('STATUS')} className={clsx("p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", colorMode === 'STATUS' ? "bg-cyan-900/40 border-cyan-500 text-cyan-400" : "bg-slate-800/40 border-transparent text-slate-500 hover:text-slate-300")}>
                        Status
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                        onClick={() => setColorMode('PQR')} 
                        disabled={!hasPQRData}
                        className={clsx("p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2 relative", colorMode === 'PQR' ? "bg-purple-900/40 border-purple-500 text-purple-400" : "bg-slate-800/40 border-transparent text-slate-500 hover:text-slate-300", !hasPQRData && "opacity-40 cursor-not-allowed")}
                        >
                        <TrendingUp size={12}/> Mapa PQR
                        {!hasPQRData && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                        </button>
                        <button 
                        disabled
                        className="p-2 text-[10px] font-bold uppercase rounded border border-transparent bg-slate-800/20 text-slate-600 flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                        <TrendingUp size={12}/> Mapa ABC
                        </button>
                    </div>

                    {hasPQRData && (
                        <button 
                        onClick={() => setColorMode(colorMode === 'SUGGESTION_PQR' ? 'PQR' : 'SUGGESTION_PQR')} 
                        className={clsx("w-full p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2 mb-4", colorMode === 'SUGGESTION_PQR' ? "bg-emerald-900/40 border-emerald-500 text-emerald-400" : "bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white")}
                        >
                        <RefreshCw size={12}/> {colorMode === 'SUGGESTION_PQR' ? 'Voltar para Atual' : 'Visualizar Sugestão'}
                        </button>
                    )}
                </>
            )}
            
            {(colorMode === 'PQR' || colorMode === 'SUGGESTION_PQR' || isSplitView) && (
              <div className="bg-slate-900 p-2 rounded mb-4 border border-slate-700 animate-in fade-in slide-in-from-top-2">
                 <div className="text-[9px] font-bold text-purple-400 mb-2 uppercase text-center border-b border-purple-900/50 pb-1">
                     Legenda PQR
                 </div>
                 <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-slate-800 p-1 rounded">
                       <div className="w-full h-1 bg-red-500 mb-1 rounded-full shadow-[0_0_5px_red]"></div>
                       <div className="text-[8px] font-bold text-red-400">P - Alta</div>
                    </div>
                     <div className="bg-slate-800 p-1 rounded">
                       <div className="w-full h-1 bg-yellow-500 mb-1 rounded-full shadow-[0_0_5px_yellow]"></div>
                       <div className="text-[8px] font-bold text-yellow-500">Q - Média</div>
                    </div>
                     <div className="bg-slate-800 p-1 rounded">
                       <div className="w-full h-1 bg-green-500 mb-1 rounded-full shadow-[0_0_5px_green]"></div>
                       <div className="text-[8px] font-bold text-green-500">R - Baixa</div>
                    </div>
                 </div>
              </div>
            )}
            
            {hasPQRData && (
                 <button 
                    onClick={handleExport}
                    className="w-full p-2 mb-6 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded flex items-center justify-center gap-2 text-[10px] uppercase font-bold transition-all"
                 >
                    <Download size={14} /> Exportar Relatório de Trocas
                 </button>
            )}

            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider flex items-center gap-2"><Search size={10}/> Filtros</h3>
            
            <div className="relative mb-4 group">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors"/>
              <input type="text" placeholder="Buscar Código, Descrição..." value={filters.search} onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>

            {/* [NOVO] Filtro PQR Explicito */}
            {hasPQRData && (
               <div className="mb-4">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2"><Filter size={12} /> Classe PQR</label>
                  <div className="flex gap-2">
                     {['P', 'Q', 'R', 'N/A'].map(cls => (
                        <button 
                           key={cls}
                           onClick={() => togglePQR(cls)}
                           className={clsx(
                              "flex-1 py-1 text-[10px] font-bold rounded border transition-all",
                              filters.pqr.includes(cls) ? "bg-slate-700 border-slate-500 text-white" : "bg-slate-800/30 border-transparent text-slate-600"
                           )}
                           style={{
                               borderColor: filters.pqr.includes(cls) && cls !== 'N/A' ? (cls === 'P' ? COLORS.PQR_P : cls === 'Q' ? COLORS.PQR_Q : COLORS.PQR_R) : undefined,
                               color: filters.pqr.includes(cls) && cls !== 'N/A' ? (cls === 'P' ? COLORS.PQR_P : cls === 'Q' ? COLORS.PQR_Q : COLORS.PQR_R) : undefined
                           }}
                        >
                           {cls}
                        </button>
                     ))}
                  </div>
               </div>
            )}

            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2"><Layers size={12}/> Tipos</label>
               {/* ... (Types and Status filters preserved) ... */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => toggleType('A')} className={clsx("flex items-center justify-center gap-2 p-2 rounded text-xs font-medium border transition-all", filters.type.includes('A') ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/20" : "bg-slate-800/50 border-transparent text-slate-500 opacity-60 hover:opacity-100")}>
                  Apanha (A)
                </button>
                <button onClick={() => toggleType('P')} className={clsx("flex items-center justify-center gap-2 p-2 rounded text-xs font-medium border transition-all", filters.type.includes('P') ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/20" : "bg-slate-800/50 border-transparent text-slate-500 opacity-60 hover:opacity-100")}>
                  Pulmão (P)
                </button>
              </div>
               <button 
                  onClick={() => setFilters(prev => ({ ...prev, type: ['A'] }))}
                  className="w-full mt-2 text-[9px] text-cyan-500 hover:text-cyan-300 underline decoration-dotted uppercase text-center"
               >
                  Visualizar Somente Apanha
               </button>
            </div>

             {/* ... (Sector, Expiry, Receipt filters preserved) ... */}
              {availableSectors.length > 0 && (
                  <div className="mb-4">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2"><Tag size={12} /> Setores</label>
                      <div className="flex flex-wrap gap-1">
                          <button 
                              onClick={() => handleSectorClick('ALL')} 
                              className={clsx(
                                  "text-[9px] px-2 py-1 rounded border transition-all uppercase font-bold", 
                                  isAllSectorsSelected ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-800/50 border-transparent text-slate-500 hover:text-slate-300"
                              )}
                          >
                              TODOS
                          </button>
                          
                          {availableSectors.map(sec => {
                              const isActive = !isAllSectorsSelected && filters.sector.includes(sec);
                              return (
                                  <button 
                                      key={sec} 
                                      onClick={() => handleSectorClick(sec)} 
                                      className={clsx(
                                          "text-[9px] px-2 py-1 rounded border transition-all uppercase", 
                                          isActive ? "bg-cyan-900/50 border-cyan-500 text-cyan-300 font-bold" : "bg-slate-800/50 border-transparent text-slate-500 hover:text-slate-300"
                                      )}
                                  >
                                      {sec}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}
            
            <div className="space-y-2 mb-6">
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Status</label>
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const isActive = filters.status.includes(key);
                  return (
                    <button key={key} onClick={() => toggleStatus(key)} className={clsx("w-full flex items-center justify-between p-2 rounded text-xs transition-all border font-medium", isActive ? "bg-slate-800 border-slate-600 text-slate-200" : "opacity-50 border-transparent text-slate-500 hover:opacity-100")}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: COLORS[key], boxShadow: `0 0 5px ${COLORS[key]}` }} />
                        {label}
                      </div>
                      {isActive && <div className="text-[9px] text-cyan-500 font-bold">ON</div>}
                    </button>
                  )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer Preserved */}
      <div 
        className={clsx(
          "absolute top-0 bottom-0 w-80 bg-[#0f172a] border-r border-slate-800 z-20 transition-transform duration-300 ease-in-out shadow-2xl",
          selectedItem ? "translate-x-80" : "translate-x-0" 
        )}
        style={{ left: 0 }} 
      >
        <div className="h-full flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/50">
             <h3 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wide">
               <Info size={14} className="text-cyan-400"/> Detalhes
             </h3>
             <button onClick={onCloseDetail} className="text-slate-500 hover:text-white transition-colors">
               <X size={16} />
             </button>
          </div>

          {selectedItem && (
            <div className="animate-in fade-in duration-300">
               <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs text-slate-400">
                  <div className="bg-slate-900/50 p-2 rounded">
                      <span className="block text-[9px] uppercase text-slate-500">Rua</span>
                      <span className="text-white font-mono text-sm">{selectedItem.rawAddress.RUA}</span>
                  </div>
                   <div className="bg-slate-900/50 p-2 rounded col-span-2">
                      <span className="block text-[9px] uppercase text-slate-500">Setor</span>
                      <span className="text-white font-mono font-bold text-cyan-400 text-sm">{selectedItem.sector}</span>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded">
                      <span className="block text-[9px] uppercase text-slate-500">Prédio</span>
                      <span className="text-white font-mono text-sm">{selectedItem.rawAddress.PRED}</span>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded">
                      <span className="block text-[9px] uppercase text-slate-500">Nível</span>
                      <span className="text-white font-mono text-sm">{selectedItem.rawAddress.AP}</span>
                  </div>
                </div>
                
                {selectedItem.analysis && (
                   <div className="mt-4 pt-4 border-t border-slate-700/50">
                      <h4 className="text-[10px] font-bold uppercase text-purple-400 mb-2 tracking-wider">Análise PQR</h4>
                      <div className="bg-purple-900/20 border border-purple-500/30 p-2 rounded grid grid-cols-2 gap-2">
                          <div>
                              <span className="block text-[9px] uppercase text-slate-400">Classe</span>
                              <span className={clsx("font-bold text-lg", selectedItem.analysis.pqrClass === 'P' ? 'text-red-400' : selectedItem.analysis.pqrClass === 'Q' ? 'text-yellow-400' : 'text-green-400')}>
                                  {selectedItem.analysis.pqrClass}
                              </span>
                          </div>
                          <div className="text-right">
                              <span className="block text-[9px] uppercase text-slate-400">Score</span>
                              <span className="font-bold text-slate-200 text-xs">{selectedItem.analysis.score.toFixed(2)}</span>
                          </div>
                          <div>
                              <span className="block text-[9px] uppercase text-slate-400">Visitas</span>
                              <span className="font-bold text-white">{selectedItem.analysis.visits}</span>
                          </div>
                           <div>
                              <span className="block text-[9px] uppercase text-slate-400">Vol. (Cx/Dia)</span>
                              <span className="font-bold text-white">{selectedItem.analysis.volume.toFixed(1)}</span>
                          </div>
                          <div className="col-span-2 text-[10px] text-slate-400 italic">
                             {selectedItem.analysis.description}
                          </div>
                      </div>
                   </div>
                )}
                
                {selectedItem.analysis?.suggestionMove && (
                     <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <h4 className="text-[10px] font-bold uppercase text-emerald-400 mb-2 tracking-wider flex items-center gap-1">
                             <RefreshCw size={10} /> Sugestão de Ajuste
                        </h4>
                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded text-xs">
                             <div className="mb-2 text-emerald-300 font-medium">
                                 {selectedItem.analysis.suggestionMove.reason}
                             </div>
                             <div className="flex items-center gap-2 text-slate-400 mb-1">
                                 <span className="text-[10px] uppercase">Mover Para:</span>
                                 <span className="text-white font-mono">{selectedItem.analysis.suggestionMove.toAddress}</span>
                             </div>
                             <div className="text-[10px] text-slate-500 italic mt-2">
                                 Prioridade: {selectedItem.analysis.suggestionMove.priority}
                             </div>
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
