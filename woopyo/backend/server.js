import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI, SchemaType as Type } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js'; // 표준국어대사전 파싱용

dotenv.config();

// ES Module 환경에서 __dirname을 쓰기 위한 필수 세팅
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let vocabularyData = [];
try {
  const excelFilePath = path.join(__dirname, 'vocabulary.xls');
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0]; // 첫 번째 시트 사용
  const sheet = workbook.Sheets[sheetName];
  
  // 헤더를 포함한 2차원 배열 형태로 가져오기
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // 첫 줄(헤더) 제외하고 데이터 매핑
  vocabularyData = rawData.slice(1).map(row => ({
    rank: row[0]?.toString().trim(),      // 순위 (id 역할)
    rawWord: row[1]?.toString().trim(),   // 원어 (예: 먹다02)
    pos: row[2]?.toString().trim(),       // 품사
    meaning: row[3]?.toString().trim(),   // 뜻풀이
    grade: row[4]?.toString().trim()      // 등급
  })).filter(item => item.rawWord);       // 원어가 있는 유효한 행만 필터링
  
  console.log(` 엑셀 어휘 데이터 ${vocabularyData.length}개 로드 완료!`);
} catch (error) {
  console.error("❌ 엑셀 로드 실패:", error);
}

const vocabMap = new Map();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelId = 'gemini-3.1-flash-lite-preview';

// 국립국어원 표준국어대사전 조회 헬퍼 함수
async function fetchKoreanDictInfo(query) {
  try {
    const DICT_KEY = process.env.KOREAN_DICT_API_KEY;
    if (!DICT_KEY) return null;

    const searchUrl = `https://stdict.korean.go.kr/api/search.do?key=${DICT_KEY}&req_type=json&q=${encodeURIComponent(query)}&advanced=y&method=exact`;
    const searchRes = await fetch(searchUrl);
    const searchText = await searchRes.text();
    if (!searchText.trim()) return [];

    const searchData = JSON.parse(searchText);
    let items = searchData?.channel?.item;
    if (!items || items.length === 0) return [];
    
    // items가 배열이 아니면 배열로 만들고, 동음이의어가 너무 많을 수 있으니 최대 4개까지만 제한
    let itemArray = Array.isArray(items) ? items : [items];
    itemArray = itemArray.slice(0, 4);

    const results = [];
    
    for (const item of itemArray) {
      const targetCode = item.target_code;
      const viewUrl = `https://stdict.korean.go.kr/api/view.do?key=${DICT_KEY}&method=TARGET_CODE&q=${targetCode}`;
      const viewRes = await fetch(viewUrl);
      const viewXmlText = await viewRes.text();
      if (!viewXmlText.trim()) continue;

      const viewData = await parseStringPromise(viewXmlText, { explicitArray: false, ignoreAttrs: true });
      const wordInfo = viewData?.channel?.item?.word_info;
      if (!wordInfo) continue;

      let posInfoArray = wordInfo.pos_info;
      if (posInfoArray && !Array.isArray(posInfoArray)) posInfoArray = [posInfoArray];

      let allSenses = [];
      let mainPos = "";

      if (posInfoArray) {
        mainPos = posInfoArray[0].pos || "";
        posInfoArray.forEach(posItem => {
          let commPatternArray = posItem.comm_pattern_info;
          if (commPatternArray && !Array.isArray(commPatternArray)) commPatternArray = [commPatternArray];
          if (commPatternArray) {
            commPatternArray.forEach(commPattern => {
              let sensesArray = commPattern.sense_info;
              if (sensesArray && !Array.isArray(sensesArray)) sensesArray = [sensesArray];
              if (sensesArray) {
                sensesArray.forEach(sense => {
                  let examples = sense.example_info;
                  if (examples && !Array.isArray(examples)) examples = [examples];

                  let catArray = sense.cat_info;
                  if (catArray && !Array.isArray(catArray)) catArray = [catArray];
                  const categories = catArray ? catArray.map(c => (typeof c.cat === 'string' ? c.cat : (c.cat?._ || "")).trim()).filter(Boolean) : [];

                  allSenses.push({
                    definition: typeof sense.definition === 'string' ? sense.definition : (sense.definition?._ || ""),
                    pattern: sense.syntactic_annotation || "",
                    grammar: sense.grammar_info || "",
                    categories: categories,
                    // 용례를 최대 2개로 제한
                    examples: examples ? examples.map(ex => typeof ex.example === 'string' ? ex.example : (ex.example?._ || "")).slice(0, 2) : []
                  });
                });
              }
            });
          }
        });
      }

      results.push({
        word: (wordInfo.word || "").trim(),
        sup_no: item.sup_no || "",
        origin: wordInfo.original_language_info ? (wordInfo.original_language_info.original_language || "").trim() : "", 
        pronunciation: wordInfo.pronunciation_info ? (Array.isArray(wordInfo.pronunciation_info) ? wordInfo.pronunciation_info[0].pronunciation : wordInfo.pronunciation_info.pronunciation).trim() : "", 
        pos: (mainPos || "").trim(),
        conjugation: wordInfo.conju_info ? (Array.isArray(wordInfo.conju_info) ? wordInfo.conju_info.map(c => c.conjugation).join(', ') : wordInfo.conju_info.conjugation).trim() : "", 
        senses: allSenses
      });
    }

    return results;
  } catch (err) {
    console.error("fetchKoreanDictInfo error:", err);
    return [];
  }
}

