
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  if (!process.env.API_KEY) {
    throw new Error("API kľúč nie je nastavený. Kliknite na 'NASTAVIŤ KĽÚČ'.");
  }

  // Vždy vytvoríme novú inštanciu pre zabezpečenie aktuálnosti kľúča
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný technický inžinier a expert na elektroinštalácie. 
Tvojou úlohou je radiť používateľom na základe poskytnutých manuálov.
Pracuješ v režime: ${mode}. Odpovedaj výhradne v slovenčine.
Ak používateľ nahrá PDF alebo obrázok schémy, analyzuj ho technicky presne.`;

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
    // Zachytenie chyby o neplatnom kľúči podľa inštrukcií
    if (err.message?.includes("Requested entity was not found") || err.message?.includes("API_KEY")) {
      throw new Error("Requested entity was not found. Váš API kľúč nie je platný alebo nie je z fakturovaného projektu. Prosím, nastavte ho znova.");
    }
    throw err;
  }
};
