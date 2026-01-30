
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
  let thinkingBudget = 0; // Defaultne vypnuté pre dokumentáciu aby sme šetrili tokeny na text
  let maxOutputTokens = 8192; // Default limit

  if (mode === AnalysisMode.DOCUMENTATION) {
    // PRE DOKUMENTÁCIU: Vypíname thinking, maximalizujeme output
    thinkingBudget = 0; 
    maxOutputTokens = 65536; // Pokus o maximálny možný output pre dlhé manuály

    systemInstruction = `Si Profesionálny Technický Spisovateľ (Technical Writer) a Prekladateľ pre výťahové systémy.
Tvojou úlohou NIE JE chatovať, ale VYGENEROVAŤ KOMPLETNÝ MANUÁL vo formáte HTML.

LIMIT DĹŽKY: AI má limit na dĺžku odpovede. Musíš byť EXTRÉMNE EFEKTÍVNY. Nepíš "omáčky", píš len čisté technické fakty, tabuľky a postupy.
Ak je manuál príliš dlhý, vygeneruj detailnú "ČASŤ 1: Inštalácia a Parametre" a na konci napíš: "Pre pokračovanie napíš 'Časť 2'".

VSTUP: Anglické manuály (obrázky/PDF).
VÝSTUP: Profesionálny slovenský manuál formátovaný ako HTML kód.

ŠTRUKTÚRA DOKUMENTU (HTML):
1. Vráť IBA HTML kód zabalený v bloku \`\`\`html ... \`\`\`.
2. Nepíš žiadny úvodný ani záverečný text mimo tento blok.
3. Použi CSS triedy Tailwind pre formátovanie.

POŽADOVANÝ OBSAH (Kondenzovaný):
1. **Titulná strana**: Názov, Verzia.
2. **Technické parametre**: Tabuľka.
3. **Menu a Štruktúra**: Stromová štruktúra menu.
4. **Chybové hlásenia**: Kompletná tabuľka chýb (Kód | Popis | Riešenie).
5. **Konfigurácia**: Kľúčové nastavenia.

PRAVIDLÁ FORMÁTOVANIA (Pre PDF export):
- Hlavný kontajner: <div class="p-10 font-serif text-black leading-relaxed text-sm"> (menšie písmo pre viac textu na stranu).
- Nadpisy: <h1 class="text-2xl font-bold mb-4 border-b-2 border-black pb-2">.
- Tabuľky: <table class="w-full border-collapse border border-gray-400 mb-4 text-xs">.
- Page Break: Použi <div style="page-break-before: always;"></div> medzi hlavnými kapitolami.

Prelož všetko do odbornej slovenčiny.`;

  } else if (mode === AnalysisMode.SCHEMATIC) {
    thinkingBudget = 8192; // Pre schémy potrebujeme logiku
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
    thinkingBudget = 10240; // Pre logiku a diagnostiku potrebujeme veľa premýšľania
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
  
  // Konfigurácia pre požiadavku
  const requestConfig: any = {
    systemInstruction,
    temperature: mode === AnalysisMode.DOCUMENTATION ? 0.3 : 0.2,
    tools: [{ googleSearch: {} }],
    maxOutputTokens: mode === AnalysisMode.DOCUMENTATION ? 65536 : 8192 // Zvýšený limit pre dokumentáciu
  };

  // Thinking config pridáme len ak je budget > 0 (nie je podporovaný pre všetky modely/režimy rovnako, ale tu ho riadime manuálne)
  if (thinkingBudget > 0) {
    requestConfig.thinkingConfig = { thinkingBudget };
  }

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
      config: requestConfig
    });

    const text = response.text || "AI nedokázala vygenerovať odpoveď (pravdepodobne bol prekročený limit dĺžky). Skúste požiadať o kratšiu časť.";
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
    throw new Error(err.message || "Chyba pri hlbokej analýze. Skúste skrátiť požiadavku.");
  }
};
