#!/bin/sh
# nightly_backup.sh: H1 (PROPOSAL.md). One hashed backup, one off-server
# copy, and the copy's hash checked on the far side. Runs from cron as root:
#
#   15 3 * * * root BACKUP_REMOTE=user@host:/path BACKUP_PATHS="/etc /srv/data" /opt/p23/nightly_backup.sh
#
# BACKUP_REMOTE  user@host:/dir (scp + ssh), or a local dir (tests)   required
# BACKUP_PATHS   what to back up                                      default /etc
# BACKUP_DIR     where the local archive and h1-log.jsonl live        default /srv/backup
#
# Every run appends one line to h1-log.jsonl, failures included; that log
# (hashes and sizes only, never the archive) is the evidence that is
# copied into experiments/backups/. The archive holds /etc secrets: the
# off-server host must be one you trust as much as the server itself.
# umask 077: the archive and log are readable by root only, here and,
# through scp -p, on the far side.
# ponytail: no retention; 7 nights of /etc is tiny. Prune once pool data is large.
# ponytail: not encrypted; the far side is trusted. Add age/gpg before using an untrusted host.
set -u
umask 077
: "${BACKUP_REMOTE:?set BACKUP_REMOTE}"
DIR=${BACKUP_DIR:-/srv/backup}
START=$(date -u +%s)
NAME="nightly-$(date -u +%F).tar.gz"
SHA="" OFF="" ERR=""

# shellcheck disable=SC2086  # BACKUP_PATHS is a space-separated list on purpose
if tar -czpf "$DIR/$NAME" ${BACKUP_PATHS:-/etc} 2>/dev/null || [ $? -eq 1 ]; then   # 1 = file changed while read
    SHA=$(sha256sum "$DIR/$NAME" | cut -d' ' -f1)
    case "$BACKUP_REMOTE" in
        *:*) scp -pq -- "$DIR/$NAME" "$BACKUP_REMOTE/" &&
             OFF=$(ssh -- "${BACKUP_REMOTE%%:*}" sha256sum "${BACKUP_REMOTE#*:}/$NAME" | cut -d' ' -f1) ;;
        *)   cp -p -- "$DIR/$NAME" "$BACKUP_REMOTE/" 2>/dev/null &&
             OFF=$(sha256sum "$BACKUP_REMOTE/$NAME" | cut -d' ' -f1) ;;
    esac || ERR="off-server copy failed"
else
    ERR="tar failed"
fi

[ -n "$SHA" ] && [ "$SHA" = "$OFF" ] && VERIFIED=true || VERIFIED=false
BYTES=$(stat -c %s "$DIR/$NAME" 2>/dev/null || echo 0)
printf '{"started_epoch": %s, "archive": "%s", "bytes": %s, "sha256": "%s", "offsite_sha256": "%s", "verified": %s, "error": "%s"}\n' \
    "$START" "$NAME" "$BYTES" "$SHA" "$OFF" "$VERIFIED" "$ERR" >> "$DIR/h1-log.jsonl"
[ "$VERIFIED" = true ] || { logger -p user.err "p23 nightly backup FAILED: ${ERR:-hash mismatch}" 2>/dev/null; exit 1; }
