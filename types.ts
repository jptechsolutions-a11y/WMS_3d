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

export interface MergedData {
  id: string; // SEQENDERECO
  rawAddress: RawAddressRow;
  rawItem?: RawItemRow;    // Apanha Stock
  pulmaoItem?: RawItemRow; // Pulmão Stock (New)
  
  // Parsed Coordinates for 3D/2D
  x: number; // Based on RUA
  y: number; // Based on AP (Calculated height)
  z: number; // Based on PRED
  
  color: string;
  isTunnel: boolean;
}

export type ViewMode = '3D_ORBIT' | '3D_WALK' | '2D_PLAN';

export type ReceiptFilterType = 'ALL' | 'YESTERDAY' | 'BEFORE_YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'SPECIFIC';

export interface FilterState {
  status: string[];
  type: string[]; // A or P
  search: string;
  expiryDays: number | null; // Null = No filter, Number = Days until expiration
  
  // Receipt Filter
  receiptType: ReceiptFilterType;
  receiptDate: string; // YYYY-MM-DD for specific date input
}