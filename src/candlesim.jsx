import { useEffect, useRef } from 'react';
import * as webGPU from './webgpu-fluid'; // We'll implement this next

export default function CandleSimulation({ width = 400, height = 600 }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    let simulation;
    
    async function init() {
      simulation = await webGPU.initCandleSimulation(canvasRef.current, width, height);
      simulation.start();
    }
    
    init();
    
    return () => {
      simulation?.stop();
    };
  }, [width, height]);
  
  return (
    <div className="candle-container" style={{ width, height }}>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        style={{ display: 'block' }}
      />
    </div>
  );
}