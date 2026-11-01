import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import {H, W} from './lib/core';
import {loadAssets} from './lib/assets';
import {renderCover} from './scenes/cover';

export const Cover: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender('cover assets'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadAssets().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    renderCover(ref.current.getContext('2d') as CanvasRenderingContext2D);
  }, [ready]);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <canvas ref={ref} width={W} height={H} style={{width: W, height: H}} />
    </AbsoluteFill>
  );
};
