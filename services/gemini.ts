
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message, KnowledgeBase } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[],
  activeBase?: KnowledgeBase
): Promise<{ text: string; sources?: any[] }> => {
  
  if (!process.env.API_KEY || process.env.API_KEY.length < 5) {
    throw new Error("API_KEY_REQUIRED");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const systemInstruction = `Si elitný elektroinžinier. Práve analyzuješ dokumentáciu v zložke ${activeBase?.name || 'Všeobecné'}.
Máš k dispozícii ${manuals.length} dokumentov. 
Cieľ: Poskytnúť technickú radu, schému (Mermaid) alebo parametre.
Režim: ${mode}. Odpovedaj stručne a slovensky.`;

  const chatHistory = history
    .slice(-6)
    .filter(m => !m.id.startsWith('err-'))
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
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...chatHistory,
        { role: 'user', parts: [...manualParts, { text: prompt }] }
      ] as any,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    const text = response.text || "AI neodpovedala.";
    return { text };
  } catch (err: any) {
    console.error("Gemini Error:", err);
    if (err.message?.includes("API key") || err.message?.includes("401") || err.message?.includes("403")) {
      throw new Error("API_KEY_REQUIRED");
    }
    throw err;
  }
};
