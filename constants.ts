import { AddressStatus } from './types';

// Visual Dimensions (Units in Meters)
export const DIMENSIONS = {
  // A "Bay" is the space between two uprights.
  BAY_WIDTH: 3.6, 
  
  RACK_HEIGHT: 1.5,
  RACK_DEPTH: 1.2,
  
  // Aisle Width
  AISLE_WIDTH: 5.0, 
  
  // Structural details
  BEAM_THICKNESS: 0.15, 
  UPRIGHT_WIDTH: 0.1, 
  PALLET_HEIGHT: 0.15,
  
  get AISLE_CENTER_OFFSET() {
    return this.AISLE_WIDTH / 2;
  },

  get STREET_SPACING() {
    return this.AISLE_WIDTH + (this.RACK_DEPTH * 2) + 4.0;
  }
};

export const COLORS = {
  [AddressStatus.Reserved]: '#eab308', // Yellow
  [AddressStatus.Occupied]: '#f97316', // Orange items
  [AddressStatus.Available]: '#22c55e', // Green (Logic) / Cyan (UI Accent)
  [AddressStatus.Blocked]: '#64748b',  // Slate
  DEFAULT: '#94a3b8',
  
  // Brand Identity Colors (Perlog/JP Style)
  UI_BACKGROUND: '#0f172a', // Dark Navy (Slate 900)
  UI_SURFACE: '#1e293b',    // Lighter Navy (Slate 800)
  UI_ACCENT: '#06b6d4',     // Cyan (Cyan 500)
  
  // Warehouse Colors (PRESERVED)
  RACK_UPRIGHT: '#1e3a8a', // Dark Blue
  RACK_BASE: '#eab308',    // Yellow Base
  RACK_BEAM: '#ea580c',    // Safety Orange
  
  // Visuals
  PALLET_BLUE: '#1e40af',  
  BOX_CARDBOARD: '#d4a373', 
  BOX_CARDBOARD_DARK: '#a88b5e',
  
  TUNNEL_HIGHLIGHT: '#06b6d4',
  HOVER: '#ffffff',
  SELECTED: '#06b6d4', 
  TEXT_LABEL: '#000000',

  // [NOVO] Cores PQR (Mapa de Calor)
  PQR_P: '#ef4444', // Vermelho (Alta frequência - Hot)
  PQR_Q: '#eab308', // Amarelo (Média)
  PQR_R: '#22c55e', // Verde (Baixa - Cold)
  PQR_NULL: '#334155' // Slate 700 (Sem dados)
};

export const STATUS_LABELS = {
  [AddressStatus.Reserved]: 'Reservado',
  [AddressStatus.Occupied]: 'Ocupado',
  [AddressStatus.Available]: 'Disponível',
  [AddressStatus.Blocked]: 'Bloqueado',
};
