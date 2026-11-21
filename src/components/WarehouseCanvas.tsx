import { ArrowUpRight } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { CalloutPosition, WarehouseScene } from '../three/warehouseScene';
import { RobotUnit } from '../types/fleet';

export interface WarehouseCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
}

interface WarehouseCanvasProps {
  robots: RobotUnit[];
  selectedRobot: RobotUnit;
  isLive: boolean;
  onSelectRobot: (robotId: string) => void;
  onInspectRobot: (robotId: string) => void;
}

export const WarehouseCanvas = forwardRef<WarehouseCanvasHandle, WarehouseCanvasProps>(
  function WarehouseCanvas({ robots, selectedRobot, isLive, onSelectRobot, onInspectRobot }, ref) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<WarehouseScene | null>(null);
    const onSelectRef = useRef(onSelectRobot);
    onSelectRef.current = onSelectRobot;

    const [callout, setCallout] = useState<CalloutPosition>({
      x: 420,
      y: 230,
      visible: true,
    });

    useImperativeHandle(ref, () => ({
      zoomIn: () => sceneRef.current?.zoomIn(),
      zoomOut: () => sceneRef.current?.zoomOut(),
      resetCamera: () => sceneRef.current?.resetCamera(),
    }));

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      const controller = new WarehouseScene(el, robots, selectedRobot.id, {
        onSelectRobot: (id) => onSelectRef.current(id),
        onCalloutMove: (pos) => {
          setCallout((prev) => {
            if (
              Math.abs(prev.x - pos.x) < 0.6 &&
              Math.abs(prev.y - pos.y) < 0.6 &&
              prev.visible === pos.visible
            ) {
              return prev;
            }
            return pos;
          });
        },
      });
      sceneRef.current = controller;

      return () => {
        controller.dispose();
        sceneRef.current = null;
      };
      // Mount once so WebGL context never tears down on UI state changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      sceneRef.current?.setSelectedRobot(selectedRobot.id);
    }, [selectedRobot.id]);

    useEffect(() => {
      sceneRef.current?.setLive(isLive);
    }, [isLive]);

    const statusBadgeClass =
      selectedRobot.status === 'Active'
        ? 'bg-[#e8f5ea] text-[#2f8548] border-[#c4e6cc]'
        : selectedRobot.status === 'Picking'
          ? 'bg-[#eaf2fc] text-[#357bc2] border-[#c6ddf5]'
          : 'bg-[#fdf2e9] text-[#c76424] border-[#f4d6bc]';

    return (
      <div className="relative w-full h-full select-none">
        {/* Isolated WebGL mount */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Projected 3D Callout Badge for Selected AMR (no backdrop-filter over WebGL) */}
        {callout.visible && (
          <div
            style={{
              transform: `translate3d(${callout.x}px, ${callout.y}px, 0) translate(-50%, -105%)`,
            }}
            className="pointer-events-auto absolute top-0 left-0 z-10 w-[144px] rounded-[20px] px-3.5 py-2.5 transition-opacity duration-150"
          >
            <div
              className="rounded-[20px] px-3.5 py-2.5 border border-white/80"
              style={{
                background:
                  'linear-gradient(145deg, rgba(235, 236, 228, 0.92) 0%, rgba(226, 229, 220, 0.88) 100%)',
                boxShadow:
                  '0 12px 28px rgba(24, 28, 22, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[12.5px] font-medium text-[#2c2f2c] tracking-tight">
                  {selectedRobot.id}
                </span>
                <button
                  type="button"
                  onClick={() => onInspectRobot(selectedRobot.id)}
                  title={`Inspect ${selectedRobot.id}`}
                  className="text-[#4a4d48] hover:text-[#1f2120] transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-dots text-[27px] leading-none text-[#1f2120]">
                  {selectedRobot.batteryHealth}%
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${statusBadgeClass}`}
                >
                  {selectedRobot.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
