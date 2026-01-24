
export interface ManualFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  baseId: string; // ID zložky/výrobcu, kam manuál patrí
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export enum AnalysisMode {
  SCHEMATIC = 'SCHEMATIC',
  LOGIC = 'LOGIC',
  SETTINGS = 'SETTINGS'
}

export interface KnowledgeBase {
  id: string;
  name: string;
  icon?: string;
}

export interface SavedProject {
  id: string;
  name: string;
  baseId: string;
  manuals: ManualFile[];
  messages: Message[];
  mode: AnalysisMode;
  timestamp: number;
}
