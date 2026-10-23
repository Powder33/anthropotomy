# 肌理 · Muscle Atlas

面向健身学习的免费交互式 3D 肌肉图谱。45 个中文学习条目对应 127 块真实肌肉网格，附有 201 块骨骼作位置参照。无需账号、数据库、API 密钥或付费服务。

## 功能

- 拖动旋转、缩放、正面 / 背面 / 左右侧视角，点击真实网格识别肌肉。
- 按身体部位筛选，搜索中文名或英文名。
- 查看主要功能、训练动作关联，以及可展开的起点 / 止点。
- 单独观察肌肉，查看浅层遮挡下的深层结构；可切换层次与骨骼参照。
- 在当前浏览器收藏条目；适配电脑、平板和手机。
- 模型无法加载时，文字学习、搜索和收藏仍可使用。

模型聚焦全身主要肌肉，不包括所有肌肉。竖脊肌群、菱形肌、髂腰肌等按学习用途合并为条目；三角肌按前、中、后束分开。没有关节动作动画。起止点和功能为概括，模型基于成人参考解剖，存在体型与配准局限。

## 本地开发

需要 Node.js 22.12+；本云环境使用 Node.js 24.19.0。使用现有检出目录，无需创建 Git worktree。

```sh
cd /workspace/anthropotomy
npm ci
npm run dev -- --port 5173
```

Vite 启动浏览器开发服务。鼠标拖动旋转、滚轮缩放；触屏使用单指旋转、双指缩放。按 `/` 聚焦搜索。左右侧按人体自身区分。收藏仅保存在当前浏览器，不跨设备同步。

模型已随仓库提供，正常开发和构建不需要重新下载。页面启动后从本站加载约 12 MB 压缩模型，运行时不依赖外部模型 CDN。

## 验证与构建

```sh
npm test
npm run build
npm run test:e2e
```

- `npm test` 验证条目与网格一一归属、左右覆盖、模型校验和、索引及坐标有效性。
- `npm run build` 执行 TypeScript 检查并输出 `dist/`，可部署至静态托管服务。
- 浏览器测试使用系统 Chromium，验证实际模型加载、点击识别、拖动、搜索、筛选、深层观察、收藏持久化、键盘标签页、手机布局及加载失败时的可用性。
- 浏览器可执行文件默认 `/usr/bin/chromium`，其他环境用 `CHROMIUM_PATH` 指定。测试自行启动开发服务器，或复用当前 5173 端口的实例。
- 桌面与移动布局由桌面浏览器模拟验证，尚未在真实手机硬件上测试多点触控和性能。

```sh
npm run preview -- --port 4173
```

生产预览使用 `dist/`。静态托管时同时发布整个目录，包括 `models/` 和 `ATTRIBUTION.md`。当前默认部署在站点根路径。

## 免费部署到 GitHub Pages

仓库自带 `.github/workflows/deploy.yml`。在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中，将 **Source** 设为 **GitHub Actions**。

推送到 `main` 后，工作流会安装依赖、验证解剖数据、构建并发布整个静态站点；也可以在 Actions 页面手动运行。项目站点使用 `/anthropotomy/` 路径，工作流已设置相应的构建参数，模型和授权文件会一起发布。

部署成功后的预期地址为 `https://powder33.github.io/anthropotomy/`。以工作流的部署结果为准；仅提交工作流不代表站点已经发布。

本地验证相同的项目路径：

```sh
npm run build -- --base=/anthropotomy/
npm run preview -- --base=/anthropotomy/ --port 4174
```

## 可选：重新生成模型

仅在需要调整学习条目或处理几何时运行：

```sh
npm run models:prepare
npm test
```

使用 Python 3 标准库，从固定 GitHub 修订下载源文件并验证 SHA-256。源文件缓存位于 `/tmp/anthropotomy-sources`，可用 `ANTHROPOTOMY_MODEL_CACHE` 指定其他目录。完整来源、改动与授权见 [public/ATTRIBUTION.md](public/ATTRIBUTION.md)。

模型依照 BodyParts3D 的 CC BY-SA 2.1 Japan 和 Z-Anatomy 的 CC BY-SA 4.0 分别保留授权。应用代码与原创文字为 MIT 授权；模型不适用应用代码的 MIT 授权。
