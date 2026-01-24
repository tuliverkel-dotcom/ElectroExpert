
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
  // Používame najnovší model Gemini 3 Flash pre rýchlosť a stabilitu
  const modelName = 'gemini-3-flash-preview';

  const systemInstruction = `Si elitný technický inžinier a poradca pre elektro produkty. 
Máš k dispozícii tieto manuály a technickú dokumentáciu: ${manuals.map(m => m.name).join(', ')}.

Tvoje úlohy:
1. Odpovedaj stručne, technicky presne a výhradne v slovenčine.
2. Ak navrhuješ zapojenie alebo logiku, VŽDY použi Mermaid diagram v bloku \`\`\`mermaid.
3. V režime SCHEMATIC sa sústreď na piny a zapojenie.
4. V režime LOGIC na sekvenciu operácií.
5. V režime SETTINGS na parametre a konfiguráciu.

Pracuj len s informáciami z poskytnutých manuálov. Ak niečo v manuáli nie je, priznaj to a navrhni všeobecný technický postup.`;

  const chatHistory = history
    .slice(-6) // Zvýšený kontext histórie
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
        { 
          role: 'user', 
          parts: [
            ...manualParts, 
            { text: `Aktuálny režim analýzy: ${mode}. Otázka: ${prompt}` }
          ] 
        }
      ] as any,
      config: {
        systemInstruction,
        temperature: 0.1, // Nižšia teplota pre presnejšie technické fakty
      }
    });

    return { text: response.text || "AI neodpovedala." };
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    if (err.message?.includes('404')) {
      throw new Error("Model Gemini 3 Flash nie je dostupný pre tento kľúč alebo región.");
    }
    throw new Error(err.message || "Chyba komunikácie s AI");
  }
};
