
import { GoogleGenAI } from "@google/genai";
import { ManualFile, AnalysisMode, Message, KnowledgeBase } from "../types";

export const analyzeManual = async (
  prompt: string, 
  manuals: ManualFile[], 
  mode: AnalysisMode,
  history: Message[],
  activeBase?: KnowledgeBase
): Promise<string | undefined> => {
  if (!process.env.API_KEY) throw new Error("API_KEY nie je nakonfigurovaný.");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';

  const systemInstruction = `Si elitný elektroinžinier so špecializáciou na revízie a projektovanie v EPLAN.
Máš prístup k dokumentácii v zložke: ${activeBase?.name?.toUpperCase() || 'VŠEOBECNÉ'}.

TVOJA ÚLOHA PRI NÁVRHU ZMIEN:
- Ak ťa používateľ požiada o úpravu zapojenia, navrhni riešenie.
- NAVRHNI VIZUÁLNY DRAFT: Vždy keď navrhuješ zmenu zapojenia, použi Mermaid.js kód (v bloku \`\`\`mermaid).
- Používaj syntax "graph TD" alebo "graph LR".
- Komponenty označuj EPLAN štandardom (napr. -K1 pre relé, -S1 pre spínač, -F1 pre istič).
- Napr. "L1 --- -F1[Istič 6A] --- -S1[STOP] --- -K1[Cievka]"

PRAVIDLÁ ANALÝZY (${mode}):
1. SCHEMATIC: Extrakcia svoriek a prepojení z PDF/obrázkov.
2. LOGIC: Postupnosť spínania, bezpečnosť a chybové stavy.
3. SETTINGS: Nastavenia parametrov meničov/prístrojov.

Odpovedaj v slovenčine, technicky a stručne. Ak je priložených príliš veľa súborov a presahujú tvoj kontext, upozorni na to.`;

  // Filter histórie pre zmenšenie payloadu (posledných 10 správ)
  const chatContents = history
    .slice(-10)
    .filter(m => m.id !== 'welcome')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  // Príprava častí s manuálmi
  const manualParts = manuals.map(manual => ({
    inlineData: {
      mimeType: manual.type,
      data: manual.base64
    }
  }));
  
  const contents = [
    ...chatContents,
    { 
      role: 'user', 
      parts: [
        ...manualParts,
        { text: prompt }
      ] 
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.1, // Nižšia teplota pre vyššiu presnosť v technike
        tools: [{ googleSearch: {} }]
      }
    });

    if (!response || !response.text) {
      throw new Error("Prázdna odpoveď od AI.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Detailed Error:", error);
    throw error;
  }
};
