
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message, KnowledgeBase } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[],
  activeBase?: KnowledgeBase
): Promise<{ text: string; sources?: any[] }> => {
  // Inicializujeme klientskú inštanciu priamo pred volaním, aby sme mali najčerstvejší kľúč z dialógu
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Model 'gemini-3-pro-image-preview' je vyžadovaný pre stabilitu pri použití Google Search grounding
  const modelName = 'gemini-3-pro-image-preview';

  const systemInstruction = `Si elitný elektroinžinier so špecializáciou na revízie a projektovanie.
Máš prístup k dokumentácii v zložke: ${activeBase?.name?.toUpperCase() || 'VŠEOBECNÉ'}.

TVOJA ÚLOHA:
- Ak ťa používateľ požiada o úpravu zapojenia, navrhni riešenie.
- VŽDY použi Mermaid.js (v bloku \`\`\`mermaid) pre vizuálne schémy.
- Komponenty označuj EPLAN štandardom (napr. -K1, -S1, -F1).

PRAVIDLÁ ANALÝZY (${mode}):
1. SCHEMATIC: Extrakcia svoriek a prepojení.
2. LOGIC: Postupnosť spínania a bezpečnosť.
3. SETTINGS: Parametre a konfigurácia.

Odpovedaj v slovenčine, technicky a stručne. Ak používaš informácie z webu, uveď zdroje.`;

  const chatHistory = history
    .slice(-8)
    .filter(m => m.id !== 'welcome' && !m.id.startsWith('err-'))
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  const manualParts = manuals.map(manual => ({
    inlineData: {
      mimeType: manual.type,
      data: manual.base64
    }
  }));
  
  const currentRequestContent = { 
    role: 'user', 
    parts: [
      ...manualParts,
      { text: prompt }
    ] 
  };

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [...chatHistory, currentRequestContent] as any,
      config: {
        systemInstruction,
        temperature: 0.15,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "Model nevrátil žiadny text.";
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      ?.map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));

    return { text, sources };
  } catch (err: any) {
    console.error("Gemini SDK Call Failed:", err);
    if (err.message?.includes("Requested entity was not found") || err.message?.includes("API_KEY")) {
      throw new Error("API_KEY_REQUIRED");
    }
    throw err;
  }
};
