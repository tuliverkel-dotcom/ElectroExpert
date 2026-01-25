
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  // Vždy vytvoríme novú inštanciu tesne pred volaním, aby sme zachytili najnovší kľúč z dialógu
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API kľúč nie je detegovaný. Prosím, kliknite na 'NASTAVIŤ API KĽÚČ' v hornom menu.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // gemini-3-pro-image-preview je ideálny pre technické manuály s obrázkami a vyžaduje manuálny výber kľúča
  const modelName = 'gemini-3-pro-image-preview';

  const systemInstruction = `Si špičkový elektro-inžinier. Analyzuješ technické manuály a schémy.
Režim: ${mode}. Jazyk: Slovenčina.
Používaj Google Search na overenie noriem (STN, EN).
Ak vidíš schému v obrázku, opíš ju technicky.
Ak navrhuješ riešenie, buď stručný a presný.`;

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

    const text = response.text || "Bez odpovede.";
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
    if (err.message?.includes("not found") || err.message?.includes("404")) {
      throw new Error("Projekt alebo API kľúč nebol nájdený. Kliknite na 'NASTAVIŤ API KĽÚČ' a vyberte kľúč z plateného projektu.");
    }
    throw new Error(`AI Chyba: ${err.message}`);
  }
};
