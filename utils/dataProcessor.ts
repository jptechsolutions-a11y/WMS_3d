import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, ClassRating, Suggestion } from '../types';
import { COLORS, DIMENSIONS } from '../constants';

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

export const processData = (
    addresses: RawAddressRow[], 
    items: RawItemRow[],
    pulmaoItems: RawItemRow[] = [] 
): MergedData[] => {
  
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => {
    if(item.SEQENDERECO) itemMap.set(item.SEQENDERECO, item);
  });

  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => {
    if(item.SEQENDERECO) pulmaoMap.set(item.SEQENDERECO, item);
  });

  return addresses.map(addr => {
    const item = itemMap.get(addr.SEQENDERECO);
    const pItem = pulmaoMap.get(addr.SEQENDERECO);
    
    const ruaIdx = extractNumber(addr.RUA);
    const predIdx = extractNumber(addr.PRED);
    const apIdx = extractNumber(addr.AP);
    const slIdx = extractNumber(addr.SL) || 1; 
    
    const sector = extractSector(addr.DESCRUA || '');

    let status = addr.STATUS as AddressStatus;
    if (![AddressStatus.Reserved, AddressStatus.Occupied, AddressStatus.Available, AddressStatus.Blocked].includes(status)) {
      status = AddressStatus.Blocked; 
    }

    const isTunnel = addr.ESP === 'P' && apIdx <= 3;
    let visualY = apIdx;
    if (isTunnel) {
        visualY = 5 + (apIdx - 1); 
    }

    const aisleCenterX = ruaIdx * DIMENSIONS.STREET_SPACING;
    const isEvenPred = predIdx % 2 === 0;
    const sideMultiplier = isEvenPred ? 1 : -1;
    
    // Z Axis: sequence index dictates depth.
    const predioSequenceIndex = Math.floor((predIdx - 1) / 2);
    // Important: In this coordinate system, 0 is the start of the street (if we consider Z axis going negative into the screen).
    // Or if we consider Standard Warehouse, usually Entrance is at Z=0.
    // Let's assume larger -Z is deeper into the aisle.
    const bayCenterZ = -(predioSequenceIndex * DIMENSIONS.BAY_WIDTH);

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
      sector
    };
  });
};

// --- ANALYTICS LOGIC ---

export const calculateAnalytics = (data: MergedData[], workDays: number): MergedData[] => {
  if (workDays <= 0) workDays = 1;

  // 1. Calculate Metrics for each occupied picking slot
  const enriched = data.map(d => {
    if (d.rawAddress.ESP !== 'A' || !d.rawItem) return { ...d, analytics: undefined };

    const visits = parseFloat(d.rawItem.VISITAS || '0');
    const volumes = parseFloat(d.rawItem.VOLUMES || '0');

    const dailyVisits = visits / workDays;
    const dailyVolume = volumes / workDays;

    return {
      ...d,
      analytics: {
        dailyVisits,
        dailyVolume,
        abcClass: 'N/A' as ClassRating,
        pqrClass: 'N/A' as ClassRating,
        combinedClass: '',
        score: 0
      }
    };
  });

  // 2. Sort and Classify ABC (Pareto by Volume)
  const itemsWithVolume = enriched.filter(d => d.analytics).sort((a, b) => b.analytics!.dailyVolume - a.analytics!.dailyVolume);
  const totalVolume = itemsWithVolume.reduce((sum, d) => sum + d.analytics!.dailyVolume, 0);
  
  let accumVol = 0;
  itemsWithVolume.forEach(d => {
    accumVol += d.analytics!.dailyVolume;
    const perc = (accumVol / totalVolume) * 100;
    if (perc <= 80) d.analytics!.abcClass = 'A';
    else if (perc <= 95) d.analytics!.abcClass = 'B';
    else d.analytics!.abcClass = 'C';
  });

  // 3. Sort and Classify PQR (Pareto by Visits/Frequency)
  const itemsWithVisits = enriched.filter(d => d.analytics).sort((a, b) => b.analytics!.dailyVisits - a.analytics!.dailyVisits);
  const totalVisits = itemsWithVisits.reduce((sum, d) => sum + d.analytics!.dailyVisits, 0);

  let accumVisits = 0;
  itemsWithVisits.forEach(d => {
    accumVisits += d.analytics!.dailyVisits;
    const perc = (accumVisits / totalVisits) * 100;
    if (perc <= 80) d.analytics!.pqrClass = 'P';
    else if (perc <= 95) d.analytics!.pqrClass = 'Q';
    else d.analytics!.pqrClass = 'R';

    // Set combined class and score for sorting suggestions
    d.analytics!.combinedClass = d.analytics!.abcClass + d.analytics!.pqrClass;
    
    // Score Logic: P > A > Q > B > R > C
    // Weight: P=50, A=40, Q=30, B=20, R=10, C=0
    let score = 0;
    if(d.analytics!.pqrClass === 'P') score += 50;
    if(d.analytics!.pqrClass === 'Q') score += 30;
    if(d.analytics!.pqrClass === 'R') score += 10;
    
    if(d.analytics!.abcClass === 'A') score += 40;
    if(d.analytics!.abcClass === 'B') score += 20;
    if(d.analytics!.abcClass === 'C') score += 0;
    
    d.analytics!.score = score;
  });

  return enriched;
};

