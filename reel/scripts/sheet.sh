#!/usr/bin/env bash
# contact sheet: scripts/sheet.sh <dir> <out.png> <cols> [scale_w]
set -euo pipefail
dir=$1; out=$2; cols=${3:-6}; w=${4:-270}
n=$(ls "$dir"/f*.png | wc -l); rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -pattern_type glob -i "$dir/f*.png" -vf "scale=$w:-1,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='%{n}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=4:color=gray" -frames:v 1 "$out"
