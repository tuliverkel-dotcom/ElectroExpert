
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Systémový API kľúč nie je nakonfigurovaný. Kontaktujte administrátora.");
  }

  // Inicializácia klienta podľa pravidiel SDK
  const ai = new GoogleGenAI({ apiKey });
  
  // gemini-3-pro-preview je najlepší model pre STEM, kódovanie a technickú logiku
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný technický inžinier a expert na elektroinštalácie a priemyselnú automatizáciu. 
Tvojou úlohou je radiť používateľom na základe poskytnutých manuálov.
Pracuješ v režime: ${mode}. Odpovedaj výhradne v slovenčine.
Ak používateľ nahrá PDF alebo obrázok schémy, analyzuj ho technicky presne. 
Využívaj Google Search na overenie aktuálnych noriem (STN, EN) alebo parametrov konkrétnych komponentov.
Ak generuješ schémy, používaj výhradne Mermaid syntax.`;

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

    const text = response.text || "Model nevygeneroval žiadnu odpoveď.";
    const sources: Array<{ title: string; uri: string }> = [];
    
    // Extrakcia zdrojov z Google Search grounding
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push({ 
            title: chunk.web.title || 'Zdroj informácie', 
            uri: chunk.web.uri 
          });
        }
      });
    }
    
    return { text, sources };
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    throw new Error(`AI Chyba: ${err.message || 'Nepodarilo sa získať odpoveď od modelu.'}`);
  }
};
