# Figma 设计稿 1:1 还原完整操作手册

> 每次 Figma 还原任务前必读，避免重复踩坑。

---

## 一、整体流程概览

```
获取 nodeId → 读取设计上下文 → 截图对比 → 下载图片资源 → 编写代码 → 自测验证 → 提交
```

---

## 二、Step 1：获取节点 ID

### 从 Figma URL 解析
URL 格式：`https://figma.com/design/:fileKey/:fileName?node-id=2-173`

- `node-id=2-173` → nodeId 为 `2:173`（连字符换冒号）
- `fileKey` 为 `/design/` 后面那段（使用 desktop MCP 时不需要）

### 使用 Figma Desktop MCP（推荐）
直接在 Figma 桌面应用中选中节点，工具会自动识别，不需要 URL。

---

## 三、Step 2：读取设计上下文

### 基本调用
```
get_design_context(nodeId: "2:173")
```

### ⚠️ 常见问题 1：返回内容过少/不完整

**原因：** 节点太大，MCP 默认裁剪响应。

**解决：** 加 `forceCode: true` 参数，强制生成完整代码（包含图片 URL 和 CSS 定位）：
```
get_design_context(nodeId: "2:173", forceCode: true)
```

**输出格式：**
```js
const imgXxx = "http://localhost:3845/assets/{hash}.svg"
// + React 代码（含 inset 定位）
```

### ⚠️ 常见问题 2：只拿到了子节点，不知道整体定位

**解决：** 对**页面根节点**（如 `2:173`）调用 `get_design_context(forceCode: true)`，
一次性获得所有子节点的：
- 图片资源 URL（localhost:3845 地址）
- `inset` 百分比定位（top/right/bottom/left）
- 旋转角度、尺寸等

---

## 四、Step 3：截图对比（视觉锚点）

```
get_screenshot(nodeId: "2:173")
```

**作用：** 作为视觉参考，自测时用来对比实现效果。

---

## 五、Step 4：下载图片资源到本地

### ⚠️ 核心注意：Figma MCP 返回的是 localhost 临时地址

图片 URL 格式：`http://localhost:3845/assets/{hash}.svg`

这些 URL **只在 Figma Desktop 运行时有效**，部署后失效，必须下载到项目的 `public/` 目录。

### 下载脚本（PowerShell）

```powershell
# 1. 先创建目录
New-Item -ItemType Directory -Path "D:\naotu\frontend\public\images" -Force

# 2. 批量下载（一条命令一个文件）
Invoke-WebRequest -Uri "http://localhost:3845/assets/{hash}.svg" `
  -OutFile "D:\naotu\frontend\public\images\node-2-174.svg"
```

**命名规则：** `node-{nodeId替换冒号为横线}.svg`
例：nodeId `2:174` → 文件名 `node-2-174.svg`

### 验证下载是否成功

```powershell
Get-ChildItem "D:\naotu\frontend\public\images" | Select-Object Name, Length
```

正常的 SVG 文件大小通常在 100KB~500KB 之间，如果是几字节说明下载失败。

### 在代码中引用

```tsx
<img src="/images/node-2-174.svg" alt="" />
// public/ 目录下的文件，直接用 /images/... 路径访问
```

---

## 六、Step 5：实现定位代码

### Figma `inset` 定位解读

Figma 输出的定位格式是 CSS `inset`，4 个值顺序为：**top right bottom left**

```
inset-[73.47%_66.42%_12.49%_21.67%]
```

等价于：
```css
position: absolute;
top: 73.47%;
right: 66.42%;
bottom: 12.49%;
left: 21.67%;
```

**注意：** 父容器必须是 `position: relative`，否则定位无效。

### 基础模板

```tsx
<main
  className="relative h-screen w-full overflow-hidden flex items-center justify-center"
  style={{
    background: 'linear-gradient(-60.6422deg, rgb(15, 12, 41) 0%, rgb(48, 43, 99) 50%, rgb(36, 36, 62) 100%)'
  }}
>
  {/* 装饰元素 */}
  <div className="absolute" style={{ top: '73.47%', right: '66.42%', bottom: '12.49%', left: '21.67%' }}>
    <img src="/images/node-2-174.svg" alt="" className="w-full h-full object-contain" />
  </div>

  {/* 主内容 */}
  <LoginForm />
