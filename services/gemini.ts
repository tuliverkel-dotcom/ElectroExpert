
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
    throw new Error("API kľúč nie je detegovaný v systéme. Prosím, použite tlačidlo 'NASTAVIŤ AI KĽÚČ' v hornom menu.");
  }

  // Create a new instance right before the call as required by the documentation
  const ai = new GoogleGenAI({ apiKey });
  // Using gemini-3-pro-image-preview for high-quality technical reasoning and Google Search grounding support
  const modelName = 'gemini-3-pro-image-preview';

  const systemInstruction = `Si elitný technický inžinier a expert na elektroinštalácie a priemyselnú automatizáciu. 
Tvojou úlohou je radiť používateľom na základe poskytnutých manuálov.
Pracuješ v režime: ${mode}. Odpovedaj výhradne v slovenčine.
Ak používateľ nahrá PDF alebo obrázok schémy, analyzuj ho technicky presne. 
Využívaj Google Search na overenie aktuálnych noriem (STN, EN) alebo parametrov konkrétnych komponentov, ak nie sú v manuáli.`;

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
    
    // Extract sources from grounding metadata as required
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push({ 
            title: chunk.web.title || 'Technický zdroj', 
            uri: chunk.web.uri 
          });
        }
      });
    }
    
    return { text, sources };
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    // Handle specific project/key error as required by documentation
    if (err.message?.includes("Requested entity was not found") || err.message?.includes("404") || err.message?.includes("API_KEY")) {
      throw new Error("CHYBA KĽÚČA: Projekt nebol nájdený alebo kľúč je neplatný. Skontrolujte, či je váš kľúč z plateného projektu (billing enabled) v Google AI Studio.");
    }
    throw new Error(`AI Chyba: ${err.message || 'Nepodarilo sa získať odpoveď od modelu.'}`);
  }
};
