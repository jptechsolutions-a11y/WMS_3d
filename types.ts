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
  VOLUMES: string; // Utilizado para o calculo hibrido
  MEDIA_DIA_CX: string; // Utilizado para o calculo hibrido
  CODRUA: string;
  NROPREDIO: string;
  NROAPARTAMENTO: string;
  NROSALA: string;
}

export interface SuggestionMove {
  fromAddress: string; // "Rua 1 - 10 - 1"
  toAddress: string;   // "Rua 1 - 02 - 1"
  productCode: string;
  productName: string;
  reason: string;      // "Item Classe P em endereço Classe C"
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
    volume: number; // Media CX Dia
    score: number;  // Score combinado
    seqProduto: string;
    description: string;
    
    // Sugestão
    suggestedClass?: 'P' | 'Q' | 'R'; // Qual classe DEVERIA estar aqui
    suggestionMove?: SuggestionMove; // Se houver movimentação saindo daqui ou vindo pra cá
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
