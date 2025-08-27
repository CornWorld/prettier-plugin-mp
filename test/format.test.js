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
});