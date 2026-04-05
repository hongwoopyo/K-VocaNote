import React, { useState, useEffect, useRef } from 'react';
import { LanguageSelector } from './components/LanguageSelector';
import { Flashcard } from './components/Flashcard';
import { SentenceCard } from './components/SentenceCard';
import { DrawingCanvas } from './components/DrawingCanvas';
import { lookupWord, extractTextFromImage, analyzeSentence } from './services/geminiService';
import { Word, Sentence, Language } from './types';
import { Search, BookOpen, Plus, Loader2, History, Trash2, Camera, CheckCircle2, Mic, LogOut, Image as ImageIcon, PenLine, Languages, MessageCircle } from 'lucide-react';

const App: React.FC = () => {
  const [userLanguage, setUserLanguage] = useState<Language | null>(null);
  
  const [searchMode, setSearchMode] = useState<'word' | 'sentence'>('word');
  
  const [words, setWords] = useState<Word[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false); // 이미지 메뉴 상태
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load initial state
  useEffect(() => {
    const savedLang = localStorage.getItem('userLanguage');
    const savedWords = localStorage.getItem('words');
    const savedSentences = localStorage.getItem('sentences');
    
    if (savedLang) setUserLanguage(JSON.parse(savedLang));
    
    if (savedWords) {
      const parsedWords = JSON.parse(savedWords);
      setWords(parsedWords);
      if (parsedWords.length > 0) setCurrentWordIndex(0);
    }

    if (savedSentences) {
      const parsedSentences = JSON.parse(savedSentences);
      setSentences(parsedSentences);
      if (parsedSentences.length > 0) setCurrentSentenceIndex(0);
    }
  }, []);

  useEffect(() => {
    if (userLanguage) localStorage.setItem('userLanguage', JSON.stringify(userLanguage));
    localStorage.setItem('words', JSON.stringify(words));
    localStorage.setItem('sentences', JSON.stringify(sentences));
  }, [userLanguage, words, sentences]);

  const handleLanguageSelect = (lang: Language) => {
    setUserLanguage(lang);
  };

  const handleResetLanguage = () => {
    setUserLanguage(null);
    localStorage.removeItem('userLanguage');
  };

  const performSearch = async (query: string, contextHint?: string) => {
    if (!query.trim() || !userLanguage) return;

    setIsLoading(true);
    setError(null);

    try {
      if (searchMode === 'word') {
        const newWord = await lookupWord(query, userLanguage.name, contextHint);
        const existingIndex = words.findIndex(w => w.korean === newWord.korean && w.definition === newWord.definition);
        
        if (existingIndex >= 0) {
          setCurrentWordIndex(existingIndex);
        } else {
          const updatedWords = [newWord, ...words];
          setWords(updatedWords);
          setCurrentWordIndex(0);
        }
      } else {
        const newSentence = await analyzeSentence(query, userLanguage.name);
        // 고유 ID 추가
        newSentence.id = query + Date.now();
        const updatedSentences = [newSentence, ...sentences];
        setSentences(updatedSentences);
        setCurrentSentenceIndex(0);
      }
      setSearchQuery('');
    } catch (err) {
      setError(searchMode === 'word' ? "Could not find word in the Standard Dictionary. Please try again." : "Could not analyze the sentence. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해 주세요.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => { setIsListening(true); setError(null); };
    recognition.onend = () => { setIsListening(false); };
    // _event로 변경하여 사용하지 않음 표시
    recognition.onError = (_event: any) => { setIsListening(false); setError("음성 인식 중 오류가 발생했습니다."); };
    recognition.onresult = (event: any) => { setSearchQuery(event.results[0][0].transcript); };
    recognition.start();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImageMenuOpen(false); // 메뉴 닫기
    processImage(file);
  };

  const processImage = (file: File) => {
    setIsImageProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = async () => {
        // Resize logic to ensure image is not too large
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          // Use JPEG format with quality 0.8 works universally and compresses well
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = compressedDataUrl.split(',')[1];
          const mimeType = 'image/jpeg';

          try {
            const extractedText = await extractTextFromImage(base64Data, mimeType);
            if (extractedText) {
              setSearchQuery(prev => prev.trim() ? `${prev} ${extractedText}` : extractedText);
            } else {
              setError("Could not identify any Korean text.");
            }
          } catch (err) {
            setError("Failed to process image.");
          } finally {
            setIsImageProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
          }
        }
      };
      
      img.onerror = () => {
        setError("Failed to load image for processing.");
        setIsImageProcessing(false);
      };

      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrawingSearch = async (base64Data: string) => {
    // DrawingCanvas에서 넘어온 데이터 처리
    // 가상의 파일 객체 처리와 유사하게 로직 수행
    setIsImageProcessing(true);
    setError(null);
    
    // 비동기 처리 완료 후 캔버스 닫기 위해 프로미스 반환
    try {
      const extractedText = await extractTextFromImage(base64Data, 'image/jpeg');
      if (extractedText) {
        setSearchQuery(prev => prev.trim() ? `${prev} ${extractedText}` : extractedText);
      } else {
        setError("Could not identify any Korean text.");
      }
    } catch (err) {
      setError("Failed to process drawing.");
    } finally {
      setIsImageProcessing(false);
      setIsDrawingOpen(false); // 검색이 완료되면 닫음
    }
  };

  const handleHomonymSelect = (definitionHint: string) => {
    if (words[currentWordIndex]) performSearch(words[currentWordIndex].korean, definitionHint);
  };

  const deleteWord = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newWords = words.filter(w => w.id !== id);
    setWords(newWords);
    if (currentWordIndex >= newWords.length) setCurrentWordIndex(Math.max(0, newWords.length - 1));
  };

  const toggleWordStatus = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newWords = words.map(w => w.id === id ? { ...w, isLearned: !w.isLearned } : w);
    setWords(newWords);
  };

  const deleteSentence = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSentences = sentences.filter(s => s.id !== id);
    setSentences(newSentences);
    if (currentSentenceIndex >= newSentences.length) setCurrentSentenceIndex(Math.max(0, newSentences.length - 1));
  };

  const toggleSentenceStatus = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSentences = sentences.map(s => s.id === id ? { ...s, isLearned: !s.isLearned } : s);
    setSentences(newSentences);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const maxBytes = searchMode === 'word' ? 60 : 120;
    
    let currentBytes = 0;
    let allowedStr = '';
    for (let i = 0; i < val.length; i++) {
      const charCode = val.charCodeAt(i);
      // Rough estimation: ASCII is 1 byte, others (like Korean) are 3 bytes in UTF-8
      const charBytes = charCode > 0x7f ? 3 : 1;
      
      if (currentBytes + charBytes <= maxBytes) {
        currentBytes += charBytes;
        allowedStr += val[i];
      } else {
        break; // Byte limit reached
      }
    }
    setSearchQuery(allowedStr);
  };

  if (!userLanguage) return <LanguageSelector onSelect={handleLanguageSelect} />;
  
  const totalItems = searchMode === 'word' ? words.length : sentences.length;
  const learnedCount = searchMode === 'word' ? words.filter(w => w.isLearned).length : sentences.filter(s => s.isLearned).length;
  const currentWord = words[currentWordIndex];
  const currentSentence = sentences[currentSentenceIndex];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {isDrawingOpen && <DrawingCanvas onClose={() => setIsDrawingOpen(false)} onSearch={handleDrawingSearch} />}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${showHistory ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            <button 
              onClick={() => setSearchMode('word')} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${searchMode === 'word' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BookOpen className="w-4 h-4" /> Word
            </button>
            <button 
              onClick={() => setSearchMode('sentence')} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${searchMode === 'sentence' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <MessageCircle className="w-4 h-4" /> Sentence
            </button>
          </div>
          <button onClick={() => setShowHistory(false)} className="md:hidden text-slate-400">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {searchMode === 'word' ? (
            words.length === 0 ? (
              <div className="text-center text-slate-400 mt-10"><p>No words yet.</p><p className="text-sm">Search to add words!</p></div>
            ) : (
              words.map((word, index) => (
                <div key={word.id} onClick={() => { setCurrentWordIndex(index); setShowHistory(false); }} className={`p-3 rounded-xl cursor-pointer transition-all group relative border ${index === currentWordIndex ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold truncate ${word.isLearned ? 'text-emerald-600' : (index === currentWordIndex ? 'text-indigo-900' : 'text-slate-700')}`}>
                          {word.korean}{word.standardDicts?.[0]?.sup_no && word.standardDicts[0].sup_no !== '0' && <sup className="ml-0.5 text-[0.6em] font-medium text-indigo-400/80">{word.standardDicts[0].sup_no}</sup>}
                        </p>
                        {word.isLearned && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        {word.hanja && !word.isLearned && <span className="text-xs text-slate-400 shrink-0">{word.hanja}</span>}
                      </div>
                      <p className={`text-xs truncate max-w-[180px] ${word.isLearned ? 'text-emerald-600/70' : 'text-slate-500'}`}>{word.translation}</p>
                    </div>
                    <button onClick={(e) => deleteWord(e, word.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-all ml-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )
          ) : (
            sentences.length === 0 ? (
              <div className="text-center text-slate-400 mt-10"><p>No sentences yet.</p><p className="text-sm">Search to analyze sentences!</p></div>
            ) : (
              sentences.map((sent, index) => (
                <div key={sent.id} onClick={() => { setCurrentSentenceIndex(index); setShowHistory(false); }} className={`p-3 rounded-xl cursor-pointer transition-all group relative border ${index === currentSentenceIndex ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold truncate ${sent.isLearned ? 'text-emerald-600' : (index === currentSentenceIndex ? 'text-indigo-900' : 'text-slate-700')}`}>{sent.original}</p>
                        {sent.isLearned && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </div>
                      <p className={`text-xs truncate max-w-[180px] ${sent.isLearned ? 'text-emerald-600/70' : 'text-slate-500'}`}>{sent.translation}</p>
                    </div>
                    <button onClick={(e) => deleteSentence(e, sent.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-all ml-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Learning Progress</span>
              <span className="text-sm font-bold text-indigo-600">
                {learnedCount} <span className="text-slate-300 font-normal">/</span> {totalItems}
              </span>
            </div>
            
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-700 ease-out" 
                style={{ width: `${totalItems > 0 ? (learnedCount / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-slate-500 pt-1">
            <span className="flex items-center gap-2">
              <span className="text-2xl">{userLanguage.flag}</span>
              <span className="font-medium text-slate-700">{userLanguage.name}</span>
            </span>
            <button 
              onClick={handleResetLanguage} 
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold">Change</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-3 md:p-6 flex flex-col md:flex-row items-center gap-3 z-20 shadow-sm shrink-0 transition-all">
          <div className="flex w-full md:w-auto items-center justify-between">
            <button onClick={() => setShowHistory(!showHistory)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><History className="w-6 h-6" /></button>
            <div className="md:hidden text-indigo-600 font-black tracking-tight text-lg shadow-indigo-100 drop-shadow-sm flex items-center gap-1">
              <span className="text-xl">✨</span> K-vocanote
            </div>
            <div className="w-10 md:hidden"></div> {/* Balance flex space */}
          </div>
          
          <form onSubmit={handleSearch} className="w-full flex-1 max-w-3xl mx-auto relative flex flex-col sm:flex-row gap-2 md:gap-3">
            <div className="relative flex-1 flex items-center shadow-sm rounded-2xl group focus-within:ring-4 ring-indigo-500/10 transition-all">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={handleSearchChange} 
                placeholder={searchMode === 'word' ? "Search a word..." : "Search a sentence to analyze..."} 
                className="w-full pl-12 pr-14 py-3.5 md:py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all text-base md:text-lg bg-slate-50/50 focus:bg-white" 
                disabled={isLoading || isImageProcessing || isListening} 
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 group-focus-within:text-indigo-600 w-5 h-5 transition-colors" />
              <button 
                type="submit" 
                disabled={isLoading || !searchQuery.trim() || isImageProcessing || isListening} 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 md:p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95"
              >
                {isLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Plus className="w-4 h-4 md:w-5 md:h-5" />}
              </button>
            </div>
            
            <div className="flex items-center justify-center sm:justify-end gap-1.5 md:gap-2 px-1">
              {/* Voice Input */}
              <button 
                type="button" 
                onClick={handleVoiceSearch} 
                disabled={isLoading || isImageProcessing} 
                className={`p-2.5 md:p-3 rounded-xl border transition-all flex-1 sm:flex-none flex items-center justify-center gap-2 ${isListening ? 'bg-red-50 text-red-600 border-red-200 animate-pulse shadow-inner' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 shadow-sm'}`}
              >
                <Mic className={`w-5 h-5 ${isListening ? 'fill-red-100' : ''}`} />
              </button>

              {/* Drawing Input */}
              <button 
                type="button" 
                onClick={() => setIsDrawingOpen(true)} 
                disabled={isLoading || isImageProcessing || isListening} 
                className="p-2.5 md:p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-xl transition-all shadow-sm flex-1 sm:flex-none flex items-center justify-center"
              >
                <PenLine className="w-5 h-5" />
              </button>

              {/* Combined Image Input (Camera/Gallery) */}
              <div className="relative flex-1 sm:flex-none">
                <button
                  type="button"
                  onClick={() => setIsImageMenuOpen(!isImageMenuOpen)}
                  disabled={isLoading || isImageProcessing || isListening}
                  className="w-full sm:w-auto p-2.5 md:p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-xl transition-all shadow-sm flex items-center justify-center"
                  title="Image Search"
                >
                  {isImageProcessing ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <Camera className="w-5 h-5" />}
                </button>

                {/* Image Menu Popup */}
                {isImageMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                    <button type="button" onClick={() => { cameraInputRef.current?.click(); setIsImageMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 rounded-xl text-slate-700 text-sm font-medium transition-colors">
                      <Camera className="w-4 h-4 text-indigo-500" /> Take Photo
                    </button>
                    <button type="button" onClick={() => { fileInputRef.current?.click(); setIsImageMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 rounded-xl text-slate-700 text-sm font-medium transition-colors mt-0.5">
                      <ImageIcon className="w-4 h-4 text-emerald-500" /> From Gallery
                    </button>
                  </div>
                )}
                
                {/* Invisible Overlay to close menu */}
                {isImageMenuOpen && (
                  <div className="fixed inset-0 z-40" onClick={() => setIsImageMenuOpen(false)}></div>
                )}
              </div>

              {/* Hidden Inputs */}
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleImageUpload} accept="image/*" capture="environment" className="hidden" />
            </div>
          </form>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col bg-slate-50/80 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
          {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 max-w-md text-center shrink-0 mx-auto shadow-sm backdrop-blur-md">{error}</div>}
          
          {searchMode === 'word' ? (
            currentWord ? (
              <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto min-h-0 animate-in fade-in zoom-in duration-300">
                <div className="flex-1 min-h-[480px] shrink-0 mb-6 relative">
                  <Flashcard word={currentWord} nativeLanguage={userLanguage} onSelectHomonym={handleHomonymSelect} onToggleLearned={toggleWordStatus} onSearchWord={performSearch}/>
                </div>
                <div className="mt-auto flex justify-center items-center gap-5 shrink-0 py-4 pb-8 md:pb-4 border-t/50 border-slate-200">
                  <button onClick={() => setCurrentWordIndex(prev => Math.max(0, prev - 1))} disabled={currentWordIndex === 0} className="w-32 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 font-bold transition-all shadow-sm active:scale-95">Previous</button>
                  <div className="px-4 py-2 bg-indigo-100/50 text-indigo-700 font-mono font-bold rounded-xl text-sm border border-indigo-100">
                    {words.length - currentWordIndex} / {words.length}
                  </div>
                  <button onClick={() => setCurrentWordIndex(prev => Math.min(words.length - 1, prev + 1))} disabled={currentWordIndex === words.length - 1} className="w-32 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 font-bold transition-all shadow-sm active:scale-95">Next</button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto text-slate-500 pb-20">
                <div className="relative mb-8 group cursor-default">
                  <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition duration-500"></div>
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center relative shadow-xl border border-slate-100">
                    <Search className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Start Your Collection</h3>
                <p className="text-base text-slate-500 font-medium px-4 leading-relaxed bg-white/60 py-3 rounded-2xl border border-white backdrop-blur-sm">
                  Search for a Korean word, or draw / upload an image to extract text for the learning.
                </p>
              </div>
            )
          ) : (
            currentSentence ? (
               <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto min-h-0 animate-in fade-in zoom-in duration-300">
                <div className="flex-1 min-h-[480px] shrink-0 mb-6 relative">
                  <SentenceCard sentence={currentSentence} nativeLanguage={userLanguage} onToggleLearned={toggleSentenceStatus} />
                </div>
                <div className="mt-auto flex justify-center items-center gap-5 shrink-0 py-4 pb-8 md:pb-4 border-t/50 border-slate-200">
                  <button onClick={() => setCurrentSentenceIndex(prev => Math.max(0, prev - 1))} disabled={currentSentenceIndex === 0} className="w-32 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 font-bold transition-all shadow-sm active:scale-95">Previous</button>
                  <div className="px-4 py-2 bg-indigo-100/50 text-indigo-700 font-mono font-bold rounded-xl text-sm border border-indigo-100">
                    {sentences.length - currentSentenceIndex} / {sentences.length}
                  </div>
                  <button onClick={() => setCurrentSentenceIndex(prev => Math.min(sentences.length - 1, prev + 1))} disabled={currentSentenceIndex === sentences.length - 1} className="w-32 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 font-bold transition-all shadow-sm active:scale-95">Next</button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto text-slate-500 pb-20">
                <div className="relative mb-8 group cursor-default">
                  <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition duration-500"></div>
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center relative shadow-xl border border-slate-100">
                    <MessageCircle className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Analyze Sentences</h3>
                <p className="text-base text-slate-500 font-medium px-4 leading-relaxed bg-white/60 py-3 rounded-2xl border border-white backdrop-blur-sm">
                  Search for a Korean sentence to analyze its structure, particles, and meaning.
                </p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

export default App;