</main>
```

### 特殊情况处理

#### 情况 1：元素有旋转（transform: rotate）

```tsx
{/* Figma 输出带 rotation: -114.31deg 时 */}
<div className="absolute flex items-center justify-center"
  style={{ top: '-13.43%', right: '59.28%', bottom: '88.44%', left: '26.67%' }}>
  <img
    src="/images/node-2-2180.svg"
    alt=""
    style={{ transform: 'rotate(-114.31deg)', width: '203.949px', height: '203.949px' }}
  />
</div>
```

#### 情况 2：元素需要超出父容器（overflow 修正）

当 Figma 中某元素有部分在画布外时，会有嵌套的 inset 修正：

```tsx
<div className="absolute" style={{ top: '68.89%', right: '24.52%', bottom: '25.87%', left: '66.3%' }}>
  {/* 内层用负值 inset 撑开溢出区域 */}
  <div className="absolute" style={{ inset: '-19.42% -8.51% -33.55% -8.51%' }}>
    <img src="/images/node-2-7234.svg" alt="" className="w-full h-full object-contain" />
  </div>
</div>
```

#### 情况 3：关闭 Next.js img 元素警告

使用 `<img>` 而不是 `<Image>` 时，在文件顶部加：
```tsx
/* eslint-disable @next/next/no-img-element */
```

---

## 七、Step 6：自测验证

### 方法 1：浏览器控制台检查图片加载

```js
// 在浏览器 DevTools 中运行
const imgs = document.querySelectorAll('img[src*="/images/node-"]');
const result = { total: imgs.length, loaded: 0 };
imgs.forEach(img => { if (img.complete && img.naturalWidth > 0) result.loaded++; });
console.log(result);
// 期望输出: { total: 10, loaded: 10 }
```

### 方法 2：TypeScript 编译检查

```powershell
cd D:\naotu\frontend
npx tsc --noEmit 2>&1 | Select-Object -First 40
```

### 方法 3：截图对比

获取实现截图和 Figma 截图并排比较：
```
get_screenshot(nodeId: "2:173")   // Figma 原稿
take_screenshot()                  // 浏览器实现
```

---

## 八、已踩过的坑（避坑清单）

| 坑 | 原因 | 解决方案 |
|---|---|---|
| `get_design_context` 返回内容太少 | 节点太大被裁剪 | 加 `forceCode: true` |
| 装饰图片显示空白/404 | 用了 Figma localhost URL 直接作为 src | 必须下载到 `public/` 目录 |
| 页面渲染空白（Application error） | 热更新时的瞬态错误 | 手动刷新或重新导航到 `/login` |
| 图片定位不对 | 父容器忘记加 `relative` | 确保父容器有 `position: relative` |
| 图片变形 | 没设置 `object-contain` | 加 `object-contain` 或 `object-cover` |
| Tailwind CSS 不生效 | 缺少 `postcss.config.mjs` | 创建文件：`export default { plugins: { '@tailwindcss/postcss': {} } }` |
| `inset` 负值导致溢出 | Figma 中元素超出画框 | 父层正常定位 + 子层负值 inset 修正 |
| ESLint 报 img 元素警告 | Next.js 推荐用 `<Image>` | 文件顶部加 eslint-disable 注释 |

---

## 九、资源管理规范

```
frontend/
  public/
    images/        ← Figma 装饰图片（SVG）
      node-2-174.svg
      node-2-1177.svg
      ...
    icons/         ← 图标（Google/GitHub/Facebook/eye 等）
      google.svg
      github.svg
      facebook.svg
      eye-hide.svg
```

**命名规则：**
- 装饰图片：`node-{nodeId（冒号换横线）}.svg`
- 图标：语义化命名，如 `eye-hide.svg`、`google.svg`

---

## 十、下次任务快速启动 Checklist

- [ ] 打开 Figma Desktop，选中目标页面根节点
- [ ] `get_design_context(nodeId: "...", forceCode: true)` 一次拿全所有资源 URL + 定位
- [ ] `get_screenshot(nodeId: "...")` 保存视觉参考
- [ ] 将输出中所有 `localhost:3845/assets/` URL 批量下载到 `public/images/`
- [ ] 验证文件大小正常（>100KB）
- [ ] 按 `inset` 值用 `position: absolute` 定位所有装饰元素
- [ ] 注意特殊情况：旋转、overflow 修正、ESLint 警告
- [ ] 浏览器控制台验证图片全部加载
- [ ] `npx tsc --noEmit` 验证无 TS 错误
- [ ] 截图与 Figma 对比，确认 1:1

---

*最后更新：2026-03-03 | 对应任务：Glass Effect Login Page 登录页还原*
