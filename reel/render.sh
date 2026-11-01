#!/usr/bin/env bash
# Render the Claude Code Reel end to end.
#
#   ./render.sh            everything: audio -> test slice -> master (chunked) -> reels/30fps -> cover -> QA
#   ./render.sh audio      rebuild the audio, beats.json and envelope only
#   ./render.sh test       3 s test slice (frames 1940-2299: sound world -> bullet-time contact)
#   ./render.sh master     chunked 120 fps master (resumes: finished chunks are kept)
#   ./render.sh deliver    master mp4 + 60 fps Reels cut + 30 fps fallback from the stitched chunks
#   ./render.sh cover      cover image
#   ./render.sh qa         automated QA on the outputs
#
# Env: CONCURRENCY (default 4), CHUNK (frames per chunk, default 516), FORCE=1 re-renders all chunks.
set -euo pipefail
cd "$(dirname "$0")"

CONCURRENCY=${CONCURRENCY:-4}
CHUNK=${CHUNK:-516}
TOTAL=4116
FPS=120
OUT=out
NAME=claude-code-reel
BUNDLE=$OUT/bundle
CHUNKS=$OUT/chunks
export REMOTION_BROWSER=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell}

log() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

check_tools() {
  log "toolchain"
  command -v node >/dev/null || die "node not found"
  command -v ffmpeg >/dev/null || die "ffmpeg not found"
  command -v python3 >/dev/null || die "python3 not found"
  echo "node $(node -v) | $(ffmpeg -version | head -1 | cut -d' ' -f1-3) | $(python3 --version)"
  python3 -c "import numpy, scipy, librosa, soundfile; print('numpy', numpy.__version__, '| scipy', scipy.__version__, '| librosa', librosa.__version__)" \
    || die "python deps missing: pip install -r audio/requirements.txt"
  [ -x "$REMOTION_BROWSER" ] || die "headless Chromium not found at $REMOTION_BROWSER (set REMOTION_BROWSER)"
  [ -d node_modules ] || { log "npm ci"; npm ci; }
  [ -f assets/music/track.m4a ] || die "music missing: put the track at assets/music/track.m4a"
  [ -f public/logo/claude-code.png ] || die "logo missing: public/logo/claude-code.png"
}

stage_audio() {
  log "audio: analysis + build (beats.json, envelope.json, mix.wav)"
  (cd audio && python3 analyze.py && python3 build.py)
}

stage_bundle() {
  log "bundle"
  rm -rf "$BUNDLE"
  npx remotion bundle src/index.ts --out-dir "$BUNDLE" --log=error >/dev/null
}

# ffprobe's csv output carries a trailing comma ("360,"): keep digits only
count_frames() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$1" 2>/dev/null | tr -dc '0-9' || echo 0; }

# render a frame range with retries at lower concurrency; never skips silently
render_range() {
  local first=$1 last=$2 out=$3 conc=$CONCURRENCY
  local want=$((last - first + 1))
  while :; do
    echo "frames $first-$last -> $out (concurrency $conc)"
    if npx remotion render "$BUNDLE" Reel "$out" --frames="$first-$last" --codec=prores --prores-profile=hq \
        --concurrency="$conc" --log=error --overwrite; then
      local got
      got=$(count_frames "$out")
      [ "$got" = "$want" ] && return 0
      echo "frame count mismatch: got $got, want $want"
    fi
    [ "$conc" -le 1 ] && die "render failed for frames $first-$last even at concurrency 1"
    conc=$((conc / 2))
    echo "retrying with concurrency $conc"
  done
}

stage_test() {
  log "test slice: 3 s (frames 1940-2299)"
  mkdir -p "$OUT/test"
  render_range 1940 2299 "$OUT/test/slice.mov"
  ffmpeg -v error -y -i "$OUT/test/slice.mov" -ss "$(python3 -c 'print(1940/120)')" -t 3 -i "$OUT/audio/mix.wav" \
    -map 0:v -map 1:a -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 -shortest \
    "$OUT/test/slice_120fps.mp4"
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -of compact "$OUT/test/slice_120fps.mp4"
}

