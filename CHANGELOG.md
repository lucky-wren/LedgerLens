# 更新记录

## 1.2.1 · 2026-11-09 · 修复「部署包里没有 README」

用户反馈云端部署包解压后只有运行文件、没有任何说明文档。**这是交付流程的漏洞，不是打开方式问题。**

- 根因：`dist/` 只放站点运行文件，`README.md` / `CHANGELOG.md` / `docs/` 都在项目根与 docs 目录；构建脚本从没把它们带进产物，而部署包是手工 `zip dist/`，于是漏得干干净净。
- 新增 `public/README.md`（**部署专用说明**：三步上线、三种部署方式、目录清单与可否删除、发新版、常见问题、完整文档索引、边界），构建时注入版本号 / 站点名 / 构建时间写入 `dist/README.md`。
- `build.mjs` 构建期同时把项目根 `CHANGELOG.md` 原样复制进 `dist/`（单一来源，不维护两份）；并加**交付闸门自检**：缺 README / CHANGELOG、占位符没替换、章节不全，直接构建失败。
- 新增 `pack.mjs` / `npm run pack`：一条命令生成两个 zip，写出前强制校验部署包 12 个必需文件与 README 五个章节。以后不再手敲 zip 命令。
- ZIP 写入补上 **UTF-8 文件名标志（bit 11）和真实 DOS 时间戳**：包里的中文文件名在 Windows 解压工具里不再乱码，也不再显示 1980 年。
- `tests/e2e.mjs` 新增两条断言：`dist` 必须自带 README / CHANGELOG、部署后可通过 HTTP 访问说明文件。

### 打包时顺带查出的一个真 bug（影响导出的 Excel）

用 Python `zipfile` 复核新包时报 `Bad CRC-32`。根因在 `LL.zipStore` 的 deflate 路径：压缩后传进去的 `data` 已是压缩字节，但 **CRC 按压缩后的数据算、uncompressed size 也写成压缩后长度**。项目自己的 `LL.unzip` 不校验这两项，所以浏览器里导出、自己读回都正常，**用 WPS / Excel / Python 打开压缩版 `.xlsx` 却会报文件损坏**——此前只有 stored 版被 openpyxl 验过，没覆盖到 UI 实际使用的异步压缩版。

- `zipStore` 改为接受 `crc`（原始数据的 CRC）与 `size`（原始长度）；`LL.zipStoreAsync` 压缩时把这两个值一起传下去。
- 新增 `tests/zip-integrity.mjs`（Node `zlib` 解析 central directory，逐条核对 CRC / 原始大小 / UTF-8 标志），**单测与 `pack.mjs` 写盘前共用**，这类错误以后不会再溜到交付物里。
- `tests/verify_office.py` 增加用 openpyxl 打开**压缩版** xlsx；新增 `tests/verify_delivery.py` 与 `npm run release`（构建 → 打包 → 外部复核一条命令）。
- `pack.mjs` 过滤掉 e2e 往 `screenshots/` 下载的 xlsx/docx/md/html，源码包从 7.1 MB 回到 4.5 MB。

版本 `1.2.0 → 1.2.1`，SW 缓存名随版本失效。除上述 ZIP 写入修正外，应用功能与业务口径**零改动**。

验证：CORE 9/9、导出 5/5、office 第三方库（含压缩版 xlsx）全部通过、E2E 27/27、交付包外部复核全部通过、等价性回归一致。

## 1.2.0 · 2026-11-09 · 导出美化与多格式

针对「导出的表格太丑」「导出报告支持 md / docx / pdf / html」两件事，只改导出层，**业务口径零改动**。

### 新增
- **导出中心**弹窗：表格 2 种 + 报告 4 种共 6 个格式卡片，白话说明、当前分组高亮、显示笔数
- **带样式 `.xlsx`**：15 列逐列宽、首行冻结、自动筛选、深蓝表头白字、斑马纹、细边框、金额千分位右对齐、退款标红、合计行、第二张「这些列什么意思」工作表、横向 A4 铺满一页宽
- **报告 4 格式**：网页 `.html`、Word `.docx`（最小 OOXML + 8 张内嵌 PNG）、Markdown `.md`（纯文字 + 每图一句速览）、PDF（A4 打印版 HTML → 系统打印窗口另存）
- 四种格式共用 `reportModel()`，封面 / KPI / 图表 / 建议 / 口径不会分叉
- ZIP 写入支持 `deflate-raw`（原生 `CompressionStream`，不支持自动回退 stored）：22,938 行从 **25 MB → 1.83 MB**
- 新增 `tests/exports.test.mjs`（5 组）、`tests/verify_office.py`（openpyxl / python-docx 交叉验证）、`docs/账镜v6_导出美化与多格式说明.md`

