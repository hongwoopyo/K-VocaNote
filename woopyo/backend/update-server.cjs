const fs = require('fs');

const file = 'D:/개발용/hongwoopyo/k-vocanote0403/k-vocanote/woopyo/backend/server.js';
let content = fs.readFileSync(file, 'utf8');

const oldStrStart = `    // 동음이의어 설명(definition)을 targetLanguageName으로 번역`;
const oldStrEnd = `    parsedData.standardDicts = stdDictInfos;`;

const startIndex = content.indexOf(oldStrStart);
const endIndex = content.indexOf(oldStrEnd) + oldStrEnd.length;

if (startIndex !== -1 && endIndex > startIndex) {
  const newLogic = `    // AI 생성 의미와 가장 잘 맞는 표준국어대사전 항목 찾기 및 동음이의어 번역
    if (stdDictInfos && stdDictInfos.length > 0) {
      const homonymsToProcess = stdDictInfos.map((info, idx) => ({
        idx: idx,
        word: info.word,
        meaning: info.senses?.[0]?.definition || ''
      })).filter(h => h.meaning);

      if (homonymsToProcess.length > 0) {
        const transPrompt = \`
You are a professional translator and language matcher.
We have an AI-generated definition for a Korean word.
AI Generated English Definition: "\${parsedData.definition}"
AI Generated \${targetLanguageName} Translation: "\${parsedData.translation}"
Context Hint (if any): "\${contextHint || 'None'}"

Here are the dictionary definitions for "\${parsedData.korean}":
\${JSON.stringify(homonymsToProcess)}

Task 1: Identify which "idx" from the dictionary definitions best matches the AI generated definition.
Task 2: Translate ALL of the Korean dictionary definitions into \${targetLanguageName}. Keep the precise meaning.

Provide the output strictly in JSON format matching this schema:
{
  "bestMatchIdx": number,
  "translations": [
    { "idx": number, "translatedMeaning": string }
  ]
}
        \`;
        try {
          const transSchema = {
            type: 'object',
            properties: {
              bestMatchIdx: { type: 'number' },
              translations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    idx: { type: 'number' },
                    translatedMeaning: { type: 'string' }
                  },
                  required: ['idx', 'translatedMeaning']
                }
              }
            },
            required: ['bestMatchIdx', 'translations']
          };
          const transModel = genAI.getGenerativeModel({ model: modelId });
          const transResponse = await transModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: transPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: transSchema,
              temperature: 0.1,
            }
          });
          const transParsed = JSON.parse(transResponse.response.text());
          
          transParsed.translations.forEach(t => {
            if (stdDictInfos[t.idx] && stdDictInfos[t.idx].senses && stdDictInfos[t.idx].senses.length > 0) {
              stdDictInfos[t.idx].senses[0].definition = t.translatedMeaning;
            }
          });

          // Move the best matched homonym to index 0 so it acts as the primary mainDict
          if (transParsed.bestMatchIdx !== undefined && transParsed.bestMatchIdx > 0 && transParsed.bestMatchIdx < stdDictInfos.length) {
            const matchedItem = stdDictInfos.splice(transParsed.bestMatchIdx, 1)[0];
            stdDictInfos.unshift(matchedItem);
          }

        } catch (e) {
          console.error('Homonym matching and translation failed:', e);
        }
      }
    }

    parsedData.standardDicts = stdDictInfos;`;
    
  let newContent = content.slice(0, startIndex) + newLogic + content.slice(endIndex);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Backend updated successfully');
} else {
  console.log('Could not find injection point');
}