stage_master() {
  log "master: chunks of $CHUNK frames"
  mkdir -p "$CHUNKS"
  : > "$CHUNKS/list.txt"
  for ((s = 0; s < TOTAL; s += CHUNK)); do
    local e=$((s + CHUNK - 1))
    ((e >= TOTAL)) && e=$((TOTAL - 1))
    local f
    f=$(printf '%s/c_%04d_%04d.mov' "$CHUNKS" "$s" "$e")
    if [ -z "${FORCE:-}" ] && [ -f "$f" ] && [ "$(count_frames "$f")" = "$((e - s + 1))" ]; then
      echo "keep $f"
    else
      render_range "$s" "$e" "$f"
    fi
    echo "file '$(basename "$f")'" >> "$CHUNKS/list.txt"
  done
  log "stitch"
  ffmpeg -v error -y -f concat -safe 0 -i "$CHUNKS/list.txt" -c copy "$OUT/master_video.mov"
  local n
  n=$(count_frames "$OUT/master_video.mov")
  [ "$n" = "$TOTAL" ] || die "stitched master has $n frames, expected $TOTAL"
  echo "stitched $n frames"
}

stage_deliver() {
  [ -f "$OUT/master_video.mov" ] || die "no stitched master; run ./render.sh master"
  log "master mp4: 1080x1920 120 fps H.264 high bitrate, AAC 48 kHz"
  ffmpeg -v error -y -i "$OUT/master_video.mov" -i "$OUT/audio/mix.wav" -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 12 -profile:v high -level:v 5.2 -pix_fmt yuv420p -r $FPS -g $FPS \
    -x264-params "keyint=$FPS:min-keyint=$FPS" -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -c:a aac -b:a 320k -ar 48000 -movflags +faststart "$OUT/${NAME}_master_120fps.mp4"

  log "Reels cut: 60 fps H.264 ~18 Mbps from blended pairs of 120 fps frames"
  local vf60="tmix=frames=2:weights='1 1',select='mod(n\,2)',setpts=N/(60*TB),format=yuv420p"
  local x60=(-c:v libx264 -preset slow -profile:v high -level:v 4.2 -b:v 18M -maxrate 20M -bufsize 36M -r 60 -g 60
    -colorspace bt709 -color_primaries bt709 -color_trc bt709)
  ffmpeg -v error -y -i "$OUT/master_video.mov" -vf "$vf60" "${x60[@]}" -pass 1 -passlogfile "$OUT/x60" -an -f mp4 /dev/null
  ffmpeg -v error -y -i "$OUT/master_video.mov" -i "$OUT/audio/mix.wav" -map 0:v -map 1:a -vf "$vf60" "${x60[@]}" \
    -pass 2 -passlogfile "$OUT/x60" -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$OUT/${NAME}_reels_60fps.mp4"

  log "fallback: 30 fps from blended quads"
  local vf30="tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\,4)\,3)',setpts=N/(30*TB),format=yuv420p"
  ffmpeg -v error -y -i "$OUT/master_video.mov" -i "$OUT/audio/mix.wav" -map 0:v -map 1:a -vf "$vf30" \
    -c:v libx264 -preset slow -profile:v high -level:v 4.1 -b:v 12M -maxrate 14M -bufsize 24M -r 30 -g 30 \
    -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$OUT/${NAME}_fallback_30fps.mp4"
  rm -f "$OUT"/x60*.log "$OUT"/x60*.mbtree
}

stage_cover() {
  log "cover"
  npx remotion still "$BUNDLE" Cover "$OUT/${NAME}_cover.png" --log=error --overwrite
  ffmpeg -v error -y -i "$OUT/${NAME}_cover.png" -q:v 2 "$OUT/${NAME}_cover.jpg"
}

stage_qa() {
  log "QA"
  python3 scripts/qa.py
}

cmd=${1:-all}
case "$cmd" in
  audio) check_tools; stage_audio ;;
  test) check_tools; stage_bundle; stage_test ;;
  master) check_tools; stage_bundle; stage_master ;;
  deliver) stage_deliver ;;
  cover) check_tools; stage_bundle; stage_cover ;;
  qa) stage_qa ;;
  all) check_tools; stage_audio; stage_bundle; stage_test; stage_master; stage_deliver; stage_cover; stage_qa ;;
  *) die "unknown stage '$cmd'" ;;
esac
log "done: $cmd"
