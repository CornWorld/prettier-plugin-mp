import { describe, it, expect } from "vitest";
import { format } from "prettier";
import { readFileSync } from "fs";
import { join } from "path";
import * as plugin from "../src/index.js";

async function formatWxml(content, options = {}) {
  return format(content, {
    ...options,
    parser: "wxml",
    plugins: [plugin],
  });
}

describe("Format", () => {
  it("should format wxml", async () => {
    const result = await formatWxml("<view>hello</view>");
    expect(result).toBe("<view>hello</view>\n");
  });

  it("should handle self-closing tags", async () => {
    const result = await formatWxml("<view/>");
    expect(result).toBe("<view />\n");
  });

  it("should handle attributes", async () => {
    const result = await formatWxml(`<view class="container" id="main"></view>`);
    expect(result).toBe(`<view class="container" id="main"></view>\n`);
  });

  it("should handle multiple root elements", async () => {
    const input = `<view>First</view><text>Second</text><button>Third</button>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view>First</view>\n<text>Second</text>\n<button>Third</button>\n`);
  });

  it("should format multi-root fixture", async () => {
    const content = readFileSync(join(process.cwd(), "test/fixtures/test-multi-root.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle interpolation", async () => {
    const result = await formatWxml("<view>{{ a + b }}</view>");
    expect(result).toBe("<view>{{ a + b }}</view>\n");
  });

  it("should handle complex structure", async () => {
    const result = await formatWxml(
      `<view class="container"><text>{{ message }}</text><image src="/path/to/image.png"/></view>`,
    );
    expect(result).toBe(
      `<view class="container">\n  <text>{{ message }}</text>\n  <image src="/path/to/image.png" />\n</view>\n`,
    );
  });

  it("should handle mixed text and interpolation", async () => {
    const result = await formatWxml("<view>Hello, {{ name }}!</view>");
    expect(result).toBe("<view>Hello, {{ name }}!</view>\n");
  });

  it("should handle event bindings", async () => {
    const result = await formatWxml(`<view bindtap="onTap"></view>`);
    expect(result).toBe(`<view bindtap="onTap"></view>\n`);
  });

  // Fixture-based tests
  it("should handle complex expressions", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-complex-expressions.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle wxs embed", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-wxs-embed.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle ignore comments - simple", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-ignore-simple.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle ignore comments - block", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-ignore-block.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle template expressions with logical operators", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-template-expressions.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle long ES5 WXS code", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-wxs-long-es5.wxml"), "utf8");
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should handle complex real page", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-complex-real.wxml"), "utf8");
    // this come from https://raw.githubusercontent.com/EastWorld/wechat-app-mall/refs/heads/master/packageCps/pages/goods-details/cps-jd.wxml
    const result = await formatWxml(content);
    expect(result).toMatchSnapshot();
  });

  it("should format number utilities WXS fixture", async () => {
    const content = readFileSync(join(__dirname, "fixtures/test-wxs-number-format.wxml"), "utf8");
    const result = await formatWxml(content, { printWidth: 80, wxsSingleQuote: true, wxsSemi: true });
    expect(result).toMatchSnapshot();
  });

  it("should accept Babel options via Prettier rc for <wxs>", async () => {
    const content = `<wxs module="m">var a=1;/* dummy */</wxs>`; // minimal valid WXS content
    const result = await formatWxml(content, {
      wxsBabelParserOptions: JSON.stringify({ allowReturnOutsideFunction: true }),
      wxsBabelGeneratorOptions: JSON.stringify({ retainLines: false })
    });
    expect(typeof result).toBe('string');
  });

  it("should break attributes when multiple placeholder-like values are present", async () => {
    const input = `<view wx:if="{====================================}" wx:for="{{------------}}" ></view>`;
    const result = await formatWxml(input);
    expect(result).toBe(
      `<view\n  wx:if="===================================="\n  wx:for="{{------------}}"\n></view>\n`
    );
  });

  it("should keep single placeholder attribute on the same line when under print width", async () => {
    const input = `<view id="x" data-a="----------------" class="c"></view>`;
    const result = await formatWxml(input, { printWidth: 200 });
    expect(result).toBe(`<view id="x" data-a="----------------" class="c"></view>\n`);
  });

  it("should break many attributes for self-closing tags", async () => {
    const input = `<image a='1' b='2' c='3' d='4'/>`;
    const result = await formatWxml(input);
    expect(result).toBe(
      `<image\n  a="1"\n  b="2"\n  c="3"\n  d="4"\n />\n`
    );
  });

  it("should preserve template expressions with object literals", async () => {
    const input = `<view>{{fn.formatNum(0, {unit: '¥'})}}</view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view>{{fn.formatNum(0, {unit: '¥'})}}</view>\n`);
  });

  it("should preserve complex template expressions with nested objects", async () => {
    const input = `<view class="product__label-content">{{fn.formatNum(0, {unit: '¥', range: [item.minSkuOriginalPrice, item.maxSkuOriginalPrice]})}}</view>`;
    const result = await formatWxml(input);
    expect(result).toBe(
      `<view class="product__label-content">\n  {{fn.formatNum(0, {unit: '¥', range: [item.minSkuOriginalPrice, item.maxSkuOriginalPrice]})}}\n</view>\n`
    );
  });

  it("should handle multiple template expressions with object literals", async () => {
    const input = `<view>{{fn({key: 'value'})}} {{item}} {{obj.prop}} {{func(arg)}}</view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view>\n  {{fn({key: 'value'})}} {{item}} {{obj.prop}} {{func(arg)}}\n</view>\n`);
  });

  // New tests for whitespace handling to prevent silent data cleanup
  it("should preserve leading and trailing spaces in non-empty text nodes", async () => {
    const input = `<view> a </view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view> a </view>\n`);
  });

  it("should remove pure-whitespace text nodes", async () => {
    const input = `<view>  </view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view></view>\n`);
  });

  it("should preserve outer spaces and normalize expression inside interpolation", async () => {
    const input = `<view>{{  a&&b  }}</view>`;
    const result = await formatWxml(input);
    // keep outer spaces inside braces, but normalize expression 'a && b'
    expect(result).toBe(`<view>{{  a && b  }}</view>\n`);
  });

  it("should preserve spaces around a single interpolation inside element", async () => {
    const input = `<view> {{x}} </view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view> {{x}} </view>\n`);
  });

  it("should break to multiline when newline exists and drop whitespace-only children", async () => {
    const input = `<view>\n  {{x}}\n</view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view>\n  {{x}}\n</view>\n`);
  });

  it("should preserve spaces around interpolation with surrounding text", async () => {
    const input = `<view> a{{x}}b </view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view> a{{x}}b </view>\n`);
  });

  it("should inline short text-interpolation-text trio and preserve spaces", async () => {
    const input = `<view>a {{x}} b</view>`;
    const result = await formatWxml(input);
    expect(result).toBe(`<view>a {{x}} b</view>\n`);
  });
});