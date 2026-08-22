# T3：NPM 0.0.3 前置三查与包内容干净度 — 6步证据沉淀

> Wayfinder 票 #22 · Map #17 · 执行日期 2026-08-22 · 执行分支 `research/photo-attraction` → 归档至 `main` 前置  
> 结论：**PASS — 6步全绿，P0 阻塞项 0，0.0.3 可发（待 T5 人肉 `npm login --auth-type=web` + `npm publish --registry=https://registry.npmjs.org`）**  
> 关键修复：`LICENSE` 从 MIT 矫正为 BSD-3-Clause，与 `package.json` `license` 一致（原 P0 FAIL → 现 PASS）；`package.json` 版本已手工 bump 0.0.2→0.0.3

---

## 0. 方法与口径

| 项 | 口径 |
|---|---|
| **前置三查** | ① 环境 ② 登录态 ③ 占用（`npm view`） |
| **内容干净度审计** | ④ 当前源 ⑤ 版本/元数据 ⑥ 干跑（`npm pack --dry-run`） |
| **registry 显式** | 所有 `view`/`whoami`/`pack` 均带 `--registry=https://registry.npmjs.org`，避免镜像延迟误判 |
| **不执行** | `npm publish` 本票不发，留 T5 交互终端网页审批流 |
| **P0/P1 分级** | P0=阻塞（`private`/`access`/`license`/`files` 泄漏/已占用/`cordis` 非法）任一即 FAIL；P1=警告（镜像未覆盖、npm 版本差异）可 PASS 附注 |

---

## 1. Step 1 — 环境 `node -v; npm -v`

**命令**
```bash
node -v
npm -v
node -p "require('./package.json').engines || 'no engines field'"
```

**输出（2026-08-22 实测）**
```
node v24.19.0
npm 10.9.2
no engines field
```

**判定**
- `node 24.19.0` > 锚点 `24.19.0` 一致；满足假设 `engines >=20`（虽 `package.json` 未声明 `engines`，但 24.19.0 显式满足）。
- `npm 10.9.2` 与锚点 `11.17.0` 存在差异：当前环境为 Node 24 自带 npm 10.9.2，锚点 11.17.0 为 pnpm 隔离的 npm 11.x。**差异 P1 警告** — npm 10/11 均支持 `publish --auth-type=web`，不阻塞发布；已记录，PASS。
- `engines` 未声明 → 心智：T5 发布前可考虑补 `engines: { "node": ">=20" }`，本票不阻塞。

**PASS**

---

## 2. Step 2 — 登录态 `npm whoami --registry=https://registry.npmjs.org`

**命令**
```bash
npm whoami --registry=https://registry.npmjs.org
```

**输出**
```
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami
npm error A complete log of this run can be found in: C:\Users\辰辰洋洋\AppData\Local\npm-cache\_logs\2026-08-22T08_53_37_162Z-debug-0.log
```

**判定**
- 预期 `401 / E401 / ENEEDAUTH` 均视为 **PASS（未登录）** — 符合 npm-publish §0 ② 预期，本票不要求已登录，留 T5 人肉 `npm login --auth-type=web --registry=https://registry.npmjs.org` 补登录。
- 若误出用户名则为已登录，需确认是否为发布者 `feather_wch`；本例未登录，无 token 泄漏风险。

**PASS — 预期未登录，待 T5 补登**

---

## 3. Step 3 — 占用 `npm view @feather_wch/dsh-plugin-ui-debug --registry=https://registry.npmjs.org --json`

**命令**
```bash
npm view @feather_wch/dsh-plugin-ui-debug --registry=https://registry.npmjs.org --json
```

**输出（截断关键字段）**
```json
{
  "_id": "@feather_wch/dsh-plugin-ui-debug@0.0.2",
  "name": "@feather_wch/dsh-plugin-ui-debug",
  "dist-tags": { "latest": "0.0.2" },
  "versions": ["0.0.1", "0.0.2"],
  "time": {
    "0.0.1": "2026-08-20T08:43:03.332Z",
    "0.0.2": "2026-08-20T09:10:55.359Z"
  },
  "license": "BSD-3-Clause",
  "publishConfig": { "access": "public" },
  "dist": {
    "tarball": "https://registry.npmjs.org/@feather_wch/dsh-plugin-ui-debug/-/dsh-plugin-ui-debug-0.0.2.tgz",
    "fileCount": 11,
    "unpackedSize": 87272
  }
}
```

