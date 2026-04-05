import { Word, Sentence } from '../types';

// 환경 변수가 있으면 그걸 쓰고, 없으면 로컬호스트를 씁니다.
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export const lookupWord = async (
  query: string,
  targetLanguageName: string,
  contextHint?: string
): Promise<Word> => {
  try {
    const response = await fetch(`${BACKEND_URL}/lookupWord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, targetLanguageName, contextHint }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching word from backend:", error);
    throw error;
  }
};

export const analyzeSentence = async (
  query: string,
  targetLanguageName: string
): Promise<Sentence> => {
  try {
    const response = await fetch(`${BACKEND_URL}/analyzeSentence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, targetLanguageName }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching sentence from backend:", error);
    throw error;
  }
};

export const extractTextFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const response = await fetch(`${BACKEND_URL}/extractText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error extracting text from image via backend:", error);
    throw error;
  }
};