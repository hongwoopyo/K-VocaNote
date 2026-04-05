import React, { useState } from 'react';
import { Language, SUPPORTED_LANGUAGES } from '../types';
import { Globe, Sparkles, Search, ArrowRight } from 'lucide-react';

interface LanguageSelectorProps {
  onSelect: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onSelect }) => {
  const [customLanguage, setCustomLanguage] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customLanguage.trim()) {
      onSelect({
        code: 'custom',
        name: customLanguage.trim(),
        flag: '🌍'
      });
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f8fafc] relative font-sans">
      {/* 아기자기한 배경 그라데이션 및 데코레이션 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-200/40 blur-[100px]"></div>
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] rounded-full bg-blue-200/40 blur-[120px]"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[40%] rounded-full bg-emerald-100/40 blur-[100px]"></div>
      </div>

      <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        <div className="max-w-5xl w-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/60 p-6 md:p-12 text-center my-4 md:my-8 animate-in fade-in zoom-in duration-500">
          
          {/* 상단 아이콘 */}
          <div className="mb-6 flex justify-center">
            <div className="relative group cursor-default">
              <div className="absolute inset-0 bg-indigo-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative p-5 bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-3xl shadow-lg ring-4 ring-white transform rotate-3 group-hover:rotate-0 transition-transform duration-300">
                <Globe className="w-12 h-12 md:w-14 md:h-14 text-white" />
              </div>
              <div className="absolute -top-3 -right-3 animate-bounce" style={{ animationDuration: '3s' }}>✨</div>
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs md:text-sm mb-6 border border-indigo-100 shadow-sm">
            <Sparkles className="w-4 h-4" /> K-vocanote
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 mb-5 tracking-tight break-keep">
             한국어 어휘 학습의 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">끝판왕</span>
          </h1>
          <p className="text-slate-600 mb-10 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed font-medium bg-slate-50/50 p-4 md:p-5 rounded-2xl border border-slate-100 break-keep">
            한 번의 입력으로 예문과 발음과 관련어(반의어, 동의어, 동음이의어)까지 직관적으로 학습해보세요.
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px flex-1 max-w-[60px] bg-slate-200"></div>
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">학습을 위한 모국어 선택</span>
            <div className="h-px flex-1 max-w-[60px] bg-slate-200"></div>
          </div>

          {/* 반응형 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {/* 직접 입력 (검색/입력 창) */}
            <form 
              onSubmit={handleCustomSubmit}
              className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-1 flex flex-col items-center justify-center p-4 md:p-5 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/80 hover:border-indigo-400 hover:shadow-xl shadow-slate-200/50 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="flex flex-col items-center mb-2">
                <Search className="w-8 h-8 md:w-10 md:h-10 text-indigo-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-300 mb-1.5" />
                <span className="text-xs md:text-sm font-bold text-indigo-400 group-hover:text-indigo-600 transition-colors">
                  Search Language
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 text-center hidden group-hover:block transition-opacity opacity-0 group-hover:opacity-100">
                  다른 국가/언어 검색하기
                </span>
              </div>
              <div className="relative w-full max-w-[160px] mx-auto mt-1">
                <input
                  type="text"
                  placeholder="e.g., Hindi, Hebrew"
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  className="w-full text-center text-sm md:text-base font-bold text-indigo-900 bg-white/60 focus:bg-white border-b-2 border-indigo-200 focus:border-indigo-500 focus:outline-none py-1.5 px-2 rounded-t-md placeholder:text-slate-300 placeholder:font-normal placeholder:text-xs transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!customLanguage.trim()}
                  className="absolute right-1 bottom-1.5 text-indigo-400 hover:text-indigo-600 disabled:opacity-0 transition-opacity p-1 bg-white hover:bg-indigo-50 rounded-full"
                >
                  <ArrowRight className="w-4 h-4 md:w-4 md:h-4" />
                </button>
              </div>
            </form>

            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onSelect(lang)}
                className="flex flex-col items-center justify-center p-4 md:p-5 rounded-2xl border-2 border-transparent hover:border-indigo-200 hover:bg-white shadow-sm hover:shadow-xl shadow-slate-200/50 transition-all duration-300 group bg-slate-50/80 hover:-translate-y-1.5"
              >
                <span className="text-4xl md:text-5xl mb-3 group-hover:scale-125 transition-transform duration-300 filter drop-shadow-md">
                  {lang.flag}
                </span>
                <span className="font-bold text-slate-600 group-hover:text-indigo-600 text-sm md:text-base break-words w-full px-1 transition-colors">
                  {lang.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 이메일 문의 푸터 (우측 하단 배치) */}
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="bg-white/90 backdrop-blur p-3 md:p-4 rounded-2xl shadow-lg shadow-indigo-900/5 border border-slate-100 text-[10px] md:text-xs text-slate-500 font-medium whitespace-nowrap">
            <div className="flex flex-col gap-1.5 text-right">
              <p className="text-slate-700">
                <span className="font-bold text-indigo-400 mr-1.5">사업 및 학습 문의:</span> 
                <a href="mailto:hongwoopyo@gmail.com" className="hover:text-indigo-600 transition-colors">hongwoopyo@gmail.com</a>
              </p>
              <p>
                <span className="font-bold text-slate-400 mr-1.5">에러 문의:</span> 
                <a href="mailto:imriotheduck@gmail.com" className="hover:text-indigo-600 transition-colors">imriotheduck@gmail.com</a>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};