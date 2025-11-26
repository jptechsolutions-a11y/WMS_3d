import React, { useState, useMemo } from 'react';
import { MergedData } from '../types';
import { Search, Box, X, Target, Map as MapIcon, Calendar } from 'lucide-react';
import clsx from 'clsx';

interface HandheldProps {
  data: MergedData[];
  onTeleport: (x: number, y: number, z: number) => void;
  onSelect: (item: MergedData) => void;
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
}

export const Handheld: React.FC<HandheldProps> = ({ data, onTeleport, onSelect, isOpen, setIsOpen }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ADDR' | 'PROD' | 'STREET'>('STREET');

  const streets = useMemo(() => {
    const finalMap = new Map<string, { sumX: number, maxZ: number, count: number }>();
    data.forEach(d => {
        if (!finalMap.has(d.rawAddress.RUA)) finalMap.set(d.rawAddress.RUA, { sumX: 0, maxZ: -Infinity, count: 0 });
        const entry = finalMap.get(d.rawAddress.RUA)!;
        entry.sumX += d.x;
        if(d.z > entry.maxZ) entry.maxZ = d.z; 
        entry.count++;
    });

    return Array.from(finalMap.entries()).map(([name, val]) => ({
        name,
        x: val.sumX / val.count,
        z: val.maxZ,
        count: val.count
    })).sort((a,b) => a.name.localeCompare(b.name));

  }, [data]);

  const filtered = useMemo(() => {
    if (activeTab === 'STREET') return [];
    const term = search.toLowerCase();
    return data.filter(d => {
      if (activeTab === 'ADDR') {
        const addrStr = `${d.rawAddress.RUA} ${d.rawAddress.PRED} ${d.rawAddress.AP} ${d.rawAddress.SL}`.toLowerCase();
        return addrStr.includes(term) || d.id.toLowerCase().includes(term);
      } else {
        const prodName = d.rawItem?.DESCRICAO?.toLowerCase() || '';
        const prodCode = d.rawItem?.CODIGO?.toLowerCase() || '';
        return prodName.includes(term) || prodCode.includes(term);
      }
    }).slice(0, 50); 
  }, [data, search, activeTab]);

  const distinctSkus = useMemo(() => {
      const skus = new Set<string>();
      data.forEach(d => {
          if(d.rawItem?.CODIGO) skus.add(d.rawItem.CODIGO);
      });
      return skus.size;
  }, [data]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-slate-900 rounded-2xl border-2 border-cyan-900/50 shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-50 group"
      >
        <div className="absolute inset-0 bg-cyan-500/10 rounded-xl animate-pulse"/>
        <Box className="text-cyan-400 group-hover:text-white" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 right-6 w-80 h-[600px] bg-[#0f172a] rounded-[2rem] border-4 border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="h-6 bg-[#0f172a] flex justify-center items-end pb-1 relative z-10 border-b border-slate-800">
         <div className="w-20 h-4 bg-slate-800 rounded-full mb-1" />
         <button onClick={() => setIsOpen(false)} className="absolute right-4 top-1 text-slate-500 hover:text-white">
            <X size={14} />
         </button>
      </div>

      <div className="flex-1 bg-[#0f172a] flex flex-col p-4 overflow-hidden">
        <div className="mb-4">
           <h2 className="text-white font-bold text-lg leading-tight">WMS <span className="text-cyan-500">Go</span></h2>
           <div className="flex justify-between items-end">
                <p className="text-slate-500 text-xs">Listado • {data.length} Itens</p>
                <p className="text-cyan-400 text-xs font-bold">{distinctSkus} SKUs</p>
           </div>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-lg mb-3 border border-slate-800">
           <button onClick={() => setActiveTab('STREET')} className={clsx("flex-1 py-1.5 text-[10px] font-medium rounded text-center transition-colors uppercase", activeTab === 'STREET' ? "bg-cyan-600 text-white" : "text-slate-500")}>Ruas</button>
           <button onClick={() => setActiveTab('ADDR')} className={clsx("flex-1 py-1.5 text-[10px] font-medium rounded text-center transition-colors uppercase", activeTab === 'ADDR' ? "bg-slate-700 text-white" : "text-slate-500")}>Endereço</button>
           <button onClick={() => setActiveTab('PROD')} className={clsx("flex-1 py-1.5 text-[10px] font-medium rounded text-center transition-colors uppercase", activeTab === 'PROD' ? "bg-slate-700 text-white" : "text-slate-500")}>Produto</button>
        </div>

        {activeTab !== 'STREET' && (
            <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={activeTab === 'ADDR' ? "Rua/Pred/AP..." : "Código ou Nome..."} className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-cyan-500 focus:outline-none placeholder:text-slate-600" />
            </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {activeTab === 'STREET' && (
             <div className="grid grid-cols-1 gap-2">
                {streets.map(s => (
                    <button 
                        key={s.name}
                        onClick={() => onTeleport(s.x, 1.7, s.z + 2)} 
                        className="flex items-center justify-between bg-slate-800/50 p-4 rounded border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 transition-all text-left group"
                    >
                        <div>
                            <div className="font-bold text-white text-lg group-hover:text-cyan-400 transition-colors">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.count} Posições</div>
                        </div>
                        <div className="bg-cyan-900/20 p-2 rounded-full text-cyan-400">
                             <MapIcon size={16} />
                        </div>
                    </button>
                ))}
             </div>
          )}

          {activeTab !== 'STREET' && (
            <>
                {filtered.length === 0 && (
                    <div className="text-center text-slate-600 text-xs mt-4">
                        {search ? "Nenhum resultado." : "Digite para buscar."}
                    </div>
                )}
                {filtered.map(item => {
                    let boxCount = 0;
                    if (item.rawItem) {
                        const qty = parseFloat(item.rawItem.ESTQ_LOCUS) || 0;
                        const cpa = parseFloat(item.rawItem.CPA) || 1; 
                        boxCount = Math.floor(qty / cpa);
                    }

                    return (
                        <div key={item.id} className="bg-slate-800/50 p-3 rounded border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 transition-colors group cursor-pointer" onClick={() => {onSelect(item); onTeleport(item.x, item.y, item.z);}}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-cyan-400">{item.rawAddress.RUA}-{item.rawAddress.PRED}-{item.rawAddress.AP}-{item.rawAddress.SL}</span>
                            <span className={clsx("w-2 h-2 rounded-full", item.rawAddress.STATUS === 'O' ? 'bg-orange-500' : 'bg-green-500')} />
                        </div>
                        {item.rawItem ? (
                            <div className="text-[10px] text-slate-300">
                                <div className="font-semibold mb-1 line-clamp-1">{item.rawItem.DESCRICAO}</div>
                                <div className="flex justify-between text-slate-500">
                                    <span>{boxCount} Cxs</span>
                                    <span className="flex items-center gap-1"><Calendar size={10}/> {item.rawItem.VALIDADE}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-slate-600 italic">Vazio</div>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Target size={10} /> Ir para local
                        </div>
                        </div>
                    );
                })}
            </>
          )}
        </div>
      </div>
      <div className="h-5 bg-[#0f172a] flex justify-center items-center"><div className="w-24 h-1 bg-slate-800 rounded-full" /></div>
    </div>
  );
};