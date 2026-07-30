# @openmaic/render-service

OpenMAIC 管理员无字幕 MP4 导出的隔离渲染服务。

浏览器先把筛选后的 slide 编译为自包含 Hyperframes ZIP，其中包含
`index.html`、无字幕 VideoTimeline manifest、slide PNG、TTS、内嵌视频和
vendored GSAP。服务在 Node 22 容器中使用 Headless Chromium 逐帧渲染，再由
FFmpeg 编码。渲染期间不需要、也不允许访问应用、内网、CDN 或互联网。

这是可选能力：主应用不依赖它启动。未配置、未启动或不健康时 capability API
返回 `enabled: false`，管理员界面禁用“导出 MP4”；不会向用户提供内部 ZIP
下载降级。

## 固定合同

- 输出仅支持 `1920×1080 / 30fps / standard / mp4`；服务会拒绝其他
  `fps`、`quality` 或 `format`。
- ZIP 和 MP4 均不含字幕轨、SRT、VTT、讲解字幕 DOM 或讲解原文。
- 每个任务必须带由 Next.js 管理员会话生成的 `x-openmaic-client` owner。
- 查询、取消和下载只有相同 owner 可访问；owner 不匹配与无效 jobId 都返回
  `404`。
- 当前使用进程内 JobStore、本地 ArtifactStore 和 Docker scratch named volume；
  不使用 PostgreSQL、Redis、对象存储，也不在重启后恢复任务。
- 完成产物保留 30 分钟；服务启动时清理异常退出遗留的 scratch 目录。

## HTTP API

| Method + path | Purpose |
| --- | --- |
| `POST /render` | multipart `project` ZIP + 固定参数，返回 `202 { jobId }` |
| `GET /render/:jobId` | 返回状态、进度、阶段和帧数 |
| `DELETE /render/:jobId` | 取消 queued/running 任务 |
| `GET /render/:jobId/download` | `succeeded` 后流式返回 `video/mp4` |
| `GET /health` | 返回 `{ ok: true }` |

任务状态为 `queued | running | succeeded | failed | cancelled`，`progress` 范围为
`0..1`。

## 默认资源与安全限制

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `9000` | 监听端口 |
| `RENDER_MAX_CONCURRENCY` | `1` | 同时渲染任务数 |
| `RENDER_MAX_CONCURRENT_EXTRACTIONS` | `1` | 同时缓冲并解压的上传数 |
| `RENDER_MAX_JOBS_PER_USER` | `1` | 每个已认证 owner 的活动任务数；不能设为 0 关闭 |
| `RENDER_MAX_QUEUE` | `5` | reserved + queued + running 总上限 |
| `RENDER_JOB_TTL_MS` | `1800000` | 终态任务和产物保留 30 分钟 |
| `RENDER_JOB_DEADLINE_MS` | `2700000` | 单任务 45 分钟硬截止时间 |
| `RENDER_MAX_UPLOAD_BYTES` | `314572800` | multipart 实际流字节上限 300 MiB |
| `RENDER_MAX_ENTRIES` | `5000` | ZIP entry 数上限 |
| `RENDER_MAX_ENTRY_BYTES` | `209715200` | 单 entry 展开上限 200 MiB |
| `RENDER_MAX_EXPANDED_BYTES` | `536870912` | 总展开上限 512 MiB |
| `RENDER_MAX_COMPRESSION_RATIO` | `200` | 单 entry 最大展开/压缩比 |
| `RENDER_EGRESS_LOCKDOWN` | `true` | 必须为 true；false 会拒绝启动，不能绕过封锁 |
| `PRODUCER_TMP_PROJECT_DIR` | `/tmp/openmaic-renders` | 临时工程与 MP4 目录 |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | 镜像内 Chromium |
| `HOME` | `/app` | 降权后 Node/Chromium 使用的可写用户主目录 |
| `XDG_CONFIG_HOME` | `/app/.config` | Chromium 的可写配置目录 |
| `XDG_CACHE_HOME` | `/app/.cache` | Chromium/Puppeteer 的可写缓存目录 |

ZIP 在解压前检查压缩体积、entry 数、单文件与总展开大小、压缩比、NUL、绝对
路径、Windows drive path、`..`、目标目录逃逸和 Unix symlink。ZIP64 在当前
300 MiB 合同内没有必要，因此拒绝处理。

## 强制出站封锁

上传的 HTML 按不可信代码处理。容器必须以 root 加 `CAP_NET_ADMIN` 启动，
entrypoint 在容器自己的网络命名空间内安装 OUTPUT 规则：

1. 允许 loopback；
2. 允许 `ESTABLISHED,RELATED` 响应流量；
3. 拒绝其他新建 IPv4/IPv6 出站连接；
4. 成功后降权为普通 `render` 用户启动 Node、Chromium 和 FFmpeg。

缺少 root、iptables、conntrack 或 NET_ADMIN，或任一规则失败时，容器立即退出，
`/health` 不会成功。禁止使用 `privileged: true`，也禁止用
`RENDER_EGRESS_LOCKDOWN=false` 绕过。Compose 中 render 网络为
`internal: true`，服务不映射宿主机端口；只有 app 主动连接服务，服务只能返回该
已建立连接的响应。

## 开发与验证

开发环境按 profile 启动，避免日常开发自动拉起 Chromium 容器：

```bash
docker compose -f docker-compose.dev.yml --profile video-export up --build
```

独立工程检查：

```bash
npm --prefix render-service ci
npm --prefix render-service run typecheck
npm --prefix render-service test
```

构建镜像后验证强制封锁：

```bash
render-service/scripts/egress-smoke.sh yuanwo-render-service:mp4-test
```

## CentOS 7.9 部署

不要在 CentOS 7 服务器现场构建 Chromium 镜像。应在 CI 或受支持的现代 Linux
构建机上构建并推送 `linux/amd64`（或目标架构）镜像，然后在服务器 pull。

部署前执行：

```bash
scripts/render-host-preflight.sh
```

必须满足 rootful Docker、Compose v2、overlay2、memory limit、NET_ADMIN、
iptables/conntrack、至少 4 GiB 当前可分配内存和 Docker 数据目录至少 10 GiB
空闲空间。失败时保持 MP4 capability 关闭；不能改用 privileged 或关闭封锁。
部署后还需在目标机验证 Compose、health、egress、SELinux AVC、Docker stats、
OOM/重启、scratch 和日志轮转，并用固定课程通过 `ffprobe` 验收
1920×1080、30fps、MP4 及预期音频流。

宿主系统升级或把服务迁移到受支持的独立 Linux 主机属于后续运维项。

[`@hyperframes/producer`]: https://www.npmjs.com/package/@hyperframes/producer
