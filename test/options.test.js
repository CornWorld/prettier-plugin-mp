import { describe, it, expect } from "vitest";
import prettier from "prettier";
import * as plugin from "../src/index.js";

async function formatWxml(source, options = {}) {
  try {
    return await prettier.format(source, {
      ...options,
      parser: "wxml",
      plugins: [plugin],
    });
  } catch (error) {
    throw error;
  }
}

describe("Options", () => {
  it("should respect wxmlTabWidth", async () => {
    const source = `<view>\n  <text>Hello</text>\n</view>`;
    const expected = `<view>\n    <text>Hello</text>\n</view>\n`;
    const result = await formatWxml(source, { tabWidth: 4, wxmlTabWidth: 4 });
    expect(result).toBe(expected);
  });

  it("should respect wxmlSingleQuote for attributes", async () => {
    const source = `<view class="container"></view>`;
    const expected = `<view class='container'></view>\n`;
    const result = await formatWxml(source, { wxmlSingleQuote: true });
    expect(result).toBe(expected);
  });

  it("should respect wxmlPrintWidth", async () => {
    const source = `<view class="a b c d e f g h i j k l m n o p q r s t u v w x y z"></view>`;
    const expected = `<view\n  class="a b c d e f g h i j k l m n o p q r s t u v w x y z"\n></view>\n`;
    const result = await formatWxml(source, { printWidth: 60, wxmlPrintWidth: 60 });
    expect(result).toBe(expected);
  });

  describe("WXML Formatting Options", () => {
    it("should break children for tags listed in wxmlPreferBreakTags (e.g., button)", async () => {
      const source = `<view>\n  <button type="primary" size="mini" bindtap="_save"> 保存 </button>\n</view>`;
      const expected = `<view>\n  <button type="primary" size="mini" bindtap="_save">\n    保存\n  </button>\n</view>\n`;
      const result = await formatWxml(source, { wxmlPreferBreakTags: "wxs,template,button" });
      expect(result).toBe(expected);
    });


  });

  describe("WXS Formatting Options", () => {
    const wxsSource = `
<wxs module="m1">
var msg = "hello world";
var foo = function(bar) {
  return bar;
};
module.exports.message = msg;
</wxs>`;

    it("should format WXS with default options (singleQuote: true, semi: true)", async () => {
      const expected = `<wxs module="m1">\n  var msg = 'hello world';\n  var foo = function (bar) {\n    return bar;\n  };\n  module.exports.message = msg;\n</wxs>\n`;
      const result = await formatWxml(wxsSource, { printWidth: 80 });
      expect(result).toBe(expected);
    });

    it("should respect wxsSemi=false", async () => {
      const expected = `<wxs module="m1">\n  var msg = 'hello world';\n  var foo = function (bar) {\n    return bar;\n  };\n  module.exports.message = msg;\n</wxs>\n`;
      const result = await formatWxml(wxsSource, { wxsSemi: false, printWidth: 80, wxsSingleQuote: true });
      expect(result).toBe(expected);
    });

    it("should respect wxsSingleQuote=false", async () => {
      const expected = `<wxs module="m1">\n  var msg = "hello world";\n  var foo = function (bar) {\n    return bar;\n  };\n  module.exports.message = msg;\n</wxs>\n`;
      const result = await formatWxml(wxsSource, { wxsSingleQuote: false, printWidth: 80 });
      expect(result).toBe(expected);
    });
  });

  describe("<wxs> JavaScript formatting (always on)", () => {
    it("should use parser for valid JS in <wxs>", async () => {
      const source = `<wxs module=\"m1\">\nvar a=1;function f(x){return x+1}\nmodule.exports={a:a, f:f}\n</wxs>`;
      const expected = `<wxs module=\"m1\">\n  var a = 1;\n  function f(x) {\n    return x + 1;\n  }\n  module.exports = {\n    a: a,\n    f: f\n  };\n</wxs>\n`;
      const result = await formatWxml(source, {});
      expect(result).toBe(expected);
    });

    it("should throw for invalid JS in <wxs>", async () => {
      // Intentionally invalid JS to force parser error
      const invalid = `<wxs module="m1">\nvar a = ;\nfunction (x) {\n  return x+1;\n}\n</wxs>`;
      await expect(formatWxml(invalid, {}))
        .rejects.toThrow(/Failed to parse\/format <wxs> JavaScript/);
    });
  });
});