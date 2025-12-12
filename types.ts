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
  CPA: string; // Units per box
  VDA: string;
  ESTQUN_OPERADOR1: string;
  ESTQUN_OPERADOR2: string;
  ESTQ_LOCUS: string; // Total Quantity in Units
  VALIDADE: string; // Date string
  RECEBIMENTO: string; // Date string
  SEQENDERECO: string;
}

export interface AnalysisRow {
  NROEMPRESA: string;
  SEQPRODUTO: string;
  DESCCOMPLETA: string;
  VISITAS: string; 
  VOLUMES: string; 
  MEDIA_DIA_CX: string; 
  CODRUA: string;
  NROPREDIO: string;
  NROAPARTAMENTO: string;
  NROSALA: string;
}

export interface SuggestionMove {
  fromAddress: string; 
  toAddress: string;   
  productCode: string;
  productName: string;
  reason: string;      
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MergedData {
  id: string; // SEQENDERECO
  rawAddress: RawAddressRow;
  rawItem?: RawItemRow;    
  pulmaoItem?: RawItemRow; 
  
  // Dados de Análise
  analysis?: {
    pqrClass: 'P' | 'Q' | 'R' | null;
    visits: number;
    volume: number; 
    score: number;  
    seqProduto: string;
    description: string;
    
    // Sugestão
    suggestedClass?: 'P' | 'Q' | 'R'; 
    suggestionMove?: SuggestionMove; 
  };

  x: number; 
  y: number; 
  z: number; 
  
  color: string;
  isTunnel: boolean;
  sector: string;
}

export type ViewMode = '3D_ORBIT' | '3D_WALK' | '2D_PLAN';

export type ReceiptFilterType = 'ALL' | 'YESTERDAY' | 'BEFORE_YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'SPECIFIC';

export interface FilterState {
  status: string[];
  type: string[]; 
  search: string;
  expiryDays: number | null; 
  sector: string[];
  
  // [NOVO] Filtro PQR
  pqr: string[]; // ['P', 'Q', 'R', 'N/A']

  // Receipt Filter
  receiptType: ReceiptFilterType;
  receiptDate: string; 
}
