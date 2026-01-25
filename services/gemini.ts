
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
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný Senior Elektro-Inžinier a Expert na Diagnostiku (Level 3 Support).
Tvojou úlohou je analyzovať technickú dokumentáciu s extrémnou presnosťou.

REŽIM ANALÝZY: ${mode}

PRAVIDLÁ PRE MERMAID SCHÉMY (KRITICKÉ):
1. VŽDY používaj úvodzovky pre texty v uzloch, napr: A["Hlavný istič 230V"]
2. Nepoužívaj v uzloch špeciálne znaky ako (), [], {} bez úvodzoviek.
3. Začínaj schému vždy kľúčovým slovom "graph TD" alebo "flowchart TD".
4. Používaj subgrafy pre logické celky (napr. napájacia časť, riadiaca časť).
5. Ak je schéma príliš komplexná, rozdeľ ju na viacero menších diagramov.

PROCES ANALÝZY:
- DEEP SCAN: Hľadaj pinouty, napäťové úrovne a logické väzby.
- STEP-BY-STEP: Každý technický krok najprv zdôvodni.
- SEARCH: Použi Google Search na overenie nejasných komponentov.

Odpovedaj výhradne v slovenčine. Ak informácia v manuáli chýba, upozorni na to.`;

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
        temperature: 0.1, // Minimálna kreativita = maximálna technická presnosť
        thinkingConfig: { 
          thinkingBudget: 16384 
        },
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "AI nedokázala vygenerovať odpoveď.";
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
    throw new Error(err.message || "Chyba pri hlbokej analýze.");
  }
};
