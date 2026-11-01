import React from 'react';
import {Composition, Still} from 'remotion';
import {H, TOTAL, W} from './lib/core';
import {Reel} from './Reel';
import {Cover} from './Cover';

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={TOTAL} fps={120} width={W} height={H} />
    <Still id="Cover" component={Cover} width={W} height={H} />
  </>
);