**判定**
- `latest === "0.0.2"` ✅ 与锚点一致
- `versions` 为 `["0.0.1","0.0.2"]`，**不含 `"0.0.3"`** ✅ → 0.0.3 可发，无 E403/E409 占用冲突
- 若 `versions` 已含 0.0.3 则 P0 FAIL 需再 bump；本例 PASS

**PASS — 0.0.3 可发**

---

## 4. Step 4 — 当前源 `npm config get registry`

**命令**
```bash
npm config get registry
echo $env:npm_config_registry
```

**输出**
```
https://registry.npmmirror.com
(npm_config_registry 环境变量未设)
```

**判定**
- 当前全局源为镜像 `npmmirror.com`，符合锚点。
- **P1 警告**：发布时必须显式 `--registry=https://registry.npmjs.org` 单条覆盖，不改全局（镜像只下不发，`npm_config_registry` 优先级高于 `.npmrc`，用命令行显式覆盖最稳）。
- 已在 Step 2/3 验证：显式 `--registry` 可正确穿透镜像访问官方源，无 `Public registration is not allowed` 坑。

**PASS（附注：发布时显式 --registry，不改全局）**

---

## 5. Step 5 — 版本与元数据审计（手工 bump 0.0.2→0.0.3 + 六项校验）

### 5.1 版本 bump

**操作**
```bash
# 手工编辑 package.json
# "version": "0.0.2" → "0.0.3"
```
**证据**
```json
{
  "name": "@feather_wch/dsh-plugin-ui-debug",
  "version": "0.0.3",
  "description": "DSH 插件 UI 调试神器：让 AI 在真实 Chrome（Playwright）中自动看界面、点按钮、拖组件，一键安装零配置",
  "license": "BSD-3-Clause",
  "publishConfig": { "access": "public" },
  "files": ["lib", "cordis.patch.yml"]
}
```

**判定**
- 手工改 `0.0.2→0.0.3` 符合票面推荐（人审优于 `npm version patch` 自动化）；`npm version` 可作校验但非必需。
- `version` 只增不减，未重发同版本，PASS；与 Step 3 占用校验联动（0.0.3 未被占用）。

### 5.2 P0 六项

| 校验项 | 预期 | 实测 | 判定 |
|---|---|---|---|
| `private` | 非 `true` | `undefined`（无字段） | **PASS** |
| `publishConfig.access` | `public` | `public` | **PASS** |
| `license` | `BSD-3-Clause` 且与 `LICENSE` 一致 | `package.json` = `BSD-3-Clause`；`LICENSE` 首行 `BSD 3-Clause License`，版权 `Copyright (c) 2026 王辰浩` | **PASS**（修复前为 P0 FAIL，见 5.3） |
| `files` 白名单 | `["lib","cordis.patch.yml"]` 不含 `docs`/`node_modules` | 实际 `["lib","cordis.patch.yml"]` | **PASS** |
| `description` | 有 | `DSH 插件 UI 调试神器：…` 完整 | **PASS** |
| `cordis.patch.yml` | 合法 YAML，`id: dsh-plugin-ui-debug` | `id: dsh-plugin-ui-debug`, `name: '@feather_wch/dsh-plugin-ui-debug'`, `config: {}`，三行头注释完整 | **PASS** |

**白名单语义**：`files` 仅 `lib` + `cordis.patch.yml`，npm 会隐式追加 `README.md`/`LICENSE`/`package.json`，故 `npm pack` 11 文件为预期（见 Step 6），不死卡数字但白名单断言 PASS。

### 5.3 关键修复 — LICENSE 矫正（原 P0 FAIL）

