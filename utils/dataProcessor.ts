import Papa from 'papaparse';
import { RawAddressRow, RawItemRow, MergedData, AddressStatus, RawCurveRow, MoveSuggestion } from '../types';
import { COLORS, DIMENSIONS } from '../constants';

// Helper to extract number from string (e.g., "RUA001" -> 1)
export const extractNumber = (str: string): number => {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// Helper para extrair o setor da descrição da rua
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

// --- LOGICA PQR ---
// A lógica pega fator V/V (Visitas/Volume) considerando dias uteis (aprox 22 dias * 3 meses = 66 dias)
const calculatePQR = (row: RawCurveRow): number => {
  const visitas = parseFloat(row.VISITAS.replace(',', '.')) || 0;
  const volumes = parseFloat(row.VOLUMES.replace(',', '.')) || 0;
  // const diasUteis = 66; // 3 meses aprox
  
  // Fator V/V simples para pontuação: Visitas tem peso maior em picking geralmente, mas pedido foi V/V
  // Usaremos um score combinado. Quanto maior, mais "Quente" (P)
  // Ajuste fino pode ser feito aqui
  const score = (visitas * 0.7) + (volumes * 0.3); 
  return score;
};

export const processData = (
    addresses: RawAddressRow[], 
    items: RawItemRow[],
    pulmaoItems: RawItemRow[] = [],
    curveData: RawCurveRow[] = []
): MergedData[] => {
  
  // Map Picking Items
  const itemMap = new Map<string, RawItemRow>();
  items.forEach(item => itemMap.set(item.SEQENDERECO, item));

  // Map Pulmão Items
  const pulmaoMap = new Map<string, RawItemRow>();
  pulmaoItems.forEach(item => pulmaoMap.set(item.SEQENDERECO, item));

  // Map Curve Data by Address Coordinates (CODRUA-NROPREDIO-NROAPARTAMENTO-NROSALA)
  // O CSV de curva traz onde o produto ESTÁ atualmente
  const curveMap = new Map<string, RawCurveRow>();
  const productCurveScore = new Map<string, { score: number, row: RawCurveRow, curve: 'P'|'Q'|'R' }>();

  // 1. Calcular Scores e Definir PQR Global dos Produtos
  if (curveData.length > 0) {
    const scoredItems = curveData.map(c => ({
      row: c,
      score: calculatePQR(c)
    })).sort((a, b) => b.score - a.score);

    const total = scoredItems.length;
    scoredItems.forEach((item, index) => {
      let curve: 'P' | 'Q' | 'R' = 'R';
      const percentile = (index / total) * 100;
      if (percentile <= 20) curve = 'P';       // Top 20%
      else if (percentile <= 50) curve = 'Q';  // Next 30%
      else curve = 'R';                        // Bottom 50%

      // Chave composta para mapear no endereço
      // PadStart é importante pois CSV pode vir "1" e endereço ser "001"
      const rua = item.row.CODRUA.padStart(3, '0'); 
      const pred = item.row.NROPREDIO;
      const ap = item.row.NROAPARTAMENTO;
      const sl = item.row.NROSALA;
      const key = `${rua}-${pred}-${ap}-${sl}`;
      
      curveMap.set(key, item.row);
      productCurveScore.set(item.row.SEQPRODUTO, { score: item.score, row: item.row, curve });
    });
  }

  // 2. Processar Endereços
  let merged = addresses.map(addr => {
    const item = itemMap.get(addr.SEQENDERECO);
    const pItem = pulmaoMap.get(addr.SEQENDERECO);
    
    // Parsing IDs
    const ruaIdx = extractNumber(addr.RUA);
    const predIdx = extractNumber(addr.PRED);
    const apIdx = extractNumber(addr.AP);
    const slIdx = extractNumber(addr.SL) || 1; 
    const sector = extractSector(addr.DESCRUA || '');

    // Curve Mapping
    // Tenta casar exatamente o endereço do CSV de curva com o endereço do WMS
    const ruaStr = ruaIdx.toString().padStart(3, '0'); // Normaliza para 001, 017 etc
    // As vezes o CSV de curva vem sem zero a esquerda, as vezes com. Tentar robustez.
    // Assumindo que CODRUA no CSV de curva bate com RUA aqui (numerico ou string)
    
    // Tentativa de chave
    // Nota: O parser do CSV remove zeros a esquerda se for numero, mas mantem se string.
    // Vamos normalizar RUA do endereço para bater com CODRUA
    const matchKey = (r: string, p: string, a: string, s: string) => {
       // Procura manual no map se chave direta falhar (devido a formatação)
       // Mas idealmente o parse ja tratou. Vamos tentar via chave padronizada.
       return `${r}-${p}-${a}-${s}`;
    };

    // Chave usada no loop anterior:
    const curveKey = `${ruaStr}-${predIdx}-${apIdx}-${slIdx}`;
    let cData = curveMap.get(curveKey);

    // Se nao achou por endereço, tenta achar pelo produto se o item já estiver vinculado no WMS
    if (!cData && item) {
       // Se o item do WMS (rawItem) tem codigo que bate com SEQPRODUTO ou algum identificador
       // Infelizmente rawItem.CODIGO pode ser diferente de SEQPRODUTO. 
       // Mas se o usuário importou a curva, ela diz onde está.
    }

    let calculatedCurve: 'P'|'Q'|'R' | undefined = undefined;
    if (cData) {
       const info = productCurveScore.get(cData.SEQPRODUTO);
       if (info) calculatedCurve = info.curve;
    }

    // Status Mapping
    let status = addr.STATUS as AddressStatus;
    if (![AddressStatus.Reserved, AddressStatus.Occupied, AddressStatus.Available, AddressStatus.Blocked].includes(status)) {
      status = AddressStatus.Blocked; 
    }

    // Coordinates
    const isTunnel = addr.ESP === 'P' && apIdx <= 3;
    let visualY = apIdx;
    if (isTunnel) visualY = 5 + (apIdx - 1); 

    const aisleCenterX = ruaIdx * DIMENSIONS.STREET_SPACING;
    const isEvenPred = predIdx % 2 === 0;
    const sideMultiplier = isEvenPred ? 1 : -1;
    const predioSequenceIndex = Math.floor((predIdx - 1) / 2);
    const bayCenterZ = -(predioSequenceIndex * DIMENSIONS.BAY_WIDTH); // Z negativo vai "para o fundo"
    const salaOffset = slIdx === 1 ? -0.7 : 0.7;
    
    const x = aisleCenterX + (sideMultiplier * DIMENSIONS.AISLE_CENTER_OFFSET);
    const z = bayCenterZ + salaOffset; // Z=0 é o inicio da rua (frente), Z negativo é fundo
    const y = (visualY - 1) * DIMENSIONS.RACK_HEIGHT;

    // Heatmap Color Logic
    let heatmapColor = COLORS.HEATMAP_EMPTY;
    if (calculatedCurve === 'P') heatmapColor = COLORS.HEATMAP_P;
    if (calculatedCurve === 'Q') heatmapColor = COLORS.HEATMAP_Q;
    if (calculatedCurve === 'R') heatmapColor = COLORS.HEATMAP_R;

    return {
      id: addr.SEQENDERECO,
      rawAddress: addr,
      rawItem: item,
      pulmaoItem: pItem,
      curveData: cData,
      calculatedCurve,
      x,
      y,
      z,
      color: COLORS[status] || COLORS.DEFAULT,
      heatmapColor,
      isTunnel,
      sector
    };
  });

  // 3. LOGICA SUGESTIVA (PQR)
  // Agrupar endereços APANHA por setor
  const sectors = new Set(merged.map(m => m.sector));
  
  sectors.forEach(sec => {
      // Filtrar apenas endereços de APANHA ('A') deste setor
      const sectorNodes = merged.filter(m => m.sector === sec && m.rawAddress.ESP === 'A' && m.rawAddress.STATUS !== AddressStatus.Blocked);
      
      if (sectorNodes.length === 0) return;

      // Classificar endereços por "Qualidade" (Proximidade do início da rua - Maior Z neste sistema coordinate system?)
      // OBS: No sistema atual, Z começa em 0 e vai ficando negativo (bayCenterZ = -(idx * WIDTH)).
      // Logo, o MAIOR Z (mais próximo de 0) é o INÍCIO da rua.
      // O MENOR Z (mais negativo) é o FUNDO.
      // Melhores endereços = Maior Z.
      const sortedAddresses = [...sectorNodes].sort((a, b) => b.z - a.z);

      // Coletar produtos que ESTÃO neste setor (baseado na curva importada e posição atual)
      // Ou produtos que DEVERIAM estar (idealmente a logica seria mais complexa, mas vamos usar o que temos)
      const productsInSector = sectorNodes
          .filter(n => n.calculatedCurve) // Só produtos com curva calculada
          .map(n => ({
              id: n.id,
              prodId: n.curveData!.SEQPRODUTO,
              prodName: n.curveData!.DESCCOMPLETA,
              curve: n.calculatedCurve!,
              score: productCurveScore.get(n.curveData!.SEQPRODUTO)?.score || 0
          }));
      
      // Ordenar produtos por Score (Mais quentes primeiro)
      productsInSector.sort((a, b) => b.score - a.score);

      // Casar Melhores Produtos com Melhores Endereços
      // Esta é uma simulação simples "Ideal"
      productsInSector.forEach((prod, idx) => {
          if (idx < sortedAddresses.length) {
              const idealAddress = sortedAddresses[idx];
              
              // Se o endereço ideal for diferente do endereço atual do produto
              if (idealAddress.id !== prod.id) {
                  // Marca no endereço ATUAL que ele deve mover
                  const currentNode = merged.find(m => m.id === prod.id);
                  if (currentNode) {
                      currentNode.moveSuggestion = {
                          itemId: prod.prodId,
                          productName: prod.prodName,
                          currentAddressId: currentNode.id,
                          suggestedAddressId: idealAddress.id,
                          reason: `Item Curva ${prod.curve} deve ir para início da rua`,
                          curve: prod.curve
                      };
                  }
                  
                  // Marca no endereço IDEAL (destino) quem deveria estar lá para visualização "Sugestiva"
                  const targetNode = merged.find(m => m.id === idealAddress.id);
                  if (targetNode) {
                      targetNode.suggestedCurve = prod.curve;
                      targetNode.suggestedFor = prod.prodName;
                  }
              } else {
                   // Item já está no lugar certo
                   const currentNode = merged.find(m => m.id === prod.id);
                   if (currentNode) {
                       currentNode.suggestedCurve = prod.curve; // Confirma curva
                   }
              }
          }
      });
  });

  return merged;
};
