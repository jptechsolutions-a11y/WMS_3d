import React from 'react';
import { MergedData, ViewMode, AddressStatus, FilterState, ReceiptFilterType } from '../types';
import { COLORS, STATUS_LABELS } from '../constants';
import { Settings, Eye, Map, Box, Info, Search, Layers, Palette, CalendarClock, Truck, Tag, X } from 'lucide-react';
import clsx from 'clsx';
import logoIcon from '/icon.png';

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  selectedItem: MergedData | null;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  stats: {
    total: number;
    occupied: number;
    available: number;
    reserved: number;
    blocked: number;
    totalApanha: number;
    validApanha: number;
    occupiedApanha: number;
    totalPulmao: number;
    validPulmao: number;
    occupiedPulmao: number;
  };
  colorMode: 'REALISTIC' | 'STATUS';
  setColorMode: (m: 'REALISTIC' | 'STATUS') => void;
  availableSectors: string[];
  onCloseDetail: () => void; // [NOVO] Para fechar o painel
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

const ItemDetail = ({ label, item }: { label: string, item: any }) => {
    if (!item) return null;
    
    const qty = parseFloat(item.ESTQ_LOCUS) || 0;
    const cpa = parseFloat(item.CPA) || 1; 
    const boxes = Math.floor(qty / cpa);

    return (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
            <h4 className="text-[10px] font-bold uppercase text-cyan-500 mb-2 tracking-wider">{label}</h4>
            <div className="text-sm text-slate-200">
                <div className="font-medium text-white mb-1">{item.DESCRICAO}</div>
                <div className="text-xs text-slate-400 mb-2">Cód: <span className="text-slate-300">{item.CODIGO}</span></div>
                
                <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-2 rounded text-xs">
                    <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Estoque</span>
                        <span className="text-cyan-400 font-bold">{boxes} cx</span>
                        <span className="text-slate-400 ml-1">({qty} un)</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Validade</span>
                        <span className="text-white">{item.VALIDADE}</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-slate-500 block text-[9px] uppercase">Recebimento</span>
                        <span className="text-white">{item.RECEBIMENTO}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  viewMode, setViewMode, selectedItem, filters, setFilters, stats, colorMode, setColorMode, availableSectors, onCloseDetail 
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

  const isAllSectorsSelected = availableSectors.length > 0 && filters.sector.length === availableSectors.length;

  return (
    <>
      {/* 1. SIDEBAR PRINCIPAL */}
      <div className="w-80 h-full bg-[#0f172a] border-r border-slate-800 flex flex-col text-slate-100 shadow-2xl z-30 font-sans relative">
        
        {/* Header with Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center bg-[#0b1120]">
          {/* [CORREÇÃO] Caminho absoluto para o ícone na pasta public */}
         <img 
  src={logoIcon}
  alt="JP Logo" 
  className="h-10 w-auto mr-3"
/>
          <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight">
              WMS <span className="text-cyan-400">3D</span>
              </h1>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Visualization</span>
          </div>
        </div>

        {/* View Modes */}
        <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-800/50">
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
          
          {/* [REMOVIDO] A seção de detalhes estava aqui. Agora está no Drawer abaixo. */}

          <div>
            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider flex items-center gap-2"><Palette size={10}/> Visualização</h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
                <button onClick={() => setColorMode('REALISTIC')} className={clsx("p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", colorMode === 'REALISTIC' ? "bg-cyan-900/40 border-cyan-500 text-cyan-400" : "bg-slate-800/40 border-transparent text-slate-500 hover:text-slate-300")}>
                  Realista
                </button>
                <button onClick={() => setColorMode('STATUS')} className={clsx("p-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", colorMode === 'STATUS' ? "bg-cyan-900/40 border-cyan-500 text-cyan-400" : "bg-slate-800/40 border-transparent text-slate-500 hover:text-slate-300")}>
                  Status
                </button>
            </div>

            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider flex items-center gap-2"><Search size={10}/> Filtros</h3>
            
            <div className="relative mb-4 group">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors"/>
              <input type="text" placeholder="Buscar Código, Descrição..." value={filters.search} onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>

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

            {/* Resto dos filtros (Status, Validade, etc.) */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => toggleType('A')} className={clsx("flex items-center justify-center gap-2 p-2 rounded text-xs font-medium border transition-all", filters.type.includes('A') ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/20" : "bg-slate-800/50 border-transparent text-slate-500 opacity-60 hover:opacity-100")}>
                  <Layers size={14}/> Apanha
                </button>
                <button onClick={() => toggleType('P')} className={clsx("flex items-center justify-center gap-2 p-2 rounded text-xs font-medium border transition-all", filters.type.includes('P') ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/20" : "bg-slate-800/50 border-transparent text-slate-500 opacity-60 hover:opacity-100")}>
                  <Box size={14}/> Pulmão
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2"><CalendarClock size={12} /> Validade (Dias)</label>
              <div className="grid grid-cols-4 gap-1">
                  {[30, 60, 90, 120].map(days => (
                      <button key={days} onClick={() => setExpiry(days)} className={clsx("text-[10px] py-1.5 rounded border transition-all text-center font-medium", filters.expiryDays === days ? "bg-red-500/20 border-red-500 text-red-400" : "bg-slate-800/50 border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300")}>
                          {days}
                      </button>
                  ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2"><Truck size={12} /> Recebimento</label>
              <div className="grid grid-cols-3 gap-1 mb-2">
                  <button onClick={() => setReceipt('YESTERDAY')} className={clsx("text-[10px] p-1 rounded border transition-all", filters.receiptType === 'YESTERDAY' ? "bg-cyan-900/30 border-cyan-500 text-cyan-400" : "bg-slate-800/50 border-transparent text-slate-500")}>Ontem</button>
                  <button onClick={() => setReceipt('THIS_WEEK')} className={clsx("text-[10px] p-1 rounded border transition-all", filters.receiptType === 'THIS_WEEK' ? "bg-cyan-900/30 border-cyan-500 text-cyan-400" : "bg-slate-800/50 border-transparent text-slate-500")}>Semana</button>
                  <button onClick={() => setReceipt('THIS_MONTH')} className={clsx("text-[10px] p-1 rounded border transition-all", filters.receiptType === 'THIS_MONTH' ? "bg-cyan-900/30 border-cyan-500 text-cyan-400" : "bg-slate-800/50 border-transparent text-slate-500")}>Mês</button>
              </div>
              <div className="flex gap-2 items-center">
                  <button onClick={() => setReceipt('SPECIFIC')} className={clsx("text-[10px] px-2 py-1.5 rounded border transition-all whitespace-nowrap", filters.receiptType === 'SPECIFIC' ? "bg-cyan-900/30 border-cyan-500 text-cyan-400" : "bg-slate-800/50 border-transparent text-slate-500")}>Data:</button>
                  <input 
                      type="date" 
                      value={filters.receiptDate} 
                      onChange={(e) => setFilters(prev => ({ ...prev, receiptType: 'SPECIFIC', receiptDate: e.target.value }))}
                      className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-slate-300 w-full focus:border-cyan-500 outline-none"
                  />
              </div>
            </div>

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
        
        {/* Footer */}
        <div className="p-4 bg-[#0b1120] border-t border-slate-800 text-xs space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30">
          <div className="flex justify-around items-center">
              <div className="flex flex-col items-center gap-1">
                  <SimplePie percent={calcPercent(stats.occupiedApanha, stats.validApanha)} color="#22d3ee" />
                  <div className="text-center">
                      <div className="text-slate-300 font-bold text-[10px] tracking-widest">APANHA</div>
                      <div className="text-slate-500 text-[9px]">{stats.occupiedApanha}/{stats.validApanha}</div>
                  </div>
              </div>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <div className="flex flex-col items-center gap-1">
                  <SimplePie percent={calcPercent(stats.occupiedPulmao, stats.validPulmao)} color="#a855f7" />
                  <div className="text-center">
                      <div className="text-slate-300 font-bold text-[10px] tracking-widest">PULMÃO</div>
                      <div className="text-slate-500 text-[9px]">{stats.occupiedPulmao}/{stats.validPulmao}</div>
                  </div>
              </div>
          </div>
          <div className="text-center pt-2 border-t border-slate-800/50">
              <p className="text-[9px] text-slate-600">Desenvolvido por <span className="text-cyan-700 font-semibold hover:text-cyan-500 transition-colors cursor-default">Juliano Patrick</span></p>
          </div>
        </div>
      </div>

      {/* 2. DETAIL DRAWER (PAINEL DESLIZANTE) */}
      <div 
        className={clsx(
          "absolute top-0 bottom-0 w-80 bg-[#0f172a] border-r border-slate-800 z-20 transition-transform duration-300 ease-in-out shadow-2xl",
          selectedItem ? "translate-x-80" : "translate-x-0" // Posicionado à esquerda (atrás da sidebar) ou movido para a direita (visível)
        )}
        style={{ left: 0 }} // Ele começa na mesma posição da sidebar e desliza para a direita
      >
        <div className="h-full flex flex-col p-4 overflow-y-auto">
          {/* Header do Drawer */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/50">
             <h3 className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wide">
               <Info size={14} className="text-cyan-400"/> Detalhes da Posição
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
                  <div className="bg-slate-900/50 p-2 rounded col-span-2">
                      <span className="block text-[9px] uppercase text-slate-500">Status</span>
                      <span className="text-white font-mono text-sm">{selectedItem.rawAddress.STATUS}</span>
                  </div>
                </div>
                
                <ItemDetail label="Apanha" item={selectedItem.rawItem} />
                <ItemDetail label="Pulmão" item={selectedItem.pulmaoItem} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
