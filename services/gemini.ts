
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API kľúč nie je nakonfigurovaný v systéme. Prosím, nastavte ho v prostredí.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Model Pro pre komplexné technické úlohy
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný elektro-inžinier a špecialista na technickú dokumentáciu.
Analyzuješ priložené manuály a schémy.
Pracuješ v režime: ${mode}. Jazyk: SLOVENČINA.
Ak je priložený obrázok, identifikuj komponenty a ich zapojenie.
Využívaj Google Search na kontrolu aktuálnych elektrotechnických noriem (STN, EN, IEC).
Odpovedaj vecne, odborne a presne.`;

  const chatHistory = history
    .filter(m => !m.id.startsWith('err-') && m.id !== 'welcome')
    .slice(0, -1)
    .map(m => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }]
    }));

  const manualParts = manuals.map(manual => ({
    inlineData: {
      mimeType: manual.type,
      data: manual.base64
    }
  }));
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...chatHistory,
        { 
          role: 'user', 
          parts: [...manualParts, { text: prompt }] 
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "Bez odozvy od AI.";
    const sources: Array<{ title: string; uri: string }> = [];
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push({ title: chunk.web.title || 'Zdroj', uri: chunk.web.uri });
        }
      });
    }
    
    return { text, sources };
  } catch (err: any) {
    console.error("Gemini Error:", err);
    throw new Error(`AI Chyba: ${err.message || 'Nepodarilo sa spracovať požiadavku.'}`);
  }
};
