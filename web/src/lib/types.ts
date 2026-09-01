export type Orientation = 'landscape' | 'portrait';

export interface ProjectStyles {
  cornerRadius?: number; // 0, 4, 8, 16, 24
  gridGap?: number; // 8, 16, 24
  margin?: number; // 16, 24, 32, 48
  fontPairing?: 'sans' | 'serif' | 'mono';
  canvasTone?: 'studio' | 'linen' | 'slate' | 'obsidian';
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  orientation: Orientation;
  palette?: string[];
  styles?: ProjectStyles;
}

export type ImageSource = 'pinterest' | 'upload' | 'extension' | 'paste' | 'style';

export interface ImageRec {
  id: string;
  projectId: string | null;
  styleGroupId: string | null;
  blob: Blob;
  source: ImageSource;
  createdAt: number;
  originalUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

export type BlockType = 
  | 'image'
  | 'title'
  | 'subtitle'
  | 'text'
  | 'colorSwatch'
  | 'palette'
  | 'card'
  | 'quote'
  | 'specSheet'
  | 'moodTag'
  | 'divider';

export interface BlockStyle {
  borderRadius?: number;
  backgroundColor?: string;
  border?: string;
  opacity?: number;
  shadow?: 'none' | 'subtle' | 'lift';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  letterSpacing?: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color?: string;
  fontSize?: number;
  padding?: number;
  objectFit?: 'cover' | 'contain' | 'none';
}

export interface PaletteData {
  colors: string[];
  format: 'hex' | 'rgb' | 'name';
  layoutMode: 'auto' | 'strip' | 'chips' | 'dots';
}

/** 48×32 Universal Micro-Grid Block Contract */
export interface Block {
  id: string;
  type: BlockType;
  /** 48-Column Micro-Grid X (0 to 47) */
  x: number;
  /** 32-Row Micro-Grid Y (0 to 31) */
  y: number;
  /** Width in grid units (1 to 48) */
  w: number;
  /** Height in grid units (1 to 32) */
  h: number;
  zIndex?: number;
  /** Primary text or image ID (retained for clean backward compatibility) */
  content: string;
  /** Visual frame overrides */
  style?: BlockStyle;
  /** Polymorphic custom payload for advanced blocks */
  data?: Record<string, any>;
}

export interface Page {
  id: string;
  projectId: string;
  order: number;
  blocks: Block[];
}

export interface StyleGroup {
  id: string;
  name: string;
  createdAt: number;
}

export interface UserSettings {
  id: 'settings';
  savedEmail: string | null;
}

/** Payload sent to the backend for PDF export (fully self-contained). */
export interface ExportPayload {
  project: Project;
  pages: Page[];
  images: { id: string; dataUrl: string }[];
  palette: string[];
  email?: string;
  styles?: ProjectStyles;
}
