import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame} from 'remotion';
import {H, W} from './lib/core';
import {loadAssets} from './lib/assets';
import {renderFrame} from './render';

export const Reel: React.FC<{frameOverride?: number}> = ({frameOverride}) => {
  const current = useCurrentFrame();
  const frame = frameOverride ?? current;
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender('fonts + logo'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadAssets()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }, [handle]);

  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const ctx = ref.current.getContext('2d') as CanvasRenderingContext2D;
    renderFrame(ctx, frame);
  }, [frame, ready]);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <canvas ref={ref} width={W} height={H} style={{width: W, height: H}} />
    </AbsoluteFill>
  );
};
