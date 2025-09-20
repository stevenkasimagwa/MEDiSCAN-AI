import React, { useRef, useState, useEffect } from 'react';

interface Props {
  src: string;
  alt?: string;
}

export const ZoomableImage: React.FC<Props> = ({ src, alt }) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [src]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setScale((s) => Math.max(1, Math.min(8, s * factor)));
  };

  // touch handlers for basic panning on mobile (no pinch-to-zoom)
  const onTouchStart = (e: React.TouchEvent) => {
    if (scale <= 1) return;
    setIsPanning(true);
    const t = e.touches[0];
    panStart.current = { x: t.clientX - translate.x, y: t.clientY - translate.y };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || !panStart.current) return;
    const t = e.touches[0];
    setTranslate({ x: t.clientX - panStart.current.x, y: t.clientY - panStart.current.y });
  };

  const onTouchEnd = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };

  const onMouseUp = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  const zoomIn = () => setScale((s) => Math.min(8, s * 1.25));
  const zoomOut = () => setScale((s) => Math.max(1, s / 1.25));
  const fit = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  return (
    <div className="w-full">
      <div className="mb-2 flex gap-2 items-center flex-wrap">
        <button aria-label="Zoom out" onClick={zoomOut} className="px-3 py-1 border rounded text-sm">-</button>
        <button aria-label="Fit image" onClick={fit} className="px-3 py-1 border rounded text-sm">Fit</button>
        <button aria-label="Zoom in" onClick={zoomIn} className="px-3 py-1 border rounded text-sm">+</button>
        <div className="ml-2 text-sm text-muted-foreground">Zoom: {Math.round(scale * 100)}%</div>
      </div>

      <div
        ref={containerRef}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'auto' }}
        className="w-full min-h-[240px] h-[60vh] sm:h-[55vh] md:h-[70vh] overflow-hidden flex items-center justify-center bg-muted rounded"
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transition: isPanning ? 'none' : 'transform 0.15s ease-out', maxWidth: '100%' }}
          className="max-w-none max-h-full object-contain"
        />
      </div>
    </div>
  );
};

export default ZoomableImage;
