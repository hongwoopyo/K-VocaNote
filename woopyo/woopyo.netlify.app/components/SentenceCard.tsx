import React, { useState, useEffect, useRef } from 'react';
import { Sentence, Language } from '../types';
import { Volume2, CheckCircle2, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface SentenceCardProps {
  sentence: Sentence;
  nativeLanguage: Language;
  onToggleLearned: (e: React.MouseEvent, id: string) => void;
}

export const SentenceCard: React.FC<SentenceCardProps> = ({ sentence, nativeLanguage, onToggleLearned }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const backContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsFlipped(false);
    setIsExplanationOpen(false);
  }, [sentence.id]);

  useEffect(() => {
    if (isFlipped && backContentRef.current) {
      backContentRef.current.scrollTop = 0;
    }
  }, [isFlipped]);

  const playAudio = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="w-full max-w-4xl mx-auto perspective-1000 h-full cursor-pointer group relative" onClick={() => setIsFlipped(!isFlipped)}>
      <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* Front of Card */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col items-center justify-center p-8 overflow-hidden z-10">
          <div className="absolute top-6 left-6 z-20">
            <button
              onClick={(e) => onToggleLearned(e, sentence.id)}
              className={`p-2 rounded-full transition-all ${sentence.isLearned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              title={sentence.isLearned ? "Mark as reviewing" : "Mark as learned"}
            >
              <CheckCircle2 className={`w-6 h-6 ${sentence.isLearned ? 'fill-emerald-100' : ''}`} />
            </button>
          </div>

          <div className="absolute top-6 right-6 text-slate-400 flex items-center gap-2">
            <span className="text-sm font-medium uppercase tracking-wider">Sentence</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
            <div className="flex flex-col items-center mb-6 max-w-3xl">
              <div className="flex items-center gap-4 text-center">
                <h2 className={`text-4xl md:text-5xl lg:text-6xl font-black text-center serif tracking-tight break-keep leading-tight ${sentence.isLearned ? 'text-emerald-600' : 'text-indigo-600'}`}>
                  {sentence.original}
                </h2>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button 
                  onClick={(e) => playAudio(e, sentence.original)}
                  className="p-3 bg-indigo-50 rounded-full text-indigo-600 hover:bg-indigo-100 hover:scale-110 transition-all shadow-sm"
                  aria-label="Listen to sentence"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
                <span className="text-lg md:text-xl text-slate-500 font-mono bg-slate-100 px-3 py-1.5 rounded-lg">
                  {sentence.pronunciation}
                </span>
              </div>
            </div>
          </div>

          <div className="text-slate-400 text-sm font-medium mt-auto flex items-center gap-2">
            <Layers className="w-4 h-4" /> Tap to see breakdown & translation
          </div>
        </div>

        {/* Back of Card */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-white text-slate-800 rounded-3xl shadow-xl border border-slate-200 flex flex-col overflow-hidden z-10">
          
          <div className="p-6 md:p-8 pb-4 border-b border-slate-100 bg-white z-20 flex justify-between items-start shrink-0">
            <div className="pr-4">
              <h3 className={`text-xl md:text-2xl font-bold serif leading-relaxed ${sentence.isLearned ? 'text-emerald-600' : 'text-indigo-600'}`}>
                {sentence.original}
              </h3>
            </div>
            <div className="flex gap-2.5 items-center shrink-0">
              <button 
                onClick={(e) => onToggleLearned(e, sentence.id)}
                className={`p-2 rounded-full transition-all ${sentence.isLearned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                title={sentence.isLearned ? "Mark as reviewing" : "Mark as learned"}
              >
                <CheckCircle2 className={`w-5 h-5 ${sentence.isLearned ? 'fill-emerald-100' : ''}`} />
              </button>
              <button 
                onClick={(e) => playAudio(e, sentence.original)}
                className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Listen to sentence"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div 
            ref={backContentRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pt-4 space-y-6 cursor-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">{nativeLanguage.name} Translation</span>
              <div className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed border-l-4 border-indigo-200 pl-4 py-1">
                {sentence.translation}
              </div>
            </div>

            {sentence.contextExplanation && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden mt-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExplanationOpen(!isExplanationOpen);
                  }}
                  className="w-full flex items-center justify-between p-4 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <span className="font-bold flex items-center gap-2">
                    <span className="text-amber-500 text-base">💡</span> Cultural & Context Breakdown
                  </span>
                  {isExplanationOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {isExplanationOpen && (
                  <div className="p-4 pt-0 text-sm text-slate-600 leading-relaxed border-t border-slate-100/50">
                    {sentence.contextExplanation}
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-4">Sentence Breakdown (Morphological)</span>
              
              <div className="flex flex-wrap gap-3">
                {sentence.breakdown.map((particle, idx) => (
                  <div key={idx} className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow min-w-[80px]">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex flex-col items-center">
                      <span className="font-bold text-indigo-700 text-lg">{particle.korean}</span>
                      {particle.baseForm && (
                        <span className="text-[10px] text-slate-400 bg-white px-1.5 rounded-sm border border-slate-200 mt-1">
                          {particle.baseForm}
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2 flex flex-col items-center bg-white">
                      <span className="text-xs font-bold text-slate-600 text-center">{particle.meaning}</span>
                      <span className="text-[10px] text-slate-400 mt-1 text-center font-mono">{particle.pos}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
