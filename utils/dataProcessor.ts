import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, ClassRating, Suggestion, RawMetricsRow } from '../types';
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
    pulmaoItems: RawItemRow[] = [],
    metrics: RawMetricsRow[] = []
): MergedData[] => {
  
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => {
    if(item.SEQENDERECO) itemMap.set(item.SEQENDERECO, item);
  });

  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => {
    if(item.SEQENDERECO) pulmaoMap.set(item.SEQENDERECO, item);
  });

  // Index metrics for fast lookup
  const metricsByAddr = new Map<string, RawMetricsRow>();
  const metricsByProd = new Map<string, RawMetricsRow>();
  
  metrics.forEach(m => {
      if (m.SEQENDERECO) metricsByAddr.set(m.SEQENDERECO, m);
      if (m.SEQPRODUTO) metricsByProd.set(m.SEQPRODUTO, m);
      if (m.CODIGO) metricsByProd.set(m.CODIGO, m);
  });

  return addresses.map(addr => {
    const item = itemMap.get(addr.SEQENDERECO);
    const pItem = pulmaoMap.get(addr.SEQENDERECO);
    
    // Attempt to find metrics
    // Priority 1: Direct Address Link (SEQENDERECO)
    // Priority 2: Product Link (SEQPRODUTO/CODIGO) if item exists
    let metricData = metricsByAddr.get(addr.SEQENDERECO);
    
    if (!metricData && item) {
        metricData = metricsByProd.get(item.CODIGO);
    }

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
    
    const predioSequenceIndex = Math.floor((predIdx - 1) / 2);
    // Assume Z=0 is entrance/start of aisle. Deeper into aisle is negative Z.
    // Or simpler: Z increases as we go down the aisle.
    // Let's use positive Z for "Depth" to make logic easier (Start = 0, End = Max)
    const bayCenterZ = (predioSequenceIndex * DIMENSIONS.BAY_WIDTH);

    const salaOffset = slIdx === 1 ? -0.7 : 0.7;
    
    const x = aisleCenterX + (sideMultiplier * DIMENSIONS.AISLE_CENTER_OFFSET);
    const z = bayCenterZ + salaOffset;
    const y = (visualY - 1) * DIMENSIONS.RACK_HEIGHT;

    return {
      id: addr.SEQENDERECO,
      rawAddress: addr,
      rawItem: item,
      pulmaoItem: pItem,
      metrics: metricData,
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
    // Only process Picking (ESP='A') that has Metric data OR Item data
    if (d.rawAddress.ESP !== 'A' || !d.metrics) return { ...d, analytics: undefined };

    const visits = parseFloat(d.metrics.VISITAS || '0');
    const volumes = parseFloat(d.metrics.VOLUMES || '0');

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
  const itemsWithVolume = enriched.filter(d => d.analytics && d.analytics.dailyVolume > 0).sort((a, b) => b.analytics!.dailyVolume - a.analytics!.dailyVolume);
  const totalVolume = itemsWithVolume.reduce((sum, d) => sum + d.analytics!.dailyVolume, 0);
  
  if (totalVolume > 0) {
      let accumVol = 0;
      itemsWithVolume.forEach(d => {
        accumVol += d.analytics!.dailyVolume;
        const perc = (accumVol / totalVolume) * 100;
        if (perc <= 80) d.analytics!.abcClass = 'A';
        else if (perc <= 95) d.analytics!.abcClass = 'B';
        else d.analytics!.abcClass = 'C';
      });
  }

  // 3. Sort and Classify PQR (Pareto by Visits/Frequency)
  const itemsWithVisits = enriched.filter(d => d.analytics && d.analytics.dailyVisits > 0).sort((a, b) => b.analytics!.dailyVisits - a.analytics!.dailyVisits);
  const totalVisits = itemsWithVisits.reduce((sum, d) => sum + d.analytics!.dailyVisits, 0);

  if (totalVisits > 0) {
      let accumVisits = 0;
      itemsWithVisits.forEach(d => {
        accumVisits += d.analytics!.dailyVisits;
        const perc = (accumVisits / totalVisits) * 100;
        if (perc <= 80) d.analytics!.pqrClass = 'P';
        else if (perc <= 95) d.analytics!.pqrClass = 'Q';
        else d.analytics!.pqrClass = 'R';
      });
  }

  // 4. Final Scoring
  enriched.forEach(d => {
      if (!d.analytics) return;
      
      // Default classes if no data
      if (d.analytics.abcClass === 'N/A') d.analytics.abcClass = 'C';
      if (d.analytics.pqrClass === 'N/A') d.analytics.pqrClass = 'R';

      d.analytics.combinedClass = d.analytics.abcClass + d.analytics.pqrClass;
    
      // Score Logic: P > A > Q > B > R > C
      // Higher score means "Should be closer to start"
      let score = 0;
      if(d.analytics.pqrClass === 'P') score += 50;
      if(d.analytics.pqrClass === 'Q') score += 30;
      if(d.analytics.pqrClass === 'R') score += 10;
      
      if(d.analytics.abcClass === 'A') score += 40;
      if(d.analytics.abcClass === 'B') score += 20;
      if(d.analytics.abcClass === 'C') score += 0;
      
      d.analytics.score = score;
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
    // 1. Identify "Good" Addresses (Start of street)
    // In our Z logic (processData), 0 is start, higher Z is deeper.
    // So Ascending Z = Best Addresses (0) to Worst Addresses (Max)
    const addresses = [...sectorItems].sort((a, b) => a.z - b.z); 
    
    // 2. Identify "Good" Items (Highest Score)
    // Only items that have metrics and are occupied
    const items = sectorItems
        .filter(d => d.metrics && d.analytics && d.rawAddress.STATUS === 'O') // Must be occupied to move item FROM
        .map(d => ({ 
            ...d, 
            score: d.analytics!.score,
            code: d.rawItem?.CODIGO || d.metrics?.SEQPRODUTO || 'Unknown',
            desc: d.rawItem?.DESCRICAO || 'Produto sem descrição'
        }))
        .sort((a, b) => b.score - a.score); // Highest score first

    // 3. Match
    // Iterate through sorted addresses. The best address should have the best item.
    // Limit to items count
    for (let i = 0; i < items.length; i++) {
        if (i >= addresses.length) break;

        const bestItem = items[i];
        const targetAddress = addresses[i]; // The address where this Best Item SHOULD be.

        // Is the best item already at the target address?
        if (targetAddress.id !== bestItem.id) {
             // It's not. We need a suggestion.
             // "Move Item X from CurrentPos to TargetPos"
             
             // Avoid duplicate move suggestions for same item
             if (suggestions.some(s => s.itemId === bestItem.id)) continue;

             suggestions.push({
                 itemId: bestItem.id, // Original location ID
                 productCode: bestItem.code,
                 productDesc: bestItem.desc,
                 fromAddress: `${bestItem.rawAddress.RUA}-${bestItem.rawAddress.PRED}-${bestItem.rawAddress.AP}`,
                 toAddress: `${targetAddress.rawAddress.RUA}-${targetAddress.rawAddress.PRED}-${targetAddress.rawAddress.AP}`,
                 fromId: bestItem.id,
                 toId: targetAddress.id,
                 priority: bestItem.analytics?.pqrClass === 'P' ? 'HIGH' : bestItem.analytics?.abcClass === 'A' ? 'MEDIUM' : 'LOW',
                 reason: `Curva ${bestItem.analytics?.combinedClass} (Score ${bestItem.analytics?.score}). Mover para início da rua.`
             });
        }
    }
  });

  return suggestions;
};
