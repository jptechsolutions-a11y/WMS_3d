import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, RawCurveRow, CurveData } from '../types';
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

const parseDecimal = (str: string): number => {
  if (!str) return 0;
  // Trata formato brasileiro (1.000,00)
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
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

// [NOVO] Processamento da Curva ABC/PQR
export const calculateCurveData = (
    data: MergedData[], 
    curveRows: RawCurveRow[], 
    periodDays: number
): MergedData[] => {
    
    // 1. Mapear dados da curva pelo SEQENDERECO
    const curveMap = new Map<string, RawCurveRow>();
    curveRows.forEach(row => {
        if(row.SEQENDERECO) curveMap.set(row.SEQENDERECO, row);
    });

    // 2. Calcular métricas individuais e criar lista temporária para ordenação
    let analyzedItems: { id: string, visits: number, volume: number, weight: number, cubage: number, score: number }[] = [];

    data.forEach(d => {
        // Apenas para itens de APANHA
        if (d.rawAddress.ESP !== 'A') return;

        const cRow = curveMap.get(d.id);
        
        // Se não tiver dados no arquivo de curva, assume zero (Curva C/R)
        const visitsTotal = cRow ? parseDecimal(cRow.VISITAS) : 0;
        const volumeTotal = cRow ? parseDecimal(cRow.VOLUMES) : 0;
        const weight = cRow ? parseDecimal(cRow.PESOBRUTO) : 0;
        const cubage = cRow ? parseDecimal(cRow.PESOCUBADO) : 0;

        const visitsPerDay = periodDays > 0 ? visitsTotal / periodDays : 0;
        const volumePerDay = periodDays > 0 ? volumeTotal / periodDays : 0;

        // Score para Ranking "Ideal" (Sugestão de Layout):
        // PQR (Visitas) tem peso maior na logística de separação para reduzir caminhada.
        // Cubagem entra como critério de desempate e ergonomia (Pesados/Grandes no início da rua).
        // Score = (Visitas * 10000) + Cubagem
        const score = (visitsPerDay * 10000) + cubage;

        analyzedItems.push({
            id: d.id,
            visits: visitsPerDay,
            volume: volumePerDay,
            weight,
            cubage,
            score
        });
    });

    // 3. Ordenar para definir classes (Pareto 80/15/5 ou simplificado por contagem)
    // Vamos usar: Top 20% = A/P, Próximos 30% = B/Q, Resto 50% = C/R
    
    // Classificação PQR (Visitas)
    analyzedItems.sort((a, b) => b.visits - a.visits);
    const totalItems = analyzedItems.length;
    const cutP = Math.floor(totalItems * 0.2); 
    const cutQ = Math.floor(totalItems * 0.5); // Acumulado

    const pqrMap = new Map<string, 'P'|'Q'|'R'>();
    analyzedItems.forEach((item, index) => {
        if (index < cutP) pqrMap.set(item.id, 'P');
        else if (index < cutQ) pqrMap.set(item.id, 'Q');
        else pqrMap.set(item.id, 'R');
    });

    // Classificação ABC (Volume)
    analyzedItems.sort((a, b) => b.volume - a.volume);
    const abcMap = new Map<string, 'A'|'B'|'C'>();
    analyzedItems.forEach((item, index) => {
        if (index < cutP) abcMap.set(item.id, 'A');
        else if (index < cutQ) abcMap.set(item.id, 'B');
        else abcMap.set(item.id, 'C');
    });

    // Ranking Ideal Global (Melhores Itens) baseado no Score Composto
    analyzedItems.sort((a, b) => b.score - a.score); 
    const rankMap = new Map<string, number>();
    analyzedItems.forEach((item, index) => {
        rankMap.set(item.id, index + 1);
    });

    // 4. Injetar dados de volta no MergedData
    return data.map(d => {
        if (d.rawAddress.ESP !== 'A' || !pqrMap.has(d.id)) {
            return d;
        }

        const pqr = pqrMap.get(d.id)!;
        const abc = abcMap.get(d.id)!;
        const itemMetrics = analyzedItems.find(i => i.id === d.id)!;

        // Combined Class para visualização cruzada
        let combined: 'AA' | 'BB' | 'CC' | 'MIX' = 'CC';
        // Lógica de Cores Cruzadas:
        // Verde se for P (frequente) OU A (volumoso)
        if (pqr === 'P' || abc === 'A') combined = 'AA';
        // Amarelo se for Q ou B (e não for P/A)
        else if (pqr === 'Q' || abc === 'B') combined = 'BB';
        // Vermelho resto
        else combined = 'CC';

        return {
            ...d,
            curveData: {
                pqrClass: pqr,
                abcClass: abc,
                combinedClass: combined,
                visitsPerDay: itemMetrics.visits,
                volumePerDay: itemMetrics.volume,
                weight: itemMetrics.weight,
                cubage: itemMetrics.cubage,
                idealRank: rankMap.get(d.id)!
            }
        };
    });
};

export const processData = (
    addresses: RawAddressRow[], 
    items: RawItemRow[],
    pulmaoItems: RawItemRow[] = [] 
): MergedData[] => {
  
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => {
    itemMap.set(item.SEQENDERECO, item);
  });

  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => {
    pulmaoMap.set(item.SEQENDERECO, item);
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
    const predioSequenceIndex = Math.floor((predIdx - 1) / 2);
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