### 修复
- `download()` 原来给所有非 HTML 文件加 UTF-8 BOM，Markdown 会冒怪字符 → 改成只给 CSV 加
- Word 图片第一版过大（一张占大半页）→ 缩到约 5.5in × 3.1in
- 使用演示第 4 步仍写「会下载一个网页文件」→ 改成「打开导出窗口挑格式」；功能介绍、关于弹窗同步
- XLSX 样式表误用了 Word 的 `w:` 属性前缀 → 改回 SpreadsheetML 的无前缀属性

验证：CORE 9/9、导出 5/5、office 第三方库全部通过、E2E 25/25、等价性回归一致、LibreOffice 实渲染复核。

## 1.1.0 · 2026-11-09 · 版式重排

针对「左边太短，右边太长」重新排版，**业务结果零改动**。

- 左栏 272 → 340 px，`position:sticky` 且占满视口，内部可独立滚动；让开 64 px 吸顶工具栏（`top:76px`）
- 四个问题的导航从结论横幅搬到左栏常驻：横幅变短、左栏变满、顺序更清楚
- 主区限宽 1160 px；≥1360 px 时图表与建议由 2 列改 3 列，趋势图独占整行
- 图表 5 行 → 4 行、建议 5 行 → 3 行、页面总高 5230 → 4557 px（−13%）
- 分区说明收短；窄屏 ≤900 px 恢复堆叠、导航 2×2、顶栏自然换行、提示文案切换
- 新增 `src/styles/04-layout.css`、`tests/layout.mjs`（量化对比 + 6 张截图）
- 修掉模板里重复的 `</head><body>`；修掉吸顶位置被工具栏遮挡导致的导航标题不可见
- 版本升 1.1.0，资源 URL 与 SW 缓存名同步失效旧缓存

验证：CORE 9/9、E2E 19/19、等价性回归全部一致、控制台零报错。详见 `docs/账镜v5_版式重排说明.md`。

## 1.0.0 · 2026-11-09

从已验证的单文件原型工程化为可部署的静态站点。**业务行为零改动**，由 `tests/parity.mjs` 逐项比对保证。

### 新增（工程层）
- 源码按模块拆分：`src/core/` 11 个真 ESM 模块、`src/ui/` 17 个顺序分片、`src/styles/` 3 片 CSS
- `build.mjs`：零依赖构建，产出云端多文件版 + 全内联单文件版 + `VERSION.json`
- `serve.mjs`：零依赖静态预览服务器
- `site.config.json`：站点名、版本、默认币种、主题色统一配置
- PWA：`manifest.webmanifest`、`sw.js`（网络优先 + 缓存回退）、192/512 图标，可安装到桌面、断网可用
- 静态资源带版本查询串，`sw.js` 缓存名随版本失效，避免发布后用户卡在旧页面
- `.github/workflows/deploy.yml`：push 到 main 自动构建、单测、发布 GitHub Pages
- `package.json` 脚本：build / start / dev / test / test:e2e / check；运行时依赖为空

### 新增（测试）
- `tests/core.test.mjs`：9 组 Node 原生单测，CORE 不再依赖浏览器
- `tests/e2e.mjs`：19 项端到端验收（HTTP 静态站 + PWA 注册 + file:// 单文件版）
- `tests/parity.mjs`：原型与构建产物的结论、KPI、建议、明细逐项等价

### 修复（工程化过程中暴露）
- CORE 拆分后跨模块裸调用 `pad` / `mulberry32` 失效 → 统一走 `LL` 命名空间
- 拼接后 `LL` 重复声明 → UI 层不再重复定义
- 内联替换时 `$$` 被 `String.replace` 当作特殊模式吞成 `$` → 改用函数式替换
- 静态预览服务器 `port: 0` 返回的是传入值而非实际端口 → 改读 `server.address().port`

### 沿用（业务层，未改动）
- v2.1：幂等去重、整周环比、币种、紧凑存储与旧格式兼容
- v3：按「老板的四个问题」重排的界面、全站大白话、加深配色、词典与引导
- v4：建议闭环、明细搜索、图表下钻、报告封面、19 项判定标准可调

---

## 原型阶段（本仓库之前）

| 版本 | 内容 |
|---|---|
| v1 | 单文件原型：适配器层思路、统一账目模型、图形化、建议引擎 |
| v2 | XLSX 原生解析、成本 / 毛利、使用演示与功能介绍 |
| v2.1 | 真实公开数据验证后修复 8 处兼容性；幂等去重、整周环比、币种 |
| v3 | 界面按四个问题重做、结论横幅、全站大白话、对比度修复 |
| v4 | 建议闭环 → 明细搜索 → 图表下钻 → 报告封面 → 阈值可调 |
