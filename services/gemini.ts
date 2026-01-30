
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

  let systemInstruction = "";

  if (mode === AnalysisMode.DOCUMENTATION) {
    systemInstruction = `Si Profesionálny Technický Spisovateľ (Technical Writer) a Prekladateľ pre výťahové systémy.
Tvojou úlohou NIE JE chatovať, ale VYGENEROVAŤ KOMPLETNÝ MANUÁL vo formáte HTML.

VSTUP: Anglické manuály (obrázky/PDF).
VÝSTUP: Profesionálny slovenský manuál formátovaný ako HTML kód.

ŠTRUKTÚRA DOKUMENTU (HTML):
1. Vráť IBA HTML kód zabalený v bloku \`\`\`html ... \`\`\`.
2. Nepíš žiadny úvodný ani záverečný text mimo tento blok.
3. Použi CSS triedy Tailwind pre formátovanie (vysvetlené nižšie).

POŽADOVANÝ OBSAH MANUÁLU:
1. **Titulná strana**: Názov zariadenia, Verzia, Dátum.
2. **Predhovor**: Krátky úvod o zariadení (preložený, profesionálny tón).
3. **Bezpečnostné pokyny**: Zvýraznené upozornenia.
4. **Technické parametre**: Prehľadná tabuľka.
5. **Štruktúra Menu**: Detailný rozpis menu systému.
6. **Chybové hlásenia**: Tabuľka (Kód chyby | Príčina | Riešenie).
7. **Nastavenia a Konfigurácia**: Postup krok za krokom.

PRAVIDLÁ FORMÁTOVANIA (Dôležité pre export do PDF):
- Použi <div class="p-10 font-serif text-black leading-relaxed"> ako hlavný kontajner.
- Nadpisy: <h1 class="text-3xl font-bold mb-6 border-b-2 border-black pb-2">, <h2 class="text-xl font-bold mt-8 mb-4">.
- Tabuľky: <table class="w-full border-collapse border border-gray-400 mb-6 text-sm">.
- Bunky tabuľky: <th class="border border-gray-400 p-2 bg-gray-100">, <td class="border border-gray-400 p-2">.
- Odseky: <p class="mb-4 text-justify">.
- Upozornenia: <div class="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4 italic">.

Prelož všetko do odbornej slovenčiny (napr. "Drive" -> "Menič", "Shaft" -> "Šachta").`;

  } else if (mode === AnalysisMode.SCHEMATIC) {
    systemInstruction = `Si Senior Elektro-Projektant a Expert na CAD systémy (EPLAN, AutoCAD Electrical).
Používateľ potrebuje VIDIEŤ SKUTOČNÚ SCHÉMU ZAPOJENIA, nie blokový diagram.

AKO ODPOVEDAŤ NA POŽIADAVKU O ZMENU/TVORBU SCHÉMY:
1. NEPOUŽÍVAJ Mermaid diagramy (žiadne graph TD).
2. VYGENERUJ SVG KÓD (Scalable Vector Graphics), ktorý vyzerá ako profesionálny elektrotechnický výkres.

ŠPECIFIKÁCIA SVG VÝKRESU:
- Vlož SVG kód do bloku: \`\`\`svg ... \`\`\`
- Pozadie: Priehľadné alebo tmavé (style="background-color:#1e293b").
- Čiary: Biele (stroke="white", stroke-width="2").
- Text: Biely (fill="white"), font-family="monospace".
- Symboly: Kresli štandardné IEC značky:
  - Cievka stýkača: Obdĺžnik s označením A1/A2.
  - Kontakty: Dve rovnobežné čiary (NO) alebo spojené (NC).
  - Svorky: Malé krúžky.
  - Vodiče: Pravouhlé zalomenia (orthogonálne).

Príklad požiadavky: "Zmeň K3 za relé".
Tvoja reakcia: Nakreslíš SVG, kde namiesto symbolu stýkača (K3) nakreslíš symbol relé (KA3) so správnym číslovaním svoriek (11, 14, A1, A2).

Odpovedaj stručne a sústreď sa na kvalitu výkresu.`;

  } else {
    systemInstruction = `Si Senior Elektro-Inžinier a Diagnostik.
Analyzuj manuály a hľadaj príčiny porúch.
Pre logické diagramy (postupnosť krokov) použi Mermaid (flowchart TD).`;
  }

  const chatHistory = history
    .filter(m => !m.id.startsWith('err-') && m.id !== 'welcome')
    .slice(-10) 
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
        temperature: mode === AnalysisMode.DOCUMENTATION ? 0.3 : 0.2, // Vyššia kreativita pre písanie textu
        thinkingConfig: { 
          thinkingBudget: 12288 
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
