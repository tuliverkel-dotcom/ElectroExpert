
export interface ManualFile {
  id: string;
  name: string;
  type: string;
  base64: string;
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

export interface SavedProject {
  id: string;
  name: string;
  manuals: ManualFile[];
  messages: Message[];
  mode: AnalysisMode;
  timestamp: number;
}