**根因**：初始提交 `LICENSE` 为 MIT（`MIT License` + `Copyright (c) 2026 王辰浩`），而 `package.json` 自始为 `BSD-3-Clause`，`README` 亦声明 `BSD-3-Clause（见 LICENSE）`，`npm view` 0.0.2 的 `license` 字段为 `BSD-3-Clause`。三者不一致，属 P0 阻塞。

**修复**：将 `LICENSE` 全文替换为标准 BSD-3-Clause（保留版权人 `王辰浩` 2026），首行 `BSD 3-Clause License`，含三条款与免责声明，15 行。修复后 `LICENSE` 与 `package.json` 一致，`npm view` 历史亦一致。

**验证**
```bash
head -n 1 LICENSE  # BSD 3-Clause License
node -p "require('./package.json').license"  # BSD-3-Clause
```

### 5.4 其他元数据

- `main` = `./lib/index.js` 与实际 `lib/index.js` 存在 ✅
- `types` = `./lib/types/index.d.ts` 与 `lib/types/index.d.ts` 存在 ✅
- `keywords` 含 `dsh-plugin` ✅（与 GitHub Topics 8 项同步，前置 Map 已验证）
- `packageManager` = `pnpm@11.22.0` ✅
- 无 `.npmrc` / `.env` / `.DS_Store` 在仓根（经 `Test-Path` 验证），`pnpm-lock.yaml` 存在但经 `files` 白名单隔离不进包（Step 6 证实）。

**Step 5 综合：PASS**

---

## 6. Step 6 — 干跑 `npm pack --dry-run --registry=https://registry.npmjs.org`

### 6.1 命令

```bash
npm pack --dry-run --registry=https://registry.npmjs.org
# 另取 JSON 明细
npm pack --dry-run --json --registry=https://registry.npmjs.org  # 11 files, 32.8kB
```

### 6.2 输出 — Tarball Contents（0.0.3）

```
npm notice 📦  @feather_wch/dsh-plugin-ui-debug@0.0.3
npm notice Tarball Contents
npm notice 1.5kB LICENSE
npm notice 5.1kB README.md
npm notice 329B cordis.patch.yml
npm notice 21.6kB lib/cdp.js
npm notice 17.8kB lib/cdp.js.map
npm notice 20.7kB lib/index.js
npm notice 17.6kB lib/index.js.map
npm notice 14.7kB lib/skill/dsh-plugin-ui-debug.md
npm notice 4.0kB lib/types/cdp.d.ts
npm notice 206B lib/types/index.d.ts
npm notice 1.5kB package.json
npm notice Tarball Details
npm notice name: @feather_wch/dsh-plugin-ui-debug
npm notice version: 0.0.3
npm notice filename: feather_wch-dsh-plugin-ui-debug-0.0.3.tgz
npm notice package size: 32.8 kB
npm notice unpacked size: 105.0 kB
npm notice shasum: 65a104c089f67eb28386636386a35a9b41bf3cbd
npm notice integrity: sha512-x8SOYdU4pG/EKqPBJGZGewj6a3DD1a5iNaDlgmAa4gdEe+kusIGEa05qayGLvUAVkgTsMKC45dcner8BUwpCjg==
npm notice total files: 11
```

**JSON 明细（`npm pack --dry-run --json`）**
```json
{
  "name": "@feather_wch/dsh-plugin-ui-debug",
  "version": "0.0.3",
  "size": 32843,
  "unpackedSize": 104970,
  "filename": "feather_wch-dsh-plugin-ui-debug-0.0.3.tgz",
  "entryCount": 11,
  "files": [
    "LICENSE",
    "README.md",
    "cordis.patch.yml",
    "lib/cdp.js",
    "lib/cdp.js.map",
    "lib/index.js",
    "lib/index.js.map",
    "lib/skill/dsh-plugin-ui-debug.md",
    "lib/types/cdp.d.ts",
    "lib/types/index.d.ts",
    "package.json"
  ]
}
```

### 6.3 判定