// 단어 검색 엔드포인트
app.post('/api/lookupWord', async (req, res) => {
  const { query, targetLanguageName, contextHint } = req.body;

  // 1. 숫자 제거 후 표제어가 정확히 일치하는 후보군 찾기
  const candidates = vocabularyData.filter(v => v.rawWord && v.rawWord.replace(/[0-9]/g, '') === query);
  
  let preMatchedOfficialInfo = [];
  let homonymPromptAddition = "";

  if (candidates.length === 1) {
    // 후보가 단 1개뿐이면 AI 판별 없이 바로 확정 (비용 절약)
    preMatchedOfficialInfo = [candidates[0]];
  } else if (candidates.length > 1) {
    // 동음이의어가 2개 이상일 경우, AI에게 넘길 최소 정보(id, 품사, 뜻풀이)만 추출
    const options = candidates.map(c => ({
      id: c.rank,
      pos: c.pos,
      meaning: c.meaning
    }));
    
    // AI에게 지시할 프롬프트 조각 생성
    homonymPromptAddition = `
    [공식 어휘 판별 미션]
    사용자가 검색한 단어 "${query}"는 여러 공식 어휘 뜻풀이를 가집니다.
    제공된 맥락 힌트(contextHint: "${contextHint || '없음'}")와 현재 생성 중인 단어의 뜻을 바탕으로, 아래 후보군 중 가장 알맞은 단 1개의 'id' 값을 찾아내십시오.
    선택한 id 문자열을 JSON의 "selectedOfficialRank" 필드에 반환하세요. 일치하는 것이 없다면 null을 반환하세요.
    후보군: ${JSON.stringify(options)}
    `;
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      korean: { type: Type.STRING, description: "The Korean word in Hangul." },
      hanja: { type: Type.STRING, description: "The Hanja (Chinese characters) if the word is of Chinese origin. Do NOT provide Hanja for native Korean words based on meaning." },
      pronunciation: { type: Type.STRING, description: "The standard Korean pronunciation written in HANGUL characters, enclosed in square brackets (e.g., [국물], [학굔데]). Do NOT use IPA symbols." },
      definition: { type: Type.STRING, description: "The definition in English. You MUST start with the direct English translation word wrapped in double asterisks, followed by a period. E.g., '**School**. An educational institution...'" },
      translation: { type: Type.STRING, description: `The translation of the word in ${targetLanguageName}. If the word is an idiom/proverb (관용구/속담), MUST format it strictly as 'Literal Translation; **Closest Equivalent Idiom/Word**, meaning explanation'. If there is no closest equivalent in the target language, format as 'Literal Translation; meaning explanation' WITHOUT **.` },
      exampleSentence: { type: Type.STRING, description: "A simple, natural Korean example sentence using the word. You MUST wrap the target word (even if conjugated) with double asterisks ** for highlighting (e.g., '할아버지께서 진지를 **드십니다**.')." },
      exampleEnglish: { type: Type.STRING, description: "The English translation of the example sentence. You MUST wrap the translated target word with double asterisks ** for highlighting (e.g., 'Grandfather is **eating** his meal.')." },
      exampleTranslation: { type: Type.STRING, description: `The translation of the example sentence strictly in ${targetLanguageName}. You MUST wrap the translated target word with double asterisks ** for highlighting.` },
      partOfSpeech: { type: Type.STRING, description: "The part of speech in Korean (e.g., 명사, 동사, 형용사, 부사, 대명사, 수사, 관형사, 감탄사, 조사)." },
      idiomExplanation: { type: Type.STRING, description: `If the word is an idiom (관용구) or proverb (속담), provide a BRIEF breakdown of its components. CRITICAL: The ENTIRE explanation MUST be written exclusively in ${targetLanguageName}, EXCEPT for the Korean terms being explained which should remain in Korean. Explain what each Korean component means in ${targetLanguageName} concisely. If it's not an idiom/proverb, return an empty string.` },
      synonyms: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            distance: { type: Type.NUMBER, description: "0.2 for identical/congruence meaning. 0.6 or 1.0 for close meanings." }
          }
        },
        description: "List of synonyms. Max 3 items."
      },
      antonyms: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            distance: { type: Type.NUMBER, description: "Fixed value 1.0 for the antonym." }
          }
        },
        description: "Provide EXACTLY ONE antonym."
      },
      honorifics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            level: { type: Type.NUMBER, description: "Politeness level: 0.5 (Polite/Jondae), 1.0 (Highly Polite/Honorific)." }
          }
        },
        description: "List of honorific forms related to this word. Max 2 items (e.g. 드시다, 잡수시다)."
      },
      casuals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            level: { type: Type.NUMBER, description: "Casualness level: Fixed 1.0 for the lowest form (Hadae)." }
          }
        },
        description: "List of casual/lower forms. Provide EXACTLY ONE item (e.g. 처먹다 for 먹다)."
      },
      hypernyms: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "The single immediate superordinate term (Hypernym) of this word in Korean. If the word is an idiom (관용어) or proverb (속담), set this strictly to '관용어' or '속담' respectively instead of a literal semantic category. Max 1." 
      },
      hyponyms: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "Immediate subordinate terms (Hyponyms) of this word in Korean. Leave empty for idioms/proverbs. Max 3." 
      },
      standardContext: { type: Type.STRING, description: "A standard context sentence that clearly distinguishes this specific meaning from its homonyms." },
      otherHomonyms: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "A list of brief definitions (in English) for OTHER homonyms of this word." 
      },
      relatedWords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of 4 to 5 contextually related Korean words (collocations or situational words) in HANGUL ONLY. e.g., if query is '교통사고', return ['차량', '안전', '병원', '응급']."
      },
      selectedOfficialRank: {
        type: Type.STRING,
        description: "The id (rank) of the matching official vocabulary from the provided homonym options based on the chosen meaning. Return an empty string if no match or no options were provided."
      }
    },
    required: ["korean", "pronunciation", "definition", "translation", "exampleSentence", "exampleEnglish", "exampleTranslation", "partOfSpeech", "idiomExplanation", "synonyms", "antonyms", "honorifics", "casuals", "hypernyms", "hyponyms", "otherHomonyms", "relatedWords", "selectedOfficialRank"],
  };

  let prompt = `
    You are a strict Korean language lexicographer. 
    The user's query is: "${query}".
    
    [CRITICAL INSTRUCTION]
    1. If the query "${query}" is NOT in Korean (e.g., it's in Chinese, English, Vietnamese, etc.), FIRST translate it into the most accurate, standard Korean base word (표제어). 
    2. ABSOLUTELY DO NOT CHANGE CONJUGATED FORMS: If the user's query contains a conjugated verb/adjective with tenses (e.g., past '보았다', '먹었다', future '볼 것이다', or other forms like '죽도록', '예뻐서', '슬픈'), YOU MUST KEEP EXACTLY what the user typed in the 'korean' field (outputs 'korean': '${query}').
       - DO NOT convert it to the base form (표제어, e.g., '보다', '먹다').
       - In 'definition', you MUST explain the conjugation rule and MUST wrap the direct translated base word with ** for highlighting. (e.g., "**To see**. Future intention form of '보다'."). 
       - In 'translation', DO NOT use ** markers. Instead, provide the translated base word, followed by a period and a space (". "), and then write the grammatical explanation. 
         * Example (translation format MUST EXACTLY MATCH): "見る. 「보다」の未来・意志形"
       - In 'exampleSentence', use the exact conjugated form provided by the user.
       - The 'partOfSpeech' should reflect the base word.
    3. HOWEVER, if the user's query contains a complete conversational phrase or a sentence (e.g., "반가워요", "수고가 많으셨습니다", "안녕하셨습니까?"), YOU MUST extract the core base word (e.g., '반갑다', '수고하다', '안녕하다') and set it as the 'korean' field.
       - Use the user's original conversational phrase as the 'exampleSentence'.
    4. MUST KEEP NOUN PHRASES / IDIOMS (관용어 / 속담): If the query is a well-known Korean idiom, idiom phrase, or proverb (e.g., "간담이 서늘하다", "가는 귀가 먹다", "약방에 감초", "발이 넓다"), DO NOT truncate or shorten it to a single word like '간담' or '귀' or '약방'. 
       - Output the FULL idiom exactly as queried in the 'korean' field.
       - Set 'partOfSpeech' to '관용구' (or '속담').
  `;

  if (contextHint) {
    prompt += `\nFocus specifically on the meaning related to: "${contextHint}".`;
  } else {
    prompt += `\nIf there are multiple homonyms, choose the most common or primary meaning.`;
  }

  if (homonymPromptAddition) {
    prompt += `\n\n${homonymPromptAddition}\n`;
  }

  prompt += `
    Provide the output strictly in JSON format.
    
**Data Requirements for Visualization (Strict Axis Rules):**
    
    1. **Synonyms (X-Axis Positive):** Max 3 words total. 
       - If there is an EXACT, perfectly interchangeable synonym, assign it distance **0.2**.
       - If there is NO perfect match, DO NOT force a 0.2. Instead, assign the closest word distance **0.3**.
       - The next closest words get **0.6** and **1.0**.
       - (Example distances to output: [0.2, 0.6, 1.0] OR [0.3, 0.6, 1.0]).
       
    2. **Antonyms (X-Axis Negative):**
       - Provide EXACTLY ONE word (distance 1.0) if an antonym exists. If not, return an empty array [].
       
    3. **Honorifics (Y-Axis Positive, 존댓말/높임말):**
       - MUST be DISTINCT lexical items only (e.g., 먹다 -> 드시다/잡수시다, 집 -> 댁).
       - DO NOT fabricate words by simply appending "-하시다" or "-시다" to a noun/adjective.
       - Assign politeness \`level\` strictly as **0.3**, **0.6**, or **1.0** based on the degree of politeness. DO NOT use 0.2.
       - Output a maximum of 3 items, but ONLY output the ones that actually exist. If only 1 exists, output 1. If a distinct honorific does NOT exist, you MUST return an EMPTY ARRAY [].
       
    4. **Casuals/Hadae (Y-Axis Negative, 반말/낮춤말/비속어):**
       - MUST be DISTINCT lexical vulgar/casual items (e.g., 먹다 -> 처먹다, 입 -> 주둥이).
       - DO NOT fabricate words.
       - If a distinct casual lexical item does NOT exist, you MUST return an EMPTY ARRAY [].
    
    **General Requirements:**
    - **korean**: MUST be the translated Korean base word (if original query was foreign).
    - **Pronunciation**: MUST strictly follow the official "Standard Korean Pronunciation Rules" (표준 발음법) of the National Institute of Korean Language. You MUST apply all phonological changes completely, including consonant assimilation (비음화, 유음화), palatalization (구개음화), and n-insertion (ㄴ 첨가).
      - Example 1: '색연필' MUST be [생년필] (NOT [색년필]).
      - Example 2: '국물' MUST be [궁물].
      - Example 3: '설날' MUST be [설랄].
      Format MUST be in HANGUL inside square brackets.
    - **Part of Speech**: MUST be in Korean (e.g., 명사, 동사, 형용사, 부사 등).
    - **Translations**: 
       - 'definition' is English.
       - 'translation' is ${targetLanguageName}.
  `;

  try {
    
    const model = genAI.getGenerativeModel({ model: modelId });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.3,
      }
    });

    const responseText = response.response.text();
    const parsedData = JSON.parse(responseText);

    // AI가 동음이의어 판별을 해서 ID를 반환했다면, 원본 엑셀 데이터와 매칭
    if (candidates.length > 1 && parsedData.selectedOfficialRank) {
      const match = candidates.find(c => c.rank === parsedData.selectedOfficialRank);
      if (match) {
        preMatchedOfficialInfo = [match];
      }
    }

    // 최종적으로 프론트엔드에 보낼 데이터에 공식 어휘 정보 삽입
    parsedData.officialInfo = preMatchedOfficialInfo;
    
    // 프론트엔드에는 필요 없는 판별용 임시 필드 삭제
    delete parsedData.selectedOfficialRank;

    // 최종 데이터 응답 전송 전에 표준국어대사전 정보도 함께 첨부 (korean 필드 기반 매칭)
    let stdDictInfos = await fetchKoreanDictInfo(parsedData.korean);
    
    // AI 생성 의미와 가장 잘 맞는 표준국어대사전 항목 찾기, 공식 어휘 매칭, 그리고 동음이의어 번역
    const officialCandidates = vocabularyData.filter(v => v.rawWord && v.rawWord.replace(/[0-9]/g, '') === parsedData.korean);
    let matchedOfficialRank = parsedData.selectedOfficialRank || null;

    if (stdDictInfos && stdDictInfos.length > 0) {
      // 이제 표제어(homonym)뿐만 아니라 개별 뜻풀이(sense)까지 모두 평탄화하여 AI에 전달
      const sensesToProcess = [];
      stdDictInfos.forEach((info, hIdx) => {
        if (info.senses) {
          info.senses.forEach((sense, sIdx) => {
            if (sense.definition) {
              sensesToProcess.push({
                hIdx: hIdx,
                sIdx: sIdx,
                word: info.word,
                sup_no: info.sup_no || "",
                meaning: sense.definition
              });
            }
          });
        }
      });

      if (sensesToProcess.length > 0 || officialCandidates.length > 1) {
        const offOptions = officialCandidates.map(c => ({
          id: c.rank,
          pos: c.pos,
          meaning: c.meaning
        }));
        
         const transPrompt = `
You are a professional translator and language matcher.
We have an AI-generated definition for a Korean word.
AI Generated English Definition: "${parsedData.definition}"
AI Generated ${targetLanguageName} Translation: "${parsedData.translation}"
Context Hint (if any): "${contextHint || 'None'}"

Here are the specific dictionary senses (뜻풀이) for "${parsedData.korean}":
${JSON.stringify(sensesToProcess)}

Here are the Official Vocabulary Candidates for "${parsedData.korean}":
${JSON.stringify(offOptions)}

Task 1: Identify which dictionary sense (meaning) best matches the AI generated definition. Return its "hIdx" and "sIdx". (Return 0 for both if unsure).
Task 2: Translate ALL of the Korean dictionary sense meanings into ${targetLanguageName}. Keep the precise meaning.
Task 3: Identify which "id" from the Official Vocabulary Candidates best matches the AI generated definition. Return an empty string "" if none match or if array is empty.

Provide the output strictly in JSON format matching this schema:
{
  "bestMatchHIdx": number,
  "bestMatchSIdx": number,
  "bestOfficialRank": "string",
  "translations": [
    { "hIdx": number, "sIdx": number, "translatedMeaning": "string" }
  ]
}
        `;
        try {
          const transSchema = {
            type: Type.OBJECT,
            properties: {
              bestMatchHIdx: { type: Type.NUMBER },
              bestMatchSIdx: { type: Type.NUMBER },
              bestOfficialRank: { type: Type.STRING },
              translations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    hIdx: { type: Type.NUMBER },
                    sIdx: { type: Type.NUMBER },
                    translatedMeaning: { type: Type.STRING }
                  },
                  required: ['hIdx', 'sIdx', 'translatedMeaning']
                }
              }
            },
            required: ['bestMatchHIdx', 'bestMatchSIdx', 'translations']
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
            if (stdDictInfos[t.hIdx] && stdDictInfos[t.hIdx].senses && stdDictInfos[t.hIdx].senses[t.sIdx]) {
              stdDictInfos[t.hIdx].senses[t.sIdx].definition = t.translatedMeaning;
            }
          });

          // 선택된 가장 정확한 뜻(Sense)을 해당 동음이의어(Homonym) 배열 안에서 최상단[0]으로 올립니다.
          if (transParsed.bestMatchHIdx !== undefined && transParsed.bestMatchSIdx !== undefined) {
             const hIdx = transParsed.bestMatchHIdx;
             const sIdx = transParsed.bestMatchSIdx;
             
             if (stdDictInfos[hIdx] && stdDictInfos[hIdx].senses && stdDictInfos[hIdx].senses.length > sIdx) {
                const matchedSense = stdDictInfos[hIdx].senses.splice(sIdx, 1)[0];
                stdDictInfos[hIdx].senses.unshift(matchedSense);
             }
             // 그런 다음, 그 최적의 뜻(Sense)을 가지고 있는 동음이의어(Homonym) 자체를 최상단[0]으로 올립니다.
             if (hIdx > 0 && hIdx < stdDictInfos.length) {
                const matchedHomonym = stdDictInfos.splice(hIdx, 1)[0];
                stdDictInfos.unshift(matchedHomonym);
             }
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

    // 표제어의 한국어 발음 표기를 표준국어대사전 첫 번째 API 기준으로 덮어쓰기
    if (stdDictInfos && stdDictInfos.length > 0 && stdDictInfos[0].pronunciation) {
      parsedData.pronunciation = `[${stdDictInfos[0].pronunciation.replace(/\[/g, '').replace(/\]/g, '')}]`;
    }

    res.json({
      id: crypto.randomUUID(),
      isLearned: false,
      ...parsedData
    });

  } catch (error) {
    console.error("Error fetching word:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

// 이미지 텍스트 추출 엔드포인트
app.post('/api/extractText', async (req, res) => {
  const { base64Image, mimeType } = req.body;
  const prompt = `
  이미지는 사용자가 직접 손으로 쓴 한국어 단어입니다.
  다음 지침에 따라 가장 명확한 한국어 단어 하나를 추출해 주세요:
  1. 이미지에 적힌 한국어 단어를 정확하게 판독하세요.
  2. 부가적인 설명 없이 오직 판독된 한국어 단어 하나만 단순한 텍스트로 반환하세요.
  3. 만약 한국어나 글자를 찾을 수 없다면 빈 문자열을 반환하세요.
  `;

  try {
    
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      },
      prompt
    ]);

    const extractedText = result.response.text();
    console.log(" 캔버스 추출 텍스트:", extractedText);
    res.json({ text: extractedText?.trim() || "" });
  } catch (error) {
    console.error("Error extracting text from image:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
});

app.post('/api/analyzeSentence', async (req, res) => {
  const { query, targetLanguageName } = req.body;

  const schema = {
    type: Type.OBJECT,
    properties: {
      original: { type: Type.STRING, description: "The spell-checked and correctly spaced version of the Korean sentence." },
      pronunciation: { type: Type.STRING, description: "The standard Korean pronunciation written in HANGUL characters for the whole sentence." },
      translation: { type: Type.STRING, description: `The full translation of the sentence in ${targetLanguageName}.` },
      breakdown: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            korean: { type: Type.STRING, description: "The specific morpheme or word chunk from the sentence (e.g. 당신, 은, 학교, 에)." },
            baseForm: { type: Type.STRING, description: "The dictionary base form if conjugated (e.g. 다니다 for 다닙니까). Leave empty if not applicable." },
            meaning: { type: Type.STRING, description: `The translation of this specific part into ${targetLanguageName}.` },
            pos: { type: Type.STRING, description: "The part of speech or role (e.g. Noun, Subject Particle, Verb, Question Ending)." }
          }
        },
        description: "Morphological breakdown of the sentence into words and particles."
      },
      contextExplanation: { type: Type.STRING, description: `If the sentence contains idioms, proverbs, slangs, or culturally/geographically specific Korean elements, provide a brief context or nuance explanation in ${targetLanguageName}. Otherwise return an empty string.` }
    },
    required: ["original", "pronunciation", "translation", "breakdown", "contextExplanation"],
  };

  const prompt = `
    You are an expert Korean language teacher.
    The user's input might have spacing or spelling errors: "${query}".
    
    1. FIRST, strictly correct any spelling, typos, and spacing errors in the Korean sentence. Use the corrected sentence for the "original" field.
    2. Translate the corrected sentence to ${targetLanguageName}.
    3. Break down the corrected sentence morphologically (word by word, particle by particle). This helps foreign learners understand how the sentence is constructed.
    4. Clearly explain what each piece means in ${targetLanguageName}.
    5. Format the breakdown chronologically as it appears in the corrected sentence.
  `;

  try {
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);

    return res.json(data);
  } catch (error) {
    console.error("Sentence analysis failed:", error);
    res.status(500).json({ error: "Failed to analyze sentence" });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

// 국립국어원 표준국어대사전 프록시 API
app.get('/api/dictInfo', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "No query provided" });

    const DICT_KEY = process.env.KOREAN_DICT_API_KEY;
    if (!DICT_KEY) return res.status(500).json({ error: "Dictionary API key not configured" });

    // 1단계: 검색 API (search.do) 로 target_code 조회
    const searchUrl = `https://stdict.korean.go.kr/api/search.do?key=${DICT_KEY}&req_type=json&q=${encodeURIComponent(query)}&advanced=y&method=exact`;
    const searchRes = await fetch(searchUrl);
    
    // 결과가 비어있거나 에러일 경우 처리
    const searchJsonText = await searchRes.text();
    if (!searchJsonText.trim()) return res.json({ result: null });

    const searchData = JSON.parse(searchJsonText);
    const items = searchData?.channel?.item;
    if (!items || items.length === 0) return res.json({ result: null });

    // 첫 번째 단어 아이템의 target_code 추출
    const targetCode = items[0].target_code;

    // 2단계: 상세 조회 API (view.do) 호출 (XML만 지원됨)
    const viewUrl = `https://stdict.korean.go.kr/api/view.do?key=${DICT_KEY}&method=TARGET_CODE&q=${targetCode}`;
    const viewRes = await fetch(viewUrl);
    const viewXmlText = await viewRes.text();
    
    if (!viewXmlText.trim()) return res.json({ result: null });

    // XML 파싱
    const viewData = await parseStringPromise(viewXmlText, { explicitArray: false, ignoreAttrs: true });
    
    const wordInfo = viewData?.channel?.item?.word_info;
    if (!wordInfo) return res.json({ result: null });

    // pos_info, comm_pattern_info 처리 (배열일 수 있음)
    let posInfoArray = wordInfo.pos_info;
    if (posInfoArray && !Array.isArray(posInfoArray)) posInfoArray = [posInfoArray];
    
    let allSenses = [];
    let mainPos = "";
    
    if (posInfoArray) {
      mainPos = posInfoArray[0].pos || "";
      posInfoArray.forEach(posItem => {
        let commPatternArray = posItem.comm_pattern_info;
        if (commPatternArray && !Array.isArray(commPatternArray)) commPatternArray = [commPatternArray];
        
        if (commPatternArray) {
          commPatternArray.forEach(commPattern => {
            let sensesArray = commPattern.sense_info;
            if (sensesArray && !Array.isArray(sensesArray)) sensesArray = [sensesArray];
            
            if (sensesArray) {
              sensesArray.forEach(sense => {
                let examples = sense.example_info;
                if (examples && !Array.isArray(examples)) examples = [examples];
                
                allSenses.push({
                  definition: typeof sense.definition === 'string' ? sense.definition : (sense.definition?._ || ""),
                  pattern: sense.syntactic_annotation || "",
                  grammar: sense.grammar_info || "",
                  examples: examples ? examples.map(ex => typeof ex.example === 'string' ? ex.example : (ex.example?._ || "")) : []
                });
              });
            }
          });
        }
      });
    }

    // 필수 정보만 정제해서 묶어줍니다
    const responseData = {
      word: wordInfo.word,                // 표제어
      origin: wordInfo.original_language_info ? wordInfo.original_language_info.original_language : "", // 원어/어원
      pronunciation: wordInfo.pronunciation_info ? (Array.isArray(wordInfo.pronunciation_info) ? wordInfo.pronunciation_info[0].pronunciation : wordInfo.pronunciation_info.pronunciation) : "", // 발음
      pos: mainPos,            // 품사
      conjugation: wordInfo.conju_info ? (Array.isArray(wordInfo.conju_info) ? wordInfo.conju_info.map(c => c.conjugation).join(', ') : wordInfo.conju_info.conjugation) : "", // 활용
      senses: allSenses                   // 뜻풀이, 문형, 용례 배열
    };

    res.json({ result: responseData });
  } catch (err) {
    console.error("Dictionary API proxy error:", err);
    res.status(500).json({ error: "Failed to fetch dictionary data" });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3002; 
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});