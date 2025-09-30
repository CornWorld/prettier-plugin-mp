# prettier-plugin-mp

微信小程序 WXML 和 WXS 文件的 Prettier 格式化插件。

A Prettier plugin for formatting WeChat Mini Program WXML and WXS files with professional code quality.

## 特性 Features

✅ **WXML 格式化**: 为 WXML 文件提供正确的缩进和结构  
✅ **WXS JavaScript 格式化**: 为嵌入的 WXS 模块提供完整的 JavaScript 格式化  
✅ **可配置选项**: 为 WXML 和 WXS 提供独立的格式化选项  
✅ **微信语法支持**: 完整支持 `wx:for`、`wx:if` 和其他微信指令  
✅ **专业品质**: 基于官方 Prettier XML 插件架构  

## 安装 Installation

```bash
pnpm install -D prettier-plugin-mp
# 或者 or
npm install --save-dev prettier-plugin-mp
```

## 使用方法 Usage

### 基本使用 Basic Usage

### 命令行 Command Line

```bash
# 格式化所有 WXML 文件 Format all WXML files
prettier --plugin=prettier-plugin-mp --write "**/*.wxml"

# 格式化指定文件 Format specific file
prettier --plugin=prettier-plugin-mp --write src/pages/index.wxml
```

### Configuration File

Create a `.prettierrc` file:

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

## 配置选项 Configuration Options

你可以通过在 `.prettierrc` 文件中添加这些选项来自定义格式化行为：

You can customize the formatting behavior by adding these options to your `.prettierrc` file:

### WXML 选项 WXML Options

| 选项 Option | 类型 Type | 默认值 Default | 描述 Description |
|--------|------|---------|-------------|
| `wxmlTabWidth` | `int` | `2` | WXML 缩进空格数（当前版本暂不生效；请使用 Prettier 的标准 `tabWidth`） Number of spaces per indentation level for WXML (currently ignored; use Prettier `tabWidth`) |
| `wxmlPrintWidth` | `int` | `80` | WXML 换行长度 Line length where Prettier will try to wrap for WXML |
| `wxmlSingleQuote` | `boolean` | `false` | WXML 属性使用单引号 Use single quotes in WXML attributes |
| `wxmlPreferBreakTags` | `string` | `""` | 逗号分隔的标签名集合，强制其子元素换行，例如：`wxs,template,button` Comma-separated tag names to force breaking children, e.g., `wxs,template,button` |

### WXS 选项 WXS Options

| 选项 Option | 类型 Type | 默认值 Default | 描述 Description |
|--------|------|---------|-------------|
| `wxsTabWidth` | `int` | `2` | WXS 代码缩进空格数 Number of spaces per indentation level for WXS code |
| `wxsSingleQuote` | `boolean` | `true` | WXS 代码使用单引号 Use single quotes in WXS code |
| `wxsSemi` | `boolean` | `true` | WXS 语句末尾添加分号 Print semicolons at the ends of statements in WXS code |
| `wxsBabelParserOptions` | `object|string` | `{}` | 传递给 Babel 解析器的选项（可对象或 JSON 字符串），用于 WXS 解析 Options passed to Babel parser for WXS (object or JSON string) |
| `wxsBabelGeneratorOptions` | `object|string` | `{}` | 传递给 Babel 代码生成器的选项（可对象或 JSON 字符串）；当前不支持换行宽度控制（不支持 `printWidth`） Options passed to Babel generator for WXS (object or JSON string); printWidth-style line wrapping is not supported |

> 说明 Note: `wxsPrintWidth` 目前不受支持，任何配置都会被忽略。Use of `wxsPrintWidth` is currently not supported and will be ignored.

### 配置示例 Example Configuration

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

## 示例 Examples

### 格式化前 Before Formatting

```xml
<view><text>Hello</text><wxs module="test">var a=1;function test(){return a;}</wxs></view>
```

### 格式化后 After Formatting

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

## 支持的语法 Supported Syntax

- **WXML 元素**: 所有标准 WXML 标签和属性 All standard WXML tags and attributes
- **微信指令**: `wx:for`, `wx:if`, `wx:elif`, `wx:else`, `wx:key` 等 WeChat Directives
- **数据绑定**: `{{ }}` 表达式 Data Binding expressions
- **WXS 模块**: `<wxs>` 标签内的完整 JavaScript 语法 Complete JavaScript syntax within `<wxs>` tags
- **事件处理**: `bind:tap`, `catch:tap` 等 Event Handlers
- **自闭合标签**: `<image />`, `<input />` 等的正确格式化 Proper formatting for self-closing tags

## 开发 Development

```bash
# 克隆仓库 Clone the repository
git clone https://github.com/your-username/prettier-plugin-mp.git
cd prettier-plugin-mp

# 安装依赖 Install dependencies
pnpm install
# 或者 or
npm install

# 运行测试 Run tests
npm test

# 测试格式化 Test formatting
npm run format:wxml
```

## 许可证 License

MIT