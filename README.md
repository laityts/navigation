```markdown
# 我的导航页 - Cloudflare Workers 版

一个轻量、美观、可自定义的个人导航页面，使用 **Cloudflare Workers** + **KV** 实现无服务器部署，支持管理员密码保护、动态分类管理、网站添加/删除等功能。

---

## 功能特性

- **响应式设计**：完美适配 PC、平板、手机
- **动态导航**：分类 + 网站卡片，支持 Font Awesome 图标
- **管理员面板**：密码登录，管理分类与网站
- **数据持久化**：使用 Cloudflare KV 存储分类、网站、密码
- **安全登录**：会话 Cookie + HttpOnly，防止 XSS
- **首次使用自动设置密码**
- **修改密码功能**
- **一键保存、退出登录**
- **加载失败时显示默认示例数据**
- **纯前端交互 + 后端 API，无需数据库**

---

## 技术栈

- **Cloudflare Workers**
- **Cloudflare KV**
- **HTML + CSS + Vanilla JS**
- **Font Awesome 6**
- **无后端框架，极简轻量**

---

## 部署步骤

### 1. 创建 Cloudflare KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **KV**
3. 点击 **Create a namespace**
4. 命名例如：`NAVIGATION_STORE`
5. 记录 **Namespace ID**

### 2. 创建 Worker

1. 进入 **Workers & Pages** → **Create application** → **Workers**
2. 选择 **HTTP handler**
3. 命名你的 Worker（如 `my-navigation`）
4. 点击 **Deploy**（先空部署）

### 3. 绑定 KV

1. 进入 Worker 设置 → **Variables** → **KV Namespace Bindings**
2. 添加绑定：
   - **Variable name**: `NAVIGATION_STORE`
   - **KV namespace**: 选择你创建的 `NAVIGATION_STORE`

### 4. 替换代码

1. 进入 Worker → **Edit code**
2. **删除默认代码**，粘贴本项目完整代码（包含 `addEventListener` 到最后）

### 5. 部署

点击 **Save and Deploy**

---

## 使用说明

### 首次访问

1. 打开你的 Worker 域名（如 `https://my-navigation.your-worker.workers.dev`）
2. 点击右下角 **管理面板**
3. 首次无密码，直接输入你想设置的 **管理员密码** → 登录
4. 进入管理面板开始添加分类和网站

### 管理功能

| 功能 | 操作 |
|------|------|
| 添加分类 | 输入名称 → 点击“添加分类” |
| 添加网站 | 填写名称、URL、选择分类、可选图标 → 添加 |
| 删除分类 | 点击分类标签的 ×（会删除该分类下所有网站） |
| 删除网站 | 点击网站卡片右侧“删除” |
| 保存更改 | 点击“保存所有更改” |
| 修改密码 | 切换到“修改密码”标签页 |
| 退出登录 | 点击右上角“退出登录” |

---

## 数据结构说明

### KV 存储键值

| Key | Value |
|-----|-------|
| `admin_password` | 管理员密码（明文，建议强密码） |
| `admin_session` | 当前会话令牌 |
| `categories` | `["分类1", "分类2"]` |
| `sites` | `[{"name": "...", "url": "...", "category": "...", "icon": "..."}]` |

---

## 自定义建议

### 修改标题和描述

编辑 `generateHomePage()` 中的：

```html
<h1>我的导航页</h1>
<p>快速访问您最常用的网站，提高工作效率</p>
```

### 更换背景渐变

修改 CSS 中的 `--gradient` 变量：

```css
--gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### 默认图标

未填写图标时使用：`<i class="fas fa-globe"></i>`

---

## 安全提示

- 密码存储为**明文**（KV 不支持加密），请使用强密码
- 会话仅 1 小时有效（`Max-Age=3600`）
- 建议绑定自定义域名 + HTTPS
- 生产环境可升级为 JWT + 加密存储

---

## 常见问题

### Q: 登录后刷新页面又要重新登录？

**A**: 确保 Cookie 未被浏览器阻止，检查是否启用了“阻止第三方 Cookie”

### Q: 数据没保存？

**A**: 检查 KV 绑定名称是否为 `NAVIGATION_STORE`（大小写敏感）

### Q: 图标不显示？

**A**: 使用 Font Awesome 6 的类名，如 `fas fa-github`，不要加 `<i></i>`

---

## 示例截图

（可自行部署后截图）

---

## 开源协议

MIT License © 2025

---
