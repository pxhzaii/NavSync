---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '6742a0d9-e307-45f6-a017-db1a34de0a08'
  PropagateID: '6742a0d9-e307-45f6-a017-db1a34de0a08'
  ReservedCode1: '96e8b8c9-1dbf-4155-8d9d-a563f44fb4e2'
  ReservedCode2: '96e8b8c9-1dbf-4155-8d9d-a563f44fb4e2'
---

# NavSync

一款极简的网址导航工具，支持云端同步。基于 [COME COME](https://dock.xbarry.com) 二次开发，使用 Cloudflare Pages Functions + GitHub Gist 实现一键部署的云端同步。

## 介绍

NavSync 旨在为用户提供纯粹、简洁、高效的上网体验。它保留了基础的网址导航功能，同时支持跨设备云端同步，让你在任何设备上都能使用同一套配置。

## 功能

- 个性主题切换（月白、初春、瀚海、大漠）
- 网址自定义（鼠标拖动排序）
- 搜索引擎自定义（百度、必应、谷歌、搜狗、维基百科）
- 搜索词自动提示
- 图标风格切换（鲜艳、朴素、灰白）
- 色彩模式切换（系统自动、夜间模式、日间模式）
- 导入、导出数据
- **云端同步**（基于 GitHub Gist + Cloudflare Pages Functions）
- **访问口令保护**（Token 存储在服务端环境变量中，前端不可见）
- **暴力破解防护**（5 次口令错误后锁定 IP 15 分钟）
- **跨设备自动同步**（换设备后自动查找云端已有配置，无需手动同步 ID）
- **Favicon 懒加载**（图标异步加载、骨架占位、加载失败回退首字母彩色图标）

## 云端同步架构

```
浏览器 ──口令──▶ Cloudflare Pages ──Token──▶ GitHub Gist API
                 (前端 + Functions)
                 (环境变量存储 Token + 口令)
```

- **GitHub Token** 和 **访问口令** 存储在 Cloudflare Pages 环境变量中，前端代码不含任何机密信息
- 用户只需输入访问口令即可同步，无需了解 Token 等技术细节
- 没有口令无法同步，口令错误也无法同步
- 所有 API 端点共用同一套限流机制（按 IP 计数，5 次失败锁定 15 分钟）
- 前后端在同一个 Cloudflare Pages 部署中，无需单独部署 Worker

## 一键部署

### 前置条件

- 一个 GitHub 账号
- 一个 Cloudflare 账号（免费即可）

### 第一步：Fork 仓库

点击 GitHub 仓库右上角的 **Fork** 按钮，将项目复制到你的账号下。

> 仓库地址：[pxhzaii/NavSync](https://github.com/pxhzaii/NavSync)

### 第二步：获取 GitHub Token

GitHub Token 用于后端代你操作 Gist（创建、读取、更新）。**仅需 `gist` 权限**，不需要其他权限。

1. 打开 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 填写以下信息：
   - **Note**（备注）：随便写，如 `NavSync Cloud Sync`
   - **Expiration**（有效期）：按需选择
   - **Scopes**（权限）：**只勾选 `gist`**，其他都不勾
4. 点击页面底部的 **Generate token**
5. 复制生成的 Token（格式类似 `ghp_xxxxxxxxxxxx`），**页面关闭后无法再看到**

> 也可以直接点击这个快捷链接，会自动帮你选好 `gist` 权限：
> [创建 Token（预设 gist 权限）](https://github.com/settings/tokens/new?description=NavSync%20Cloud%20Sync&scopes=gist)

### 第三步：在 Cloudflare Pages 部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → 点击 **Create** → 选择 **Pages** → 选择 **Connect to Git**
3. 注意是 Pages，不是 Workers。页面底部有一行小字链接，点击切换到 Pages。
4. 授权 Cloudflare 访问你的 GitHub，选择你 Fork 的 `NavSync` 仓库
5. 填写构建设置：
   - **Framework preset** 框架预设：`Vue`
   - **Build command** 构建命令：`npm run build`
   - **Build output directory** 构建输出目录：`dist`
6. 展开底部的 **Environment variables** 环境变量（高级），添加以下两个变量：

   | 变量名 | 说明 | 示例值 |
   | --- | --- | --- |
   | `GITHUB_TOKEN` | 第二步获取的 GitHub Token | `ghp_xxxxxxxxxxxx` |
   | `CLOUD_PASSWORD` | 自定义一个访问口令，同步时需要 | `你的同步密码，建议复杂点` |

7. 点击 **Save and Deploy** 保存并部署

### 第四步：等待部署完成

Cloudflare 会自动拉取代码、安装依赖、构建并部署。通常 2-3 分钟内完成。

部署成功后，你会得到一个 `https://your-project.pages.dev` 的地址。也可以在 Pages 项目的 **Custom domains** 中绑定自己的域名。

### 第五步：开始使用

1. 打开你的网站地址
2. 进入设置 → 云端同步，点击「连接云端同步」
3. 输入你设置的访问口令（`CLOUD_PASSWORD`），点击验证
4. 验证通过后点击「上传到云端」即可同步配置
5. 换设备时，重复上述步骤后点击「从云端拉取」，会自动查找并下载你之前上传的配置

> 如果未设置 `CLOUD_PASSWORD` 环境变量，则无需口令即可同步（不推荐，任何人都能操作）。
> 连续 5 次口令错误后，该 IP 将被锁定 15 分钟。

## 关键环境变量

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 是 | GitHub Personal Access Token，仅需要 `gist` 权限 |
| `CLOUD_PASSWORD` | 否 | 访问口令。留空则不启用口令保护（任何人都能同步） |

> **安全提示**：这两个变量只需在 Cloudflare Pages Dashboard 中设置，**不要**写在代码或 `.env` 文件中。`.env.example` 仅供参考。
>
> **限流机制**：所有需要口令校验的 API 端点共用同一套 IP 限流，5 分钟内失败 5 次即锁定 15 分钟，锁定期间拒绝所有请求。
> 注意：限流基于 Cloudflare 隔离实例的内存计数，同一 IP 命中不同实例时计数可能不连续（非安全性场景足够，高安全需求建议绑定 KV 做持久化计数）。

## API 端点

部署后自动提供以下 API（与前端同域，无需额外配置）：

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/status` | GET | 查询服务状态（是否启用口令模式） |
| `/api/verify-password` | POST | 验证访问口令 |
| `/api/find-gist` | GET | 查找当前用户已有的配置 Gist（跨设备同步用） |
| `/api/upload` | POST | 上传配置到云端 Gist |
| `/api/download` | GET | 从云端 Gist 下载配置 |
| `/api/user` | GET | 获取 GitHub 用户信息（验证 Token 有效性） |

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

本地开发时如需测试云端同步功能，在项目根目录创建 `.dev.vars` 文件（已在 `.gitignore` 中排除）：

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
CLOUD_PASSWORD=your-password
```

## 更新

当上游仓库有更新时，同步到你 Fork 的仓库：

```bash
# 添加上游仓库（只需一次）
git remote add upstream https://github.com/pxhzaii/NavSync.git

# 拉取并合并上游更新
git fetch upstream
git merge upstream/main

# 推送到你的仓库
git push origin main
```

推送后 Cloudflare Pages 会自动重新部署。

## 自定义修改

| 想改什么 | 文件位置 | 说明 |
| --- | --- | --- |
| 浏览器标签图标 | `public/favicon.png` | 替换图片文件即可，建议 32x32 或 64x64 PNG |
| 页面头部 Logo | `public/favicon.png` | 与标签图标共用同一文件，修改同上 |
| 网站标题 | `index.html` | 修改 `<title>` 标签内容 |
| 默认搜索引擎 | `src/utils/types/search.ts` + `src/preset.json` | 列表顺序和 `preset.json` 中 `settings.search` 字段 |

## 感谢

- [COME COME](https://dock.xbarry.com) - 原项目
- [Moon-Web-Start](https://github.com/jic999/moon-web-start) - 基础框架
- [0x3](https://0x3.com) - 设计灵感

## 关于

本项目在 [Moon-Web-Start](https://github.com/jic999/moon-web-start) 的基础上做了大量的优化和补充，同时借鉴了 [0x3](https://0x3.com) 的风格，并增加了 Cloudflare Pages Functions 云端同步功能。

如果您有任何问题、建议或反馈，欢迎提 Issue。

> AI生成