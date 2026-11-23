#!/usr/bin/env bash
# Turns out/adflo-demo.webm (from record.mjs) into out/adflo-marketing.mp4: intro card, captions, end card.
set -euo pipefail
cd "$(dirname "$0")"
PUB=../../public
F_B=/usr/share/fonts/opentype/inter/Inter-Bold.otf
F_M=/usr/share/fonts/opentype/inter/Inter-Medium.otf
BG=0x0b1a3c
SRC=out/adflo-demo.webm
FPS=30

cap() { # start end text
  echo "drawtext=fontfile=$F_B:text='$3':fontsize=46:fontcolor=white:box=1:boxcolor=0x0b1a3ccc:boxborderw=26:x=(w-text_w)/2:y=h-130:enable='between(t,$1,$2)':alpha='if(lt(t,$1+0.4),(t-$1)/0.4,if(gt(t,$2-0.4),($2-t)/0.4,1))'"
}
CAPS="$(cap 0.5 11.5 "All your business admin, in one place"),$(cap 12.5 23.5 "Licenses, insurance and certifications, never miss a renewal"),$(cap 24.5 42.5 "Every tool, truck and unit, and who has it"),$(cap 43.5 49.5 "Every deadline in one calendar"),$(cap 50.5 53.5 "Know what you are owed"),$(cap 54.5 57.5 "The paperwork side of your business, handled")"

# Main footage with captions
ffmpeg -v error -y -i "$SRC" -vf "fps=$FPS,scale=1920:1080,format=yuv420p,$CAPS" -c:v libx264 -crf 18 -an out/_main.mp4

# Intro (3.5s) and end card (4.5s): dark background, logo, text
card() { # out seconds logo-width line1 line2 line3
  ffmpeg -v error -y -f lavfi -i "color=c=$BG:s=1920x1080:r=$FPS:d=$2" -loop 1 -i $PUB/logo-wordmark-light.png \
    -filter_complex "[1:v]scale=$3:-1,format=rgba,fade=t=in:st=0.2:d=0.6:alpha=1,fade=t=out:st=$(echo "$2-0.5" | bc):d=0.5:alpha=1[l];\
[0:v][l]overlay=(W-w)/2:300:shortest=1,\
drawtext=fontfile=$F_B:text='$4':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=520:alpha='min(1,max(0,(t-0.6)/0.6))',\
drawtext=fontfile=$F_M:text='$5':fontsize=38:fontcolor=0xb8c7ee:x=(w-text_w)/2:y=620:alpha='min(1,max(0,(t-1.0)/0.6))',\
drawtext=fontfile=$F_B:text='$6':fontsize=44:fontcolor=0x0b1a3c:box=1:boxcolor=0x7cc4ff:boxborderw=24:x=(w-text_w)/2:y=780:alpha='min(1,max(0,(t-1.4)/0.6))',\
fade=t=out:st=$(echo "$2-0.4" | bc):d=0.4,format=yuv420p" -c:v libx264 -crf 18 -t "$2" out/$1.mp4
}
card _intro 3.5 560 "The administrative layer for contractors" "Compliance, records and equipment, organized" " "
card _end 4.5 560 "Less paperwork. More control." "Works alongside your accounting and project software" "Start free at adflo.com"

# Join with short fades
ffmpeg -v error -y -i out/_intro.mp4 -i out/_main.mp4 -i out/_end.mp4 -filter_complex \
"[0][1]xfade=transition=fade:duration=0.5:offset=3.0[a];[a][2]xfade=transition=fade:duration=0.5:offset=$(echo "3.0+$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/_main.mp4)-0.5" | bc)[v]" \
  -map "[v]" -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart out/adflo-marketing.mp4
rm -f out/_intro.mp4 out/_main.mp4 out/_end.mp4
echo "wrote out/adflo-marketing.mp4"
