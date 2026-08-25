# prettier-plugin-mp

微信小程序 WXML 和 WXS 文件的 Prettier 格式化插件。

## 安装

```bash
pnpm install -D prettier-plugin-mp
# 或
npm install --save-dev prettier-plugin-mp
```

## 配置

在 `.prettierrc` 中注册插件，并让 Prettier 用 `wxml` 解析器处理 `*.wxml`：

```json
{
  "plugins": ["prettier-plugin-mp"],
  "overrides": [
    {
      "files": "*.wxml",
      "options": {
        "parser": "wxml"
      }
    }
  ]
}
```

## 命令行

```bash
# 格式化所有 WXML 文件
prettier --plugin=prettier-plugin-mp --write "**/*.wxml"

# 格式化单个文件
prettier --plugin=prettier-plugin-mp --write src/pages/index.wxml
```

## 选项

所有选项都写在 `.prettierrc` 的 `overrides[].options` 里。WXML 和 WXS 各自独立。

### WXML

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|-------------|
| `wxmlTabWidth` | `int` | `2` | 缩进空格数。当前版本暂不生效，请用 Prettier 标准的 `tabWidth` |
| `wxmlPrintWidth` | `int` | `80` | 换行长度 |
| `wxmlSingleQuote` | `boolean` | `false` | 属性用单引号还是双引号 |
| `wxmlPreferBreakTags` | `string` | `wxs,template` | 逗号分隔的标签名集合，强制其中子元素换行。如 `wxs,template,button` |

### WXS

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|------|
| `wxsTabWidth` | `int` | `2` | 缩进空格数 |
| `wxsSingleQuote` | `boolean` | `true` | 用单引号 |
| `wxsSemi` | `boolean` | `true` | 语句末尾加分号 |
| `wxsBabelParserOptions` | `string` | — | JSON 字符串，传给 Babel 解析器。如 `{"plugins":["optionalChaining"]}` |
| `wxsBabelGeneratorOptions` | `string` | — | JSON 字符串，传给 Babel 生成器。不支持 `printWidth` 式的换行控制 |

> `wxsPrintWidth` 目前不受支持，即使配置也会被忽略。

### 完整示例

```json
{
  "plugins": ["prettier-plugin-mp"],
  "overrides": [
    {
      "files": "*.wxml",
      "options": {
        "parser": "wxml",
        "wxmlTabWidth": 2,
        "wxmlPrintWidth": 100,
        "wxmlSingleQuote": false,
        "wxmlPreferBreakTags": "wxs,template,button",
        "wxsTabWidth": 2,
        "wxsSingleQuote": true,
        "wxsSemi": true
      }
    }
  ]
}
```

## 格式化效果

格式化前：

```xml
<view><text>Hello</text><wxs module="test">var a=1;function test(){return a;}</wxs></view>
```

格式化后：

```xml
<view>
  <text>Hello</text>
  <wxs module="test">
  var a = 1;
  function test() {
    return a;
  }
  </wxs>
</view>
```

## 支持的语法

- 标准 WXML 标签与属性
- 微信指令：`wx:for`、`wx:if`、`wx:elif`、`wx:else`、`wx:key` 等
- `{{ }}` 数据绑定表达式
- `<wxs>` 标签内完整的 JavaScript 语法
- 事件处理：`bind:tap`、`catch:tap` 等
- `<image />`、`<input />` 等自闭合标签
- `<text>` 内容原样保留
- `<block>` 强制按块级排版
- `prettier-ignore-start` / `prettier-ignore-end` 区间忽略
- 多行 `{{ }}` 表达式与 `&&`、`||` 内联表达式的规范化

## 开发

```bash
git clone https://github.com/CornWorld/prettier-plugin-mp.git
cd prettier-plugin-mp

pnpm install
npm test
npm run format:wxml
```

## 许可证

MIT