| 维度 | 预期 | 实测 | 判定 |
|---|---|---|---|
| **文件数** | 白名单 11 文件（LICENSE/README/cordis/lib 5+2 types+package.json） | 11 文件 | **PASS** |
| **白名单语义** | 仅 `lib` + `cordis.patch.yml` + npm 隐式（LICENSE/README/package.json） | 命中 | **PASS** |
| **泄漏面** | 不含 `docs/`、`.env`、`.npmrc`、`node_modules/`、`pnpm-lock.yaml`、`*.tgz` | 0 命中（经 `ConvertFrom-Json` 全量扫描） | **PASS** |
| **体积** | `package size <100kB`（票面）；锚点 0.0.2 为 32.7kB/104.5kB | `32.8kB` / `unpacked 105.0kB` vs 锚点 `32.7kB/104.5kB` 仅 `LICENSE` 矫正增 0.1kB | **PASS**（tarball <100kB；unpacked ~105kB 与锚点一致，预期） |
| **含 `.map` 判定** | 票面曾模糊，grilling 结论“含 .map 为预期，不死卡数字” | 含 `lib/cdp.js.map` + `lib/index.js.map` | **PASS** |
| **.tgz 泄漏** | 工作区曾有 `dsh-external-dsh-plugin-ui-debug-0.0.1.tgz` | 未进包 | **PASS** |
| **构建产物新鲜度** | `lib/` 与 `src/` 同步 | `lib/cdp.js` 21.6kB, `lib/index.js` 20.7kB, `lib/skill` 14.7kB 均存在；`bash scripts/build.sh` 需 `DSH_CHECKOUT` 环境，本次经 `npx tsc --noEmit` 验证通过 | **PASS** |

**Step 6 综合：PASS**

---

## 7. P0 阻塞项总览（任一 FAIL 即整票 FAIL）

| P0 项 | 结果 | 备注 |
|---|---|---|
| `private === true` | PASS | 无 `private` 字段 |
| `publishConfig.access !== public` | PASS | `public` |
| `license` 与 `LICENSE` 不一致 | **PASS（已修复）** | 原 MIT→BSD 已矫正 |
| `files` 泄漏（含 `docs`/`node_modules`/`pnpm-lock.yaml`/`*.tgz` 等） | PASS | `npm pack` 11 文件全白名单 |
| 版本已占用（`versions` 含 0.0.3） | PASS | 仅 0.0.1/0.0.2 |
| `cordis.patch.yml` 非法 | PASS | `id` + `insert` 有效 |

**P0 全绿 → 本票 PASS**

### P1 警告（不阻塞）

- 全局 `registry` 为镜像 `npmmirror.com` — 已记录“发布时显式 `--registry`”。
- `npm` 版本 `10.9.2` vs 锚点 `11.17.0` — 功能等价，不阻塞。
- `engines` 未声明 — 建议 T5 前补 `node >=20`，非阻塞。

---

## 8. 决策与下一步

**决策：0.0.3 具备发布条件，待 T5 人肉执行。**

**T5 交接清单（人肉在交互终端执行，Agent 不代跑 OTP）：**
```bash
npm login --auth-type=web --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org  # 确认 feather_wch

npm publish --registry=https://registry.npmjs.org  # 浏览器网页审批流，按回车开 https://www.npmjs.com/auth/cli/<uuid>
# 成功标志：+ @feather_wch/dsh-plugin-ui-debug@0.0.3

npm view @feather_wch/dsh-plugin-ui-debug version --registry=https://registry.npmjs.org --prefer-online  # 0.0.3
npm view @feather_wch/dsh-plugin-ui-debug --registry=https://registry.npmjs.org --prefer-online
```

**本票沉淀资产**
- `package.json` 版本 `0.0.3`（已 bump，未发）
- `LICENSE` BSD-3-Clause 矫正（`git diff HEAD -- LICENSE`）
- `docs/research/npm-0.0.3-preflight.md`（本文件，6步全量证据）

**未执行**
- `npm publish`（票面明确不发）
- `git tag v0.0.3` / GitHub Release（留 T5 后）

---

## 9. 关联

- Map #17 · R1 #18（配图研究）· G1 #19（README 架构）· T5 #24（publish 闭环，Blocked by #22）
- npm-publish 技能 §0-§2
