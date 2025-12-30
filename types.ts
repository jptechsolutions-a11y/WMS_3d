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

export interface RawMetricsRow {
  NROEMPRESA?: string;
  SEQPRODUTO?: string; // Código do produto
  CODIGO?: string;     // Alternativa para código
  SEQENDERECO?: string; // Link direto endereço
  VISITAS?: string;
  VOLUMES?: string;
  DIAS_SAIDA?: string;
  PESOBRUTO?: string;
  PESOCUBADO?: string;
}

export type ClassRating = 'A' | 'B' | 'C' | 'P' | 'Q' | 'R' | 'N/A'; // N/A for unclassified

export interface AnalyticsData {
  abcClass: ClassRating;
  pqrClass: ClassRating;
  combinedClass: string; // Ex: "AP", "AR", "CQ"
  dailyVisits: number;
  dailyVolume: number;
  score: number; // For sorting suggestions
}

export interface MergedData {
  id: string; // SEQENDERECO
  rawAddress: RawAddressRow;
  rawItem?: RawItemRow;    // Apanha Stock
  pulmaoItem?: RawItemRow; // Pulmão Stock
  
  // Analytics info merged from Metrics file
  metrics?: RawMetricsRow;

  // Parsed Coordinates for 3D/2D
  x: number; // Based on RUA
  y: number; // Based on AP (Calculated height)
  z: number; // Based on PRED
  
  color: string;
  isTunnel: boolean;
  sector: string;
  
  // Calculated Analytics
  analytics?: AnalyticsData;
}

export interface Suggestion {
  itemId: string;
  productCode: string;
  productDesc: string;
  fromAddress: string;
  toAddress: string;
  fromId: string;
  toId: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export type ViewMode = '3D_ORBIT' | '3D_WALK' | '2D_PLAN' | 'ANALYTICS';

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
