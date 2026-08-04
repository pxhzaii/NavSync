---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: 'ce02b4f3-dc4f-4a3a-beb8-55effebacc52'
  PropagateID: 'ce02b4f3-dc4f-4a3a-beb8-55effebacc52'
  ReservedCode1: '25c16ae9-5379-4edb-a71c-2943fb0488f0'
  ReservedCode2: '25c16ae9-5379-4edb-a71c-2943fb0488f0'
---

## COME COME 

## 介绍
[COME COME](https://dock.xbarry.com) 是一款极简的网址导航工具，旨在为用户提供纯粹、简洁、高效的上网体验。

它充分保留了基础的网址导航功能，同时在设计上力求简洁，让用户能够以最快的速度找到所需的网站。

![index](https://raw.githubusercontent.com/hellojuantu/comecome/refs/heads/main/public/img/index.png?raw=true)

![设置](https://github.com/hellojuantu/comecome/blob/main/public/img/settings.png?raw=true)

## 功能
- 个性主题切换（月白、初春、瀚海、大漠）
- 网址自定义（鼠标拖动排序）
- 搜索引擎自定义（必应、谷歌、百度、搜狗、维基）
- 搜索词自动提示
- 导入、导出数据
- 夜间模式
- 用户配置同步云端（基于 GitHub Gist + Cloudflare Pages Functions）
- 云端同步访问口令保护（Token 存储在 Pages 环境变量中，用户只需输入口令即可同步）

## 云端同步配置

采用 **Cloudflare Pages Functions** 架构，前后端在同一个部署里，一键部署即可。

### 架构说明

```
浏览器 ──口令──▶ Cloudflare Pages ──Token──▶ GitHub Gist API
                   (前端 + 函数)
                   (环境变量存储 Token+口令)
```

- GitHub Token 和访问口令存储在 Pages 环境变量中，前端代码不含机密
- 用户只需输入访问口令即可同步，无需任何额外配置
- 没有口令无法同步，口令错误也无法同步

### 一键部署步骤

1. **将本项目 Fork 到你的 GitHub**

2. **在 Cloudflare Pages 创建项目**
   - 进入 Cloudflare Dashboard → Pages → 创建项目 → 连接到 Git
   - 选择你 Fork 的仓库
   - 构建命令：`npm run build`
   - 输出目录：`dist`

3. **设置环境变量**（Pages Dashboard → Settings → Environment variables）
   - `GITHUB_TOKEN`：你的 GitHub Token（仅需 gist 权限），[点击创建](https://github.com/settings/tokens/new?description=COME%20COME%20Cloud%20Sync&scopes=gist)
   - `CLOUD_PASSWORD`：你的访问口令

4. **部署完成**
   - Pages 会自动构建并部署
   - 前端和后端 API 在同一个域名下，无需额外配置
   - 之后每次 push 代码到 GitHub，Pages 自动重新部署

## 感谢
- 你的使用
- [Moon-Web-Start](https://github.com/jic999/moon-web-start)
- [0x3](https://0x3.com)

## 关于
一直想做一款极简风格的网址导航，本项目在 [Moon-Web-Start](https://github.com/jic999/moon-web-start) 的基础上做了大量的优化和补充，同时借鉴了 [0x3](https://0x3.com) 的风格。

如果您有任何问题、建议或反馈，我非常乐意听取。请随时联系我，感谢您的支持！

> AI生成
