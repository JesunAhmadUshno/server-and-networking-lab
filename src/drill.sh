#!/bin/sh
# drill.sh: time one recovery trial for H2 or H3 (PROPOSAL.md) and record it.
#
#   sh drill.sh order                                   print a random trial order and save it
#   sh drill.sh H2|H3 TRIAL ARCHIVE RESTORE_ROOT [OUT]  time one trial
#
# Inject the fault first, then start this. The clock runs from start until
# you press Enter AND the restore is verified: `tar --compare` checks every
# restored file (contents, size, mode, owner, mtime) against ARCHIVE, the
# off-server copy you restored from. One dated JSON file per trial goes
# to OUT (default experiments/drills/); an existing record is never
# overwritten, so a bad trial cannot be re-run away.
set -eu
OUT_DEFAULT="$(dirname "$0")/../experiments/drills"

if [ "${1:-}" = order ]; then
    mkdir -p "$OUT_DEFAULT"
    f="$OUT_DEFAULT/order-$(date -u +%F).txt"
    printf '%s\n' H2-1 H2-2 H2-3 H3-1 H3-2 H3-3 | shuf | tee "$f"
    exit 0
fi

[ $# -ge 4 ] || { sed -n '4,5p' "$0"; exit 2; }
H=$1 TRIAL=$2 ARCHIVE=$3 ROOT=$4 OUT=${5:-$OUT_DEFAULT}
case "$H" in H2|H3) ;; *) echo "hypothesis must be H2 or H3" >&2; exit 2 ;; esac
mkdir -p "$OUT"
REC="$OUT/$(date -u +%F)-$H-trial$TRIAL.json"
ls "$OUT"/*-"$H"-trial"$TRIAL".json >/dev/null 2>&1 && { echo "trial $H-$TRIAL already recorded" >&2; exit 1; }

START=$(date -u +%s)
echo "$H trial $TRIAL: clock started $(date -u +%FT%TZ). Restore into $ROOT, then press Enter."
read -r _
if tar -dzf "$ARCHIVE" -C "$ROOT" >/dev/null 2>&1; then VERIFIED=true; else VERIFIED=false; fi
END=$(date -u +%s)
BYTES=$(gzip -dc "$ARCHIVE" | wc -c | tr -d ' ')
ARCHIVE_EPOCH=$(stat -c %Y "$ARCHIVE")   # backups are copied with mtime kept (cp -p / scp -p)

printf '{"hypothesis": "%s", "trial": %s, "started_epoch": %s, "seconds": %s, "verified": %s, "bytes_restored": %s, "archive": "%s", "archive_epoch": %s}\n' \
    "$H" "$TRIAL" "$START" "$((END - START))" "$VERIFIED" "$BYTES" "$(basename "$ARCHIVE")" "$ARCHIVE_EPOCH" > "$REC"
echo "recorded $REC: $((END - START)) s, verified=$VERIFIED"
