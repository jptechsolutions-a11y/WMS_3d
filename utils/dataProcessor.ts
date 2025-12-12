import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, AnalysisRow } from '../types';
import { COLORS, DIMENSIONS } from '../constants';

// Helper to extract number from string (e.g., "RUA001" -> 1)
export const extractNumber = (str: string): number => {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

const extractSector = (desc: string): string => {
  if (!desc) return 'GERAL';
  return desc.replace(/^RUA\s*\d+\s*[-]?\s*/i, '').trim().toUpperCase() || 'GERAL';
};

export const parseCSV = <T>(file: File): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as T[]),
      error: (err) => reject(err),
    });
  });
};

// [NOVO] Lógica PQR baseada em Visitas (Pareto / Curva)
// P = 0-80% das visitas acumuladas
// Q = 80-95% das visitas acumuladas
// R = 95-100% das visitas acumuladas
const calculatePQR = (analysisRows: AnalysisRow[]) => {
  // 1. Converter visitas para número e ordenar decrescente
  const sorted = analysisRows.map(row => ({
    ...row,
    visitasNum: parseInt(row.VISITAS || '0', 10),
    key: `${parseInt(row.CODRUA)}-${parseInt(row.NROPREDIO)}-${parseInt(row.NROAPARTAMENTO)}-${parseInt(row.NROSALA)}` // Chave única de endereço
  })).sort((a, b) => b.visitasNum - a.visitasNum);

  const totalVisits = sorted.reduce((acc, curr) => acc + curr.visitasNum, 0);
  
  let currentAccumulated = 0;
  const pqrMap = new Map<string, { class: 'P' | 'Q' | 'R', visits: number, seq: string, desc: string }>();

  sorted.forEach(item => {
    currentAccumulated += item.visitasNum;
    const percentage = (currentAccumulated / totalVisits) * 100;
    
    let classification: 'P' | 'Q' | 'R' = 'R';
    if (percentage <= 80) classification = 'P';
    else if (percentage <= 95) classification = 'Q';
    
    // Se visitas for 0, força ser R
    if (item.visitasNum === 0) classification = 'R';

    pqrMap.set(item.key, {
      class: classification,
      visits: item.visitasNum,
      seq: item.SEQPRODUTO,
      desc: item.DESCCOMPLETA
    });
  });

  return pqrMap;
};

export const processData = (
    addresses: RawAddressRow[], 
    items: RawItemRow[],
    pulmaoItems: RawItemRow[] = [],
    analysisData: AnalysisRow[] = [] // [NOVO] Dados PQR
): MergedData[] => {
  
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => itemMap.set(item.SEQENDERECO, item));

  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => pulmaoMap.set(item.SEQENDERECO, item));

  // Processar PQR se existir
  let pqrMap: Map<string, any> | null = null;
  if (analysisData.length > 0) {
    pqrMap = calculatePQR(analysisData);
  }

  return addresses.map(addr => {
    const item = itemMap.get(addr.SEQENDERECO);
    const pItem = pulmaoMap.get(addr.SEQENDERECO);
    
    const ruaIdx = extractNumber(addr.RUA);
    const predIdx = extractNumber(addr.PRED);
    const apIdx = extractNumber(addr.AP);
    const slIdx = extractNumber(addr.SL) || 1; 
    
    const sector = extractSector(addr.DESCRUA || '');

    // Status Mapping
    let status = addr.STATUS as AddressStatus;
    if (![AddressStatus.Reserved, AddressStatus.Occupied, AddressStatus.Available, AddressStatus.Blocked].includes(status)) {
      status = AddressStatus.Blocked; 
    }

    // Tunnel Logic
    const isTunnel = addr.ESP === 'P' && apIdx <= 3;
    let visualY = apIdx;
    if (isTunnel) {
        visualY = 5 + (apIdx - 1); 
    }

    // Coordinates
    const aisleCenterX = ruaIdx * DIMENSIONS.STREET_SPACING;
    const isEvenPred = predIdx % 2 === 0;
    const sideMultiplier = isEvenPred ? 1 : -1;
    const predioSequenceIndex = Math.floor((predIdx - 1) / 2);
    const bayCenterZ = -(predioSequenceIndex * DIMENSIONS.BAY_WIDTH);
    const salaOffset = slIdx === 1 ? -0.7 : 0.7;
    
    const x = aisleCenterX + (sideMultiplier * DIMENSIONS.AISLE_CENTER_OFFSET);
    const z = bayCenterZ + salaOffset;
    const y = (visualY - 1) * DIMENSIONS.RACK_HEIGHT;

    // [NOVO] Vincular dados PQR
    let analysisInfo = undefined;
    if (pqrMap) {
      // Criar chave compatível com a lógica do calculatePQR
      // Nota: rawAddress strings podem ter zeros à esquerda "001", o parse resolve isso
      const addressKey = `${ruaIdx}-${predIdx}-${apIdx}-${slIdx}`;
      const pqrData = pqrMap.get(addressKey);
      
      if (pqrData) {
        analysisInfo = {
          pqrClass: pqrData.class,
          visits: pqrData.visits,
          seqProduto: pqrData.seq,
          description: pqrData.desc
        };
      }
    }

    return {
      id: addr.SEQENDERECO,
      rawAddress: addr,
      rawItem: item,
      pulmaoItem: pItem,
      analysis: analysisInfo, // [NOVO]
      x,
      y,
      z,
      color: COLORS[status] || COLORS.DEFAULT,
      isTunnel,
      sector
    };
  });
};
