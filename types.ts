// Data Types

export enum AddressStatus {
  Reserved = 'R',
  Occupied = 'O',
  Available = 'D',
  Blocked = 'B',
}

export interface RawAddressRow {
  CD: string;
  SEQENDERECO: string;
  DEP: string;
  RUA: string;
  PRED: string;
  AP: string;
  SL: string;
  ESP: 'A' | 'P'; // Apanha or Pulmão
  STATUS: string;
  SETOR: string;
  ARMAZENAGEM: string;
  PAR_IMPAR: string;
  CODTIPENDER: string;
  TIPOENDERECO: string;
  DESCRUA?: string;
}

export interface RawItemRow {
  CODIGO: string;
  DESCRICAO: string;
  CPA: string;
  VDA: string;
  ESTQUN_OPERADOR1: string;
  ESTQUN_OPERADOR2: string;
  ESTQ_LOCUS: string;
  VALIDADE: string;
  RECEBIMENTO: string;
  SEQENDERECO: string;
}

// [NOVO] Interface para o arquivo de Curva ABC/PQR
export interface RawCurveRow {
  NROEMPRESA: string;
  SEQPRODUTO: string; // Link com RawItemRow.CODIGO (ou SEQPRODUTO se for o ID)
  DESCCOMPLETA: string;
  QTDEMBALAGEM: string;
  PESOBRUTO: string;
  ALTURA: string;
  LARGURA: string;
  PROFUNDIDADE: string;
  PESOCUBADO: string;
  DIAS_SAIDA: string;
  VISITAS: string;
  VOLUMES: string;
  MEDIA_DIA_CX: string;
  DEP: string;
  CODRUA: string;
  NROPREDIO: string;
  NROAPARTAMENTO: string;
  NROSALA: string;
  LINHA: string;
  NORMA_APANHA: string;
  TX_REPOS_PICKING_ATUAL: string;
  NORMA_PULMAO: string;
  TX_REPOS_POS_CORRECAO_PULMAO: string;
  SEQENDERECO: string; // Link direto com o endereço
}

export interface CurveData {
  pqrClass: 'P' | 'Q' | 'R';
  abcClass: 'A' | 'B' | 'C';
  combinedClass: 'AA' | 'BB' | 'CC' | 'MIX'; // Simplificação para cores
  visitsPerDay: number;
  volumePerDay: number;
  weight: number;
  cubage: number;
  idealRank: number; // Rank global para sugestão (1 = melhor item)
}

export interface MergedData {
  id: string; // SEQENDERECO
  rawAddress: RawAddressRow;
  rawItem?: RawItemRow;    
  pulmaoItem?: RawItemRow; 
  
  // [NOVO] Dados de Curva
  curveData?: CurveData;

  // Parsed Coordinates for 3D/2D
  x: number; 
  y: number; 
  z: number; 
  
  color: string;
  isTunnel: boolean;
  sector: string; 
}

export type ViewMode = '3D_ORBIT' | '3D_WALK' | '2D_PLAN' | 'ANALYSIS_ABC';

export type ReceiptFilterType = 'ALL' | 'YESTERDAY' | 'BEFORE_YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'SPECIFIC';

export interface FilterState {
  status: string[];
  type: string[]; // A or P
  search: string;
  expiryDays: number | null; 
  sector: string[];
  
  receiptType: ReceiptFilterType;
  receiptDate: string; 
}

// [NOVO] Configuração da Análise
export interface AnalysisConfig {
  periodDays: number; // Dias úteis considerados
  curveType: 'ABC' | 'PQR' | 'CROSS'; // O que visualizar
  viewState: 'CURRENT' | 'SUGGESTED'; // Ver o mapa atual ou o sugerido
}
