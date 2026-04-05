import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Eraser, Loader2 } from 'lucide-react';

interface DrawingCanvasProps {
  onClose: () => void;
  onSearch: (imageData: string) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onClose, onSearch }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 캔버스 초기화 및 리사이징
  const initCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 컨테이너의 실제 크기를 가져옴
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) {
      setTimeout(initCanvas, 50);
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    
    // 캔버스의 내부 해상도(width, height)와 실제 디스플레이(style) 크기 매칭
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 배경을 완벽하게 하얀색 불투명으로 채우기
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // DPR 스케일링 적용
    ctx.scale(dpr, dpr);

    // AI가 선을 선명하게 인식할 수 있도록 두께를 키워줍니다
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // 컴포넌트 마운트 시 및 리사이즈 시 캔버스 설정
  useEffect(() => {
    setTimeout(initCanvas, 50);
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  // 정확한 좌표 계산 함수
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    // 터치 이벤트인지 마우스 이벤트인지 정확히 분기
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (!('touches' in e)) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return { x: 0, y: 0 };
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x, pos.y); // 점 하나만 찍었을 때도 보이도록
      ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    // 터치 스크롤 및 마우스 이벤트 기본 동작 방지 (터치기기에서 캔버스가 밀리는 것 방지)
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleSearch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // JPEG로 추출하여 알파 채널(투명 배경)이 검은색으로 변환되는 현상 원천 차단
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    const base64Data = dataUrl.split(',')[1];
    
    // 로딩 상태 설정
    setIsProcessing(true);
    onSearch(base64Data);
    // 모달을 닫는 시점은 상위 컴포넌트(App.tsx)의 비동기 작업이 끝난 후 setIsDrawingOpen에 맡깁니다.
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden h-[500px]">
        {/* Header */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            Write Hangul
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Canvas Area - 컨테이너 div 추가 */}
        <div ref={containerRef} className="flex-1 relative bg-white cursor-crosshair touch-none overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="block w-full h-full"
            style={{ touchAction: 'none' }} // 브라우저 기본 터치 액션 비활성화
          />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-slate-300 text-sm pointer-events-none select-none">
            Draw here
          </div>
        </div>

        {/* Footer / Controls */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          <button 
            onClick={initCanvas}
            disabled={isProcessing}
            className="flex items-center gap-2 text-slate-500 hover:text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Eraser className="w-5 h-5" />
            <span className="text-sm font-medium">Clear</span>
          </button>
          
          <button 
            onClick={handleSearch}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-75 disabled:scale-100"
          >
            <span className="font-bold">{isProcessing ? "Searching..." : "Search"}</span>
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};