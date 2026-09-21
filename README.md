# prettier-plugin-mp

[![npm version](https://img.shields.io/npm/v/prettier-plugin-mp)](https://www.npmjs.com/package/prettier-plugin-mp)
[![license](https://img.shields.io/npm/l/prettier-plugin-mp)](./LICENSE)

微信小程序 WXML / WXS 格式化插件，基于 [Prettier](https://prettier.io) 3.x 插件 API 实现。

## 特性

- WXML 解析与打印：标签、属性、自闭合标签、多根节点
- `<wxs>` 内嵌 JavaScript 基于 Babel 完整格式化
- `{{ }}` 插值表达式规范化（多行表达式、`&&` / `||` 等逻辑运算符）
- `wx:for`、`wx:if`、`bind:tap` 等微信指令与事件绑定属性原样支持
- `<!-- prettier-ignore-start -->` / `<!-- prettier-ignore-end -->` 区间忽略
- WXML 与 WXS 选项相互独立，不影响其他文件的 Prettier 行为

## 环境要求

- [Prettier](https://prettier.io) >= 3.0

## 安装

```bash
npm install --save-dev prettier-plugin-mp
# 或
pnpm add -D prettier-plugin-mp
# 或
yarn add -D prettier-plugin-mp
```

## 使用

### 配置文件

在 `.prettierrc` 中注册插件，并将 `*.wxml` 交给 `wxml` 解析器：

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

插件选项写在 `overrides[].options` 中即可，参见[选项](#选项)。

### 命令行

```bash
# 格式化所有 WXML 文件
prettier --plugin=prettier-plugin-mp --write "**/*.wxml"

# 格式化单个文件
prettier --plugin=prettier-plugin-mp --write src/pages/index.wxml
```

### 编辑器（VS Code）

1. 安装 [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) 扩展，它会自动加载项目依赖中的插件。
2. 在 `.vscode/settings.json` 中将 `*.wxml` 关联到 `wxml` 语言，使格式化命令对该文件类型生效：

```jsonc
{
  "files.associations": {
    "*.wxml": "wxml",
  },
}
```

## 选项

WXML 与 WXS 选项相互独立，均通过 `overrides[].options` 配置。

### WXML

| 选项                  | 类型      | 默认值         | 说明                                                             |
| --------------------- | --------- | -------------- | ---------------------------------------------------------------- |
| `wxmlPrintWidth`      | `int`     | `80`           | 换行长度                                                         |
| `wxmlSingleQuote`     | `boolean` | `false`        | 属性使用单引号还是双引号                                         |
| `wxmlPreferBreakTags` | `string`  | `wxs,template` | 逗号分隔的标签名，其中的子元素强制换行，如 `wxs,template,button` |
| `wxmlTabWidth`        | `int`     | `2`            | 缩进空格数（当前版本未生效，见[已知限制](#已知限制)）            |

### WXS

| 选项                       | 类型      | 默认值 | 说明                                                                                         |
| -------------------------- | --------- | ------ | -------------------------------------------------------------------------------------------- |
| `wxsSingleQuote`           | `boolean` | `true` | 使用单引号                                                                                   |
| `wxsSemi`                  | `boolean` | `true` | 语句末尾加分号                                                                               |
| `wxsTabWidth`              | `int`     | `2`    | WXS 代码内部的缩进空格数，缺省跟随 `tabWidth`；`<wxs>` 在 WXML 中的层级缩进始终用 `tabWidth` |
| `wxsBabelParserOptions`    | `string`  | —      | 传给 Babel 解析器的 JSON，如 `{"plugins":["optionalChaining"]}`                              |
| `wxsBabelGeneratorOptions` | `string`  | —      | 传给 Babel 生成器的 JSON，不支持 `printWidth` 式的换行控制                                   |

WXML 的缩进层级与整体换行宽度直接使用 Prettier 标准选项 `tabWidth` / `printWidth`。

## 示例

格式化前：

```xml
<wxs module="test">var a=1;function test(){return a;}</wxs><view><text>{{test()}}</text></view>
```

格式化后：

```xml
<wxs module="test">
  var a = 1;
  function test() {
    return a;
  }
</wxs>
<view>
  <text>{{test()}}</text>
</view>
```

通过 `wxmlPreferBreakTags` 让普通标签的子元素也换行：

```xml
<!-- wxmlPreferBreakTags: "wxs,template,button" -->
<button class="btn">
  确定
</button>
```

## 支持的语法

- 标签、属性与自闭合标签（`<image />`、`<input />`）
- 微信指令（`wx:for`、`wx:if`、`wx:key` 等）与事件绑定（`bind:tap`、`catch:tap` 等）
- `{{ }}` 数据绑定，含多行表达式与 `&&` / `||` 的规范化
- `<wxs>` 内的完整 JavaScript 语法
- `<text>` 内容原样保留，`<block>` 按块级排版
- `prettier-ignore-start` / `prettier-ignore-end` 区间忽略
- 多个根元素

## 已知限制

- `wxmlTabWidth` 当前版本未生效，缩进请使用 Prettier 标准的 `tabWidth`。
- `wxsPrintWidth` 不支持：WXS 代码的换行由 Babel 生成器决定，配置该选项会被忽略。

## 开发

```bash
git clone https://github.com/CornWorld/prettier-plugin-mp.git
cd prettier-plugin-mp
pnpm install
npm test
```

## 许可证

[MIT](./LICENSE)
