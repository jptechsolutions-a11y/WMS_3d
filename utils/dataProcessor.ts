import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, AnalysisRow, SuggestionMove } from '../types';
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

const calculatePQR = (analysisRows: AnalysisRow[]) => {
  const parsedRows = analysisRows.map(row => ({
    ...row,
    visitasNum: parseInt(row.VISITAS || '0', 10),
    volumeNum: parseFloat(row.MEDIA_DIA_CX?.replace(',', '.') || '0'),
    key: `${parseInt(row.CODRUA)}-${parseInt(row.NROPREDIO)}-${parseInt(row.NROAPARTAMENTO)}-${parseInt(row.NROSALA)}`
  }));

  const maxVisits = Math.max(...parsedRows.map(r => r.visitasNum), 1);
  const maxVolume = Math.max(...parsedRows.map(r => r.volumeNum), 1);

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

// [ATUALIZADO] Lógica de Sugestão com Otimização de Proximidade
const generateSuggestions = (data: MergedData[]): MergedData[] => {
  const sectors = new Set(data.map(d => d.sector));
  const newData = [...data];
  const addressMap = new Map<string, MergedData>();
  newData.forEach(d => addressMap.set(d.id, d));

  sectors.forEach(sector => {
      // 1. Filtrar endereços de Apanha DO SETOR
      const sectorAddresses = newData.filter(d => d.sector === sector && d.rawAddress.ESP === 'A');
      if (sectorAddresses.length === 0) return;

      // 2. Classificar Endereços ("Score do Slot")
      // Prioridade: Nível Baixo (AP=1) > Frente da Rua (Maior Z)
      const rankedAddresses = [...sectorAddresses].sort((a, b) => {
         const apA = extractNumber(a.rawAddress.AP);
         const apB = extractNumber(b.rawAddress.AP);
         if (apA !== apB) return apA - apB; // Menor nível melhor (Crescente)
         return b.z - a.z; // Maior Z (Frente) melhor (Decrescente)
      });

      // 3. Classificar Itens ("Score do Produto")
      const rankedItems = sectorAddresses
          .filter(d => d.analysis) 
          .map(d => ({ 
              originalAddressId: d.id, 
              originalX: d.x,
              originalZ: d.z,
              analysis: d.analysis!,
              itemDesc: d.analysis!.description,
              itemSeq: d.analysis!.seqProduto
          }))
          .sort((a, b) => b.analysis.score - a.analysis.score); 

      // 4. Matching com Otimização de Distância
      // Para cada slot do ranking (começando do melhor), encontramos o item PQR que melhor se encaixa.
      // Se houver múltiplos itens de score similar, tentamos pegar o que está mais PERTO fisicamente para evitar viagens longas de reabastecimento.
      
      const usedItems = new Set<string>();

      rankedAddresses.forEach((targetAddress, index) => {
          // Pegar o "Ideal" puramente por rank
          if (index >= rankedItems.length) return;

          // [OTIMIZAÇÃO] Em vez de pegar cegamente o index, vamos olhar os top N itens não usados
          // e ver se algum deles está MUITO perto deste slot.
          // Janela de busca: próximos 5 itens do ranking (para não violar muito a regra de ouro)
          let bestItemIdx = -1;
          let minDist = Infinity;
          
          // Busca limitada para manter a integridade da Curva PQR (não misturar P com R)
          const searchWindow = 10; 
          let foundCandidate = false;

          for (let i = 0; i < rankedItems.length; i++) {
             if (usedItems.has(rankedItems[i].itemSeq)) continue;
             
             // Se já passamos muitos itens e a classe PQR mudou drasticamente, pare.
             // (Ex: não troque um Super P por um P fraco só pq tá perto)
             // Mas aqui assumimos que rankedItems já está ordenado por score.
             
             // Se este é o primeiro disponível, é o candidato padrão "Ouro"
             if (!foundCandidate) {
                 bestItemIdx = i;
                 foundCandidate = true;
                 
                 // Se a janela de busca acabou, break e usa esse mesmo.
                 // Mas queremos tentar otimizar.
             }

             // Calculo de Distância
             const item = rankedItems[i];
             const dist = Math.sqrt(Math.pow(targetAddress.x - item.originalX, 2) + Math.pow(targetAddress.z - item.originalZ, 2));

             // Se a classe é a mesma, podemos usar proximidade como critério de desempate
             const currentBest = rankedItems[bestItemIdx];
             if (item.analysis.pqrClass === currentBest.analysis.pqrClass) {
                  if (dist < minDist) {
                      minDist = dist;
                      bestItemIdx = i;
                  }
             }

             // Limita a busca para não iterar o array todo
             if (i > index + searchWindow) break;
          }

          if (bestItemIdx !== -1) {
              const item = rankedItems[bestItemIdx];
              usedItems.add(item.itemSeq);

              targetAddress.analysis = {
                 ...targetAddress.analysis!,
                 suggestedClass: item.analysis.pqrClass
              };

              // Gerar sugestão de troca se não for o mesmo local
              const originalAddress = addressMap.get(item.originalAddressId);
              if (originalAddress && originalAddress.id !== targetAddress.id) {
                 const move: SuggestionMove = {
                     fromAddress: `${originalAddress.rawAddress.RUA}-${originalAddress.rawAddress.PRED}-${originalAddress.rawAddress.AP}`,
                     toAddress: `${targetAddress.rawAddress.RUA}-${targetAddress.rawAddress.PRED}-${targetAddress.rawAddress.AP}`,
                     productCode: item.itemSeq,
                     productName: item.itemDesc,
                     reason: `Ajuste PQR (Dist: ${minDist.toFixed(1)}m)`,
                     priority: item.analysis.pqrClass === 'P' ? 'HIGH' : 'MEDIUM'
                 };
                 
                 originalAddress.analysis = {
                     ...originalAddress.analysis!,
                     suggestionMove: move
                 };
              }
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

  if (pqrMap) {
      return generateSuggestions(initialMerged);
  }

  return initialMerged;
};
