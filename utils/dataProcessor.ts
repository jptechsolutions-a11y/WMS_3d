import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, AnalysisRow, SuggestionMove } from '../types';
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

// [ATUALIZADO] Lógica Híbrida PQR (Visitas + Volumes)
const calculatePQR = (analysisRows: AnalysisRow[]) => {
  // 1. Parsear valores
  const parsedRows = analysisRows.map(row => ({
    ...row,
    visitasNum: parseInt(row.VISITAS || '0', 10),
    volumeNum: parseFloat(row.MEDIA_DIA_CX?.replace(',', '.') || '0'),
    key: `${parseInt(row.CODRUA)}-${parseInt(row.NROPREDIO)}-${parseInt(row.NROAPARTAMENTO)}-${parseInt(row.NROSALA)}`
  }));

  // 2. Encontrar máximos para normalização
  const maxVisits = Math.max(...parsedRows.map(r => r.visitasNum), 1);
  const maxVolume = Math.max(...parsedRows.map(r => r.volumeNum), 1);

  // 3. Calcular Score Combinado e Ordenar
  // Peso Sugerido: 70% Visitas (Picking Frequência) + 30% Volume (Reposição)
  const sorted = parsedRows.map(row => {
    const normVisit = row.visitasNum / maxVisits;
    const normVol = row.volumeNum / maxVolume;
    const score = (normVisit * 0.7) + (normVol * 0.3);
    return { ...row, score };
  }).sort((a, b) => b.score - a.score);

  const totalScore = sorted.reduce((acc, curr) => acc + curr.score, 0);
  
  let currentAccumulated = 0;
  const pqrMap = new Map<string, { class: 'P' | 'Q' | 'R', visits: number, volume: number, score: number, seq: string, desc: string }>();

  sorted.forEach(item => {
    currentAccumulated += item.score;
    const percentage = (currentAccumulated / totalScore) * 100;
    
    let classification: 'P' | 'Q' | 'R' = 'R';
    if (percentage <= 80) classification = 'P';
    else if (percentage <= 95) classification = 'Q';
    
    // Itens sem movimento forçados para R
    if (item.score === 0) classification = 'R';

    pqrMap.set(item.key, {
      class: classification,
      visits: item.visitasNum,
      volume: item.volumeNum,
      score: item.score,
      seq: item.SEQPRODUTO,
      desc: item.DESCCOMPLETA
    });
  });

  return pqrMap;
};

// [NOVO] Lógica de Sugestão de Reorganização
const generateSuggestions = (data: MergedData[]): MergedData[] => {
  // Agrupar endereços de APANHA por Setor
  const sectors = new Set(data.map(d => d.sector));
  
  // Clone para não mutar diretamente enquanto iteramos
  const newData = [...data];
  const addressMap = new Map<string, MergedData>();
  newData.forEach(d => addressMap.set(d.id, d));

  sectors.forEach(sector => {
      // 1. Pegar endereços de Apanha deste setor
      const sectorAddresses = newData.filter(d => d.sector === sector && d.rawAddress.ESP === 'A');
      if (sectorAddresses.length === 0) return;

      // 2. Classificar Endereços (Score de Ouro)
      // Melhor endereço: Nível baixo (AP=1) e Mais perto da "frente" (Maior Z)
      // Ajuste Z: No sistema 3D, Z cresce para a "frente" da rua (onde está o label).
      // Score = (Z * 10) - (AP * 100). Nível pesa mais que profundidade.
      const rankedAddresses = [...sectorAddresses].sort((a, b) => {
         const scoreA = (a.z * 10) - (extractNumber(a.rawAddress.AP) * 100);
         const scoreB = (b.z * 10) - (extractNumber(b.rawAddress.AP) * 100);
         return scoreB - scoreA; // Decrescente (Maior score é melhor)
      });

      // 3. Pegar Itens com PQR deste setor (que estão atualmente ocupando endereços aqui)
      // Nota: Estamos assumindo reorganização dos itens JÁ presentes no setor.
      const rankedItems = sectorAddresses
          .filter(d => d.analysis) // Tem dados PQR
          .map(d => ({ 
              originalAddressId: d.id, 
              analysis: d.analysis!,
              itemDesc: d.analysis!.description,
              itemSeq: d.analysis!.seqProduto
          }))
          .sort((a, b) => b.analysis.score - a.analysis.score); // Mais movimentados primeiro

      // 4. Match (Pareamento Ideal)
      // O item Top 1 deve ir para o Endereço Top 1
      rankedItems.forEach((item, index) => {
          if (index >= rankedAddresses.length) return; // Mais itens que endereços (raro se for 1:1)

          const targetAddress = rankedAddresses[index];
          const originalAddress = addressMap.get(item.originalAddressId);

          // Atualizar a Sugestão no Target Address
          // "Neste endereço (target), deveria estar o item com classe tal"
          targetAddress.analysis = {
             ...targetAddress.analysis!,
             suggestedClass: item.analysis.pqrClass // A cor sugerida para este local é a classe do item Top
          };

          // Gerar Log de Movimento se necessário
          // Se o item não está JÁ no melhor lugar
          if (originalAddress && originalAddress.id !== targetAddress.id) {
             const move: SuggestionMove = {
                 fromAddress: `${originalAddress.rawAddress.RUA}-${originalAddress.rawAddress.PRED}-${originalAddress.rawAddress.AP}`,
                 toAddress: `${targetAddress.rawAddress.RUA}-${targetAddress.rawAddress.PRED}-${targetAddress.rawAddress.AP}`,
                 productCode: item.itemSeq,
                 productName: item.itemDesc,
                 reason: `Item ${item.analysis.pqrClass} (Score ${item.analysis.score.toFixed(2)}) movido para melhor posição.`,
                 priority: item.analysis.pqrClass === 'P' ? 'HIGH' : 'MEDIUM'
             };
             
             // Anexar sugestão ao endereço onde o item ESTÁ hoje, para saber que ele deve sair
             originalAddress.analysis = {
                 ...originalAddress.analysis!,
                 suggestionMove: move
             };
          }
      });
  });

  return newData;
};

export const processData = (
    addresses: RawAddressRow[], 
    items: RawItemRow[],
    pulmaoItems: RawItemRow[] = [],
    analysisData: AnalysisRow[] = []
): MergedData[] => {
  
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => itemMap.set(item.SEQENDERECO, item));

  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => pulmaoMap.set(item.SEQENDERECO, item));

  let pqrMap: Map<string, any> | null = null;
  if (analysisData.length > 0) {
    pqrMap = calculatePQR(analysisData);
  }

  const initialMerged = addresses.map(addr => {
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

    let analysisInfo = undefined;
    if (pqrMap) {
      const addressKey = `${ruaIdx}-${predIdx}-${apIdx}-${slIdx}`;
      const pqrData = pqrMap.get(addressKey);
      
      if (pqrData) {
        analysisInfo = {
          pqrClass: pqrData.class,
          visits: pqrData.visits,
          volume: pqrData.volume,
          score: pqrData.score,
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
      analysis: analysisInfo,
      x,
      y,
      z,
      color: COLORS[status] || COLORS.DEFAULT,
      isTunnel,
      sector
    };
  });

  // [ATUALIZADO] Se temos dados PQR, calcular sugestões
  if (pqrMap) {
      return generateSuggestions(initialMerged);
  }

  return initialMerged;
};
