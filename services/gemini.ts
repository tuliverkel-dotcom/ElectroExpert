
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode
): Promise<string | undefined> => {
  // V tomto prostredí používame priamo process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const modelName = 'gemini-3-pro-preview';

  let systemInstruction = `Si špičkový elektroinžinier a technický poradca so špecializáciou na priemyselnú automatizáciu, elektroinštalácie a programovanie PLC/smart zariadení.
Vašou úlohou je analyzovať poskytnuté obrázky alebo texty manuálov a odpovedať na technické otázky používateľa.

Môžeš byť v troch módoch, aktuálny mód: ${mode}.

1. SCHEMATIC: Zameraj sa na svorkovnice, zapojenie fáz, nulákov, zeme, vstupy a výstupy (DI, DO, AI, AO). Ak vidíš schému, popíš presne kam čo zapojiť.
2. LOGIC: Zameraj sa na fungovanie zariadenia. Ako prebieha štart, čo sa stane pri chybe, ako komunikuje (Modbus, KNX, DALI, etc.).
3. SETTINGS: Zameraj sa na konfiguračné menu, registre, parametre v tabuľkách. Odporuč konkrétne hodnoty ak vieš.

Pravidlá:
- Odpovedaj v slovenčine.
- Buď stručný, ale technicky presný.
- Ak niečo v manuáli nevidíš, priznaj to a nefantazíruj.
- Používaj Markdown pre lepšiu čitateľnosť (odrážky, tabuľky, tučné písmo).`;

  const parts: any[] = manuals.map(manual => ({
    inlineData: {
      mimeType: manual.type,
      data: manual.base64
    }
  }));

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
