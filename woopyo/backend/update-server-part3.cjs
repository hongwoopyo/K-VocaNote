const fs = require('node:fs');

const file = 'D:/개발용/hongwoopyo/k-vocanote0403/k-vocanote/woopyo/backend/server.js';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('    // 최종 데이터 응답 전송 전에 표준국어대사전 정보도 함께 첨부');
const endIdx = content.indexOf('    // 표제어의 한국어 발음 표기를 표준국어대사전 첫 번째 API 기준으로 덮어쓰기');

if(startIdx !== -1 && endIdx > startIdx) {
  const newLogic = `    // 최종 데이터 응답 전송 전에 표준국어대사전 정보도 함께 첨부 (korean 필드 기반 매칭)
    const stdDictInfos = await fetchKoreanDictInfo(parsedData.korean);
    
    // AI 생성 의미와 가장 잘 맞는 표준국어대사전 항목 찾기, 공식 어휘 매칭, 그리고 동음이의어 번역
    const officialCandidates = vocabularyData.filter(v => v.rawWord && v.rawWord.replace(/[0-9]/g, '') === parsedData.korean);
    let matchedOfficialRank = parsedData.selectedOfficialRank || null;

    if (stdDictInfos && stdDictInfos.length > 0) {
      const homonymsToProcess = stdDictInfos.map((info, idx) => ({
        idx: idx,
        word: info.word,
        meaning: info.senses?.[0]?.definition || ''
      })).filter(h => h.meaning);

      if (homonymsToProcess.length > 0 || officialCandidates.length > 1) {
        const offOptions = officialCandidates.map(c => ({
          id: c.rank,
          pos: c.pos,
          meaning: c.meaning
        }));
        
         const transPrompt = \`
You are a professional translator and language matcher.
We have an AI-generated definition for a Korean word.
AI Generated English Definition: "\${parsedData.definition}"
AI Generated \${targetLanguageName} Translation: "\${parsedData.translation}"
Context Hint (if any): "\${contextHint || 'None'}"

Here are the dictionary definitions for "\${parsedData.korean}":
\${JSON.stringify(homonymsToProcess)}

Here are the Official Vocabulary Candidates for "\${parsedData.korean}":
\${JSON.stringify(offOptions)}

Task 1: Identify which "idx" from the dictionary definitions best matches the AI generated definition.
Task 2: Translate ALL of the Korean dictionary definitions into \${targetLanguageName}. Keep the precise meaning.
Task 3: Identify which "id" from the Official Vocabulary Candidates best matches the AI generated definition. Return null if none match or if array is empty.

Provide the output strictly in JSON format matching this schema:
{
  "bestMatchIdx": number,
  "bestOfficialRank": "string or null",
  "translations": [
    { "idx": number, "translatedMeaning": "string" }
  ]
}
        \`;
        try {
          const transSchema = {
            type: 'object',
            properties: {
              bestMatchIdx: { type: 'number' },
              bestOfficialRank: { type: ['string', 'null'] },
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

          if (transParsed.bestOfficialRank) {
            matchedOfficialRank = transParsed.bestOfficialRank;
          }

        } catch (e) {
          console.error("Homonym matching and translation failed:", e);
        }
      }
    }

    // 최종적으로 Official Info 확정
    if (officialCandidates.length === 1) {
      parsedData.officialInfo = [officialCandidates[0]];
    } else if (matchedOfficialRank) {
      const match = officialCandidates.find(c => c.rank === matchedOfficialRank);
      if (match) {
        parsedData.officialInfo = [match];
      }
    }

    parsedData.standardDicts = stdDictInfos;

`;
  
  let newContent = content.slice(0, startIdx) + newLogic + content.slice(endIdx);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Success');
} else {
  console.log('Failed', startIdx, endIdx);
}