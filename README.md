# 破界 · 打砖块

> 纯前端 HTML5 Canvas 打砖块 —— 10 关递进 + 2 场 Boss 战；零依赖、零素材，双击即玩，离线可跑。

一个用 Canvas 2D 画出来的打砖块：所有图形都由代码绘制，所有音效都由 WebAudio 实时合成，
不引入任何框架、图片或音频文件。玩网页版不过瘾，就用 Electron 打成 Windows 桌面版。

## 下载 Download

不想装环境、不想敲命令，直接到 [Releases](https://github.com/jiangzhiyuanqian/pojie-breakout/releases/latest) 下载：

| 文件 | 说明 |
| --- | --- |
| `PojieBreakout-v1.0.0-x64.exe` | Windows 10/11 x64 安装包，可选安装目录、创建桌面快捷方式 |
| `PojieBreakout-v1.0.0-x64-portable.exe` | 免安装便携版，下载后双击即玩 |
| `PojieBreakout-v1.0.0-web.html` | 单文件网页版，浏览器直接打开，无需安装 |

> 程序未做代码签名，首次运行若弹出 SmartScreen 提示，点「更多信息」→「仍要运行」即可。

## 游戏画面

```text
  SCORE 000000           LEVEL 3 / 10            LIFE x3
  BEST  12820            DAWN
  ────────────────────────────────────────────────────────────

  ██████████████████████████████████████████████████████████
  ██████  ██████  ██████  ██████  ██████  ██████  ██████  ██
  ██████  ██████        ██████        ██████  ██████  ██████

                          ●
                               ●

                      COMBO x5

  ═══════════════════════════════════════════════════════════
                     ←──── 挡板 ────
```

  鼠标 / ←→ 移动挡板 · 空格 发球·射击 · P 暂停 · M 静音 · R 重开

## 特性 Features

- **10 关 + Boss 战**：10 个手工设计的递进关卡，外加 2 场 Boss 战，血条、多阶段攻击。
- **三档难度**：休闲 / 标准 / 硬核，挡板宽度、球速、初始生命与掉落率随之变化。
- **6 种道具**：宽挡板、窄挡板、多球、激光、减速、加命，掉落即生效，有倒计时与 HUD 提示。
- **连击倍率系统**：连续击砖不断累加连击数，得分倍率随连击提升（`×1 + 0.1 × 连击`），断连即清零。
- **粒子与屏幕震动**：砖块碎裂粒子、撞击震屏、掉落物特效，命中反馈干脆利落。
- **WebAudio 实时合成音效**：音效由振荡器与包络实时合成，连击会随连击数升调，全程无音频素材。
- **无任何外部依赖**：不使用任何第三方库、CDN、图片或字体文件，纯 HTML + CSS + 原生 JS。
- **离线可玩**：断网状态下功能完整，所有进度只存在本机浏览器里。
- **本地存档**：最高分、关卡进度、静音与设置通过 `localStorage` 保存，随时接着玩。

## 操作说明 Controls

| 按键 / 操作 | 作用 |
| --- | --- |
| 鼠标移动 | 左右移动挡板 |
| `←` / `→` 方向键 | 左右移动挡板（与鼠标二选一） |
| `空格` 或 鼠标左键点击 | 发球；持有激光道具时发射激光 |
| `P` | 暂停 / 继续游戏 |
| `M` | 静音 / 取消静音 |
| `R` | 重开当前关卡 |

## 运行方式 Getting Started

### 网页版（免安装）

直接双击 `src/index.html` 即可运行 —— 不需要本地服务器，不需要联网，不需要任何构建步骤。
如果拿到的是单文件版 `dist/破界打砖块.html`，双击它同样可以直接玩（样式与脚本已全部内联）。

### 桌面版（Electron）

```bash
npm install        # 安装依赖（Electron + electron-builder）
npm start          # Electron 开发模式运行，带热重载
npm run build:win  # 产出 Windows 桌面版（安装包 + 便携版 exe）
```

## 构建与发布 Build & Release

| 命令 | 作用 | 产物位置 |
| --- | --- | --- |
| `npm run build:html` | 把 `src/` 里的 CSS 与 JS 内联，生成单文件网页版 | `dist/破界打砖块.html` |
| `npm run build:win` | 用 electron-builder 打包 Windows 桌面版（NSIS 安装包 + 便携版） | `release/`（`*.exe`、`*.blockmap`、`latest.yml`） |

- `dist/` 存放网页与中间产物；`release/` 存放 electron-builder 的最终安装包。
- `.github/workflows/release.yml` 负责自动发布：推送带 `v*` 标签的提交到 `main`，或手动触发
  （`workflow_dispatch`）后，CI 会在 `windows-latest` 上跑 `npm run build:win`，用
  `softprops/action-gh-release@v2` 把 `release/` 下的 exe、blockmap、latest.yml，以及
  `npm run build:html` 产出的单文件 HTML 一并上传为 Release 资产。
- 标签中带 `-`（如 `v1.0.0-beta.1`）时，该次 Release 会被标记为 **Pre-release**。

## 项目结构 Project Structure

```text
破界打砖块/
├─ src/                       # 源码：纯前端，零依赖
│  ├─ index.html              # 页面骨架、HUD / 菜单 DOM、script 加载顺序
│  ├─ styles.css              # 全部样式
│  └─ js/
│     ├─ util.js              # 通用工具：数学、随机、DOM 与存储辅助
│     ├─ audio.js             # WebAudio 实时合成音效（无音频素材）
│     ├─ levels.js            # 10 关 + 2 场 Boss 的关卡数据
│     ├─ storage.js           # 进度、最高分、设置的本地持久化
│     ├─ engine.js            # 游戏循环、碰撞检测、道具、连击
│     ├─ render.js            # Canvas 2D 绘制、粒子、屏幕震动
│     ├─ ui.js                # 菜单 / 设置 / 关卡选择 / 结算等 DOM 层
│     └─ main.js              # 入口：启动主循环、绑定输入
├─ .github/
│  └─ workflows/
│     └─ release.yml          # CI：打 Windows 包并发布 GitHub Release
├─ dist/                      # 构建产物：单文件网页版（*.html）
├─ release/                   # electron-builder 产物：exe / blockmap / latest.yml
├─ package.json               # npm 脚本：start / build:html / build:win
├─ LICENSE                    # MIT
└─ README.md
```

## 开发说明 Development

- **加载方式**：源码是普通 `<script>` 标签引入的**非 ES module** 脚本，在 `src/index.html` 中按
  `util → audio → levels → storage → engine → render → ui → main` 的顺序加载。顺序是有依赖关系的，
  不要随意调整。
- **全局命名空间**：所有模块都挂在全局命名空间 `POJIE` 下，模块之间通过 `POJIE.xxx` 调用，
  不向 `window` 抛散乱的全局变量。
- **入口**：`src/js/main.js` 是入口，负责创建游戏实例、启动主循环并绑定输入事件。
- **调试**：因为是普通 script，用浏览器直接打开 `src/index.html` 就能改即看，无需构建工具。
- **改完记得同步**：修改 `src/` 后重新执行 `npm run build:html` 生成单文件版；发布桌面版前
  先跑一次 `npm run build:win` 确认打包正常。

## 许可证 License

本项目基于 [MIT](LICENSE) 许可证发布。MIT 许可证允许自由使用、复制、修改、合并、发布、
再分发与再许可，但需保留版权声明与许可声明，且软件按“原样”提供、不附带任何担保。

## 作者 Author

- 维护者：jiangzhiyuanqian
- 邮箱：qli80082@gmail.com
