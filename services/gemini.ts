
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message, KnowledgeBase } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[],
  activeBase?: KnowledgeBase
): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný elektroinžinier so špecializáciou na revízie a projektovanie v EPLAN.
Máš prístup k dokumentácii v zložke: ${activeBase?.name.toUpperCase()}.

TVOJA ÚLOHA PRI NÁVRHU ZMIEN:
- Ak ťa používateľ požiada o úpravu zapojenia (napr. "Pridaj tlačidlo", "Zmeň logiku stopky"), navrhni riešenie.
- NAVRHNI VIZUÁLNY DRAFT: Vždy keď navrhuješ zmenu zapojenia, použi Mermaid.js kód (v bloku \`\`\`mermaid).
- Používaj syntax "graph TD" alebo "graph LR".
- Komponenty označuj EPLAN štandardom (napr. -K1 pre relé, -S1 pre spínač, -F1 pre istič).
- Napr. "L1 --- -F1[Istič 6A] --- -S1[STOP] --- -K1[Cievka]"

PRAVIDLÁ ANALÝZY:
1. SCHEMATIC: Extrakcia svoriek z PDF schém.
2. LOGIC: Sekvencie a chybové stavy.
3. SETTINGS: Parametre.

Dôležité: Keďže nevieš priamo meniť PDF súbor, tvoj Mermaid draft slúži ako predloha pre používateľa, ktorú môže implementovať v EPLANe.

Odpovedaj v slovenčine, technicky a presne.`;

  const chatContents = history
    .filter(m => m.id !== 'welcome')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  const currentParts: any[] = manuals.map(manual => ({
    inlineData: {
      mimeType: manual.type,
      data: manual.base64
    }
  }));
  
  currentParts.push({ text: prompt });

  const contents = [
    ...chatContents,
    { role: 'user', parts: currentParts }
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
