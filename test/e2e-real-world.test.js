import { describe, it, expect } from "vitest";
import { format } from "prettier";
import * as plugin from "../src/index.js";
import { readdirSync, statSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, "wxml-dir");

function listWxmlFiles(dir) {
  const out = [];
  const entries = readdirSync(dir);
  for (const name of entries) {
    const fp = path.join(dir, name);
    const st = statSync(fp);
    if (st.isDirectory()) {
      out.push(...listWxmlFiles(fp));
    } else if (st.isFile() && name.endsWith(".wxml")) {
      out.push(fp);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

describe("E2E: real-world WXML under wxml-dir", () => {
  const files = listWxmlFiles(BASE_DIR);
  if (files.length === 0) {
    it("should have at least one .wxml file in wxml-dir", () => {
      expect(files.length).toBeGreaterThan(0);
    });
    return;
  }

  for (const file of files) {
    const rel = path.relative(BASE_DIR, file);
    it(`format ${rel}`, async () => {
      const content = readFileSync(file, "utf8");
      const result = await format(content, {
        parser: "wxml",
        plugins: [plugin],
        // lock styles to avoid snapshot drift
        printWidth: 80,
        tabWidth: 2,
        endOfLine: "lf",
        // WXML-specific
        wxmlPrintWidth: 80,
        wxmlTabWidth: 2,
        wxmlSingleQuote: false,
        // WXS-specific
        wxsSemi: true,
        wxsTabWidth: 2,
        wxsSingleQuote: true,
      });
      expect(result).toMatchSnapshot();
    });
  }
});