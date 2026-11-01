// Local-only assets (no network at render time): bundled fonts + the user's logo if present.
import {staticFile} from 'remotion';
import logoManifest from '../data/logo.json';

const FONTS: [string, string, string][] = [
  ['Anton', 'fonts/Anton.woff2', '400'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-400-normal.woff2', '400'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-700-normal.woff2', '700'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-800-normal.woff2', '800'],
  ['Inter', 'fonts/inter-latin-500-normal.woff2', '500'],
  ['Inter', 'fonts/inter-latin-800-normal.woff2', '800'],
  ['Inter', 'fonts/inter-latin-900-normal.woff2', '900'],
];

export const LOGO: {img: HTMLImageElement | null; pixelArt: boolean; w: number; h: number} = {
  img: null,
  pixelArt: false,
  w: 0,
  h: 0,
};

let loading: Promise<void> | null = null;

export const loadAssets = () => {
  if (loading) return loading;
  loading = (async () => {
    await Promise.all(
      FONTS.map(async ([family, file, weight]) => {
        const ff = new FontFace(family, `url(${staticFile(file)})`, {weight});
        await ff.load();
        (document.fonts as any).add(ff);
      }),
    );
    const man = logoManifest as {file: string | null; pixelArt: boolean};
    if (man.file) {
      const img = new Image();
      img.src = staticFile(man.file);
      await img.decode();
      LOGO.img = img;
      LOGO.pixelArt = man.pixelArt;
      LOGO.w = img.naturalWidth;
      LOGO.h = img.naturalHeight;
    }
  })();
  return loading;
};
