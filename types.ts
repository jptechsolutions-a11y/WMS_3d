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

// [NOVO] Interface para o arquivo de análise PQR/ABC
export interface AnalysisRow {
  NROEMPRESA: string;
  SEQPRODUTO: string;
  DESCCOMPLETA: string;
  VISITAS: string; // Usado para PQR
  VOLUMES: string;
  MEDIA_DIA_CX: string;
  CODRUA: string;
  NROPREDIO: string;
  NROAPARTAMENTO: string;
  NROSALA: string;
  // Outros campos podem ser adicionados conforme necessidade
}

export interface MergedData {
  id: string; // SEQENDERECO
  rawAddress: RawAddressRow;
  rawItem?: RawItemRow;    
  pulmaoItem?: RawItemRow; 
  
  // Dados de Análise [NOVO]
  analysis?: {
    pqrClass: 'P' | 'Q' | 'R' | null;
    visits: number;
    seqProduto: string;
    description: string;
  };

  // Parsed Coordinates for 3D/2D
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
  type: string[]; // A or P
  search: string;
  expiryDays: number | null; 
  sector: string[];
  
  // Receipt Filter
  receiptType: ReceiptFilterType;
  receiptDate: string; 
}
