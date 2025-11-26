import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus } from '../types';
import { COLORS, DIMENSIONS } from '../constants';

// Helper to extract number from string (e.g., "RUA001" -> 1)
export const extractNumber = (str: string): number => {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// [NOVO] Helper para extrair o setor da descrição da rua
// Ex: "RUA 021 MERCEARIA" -> "MERCEARIA"
// Ex: "RUA 01 - LIQUIDA" -> "LIQUIDA"
const extractSector = (desc: string): string => {
  if (!desc) return 'GERAL';
  // Remove "RUA", digitos opcionais, espaços e hifens do início
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

export const processData = (
    addresses: RawAddressRow[], 
    items: RawItemRow[],
    pulmaoItems: RawItemRow[] = [] 
): MergedData[] => {
  
  // Map Picking Items
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => {
    itemMap.set(item.SEQENDERECO, item);
  });

  // Map Pulmão Items
  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => {
    pulmaoMap.set(item.SEQENDERECO, item);
  });

  return addresses.map(addr => {
    const item = itemMap.get(addr.SEQENDERECO);
    const pItem = pulmaoMap.get(addr.SEQENDERECO);
    
    // 1. Parsing IDs
    const ruaIdx = extractNumber(addr.RUA);
    const predIdx = extractNumber(addr.PRED);
    const apIdx = extractNumber(addr.AP);
    const slIdx = extractNumber(addr.SL) || 1; 
    
    // [NOVO] Extração do Setor
    const sector = extractSector(addr.DESCRUA || '');

    // 2. Status Mapping
    let status = addr.STATUS as AddressStatus;
    if (![AddressStatus.Reserved, AddressStatus.Occupied, AddressStatus.Available, AddressStatus.Blocked].includes(status)) {
      status = AddressStatus.Blocked; 
    }

    // 3. "Pulmão" (Tunnel) Logic
    const isTunnel = addr.ESP === 'P' && apIdx <= 3;
    let visualY = apIdx;
    if (isTunnel) {
        visualY = 5 + (apIdx - 1); 
    }

    // 4. COORDINATE CALCULATION 
    const aisleCenterX = ruaIdx * DIMENSIONS.STREET_SPACING;

    // Side Logic
    const isEvenPred = predIdx % 2 === 0;
    const sideMultiplier = isEvenPred ? 1 : -1;
    
    // Z Axis
    const predioSequenceIndex = Math.floor((predIdx - 1) / 2);
    const bayCenterZ = -(predioSequenceIndex * DIMENSIONS.BAY_WIDTH);

    // Sala Logic
    const salaOffset = slIdx === 1 ? -0.7 : 0.7;
    
    const x = aisleCenterX + (sideMultiplier * DIMENSIONS.AISLE_CENTER_OFFSET);
    const z = bayCenterZ + salaOffset;
    const y = (visualY - 1) * DIMENSIONS.RACK_HEIGHT;

    return {
      id: addr.SEQENDERECO,
      rawAddress: addr,
      rawItem: item,
      pulmaoItem: pItem,
      x,
      y,
      z,
      color: COLORS[status] || COLORS.DEFAULT,
      isTunnel,
      sector // [NOVO]
    };
  });
};
