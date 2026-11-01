import {Config} from '@remotion/cli/config';

// Rendering uses the preinstalled headless Chromium so nothing is downloaded at render time.
Config.setBrowserExecutable(process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(96);
// 'swiftshader' keeps 2D canvas on Chrome's CPU rasteriser: ~13x faster here than emulated GPU ('swangle')
Config.setChromiumOpenGlRenderer('swiftshader');
