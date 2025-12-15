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

// Interface para o CSV de Curva PQR/ABC
export interface RawCurveRow {
  NROEMPRESA: string;
  SEQPRODUTO: string;
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
  LINHA: string; // Ex: BAZAR - BAZAR (RT)
  NORMA_APANHA: string;
  TX_REPOS_PICKING_ATUAL: string;
  NORMA_PULMAO: string;
  TX_REPOS_POS_CORRECAO_PULMAO: string;
}

export interface MoveSuggestion {
  itemId: string;
  productName: string;
  currentAddressId: string;
  suggestedAddressId: string;
  reason: string; // Ex: "Item Curva P em final de rua"
  curve: 'P' | 'Q' | 'R';
}

export interface MergedData {
  id: string; // SEQENDERECO
  rawAddress: RawAddressRow;
  rawItem?: RawItemRow;    // Apanha Stock
  pulmaoItem?: RawItemRow; // Pulmão Stock (New)
  
  // Curve Data
  curveData?: RawCurveRow;
  calculatedCurve?: 'P' | 'Q' | 'R'; // Calculado via logica
  
  // Parsed Coordinates for 3D/2D
  x: number; // Based on RUA
  y: number; // Based on AP (Calculated height)
  z: number; // Based on PRED
  
  color: string;
  heatmapColor?: string; // Cor para visualização térmica
  
  isTunnel: boolean;
  sector: string;
  
  // Suggestion Logic
  suggestedCurve?: 'P' | 'Q' | 'R';
  suggestedFor?: string; // ID do produto que DEVERIA estar aqui
  moveSuggestion?: MoveSuggestion; // Se este item deve sair daqui
}

export type ViewMode = '3D_ORBIT' | '3D_WALK' | '2D_PLAN' | '2D_APANHA_ONLY'; // Adicionado APANHA_ONLY

export type ReceiptFilterType = 'ALL' | 'YESTERDAY' | 'BEFORE_YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'SPECIFIC';

export type CurveMode = 'NONE' | 'CURRENT_ABC' | 'CURRENT_PQR' | 'SUGGESTED_PQR';

export interface FilterState {
  status: string[];
  type: string[]; // A or P
  search: string;
  expiryDays: number | null; 
  sector: string[]; 
  
  // Receipt Filter
  receiptType: ReceiptFilterType;
  receiptDate: string; 

  // Curve Mode
  curveMode: CurveMode;
}
