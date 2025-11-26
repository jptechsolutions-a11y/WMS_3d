import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus } from '../types';
import { COLORS, DIMENSIONS } from '../constants';

// Helper to extract number from string (e.g., "RUA001" -> 1)
export const extractNumber = (str: string): number => {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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
    // Invert direction: Predio 1 (Start) is at 0. Higher Predios go Negative (Up/Far).
    // This puts "Start" at the "Bottom" visually in 2D/3D default views.
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
      isTunnel
    };
  });
};