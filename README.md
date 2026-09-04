# prettier-plugin-mp

[![npm version](https://img.shields.io/npm/v/prettier-plugin-mp)](https://www.npmjs.com/package/prettier-plugin-mp)
[![license](https://img.shields.io/npm/l/prettier-plugin-mp)](./LICENSE)

微信小程序 WXML / WXS 的 [Prettier](https://prettier.io) 插件，需要 Prettier 3.x。

## 安装

```bash
npm install --save-dev prettier-plugin-mp
# 或
pnpm install -D prettier-plugin-mp
```

## 使用

在 `.prettierrc` 中注册插件，并将 `*.wxml` 交给 `wxml` 解析器：

```json
{
  "plugins": ["prettier-plugin-mp"],
  "overrides": [
    {
      "files": "*.wxml",
      "options": {
        "parser": "wxml",
        "wxmlPrintWidth": 100
      }
    }
  ]
}
```

也可以直接在命令行使用：

```bash
# 格式化所有 WXML 文件
prettier --plugin=prettier-plugin-mp --write "**/*.wxml"

# 格式化单个文件
prettier --plugin=prettier-plugin-mp --write src/pages/index.wxml
```

## 选项

选项写在 `overrides[].options` 中，WXML 与 WXS 各自独立。

### WXML

| 选项                  | 类型      | 默认值         | 说明                                                             |
| --------------------- | --------- | -------------- | ---------------------------------------------------------------- |
| `wxmlTabWidth`        | `int`     | `2`            | 缩进空格数 ¹                                                     |
| `wxmlPrintWidth`      | `int`     | `80`           | 换行长度                                                         |
| `wxmlSingleQuote`     | `boolean` | `false`        | 属性使用单引号还是双引号                                         |
| `wxmlPreferBreakTags` | `string`  | `wxs,template` | 逗号分隔的标签名，其中的子元素强制换行，如 `wxs,template,button` |

¹ 当前版本未生效，缩进请使用 Prettier 标准的 `tabWidth`。

### WXS

| 选项                       | 类型      | 默认值 | 说明                                                                                         |
| -------------------------- | --------- | ------ | -------------------------------------------------------------------------------------------- |
| `wxsTabWidth`              | `int`     | `2`    | WXS 代码内部的缩进空格数，缺省跟随 `tabWidth`；`<wxs>` 在 WXML 中的层级缩进始终用 `tabWidth` |
| `wxsSingleQuote`           | `boolean` | `true` | 使用单引号                                                                                   |
| `wxsSemi`                  | `boolean` | `true` | 语句末尾加分号                                                                               |
| `wxsBabelParserOptions`    | `string`  | —      | 传给 Babel 解析器的 JSON，如 `{"plugins":["optionalChaining"]}`                              |
| `wxsBabelGeneratorOptions` | `string`  | —      | 传给 Babel 生成器的 JSON，不支持 `printWidth` 式的换行控制                                   |

> `wxsPrintWidth` 暂不支持，配置后会被忽略。

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

## 支持的语法

- 标签、属性与自闭合标签（`<image />`、`<input />`）
- 微信指令（`wx:for`、`wx:if`、`wx:key` 等）与事件绑定（`bind:tap`、`catch:tap` 等）
- `{{ }}` 数据绑定，含多行表达式与 `&&` / `||` 的规范化
- `<wxs>` 内的完整 JavaScript 语法
- `<text>` 内容原样保留，`<block>` 按块级排版
- `prettier-ignore-start` / `prettier-ignore-end` 区间忽略

## 开发

```bash
git clone https://github.com/CornWorld/prettier-plugin-mp.git
cd prettier-plugin-mp
pnpm install
npm test
```

## 许可证

MIT
