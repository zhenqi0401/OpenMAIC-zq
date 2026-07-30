#!/bin/sh
# Render-service entrypoint.
#
# The service renders UNTRUSTED, uploaded HTML in Chromium. The export ZIP is
# fully self-contained (all assets + vendored GSAP are bundled at build time and
# served to Chromium over loopback), so the render needs ZERO outbound network.
# We enforce that here: block all egress except loopback and replies on already
# established (app-initiated) connections. This is the boundary that stops the
# untrusted page from initiating connections back to the app (e.g. the compose
# `openmaic` service) or anywhere else, even though both share a Docker network.
#
# Requires the container to start as root with CAP_NET_ADMIN (compose:
# `cap_add: [NET_ADMIN]`). We install the rules as root, then drop to the
# unprivileged `render` user for the Node process.
#
# FAIL CLOSED: lockdown is mandatory. A false/invalid configuration or any rule
# installation failure exits non-zero before /health can become available.
set -eu

if [ "${RENDER_EGRESS_LOCKDOWN:-true}" != "true" ]; then
  echo "[render-service] FATAL: RENDER_EGRESS_LOCKDOWN must remain true." >&2
  exit 1
fi

lockdown() {
  # ESTABLISHED,RELATED lets the Hono API respond to the app's inbound requests;
  # loopback lets the producer's file server + Chromium talk locally. Everything
  # else outbound (new connections, DNS to resolve `openmaic`, etc.) is dropped.
  # IPv4 rules must all succeed; IPv6 is best-effort (the stack/table may be
  # absent), but when present we still default-drop so v6 can't be an escape.
  iptables -A OUTPUT -o lo -j ACCEPT || return 1
  iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT || return 1
  iptables -P OUTPUT DROP || return 1
  if command -v ip6tables >/dev/null 2>&1; then
    ip6tables -A OUTPUT -o lo -j ACCEPT || return 1
    ip6tables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT || return 1
    ip6tables -P OUTPUT DROP || return 1
  fi
  return 0
}

if [ "$(id -u)" != "0" ]; then
  echo "[render-service] FATAL: egress lockdown requires root plus CAP_NET_ADMIN." >&2
  exit 1
fi
if ! command -v iptables >/dev/null 2>&1; then
  echo "[render-service] FATAL: iptables is required for mandatory egress lockdown." >&2
  exit 1
fi
if ! lockdown; then
  echo "[render-service] FATAL: mandatory egress lockdown failed; refusing to start." >&2
  exit 1
fi
echo "[render-service] egress lockdown active (outbound blocked except loopback)"

# `setpriv` changes UID/GID but deliberately preserves the caller's environment.
# Because this script starts as root, leaving HOME untouched would run Chromium as
# `render` with HOME=/root. Chromium then cannot initialise its profile/Crashpad
# database and exits before the first captured frame. Keep the browser's home and
# XDG state in the render-owned application directory regardless of base-image or
# Compose defaults.
export HOME=/app
export XDG_CONFIG_HOME=/app/.config
export XDG_CACHE_HOME=/app/.cache

# Drop privileges to the unprivileged render user for Node, Chromium and FFmpeg.
exec setpriv --reuid=render --regid=render --init-groups node_modules/.bin/tsx src/main.ts