// --- SUGGESTION ENGINE ---

export const generateSuggestions = (data: MergedData[]): Suggestion[] => {
  const suggestions: Suggestion[] = [];
  
  // Group by Sector
  const sectorMap = new Map<string, MergedData[]>();
  data.forEach(d => {
    if (d.rawAddress.ESP !== 'A') return; // Only Picking
    if (!sectorMap.has(d.sector)) sectorMap.set(d.sector, []);
    sectorMap.get(d.sector)!.push(d);
  });

  sectorMap.forEach((sectorItems, sectorName) => {
    // 1. Identify "Good" Addresses (Start of street = Higher Z in our logic, or logic based on "Entrance")
    // In our Scene2D logic, maxZ was used as start. Let's assume max Z is "better".
    const addresses = [...sectorItems].sort((a, b) => b.z - a.z); // Descending Z = Start of Street to Back
    
    // 2. Identify "Good" Items (Highest Score)
    // We only care about items that actually exist (Occupied)
    const items = sectorItems
        .filter(d => d.rawItem && d.analytics)
        .map(d => ({ 
            ...d, 
            score: d.analytics!.score,
            code: d.rawItem!.CODIGO,
            desc: d.rawItem!.DESCRICAO
        }))
        .sort((a, b) => b.score - a.score);

    // 3. Match
    // Iterate through sorted addresses. The best address should have the best item.
    for (let i = 0; i < items.length; i++) {
        // We can only swap to addresses that exist in the list (we don't create new addresses)
        if (i >= addresses.length) break;

        const bestItem = items[i];
        const targetAddress = addresses[i];

        // If the item sitting at targetAddress is NOT the bestItem, we need a move
        // Note: targetAddress might be empty or occupied by someone else
        const currentItemAtTarget = targetAddress.rawItem;

        if (currentItemAtTarget?.CODIGO !== bestItem.code) {
             // Create Suggestion
             suggestions.push({
                 itemId: bestItem.id, // Original location ID
                 productCode: bestItem.code,
                 productDesc: bestItem.desc,
                 fromAddress: `${bestItem.rawAddress.RUA}-${bestItem.rawAddress.PRED}-${bestItem.rawAddress.AP}`,
                 toAddress: `${targetAddress.rawAddress.RUA}-${targetAddress.rawAddress.PRED}-${targetAddress.rawAddress.AP}`,
                 fromId: bestItem.id,
                 toId: targetAddress.id,
                 priority: bestItem.analytics?.pqrClass === 'P' ? 'HIGH' : bestItem.analytics?.abcClass === 'A' ? 'MEDIUM' : 'LOW',
                 reason: `Item Curva ${bestItem.analytics?.combinedClass} deve estar no início da rua.`
             });
        }
    }
  });

  return suggestions;
};
