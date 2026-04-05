import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Word, Language } from '../types';
import { Volume2, RotateCw, ArrowRightLeft, BookType, CheckCircle2, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Cell } from 'recharts';

interface FlashcardProps {
  word: Word;
  nativeLanguage: Language;
  onSelectHomonym: (definition: string) => void;
  onToggleLearned: (e: React.MouseEvent, id: string) => void;
  onSearchWord: (query: string) => void; //
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, nativeLanguage, onSelectHomonym, onToggleLearned, onSearchWord }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const backContentRef = useRef<HTMLDivElement>(null);

  // Reset flip state when word changes
  useEffect(() => {
    setIsFlipped(false);
    setIsExplanationOpen(false);
  }, [word.id]);

  // Reset scroll position when flipped
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

  const renderTextWithHighlight = (text: string, target: string, noBold: boolean = false, customColorClass?: string) => {
    if (!text) return null;
    const highlightColorClass = customColorClass || (word.isLearned ? 'text-emerald-600' : 'text-indigo-600');
    const weightClass = noBold ? '' : 'font-bold';

    if (text.includes('**')) {
      const parts = text.split(/\*\*(.*?)\*\*/g);
      return (
        <span>
          {parts.map((part, i) => 
            i % 2 === 1 ? 
              <span key={i} className={`${highlightColorClass} ${weightClass}`.trim()}>{part}</span> : 
              <span key={i}>{part}</span>
          )}
        </span>
      );
    }

    if (!target) return <span>{text}</span>;

    const parts = text.split(new RegExp(`(${target})`, 'gi'));

    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === target.toLowerCase() ? 
            <span key={i} className={`${highlightColorClass} ${weightClass}`.trim()}>{part}</span> : 
            <span key={i}>{part}</span>
        )}
      </span>
    );
  };

  // Recharts 커스텀 도형 렌더링 함수 (존대/하대 삼각형)
  const renderCustomShape = (props: any) => {
    const { cx, cy, payload } = props;
    const size = 15; // 삼각형 크기

    if (!payload || !cx || !cy) return null;

    if (payload.type === 'honorific') {
      // 위를 보는 삼각형 (존대)
      return (
        <path d={`M${cx},${cy - size/2} L${cx - size/2},${cy + size/2} L${cx + size/2},${cy + size/2} Z`} fill={payload.color} stroke="none" />
      );
    } else if (payload.type === 'casual') {
      // 아래를 보는 삼각형 (하대)
      return (
        <path d={`M${cx},${cy + size/2} L${cx - size/2},${cy - size/2} L${cx + size/2},${cy - size/2} Z`} fill={payload.color} stroke="none" />
      );
    } else {
      // 기본 원
      return (
        <circle cx={cx} cy={cy} r={6} fill={payload.color} stroke="none" />
      );
    }
  };

  // Prepare data for the chart with specific color logic and jittering for visibility
  const chartData = useMemo(() => {
    // 표제어 색상
    const headwordColor = word.isLearned ? '#059669' : '#4f46e5'; 

    const data: any[] = [
      { x: 0, y: 0, label: word.korean, type: 'main', color: headwordColor, dy: -20, dx: 0 } // Center
    ];

    // Synonyms (X-Axis +)
    word.synonyms.forEach((syn, index) => {
      // 0.2와 거의 일치하면 초록색 대신 표제어 색상 적용
      const isCongruence = Math.abs(syn.distance - 0.2) < 0.05;
      
      // 백엔드에서 정해준 거리(0.2, 0.3, 0.6, 1.0)를 그대로 X 좌표로 사용
      const currentX = syn.distance; 

      // 텍스트가 겹치지 않게 위아래로 번갈아가며 배치
      const dy = index % 2 === 0 ? -22 : 22; 

      data.push({ 
        x: currentX, 
        y: 0, 
        label: syn.word, 
        type: 'synonym', 
        color: isCongruence ? headwordColor : '#22c55e',
        dy: dy,
        dx: 0
      });
    });

    // Antonyms (X-Axis -) -> Fixed at -1.0
    word.antonyms.forEach(ant => {
      data.push({ x: -1.0, y: 0, label: ant.word, type: 'antonym', color: '#ef4444', dy: -18, dx: 0 });
    });

    // Honorifics (Y-Axis +)
    word.honorifics?.forEach((hon, index) => {
      const currentY = hon.level; 
      // dx 값을 35에서 25로 대칭 축소 (중앙 정렬)
      const dx = index % 2 === 0 ? 25 : -25;

      data.push({ 
        x: 0, 
        y: currentY, 
        label: hon.word, 
        type: 'honorific', 
        color: '#06b6d4', // Cyan 컬러로 변경
        dy: 4,
        dx: dx
      });
    });

    // Casuals (Y-Axis -)
    word.casuals?.forEach(cas => {
      data.push({ 
        x: 0, 
        y: -1.0, 
        label: cas.word, 
        type: 'casual', 
        color: '#f59e0b',
        dy: 4,
        dx: 25 // 35에서 25로 축소
      });
    });

    return data;
  }, [word]);

  return (
    <div className="w-full max-w-4xl mx-auto perspective-1000 h-full cursor-pointer group relative" onClick={() => setIsFlipped(!isFlipped)}>
      <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* Front of Card */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col items-center justify-center p-8 overflow-hidden z-10">
          
          <div className="absolute top-6 left-6 z-20">
            <button
              onClick={(e) => onToggleLearned(e, word.id)}
              className={`p-2 rounded-full transition-all ${word.isLearned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              title={word.isLearned ? "Mark as reviewing" : "Mark as learned"}
            >
              <CheckCircle2 className={`w-6 h-6 ${word.isLearned ? 'fill-emerald-100' : ''}`} />
            </button>
          </div>

          <div className="absolute top-6 right-6 text-slate-400 flex items-center gap-2">
            <span className="text-sm font-medium uppercase tracking-wider">{word.partOfSpeech}</span>
            <RotateCw className="w-4 h-4" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
            
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className={`text-6xl md:text-8xl font-black text-center serif tracking-tight break-keep ${word.isLearned ? 'text-emerald-600' : 'text-indigo-600'}`}>
                  {word.korean}
                </h2>
                <button 
                  onClick={(e) => playAudio(e, word.korean)}
                  className="p-3 bg-indigo-50 rounded-full text-indigo-600 hover:bg-indigo-100 hover:scale-110 transition-all shadow-sm"
                  aria-label="Listen to word"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center gap-3 mt-4">
                 <span className="text-xl md:text-2xl text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-lg">
                  {word.pronunciation}
                </span>
                {word.hanja && (
                  <span className="text-xl md:text-2xl text-slate-400 font-serif font-light border-l border-slate-300 pl-3">
                    {word.hanja}
                  </span>
                )}
              </div>
            </div>

            {word.exampleSentence && (
              <div className="mt-8 max-w-md text-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 hidden md:block">
                <p className="text-slate-600 text-lg font-serif italic">
                  "{renderTextWithHighlight(word.exampleSentence, word.korean)}"
                </p>
              </div>
            )}
            
            {/*  연관 검색어 영역 추가 시작 */}
            {word.relatedWords && word.relatedWords.length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-2 z-20 w-full px-6 relative">
                <span className="w-full text-center text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Related Words</span>
                {word.relatedWords.map((relWord, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation(); 
                      onSearchWord(relWord); // 클릭하면 해당 단어로 바로 검색!
                    }}
                    className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-full hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm z-30"
                  >
                    # {relWord}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-slate-400 text-sm font-medium mt-auto">
            Tap to see meaning & details
          </div>
        </div>

        {/* Back of Card */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-white text-slate-800 rounded-3xl shadow-xl border border-slate-200 flex flex-col overflow-hidden z-10">
          
          <div className="p-6 md:p-8 pb-4 border-b border-slate-100 bg-white z-20 flex justify-between items-start shrink-0">
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h3 className={`text-2xl md:text-3xl font-bold serif ${word.isLearned ? 'text-emerald-600' : 'text-indigo-600'}`}>
                  {word.korean}
                </h3>
                <span className="text-lg md:text-xl text-slate-400 font-mono">{word.pronunciation}</span>
                {word.hanja && <span className="text-lg md:text-xl text-slate-400 font-serif border-l border-slate-300 pl-3">{word.hanja}</span>}
              </div>
            </div>
            <div className="flex gap-2.5 items-center shrink-0">
              <button 
                onClick={(e) => onToggleLearned(e, word.id)}
                className={`p-2 rounded-full transition-all ${word.isLearned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                title={word.isLearned ? "Mark as reviewing" : "Mark as learned"}
              >
                <CheckCircle2 className={`w-5 h-5 ${word.isLearned ? 'fill-emerald-100' : ''}`} />
              </button>
              <button 
                onClick={(e) => playAudio(e, word.korean)}
                className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Listen to word"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div 
            ref={backContentRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pt-4 space-y-8 cursor-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">{nativeLanguage.name}</span>
                <div className={`text-xl md:text-2xl font-medium leading-relaxed`}>
                  {(() => {
                    const isIdiomOrProverb = word.partOfSpeech === '관용구' || word.partOfSpeech === '속담';
                    
                    if (isIdiomOrProverb && word.translation.includes(';')) {
                      const splitIdx = word.translation.indexOf(';');
                      const literalPart = word.translation.substring(0, splitIdx);
                      const meaningPart = word.translation.substring(splitIdx + 1);
                      
                      return (
                        <>
                          <span className="text-slate-600">{literalPart};</span>
                          <span className="text-slate-800 ml-1.5 font-normal text-lg md:text-xl">
                            {renderTextWithHighlight(meaningPart, "", false)}
                          </span>
                        </>
                      );
                    }

                    // 혹시라도 일반 단어에서 AI가 모국어 번역에 **를 포함했다면 제거하여 깔끔하게 처리
                    const cleanTranslation = word.translation.replace(/\*\*/g, '');
                    
                    if (cleanTranslation.includes('. ')) {
                      // 동사 등 변형어구 설명문이 포함된 경우 (예: "見る. 「보다」の過去形")
                      const dotIdx = cleanTranslation.indexOf('. ');
                      return (
                        <>
                          <span className={word.isLearned ? 'text-emerald-600' : 'text-indigo-600'}>{cleanTranslation.substring(0, dotIdx + 1)}</span>
                          <span className="text-slate-800 ml-1.5 font-normal text-lg md:text-xl">{cleanTranslation.substring(dotIdx + 1).trim()}</span>
                        </>
                      );
                    }
                    // 일반 단어
                    return <span className={word.isLearned ? 'text-emerald-600' : 'text-indigo-600'}>{cleanTranslation}</span>;
                  })()}
                </div>
                {word.idiomExplanation && (word.partOfSpeech === '관용구' || word.partOfSpeech === '속담') && (
                  <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExplanationOpen(!isExplanationOpen);
                      }}
                      className="w-full flex items-center justify-between p-3 text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <span className="font-medium">Cultural & Linguistic Breakdown</span>
                      {isExplanationOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isExplanationOpen && (
                      <div className="p-3 pt-0 text-sm text-slate-500 leading-relaxed border-t border-slate-100/50">
                        {word.idiomExplanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 타겟 언어가 영어가 아닐 때만 English Definition 표시 */}
              {nativeLanguage.code !== 'en' && !nativeLanguage.name.toLowerCase().includes('english') && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">English Definition</span>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed">{renderTextWithHighlight(word.definition, "", true)}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Example</span>
                <button onClick={(e) => playAudio(e, word.exampleSentence)} className="text-slate-400 hover:text-indigo-600">
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-lg md:text-xl font-serif text-slate-800">
                  {renderTextWithHighlight(word.exampleSentence, word.korean)}
                </p>
                {/* 타겟 언어가 영어가 아닐 때만 중간 회색 서브텍스트 출력, 영어일 경우 생략하여 중복 방지 */}
                {nativeLanguage.code !== 'en' && !nativeLanguage.name.toLowerCase().includes('english') && (
                  <p className="text-slate-500 text-sm">
                    {renderTextWithHighlight(word.exampleEnglish, "", false, word.isLearned ? 'text-emerald-400' : 'text-indigo-400')}
                  </p>
                )}
                <p className="text-lg md:text-xl font-serif text-slate-800">
                  {renderTextWithHighlight(word.exampleTranslation, "")}
                </p>
              </div>
            </div>

            {/*  문체부 공식 어휘 정보 영역 추가 */}
            {word.officialInfo && word.officialInfo.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">📖 Official Vocabulary Info</span>
                <div className="space-y-2">
                  {word.officialInfo.map((info, idx) => (
                    <div key={idx} className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${info.grade === 'A' ? 'bg-emerald-500' : info.grade === 'B' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                          {info.grade} 등급
                        </span>
                        <span className="text-indigo-900 font-bold">{info.rawWord}</span>
                        <span className="text-indigo-600/70 text-xs font-medium">({info.pos})</span>
                        <span className="text-indigo-400 text-[10px] ml-auto font-mono">순위: {info.rank}</span>
                      </div>
                      {info.meaning && (
                        <p className="text-xs text-indigo-800 bg-white/60 p-2 rounded-lg inline-block border border-indigo-50">
                          <span className="font-bold mr-1">풀이:</span> {info.meaning}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Semantic Map Visualization */}
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 block">Semantic Map</span>
              <div className="w-full max-w-md mx-auto aspect-square bg-slate-50 rounded-xl border border-slate-200 p-1 md:p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      hide={true}
                      domain={[-1.0, 1.0]} /* 최대치를 딱 1.0으로 고정 */
                      padding={{ left: 20, right: 20 }} /* 가장자리 점이 잘리지 않도록 여백 추가 */
                      allowDataOverflow={false}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      hide={true}
                      domain={[-1.0, 1.0]}
                      padding={{ top: 20, bottom: 20 }} 
                      allowDataOverflow={false}
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#475569' }}
                    />
                    <ReferenceLine x={0} stroke="#cbd5e1" />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
                    <Scatter name="Words" data={chartData} shape={renderCustomShape as any}>
                      <LabelList 
                        dataKey="label" 
                        content={(props: any) => {
                          const { x, y, value, index } = props;
                          const dy = chartData[index].dy || 0;
                          const dx = chartData[index].dx || 0;
                          return (
                            <text 
                              x={x + dx} 
                              y={y} 
                              dy={dy} 
                              fill="#334155" 
                              fontSize={13} 
                              fontWeight={700} 
                              textAnchor="middle"
                              style={{ textShadow: '0px 0px 4px white, 0px 0px 8px white' }}
                            >
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${word.isLearned ? 'bg-emerald-600' : 'bg-indigo-600'}`}></div>
                  Target
                </span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Synonym</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>Antonym</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div>Honorific</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Casual</span>
              </div>
            </div>

            {/* Hierarchy Table */}
            {(word.hypernyms?.length || word.hyponyms?.length) && (
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">Word Hierarchy</span>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 font-medium w-32 flex items-center gap-2">
                          <ArrowUp className="w-3 h-3 text-slate-400" /> Hypernym
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {word.hypernyms && word.hypernyms.length > 0 ? word.hypernyms[0] : '-'}
                        </td>
                      </tr>
                      
                      <tr className={`${word.isLearned ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
                        <td className={`px-4 py-3 font-bold w-32 flex items-center gap-2 ${word.isLearned ? 'text-emerald-600' : 'text-indigo-600'}`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${word.isLearned ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div> Current
                        </td>
                        <td className={`px-4 py-3 font-bold text-lg ${word.isLearned ? 'text-emerald-700' : 'text-indigo-700'}`}>
                          {word.korean}
                        </td>
                      </tr>

                      <tr className="bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 font-medium w-32 flex items-center gap-2">
                          <ArrowDown className="w-3 h-3 text-slate-400" /> Hyponym
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {word.hyponyms && word.hyponyms.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {word.hyponyms.map((hypo, idx) => (
                                <span key={idx} className="bg-white px-2 py-0.5 rounded text-xs border border-slate-200 text-slate-600 shadow-sm">
                                  {hypo}
                                </span>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {word.otherHomonyms && word.otherHomonyms.length > 0 && (
              <div className="pt-4 border-t border-slate-100 pb-8">
                <div className="flex items-center gap-2 mb-3 text-amber-500">
                  <ArrowRightLeft className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Other Meanings (Homonyms)</span>
                </div>
                <div className="flex flex-col gap-2">
                  {word.otherHomonyms.map((homonymDef, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectHomonym(homonymDef);
                      }}
                      className="text-left px-3 py-2 rounded bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 transition-all text-sm text-slate-600 flex items-start gap-2 group/btn shadow-sm"
                    >
                      <BookType className="w-4 h-4 mt-0.5 text-slate-400 group-hover/btn:text-amber-500" />
                      <span>{homonymDef}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
};