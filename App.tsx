import React, { useState, useEffect, useMemo } from 'react';
import { Scene3D } from './components/Scene3D';
import { Scene2D } from './components/Scene2D';
import { Sidebar } from './components/Sidebar';
import { Handheld } from './components/Handheld';
import { processData, parseCSV } from './utils/dataProcessor';
import { MergedData, ViewMode, FilterState, RawAddressRow, RawItemRow, AddressStatus, ReceiptFilterType } from './types';
import { Upload, AlertTriangle } from 'lucide-react';

// Helper to parse DD/MM/YYYY to Date object
const parseDatePTBR = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getFullYear() === d2.getFullYear();
};

export default function App() {
  const [data, setData] = useState<MergedData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('3D_ORBIT');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [colorMode, setColorMode] = useState<'REALISTIC' | 'STATUS'>('REALISTIC');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [teleportPos, setTeleportPos] = useState<{x:number, y:number, z:number} | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [files, setFiles] = useState<{ structure?: File, items?: File, pulmao?: File }>({});

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    status: [AddressStatus.Occupied, AddressStatus.Available, AddressStatus.Reserved, AddressStatus.Blocked],
    type: ['A', 'P'],
    search: '',
    expiryDays: null,
    receiptType: 'ALL',
    receiptDate: new Date().toISOString().split('T')[0] 
  });

  // Calculate visible items
  const visibleItemIds = useMemo(() => {
    const ids = new Set<string>();
    const searchLower = filters.search.toLowerCase();
    const hasSearch = !!searchLower;
    const hasExpiry = filters.expiryDays !== null;
    const hasReceipt = filters.receiptType !== 'ALL';
    
    const now = new Date();
    now.setHours(0,0,0,0);

    data.forEach(d => {
       let matches = true;
       const relevantItem = d.rawAddress.ESP === 'P' ? d.pulmaoItem : d.rawItem;

       if (hasSearch) {
          const addrStr = `${d.rawAddress.RUA} ${d.rawAddress.PRED} ${d.rawAddress.AP} ${d.rawAddress.SL}`.toLowerCase();
          const prodName = relevantItem?.DESCRICAO?.toLowerCase() || '';
          const prodCode = relevantItem?.CODIGO?.toLowerCase() || '';
          const idStr = d.id.toLowerCase();
          
          if (!addrStr.includes(searchLower) && !idStr.includes(searchLower) && !prodName.includes(searchLower) && !prodCode.includes(searchLower)) {
             matches = false;
          }
       }

       if (matches && hasExpiry) {
           if (!relevantItem || !relevantItem.VALIDADE) {
               matches = false;
           } else {
               const expiryDate = parseDatePTBR(relevantItem.VALIDADE);
               if (expiryDate) {
                   const diffTime = expiryDate.getTime() - now.getTime();
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                   if (diffDays > filters.expiryDays!) matches = false;
               } else {
                   matches = false; 
               }
           }
       }

       if (matches && hasReceipt) {
           if (!relevantItem || !relevantItem.RECEBIMENTO) {
               matches = false;
           } else {
               const receiptDate = parseDatePTBR(relevantItem.RECEBIMENTO);
               if (!receiptDate) {
                   matches = false;
               } else {
                   receiptDate.setHours(0,0,0,0);
                   
                   switch (filters.receiptType) {
                       case 'YESTERDAY':
                           const yest = new Date(now);
                           yest.setDate(now.getDate() - 1);
                           if (!isSameDay(receiptDate, yest)) matches = false;
                           break;
                       case 'BEFORE_YESTERDAY':
                           const beforeYest = new Date(now);
                           beforeYest.setDate(now.getDate() - 2);
                           if (!isSameDay(receiptDate, beforeYest)) matches = false;
                           break;
                       case 'THIS_WEEK':
                           const day = now.getDay(); 
                           const diff = now.getDate() - day; 
                           const startOfWeek = new Date(now);
                           startOfWeek.setDate(diff);
                           if (receiptDate < startOfWeek) matches = false;
                           break;
                       case 'THIS_MONTH':
                           const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                           if (receiptDate < startOfMonth) matches = false;
                           break;
                       case 'SPECIFIC':
                           const [y, m, d] = filters.receiptDate.split('-').map(Number);
                           const specific = new Date(y, m - 1, d);
                           if (!isSameDay(receiptDate, specific)) matches = false;
                           break;
                   }
               }
           }
       }

       if (matches) ids.add(d.id);
    });
    return ids;
  }, [data, filters.search, filters.expiryDays, filters.receiptType, filters.receiptDate]);

  const stats = useMemo(() => {
    const s = {
      totalApanha: 0,
      validApanha: 0, 
      occupiedApanha: 0,
      totalPulmao: 0,
      validPulmao: 0, 
      occupiedPulmao: 0,
      total: 0, occupied: 0, available: 0, reserved: 0, blocked: 0 
    };

    data.forEach(d => {
      const isTypeVisible = filters.type.includes(d.rawAddress.ESP);
      const isStatusVisible = filters.status.includes(d.rawAddress.STATUS);
      const isSearchVisible = (!filters.search && filters.expiryDays === null && filters.receiptType === 'ALL') ? true : visibleItemIds.has(d.id);

      if (isTypeVisible && isStatusVisible && isSearchVisible) {
          s.total++;
          if (d.rawAddress.STATUS === AddressStatus.Occupied) s.occupied++;
          if (d.rawAddress.STATUS === AddressStatus.Available) s.available++;
          if (d.rawAddress.STATUS === AddressStatus.Reserved) s.reserved++;
          if (d.rawAddress.STATUS === AddressStatus.Blocked) s.blocked++;
      }

      if (d.rawAddress.ESP === 'A') {
          s.totalApanha++;
          if (d.rawAddress.STATUS !== AddressStatus.Blocked) s.validApanha++;
          if (d.rawAddress.STATUS === AddressStatus.Occupied) s.occupiedApanha++;
      } else if (d.rawAddress.ESP === 'P') {
          s.totalPulmao++;
          if (d.rawAddress.STATUS !== AddressStatus.Blocked) s.validPulmao++;
          if (d.rawAddress.STATUS === AddressStatus.Occupied) s.occupiedPulmao++;
      }
    });
    return s;
  }, [data, filters, visibleItemIds]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'structure' | 'items' | 'pulmao') => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const handleImport = async () => {
    if (!files.structure) return alert('Arquivo de estrutura é obrigatório!');
    setLoading(true);
    try {
      const addresses = await parseCSV<RawAddressRow>(files.structure);
      const items = files.items ? await parseCSV<RawItemRow>(files.items) : [];
      const pulmao = files.pulmao ? await parseCSV<RawItemRow>(files.pulmao) : [];
      const merged = processData(addresses, items, pulmao);
      setData(merged);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar CSV.');
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = useMemo(() => 
    data.find(d => d.id === selectedId) || null, 
  [selectedId, data]);

  const handleTeleport = (x: number, y: number, z: number) => {
    setTeleportPos({ x, y, z });
    setTimeout(() => setTeleportPos(null), 100);
  };

  if (data.length === 0) {
    return (
      <div className="w-full h-screen bg-[#0f172a] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/80 p-8 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30">
               <Upload size={32} />
             </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2 text-white">Perlog WMS <span className="text-cyan-400">3D</span></h2>
          <p className="text-slate-400 text-center mb-6 text-sm">Importe seus dados para visualizar.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Estrutura (Endereços) *</label>
              <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'structure')} className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 cursor-pointer file:cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Estoque Apanha - Opcional</label>
               <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'items')} className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 cursor-pointer file:cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Estoque Pulmão - Opcional</label>
               <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'pulmao')} className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 cursor-pointer file:cursor-pointer" />
            </div>
          </div>

          <button onClick={handleImport} disabled={loading || !files.structure} className="w-full mt-8 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded transition-all shadow-lg shadow-cyan-900/50">{loading ? 'Processando...' : 'Gerar Visualização'}</button>
          
          <div className="mt-4 p-3 bg-cyan-900/20 border border-cyan-500/20 rounded text-cyan-400 text-xs flex gap-2">
             <AlertTriangle size={16} />
             <span>CSV deve usar ponto e vírgula (;). Campos: CD, RUA, PRED, AP, STATUS.</span>
          </div>
        </div>
      </div>
    );
  }

  const filteredDataFor2D = data.filter(d => 
    filters.type.includes(d.rawAddress.ESP) && 
    filters.status.includes(d.rawAddress.STATUS) &&
    visibleItemIds.has(d.id) 
  );

  return (
    <div className="flex w-full h-screen bg-[#0f172a] overflow-hidden">
      <Sidebar 
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedItem={selectedItem}
        filters={filters}
        setFilters={setFilters}
        stats={stats}
        colorMode={colorMode}
        setColorMode={setColorMode}
      />
      
      <main className="flex-1 relative h-full">
        {viewMode.includes('3D') ? (
           <Scene3D 
             data={data} 
             visibleStatus={filters.status} 
             visibleTypes={filters.type} 
             visibleItemIds={visibleItemIds}
             mode={viewMode === '3D_WALK' ? 'WALK' : 'ORBIT'} 
             onSelect={(item) => setSelectedId(item.id)}
             selectedId={selectedId}
             teleportPos={teleportPos}
             isMobileOpen={isMobileOpen}
             colorMode={colorMode}
           />
        ) : (
           <Scene2D 
             data={filteredDataFor2D}
             onSelect={(item) => setSelectedId(item.id)}
             selectedId={selectedId}
           />
        )}
        
        {viewMode === '3D_WALK' && (
           <Handheld 
             data={data} 
             onTeleport={handleTeleport}
             onSelect={(item) => setSelectedId(item.id)}
             isOpen={isMobileOpen}
             setIsOpen={setIsMobileOpen}
           />
        )}

        {viewMode === '3D_WALK' && !isMobileOpen && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm pointer-events-none">
              WASD para Mover • Clique no Celular para Navegar
           </div>
        )}
      </main>
    </div>
  );
}