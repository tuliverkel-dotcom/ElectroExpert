
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[],
  customApiKey?: string | null
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  
  const envKey = process.env.API_KEY;
  const apiKey = customApiKey || ((envKey && envKey !== 'undefined') ? envKey : null);
  
  if (!apiKey) {
    throw new Error("CHÝBAJÚCI AI KĽÚČ: Pripojte Google Drive pre načítanie kľúča, alebo ho nastavte v prostredí.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Prepíname na PRO model pre maximálnu inteligenciu
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný Senior Elektro-Inžinier a Expert na Diagnostiku (Level 3 Support).
Tvojou úlohou je analyzovať priloženú technickú dokumentáciu (PDF/Obrázky) s extrémnou presnosťou.

REŽIM ANALÝZY: ${mode}

PRAVIDLÁ UVAŽOVANIA:
1. DEEP SCAN: Nehľadaj len kľúčové slová. Analyzuj zapojenia, napäťové úrovne, pinouty a protokoly.
2. STEP-BY-STEP LOGIC: Každé riešenie najprv logicky zdôvodni na základe faktov z manuálu.
3. MERMAID DIAGRAMS: Ak navrhuješ zapojenie, VŽDY použi Mermaid syntax. Diagramy rob detailné (napr. sub-grafy pre MCU, senzory a napájanie).
4. SEARCH GROUNDING: Ak narazíš na nejasnú súčiastku, použi Google Search na overenie jej datasheetu alebo noriem (EN/IEC).
5. TÓN: Profesionálny, technický, stručný ale vyčerpávajúci.

Ak v manuáli chýba informácia potrebná pre bezpečné riešenie, jasne na to upozorni a navrhni merania, ktoré má technik vykonať.`;

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
        temperature: 0.3, // Nižšia teplota pre vyššiu faktickú presnosť
        thinkingConfig: { 
          thinkingBudget: 16384 // Pridávame "kapacitu na premýšľanie" pre zložité technické úlohy
        },
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "AI nedokázala vygenerovať odpoveď. Skúste preformulovať otázku.";
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
    console.error("Gemini Pro Error:", err);
    // Fallback na Flash ak by Pro model zlyhal (napr. kvôli kvótam)
    if (err.message?.includes("not found") || err.message?.includes("quota")) {
        throw new Error("Model Pro nie je dostupný. Skúste prejsť na platený API plán pre 'Thinking' funkcie.");
    }
    throw new Error(err.message || "Chyba pri hlbokej analýze.");
  }
};
