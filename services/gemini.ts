
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[]
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  // Získanie kľúča zo systémového prostredia
  const apiKey = process.env.API_KEY;
  
  // Kontrola, či kľúč nie je len reťazec "undefined" alebo prázdny
  if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
    throw new Error("AI kľúč nie je v systéme dostupný. Ak ste v AI Studiu, použite tlačidlo v hlavičke.");
  }

  // Inicializácia AI
  const ai = new GoogleGenAI({ apiKey });
  
  // gemini-3-flash-preview je ideálny: rýchly, multimodal (PDF/Obrázky) a podporuje Search
  const modelName = 'gemini-3-flash-preview';

  const systemInstruction = `Si elitný elektro-inžinier so špecializáciou na revízie a priemyselnú automatizáciu.
Tvojou úlohou je radiť na základe priložených manuálov.
Pracuj v režime: ${mode}. Odpovedaj výhradne v slovenčine.
Ak používateľ nahrá obrázok schémy, analyzuj zapojenie a navrhni riešenie.
Využívaj Google Search pre overenie aktuálnych noriem STN/EN.
Ak navrhuješ schému, použi Mermaid kód.`;

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
    
    // Extrakcia zdrojov z vyhľadávania
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
    console.error("Gemini API Error:", err);
    throw new Error(`AI Chyba: ${err.message || 'Chyba pripojenia'}`);
  }
};
