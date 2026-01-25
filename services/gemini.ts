
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message, KnowledgeBase } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: any[] }> => {
  
  // Inicializácia podľa striktných pravidiel SDK
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  // Pre technickú analýzu manuálov volíme Pro model
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný technický inžinier a expert na elektroinštalácie. 
Tvojou úlohou je radiť používateľom na základe poskytnutých manuálov.
Pracuješ v režime: ${mode}.

Pravidlá:
1. Odpovedaj výhradne v slovenčine, technicky presne a stručne.
2. Ak je to relevantné pre pochopenie zapojenia, generuj Mermaid diagram v bloku \`\`\`mermaid.
3. Vždy sa odkazuj na konkrétne informácie z manuálov.
4. Ak informácia v manuáli chýba, upozorni na to a navrhni bezpečný štandardný postup.

Manuály k dispozícii: ${manuals.map(m => m.name).join(', ')}.`;

  // Filtrujeme históriu tak, aby sme neposielali aktuálnu správu dvakrát 
  // a obmedzujeme počet správ kvôli veľkosti payloadu (base64 dáta sú náročné)
  const chatHistory = history
    .filter(m => !m.id.startsWith('err-'))
    .slice(0, -1) // Vynecháme poslednú správu, ktorú pridáme nižšie s manuálmi
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  // Pripravíme manuály ako inline dáta
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
            { text: prompt }
          ] 
        }
      ] as any,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Model nevrátil žiadny text.");
    
    return { text };
  } catch (err: any) {
    console.error("Gemini API Error Detail:", err);
    
    if (err.message?.includes('fetch')) {
      throw new Error("Sieťové spojenie s AI zlyhalo. Skontrolujte veľkosť nahraných súborov.");
    }
    
    throw new Error(err.message || "Nepodarilo sa získať odpoveď od AI.");
  }
};
