#!/usr/bin/env bash
# CentOS 7.9 host preflight for the isolated OpenMAIC MP4 render service.
set -u

failures=0

section() {
  echo
  echo "[$1]"
}

fail() {
  echo "FAIL: $1" >&2
  failures=$((failures + 1))
}

pass() {
  echo "PASS: $1"
}

section "Host"
uname -r
arch="$(uname -m)"
echo "architecture=$arch"
case "$arch" in
  x86_64|aarch64) pass "supported container architecture ($arch)" ;;
  *) fail "publish a matching render-service image for architecture $arch" ;;
esac
command -v getenforce >/dev/null 2>&1 && echo "selinux=$(getenforce)" || echo "selinux=unavailable"

section "Docker"
if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed"
else
  docker version || fail "docker daemon is not reachable"
  docker compose version || fail "Docker Compose v2 is required"
  info="$(docker info --format '{{json .}}' 2>/dev/null || true)"
  [ -n "$info" ] || fail "docker info failed"
  docker info --format 'root_dir={{.DockerRootDir}} storage={{.Driver}} cgroup_driver={{.CgroupDriver}} cgroup_version={{.CgroupVersion}} memory_limit={{.MemoryLimit}} security={{json .SecurityOptions}}' 2>/dev/null || true
  storage="$(docker info --format '{{.Driver}}' 2>/dev/null || true)"
  [ "$storage" = "overlay2" ] && pass "overlay2 storage driver" || fail "overlay2 is required (found: ${storage:-unknown})"
  memory_limit="$(docker info --format '{{.MemoryLimit}}' 2>/dev/null || true)"
  [ "$memory_limit" = "true" ] && pass "container memory limits available" || fail "container memory limits are unavailable"
  security="$(docker info --format '{{json .SecurityOptions}}' 2>/dev/null || true)"
  echo "$security" | grep -q 'rootless' && fail "rootful Docker is required" || pass "Docker is not rootless"
fi

section "Capacity"
available_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
echo "memory_available_kib=${available_kb:-0}"
[ "${available_kb:-0}" -ge 4194304 ] && pass "at least 4 GiB memory currently available" || fail "at least 4 GiB current free memory is required"
docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
if [ -n "$docker_root" ]; then
  df -Pk "$docker_root"
  available_disk_kb="$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')"
  [ "${available_disk_kb:-0}" -ge 10485760 ] && pass "at least 10 GiB available under Docker root" || fail "Docker root needs at least 10 GiB free"
fi

section "Networking and NET_ADMIN"
docker network inspect bridge >/dev/null 2>&1 && pass "Docker bridge network is available" || fail "Docker bridge network is unavailable"
if command -v lsmod >/dev/null 2>&1; then
  lsmod | grep -E '(^|_)(nf_conntrack|ip_tables|iptable_filter)' || fail "iptables/conntrack kernel modules were not observed"
fi
if docker run --rm --cap-add NET_ADMIN --network none debian:bookworm-slim sh -c 'test -r /proc/net/ip_tables_names' >/dev/null 2>&1; then
  pass "an ephemeral container can receive NET_ADMIN"
else
  fail "NET_ADMIN smoke test failed (the image may need to be pre-pulled on an offline host)"
fi

echo
if [ "$failures" -ne 0 ]; then
  echo "Preflight failed with $failures blocking issue(s). Keep MP4 capability disabled." >&2
  exit 1
fi
echo "Preflight passed. Continue with image pull, Compose validation, egress smoke test and fixed-course acceptance."
