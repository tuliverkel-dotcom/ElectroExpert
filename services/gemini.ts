
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  if (!process.env.API_KEY) {
    throw new Error("API kľúč nie je pripravený. Kliknite na 'NASTAVIŤ KĽÚČ' v hornej lište.");
  }

  // Creating a new instance right before the call to ensure the latest API key is used
  // Upgraded to gemini-3-pro-preview for complex technical manual analysis
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný technický inžinier a expert na elektroinštalácie. 
Tvojou úlohou je radiť používateľom na základe poskytnutých manuálov.
Pracuješ v režime: ${mode}.
Odpovedaj výhradne v slovenčine. Využívaj technické schémy (mermaid) ak je to vhodné.`;

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

    const text = response.text || "Model neodpovedal.";
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
    // Handling specific error for invalid key
    if (err.message?.includes("API_KEY") || err.message?.includes("not found") || err.message?.includes("Requested entity was not found")) {
      throw new Error("Platnosť API kľúča vypršala alebo nie je nastavený. Kliknite na 'NASTAVIŤ KĽÚČ'.");
    }
    throw err;
  }
};
