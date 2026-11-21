import { useEffect, useRef } from 'react';
import { AmrHeroScene } from '../three/amrHeroScene';

interface AmrHeroCanvasProps {
  hasCargo: boolean;
  accentColor: 'orange' | 'green';
}

export function AmrHeroCanvas({ hasCargo, accentColor }: AmrHeroCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<AmrHeroScene | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const controller = new AmrHeroScene(el, { hasCargo, accentColor });
    sceneRef.current = controller;

    return () => {
      controller.dispose();
      sceneRef.current = null;
    };
    // Mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setRobotConfig({ hasCargo, accentColor });
  }, [hasCargo, accentColor]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      aria-label="3D AMR robot preview"
    />
  );
}
