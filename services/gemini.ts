
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  // Striktná inicializácia bez fallbacku na prázdny reťazec
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepnutie na stabilnejší model pre toto prostredie
  const modelName = 'gemini-3-flash-preview';

  const systemInstruction = `Si elitný technický inžinier a expert na elektroinštalácie. 
Tvojou úlohou je radiť používateľom na základe poskytnutých manuálov.
Pracuješ v režime: ${mode}.

Pravidlá:
1. Odpovedaj výhradne v slovenčine, technicky presne a stručne.
2. Ak je to relevantné pre pochopenie zapojenia, generuj Mermaid diagram v bloku \`\`\`mermaid.
3. Vždy sa odkazuj na konkrétne informácie z manuálov.
4. Ak informácia v manuáli chýba, upozorni na to a navrhni bezpečný štandardný postup.

Manuály k dispozícii: ${manuals.map(m => m.name).join(', ')}.`;

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
          parts: [
            ...manualParts, 
            { text: prompt }
          ] 
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
        // Google Search grounding ostáva zachovaný pre zdroje z webu
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "Model nevrátil žiadnu odpoveď.";
    
    const sources: Array<{ title: string; uri: string }> = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || 'Zdroj z webu',
            uri: chunk.web.uri
          });
        }
      });
    }
    
    return { text, sources };
  } catch (err: any) {
    console.error("Gemini API Error Detail:", err);
    throw new Error(err.message || "Nepodarilo sa získať odpoveď od AI. Skontrolujte API konfiguráciu.");
  }
};
