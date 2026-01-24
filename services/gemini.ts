
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message, KnowledgeBase } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[],
  apiKey: string,
  activeBase?: KnowledgeBase
): Promise<{ text: string; sources?: any[] }> => {
  
  if (!apiKey || apiKey.length < 10) {
    throw new Error("NEPLATNY_KLUC");
  }

  const ai = new GoogleGenAI({ apiKey });
  // Použijeme stabilný model flash pre najrýchlejšiu odozvu
  const modelName = 'gemini-1.5-flash';

  const systemInstruction = `Si technický poradca pre elektro produkty. 
Máš k dispozícii tieto manuály: ${manuals.map(m => m.name).join(', ')}.
Odpovedaj stručne, technicky správne a v slovenčine.
Ak navrhuješ zapojenie, použi Mermaid diagram v bloku \`\`\`mermaid.`;

  const chatHistory = history
    .slice(-4)
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

    return { text: response.text || "AI neodpovedala." };
  } catch (err: any) {
    console.error("Gemini Error:", err);
    throw new Error(err.message || "Chyba komunikácie s AI");
  }
};
