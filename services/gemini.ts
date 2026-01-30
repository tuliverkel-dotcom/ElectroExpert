
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
    systemInstruction = `Si Certifikačný Inžinier a Technický Spisovateľ.
Tvojou úlohou je vygenerovať profesionálnu technickú dokumentáciu.

POKYNY:
1. Formálna štruktúra (Markdown).
2. Ak používateľ žiada zmenu zapojenia, zapracuj ju ako "As-Built" stav.
3. Použi placeholdery {{VÝROBCA}}, {{S/N}} pre chýbajúce údaje.
4. Odporúčaná osnova: Identifikácia, Bezpečnosť, Funkcia, Obsluha, Údržba.`;

  } else if (mode === AnalysisMode.SCHEMATIC) {
    // <--- TU JE HLAVNÁ ZMENA PRE VÝKRESY
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
        temperature: mode === AnalysisMode.SCHEMATIC ? 0.1 : 0.2, // Nízka teplota pre presné kreslenie
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
