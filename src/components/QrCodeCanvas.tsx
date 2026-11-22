import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
}

export function QrCodeCanvas({ value, size = 216 }: QrCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#171717',
        light: '#FFFFFF',
      },
    }).catch(() => {});
  }, [value, size]);

  return (
    <div className="inline-flex flex-col items-center rounded-xl border border-[#C6A56B]/40 bg-white p-3">
      <canvas ref={canvasRef} width={size} height={size} aria-label={`QR Code for ${value}`} />
    </div>
  );
}
