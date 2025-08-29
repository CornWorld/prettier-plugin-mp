import languages from "./languages.js";
import parser from "./parser.js";
import printer from "./printer.js";

const plugin = {
  languages,
  parsers: {
    wxml: parser
  },
  printers: {
    wxml: { ...printer }
  },
  options: {
    wxmlTabWidth: {
      type: "int",
      category: "WXML",
      default: 2,
      description: "Number of spaces per indentation level in WXML files.",
      range: { start: 0, end: Infinity, step: 1 }
    },
    wxmlSingleQuote: {
      type: "boolean",
      category: "WXML",
      default: false,
      description: "Use single quotes instead of double quotes in WXML attributes."
    },
    wxmlPrintWidth: {
      type: "int",
      category: "WXML",
      default: 80,
      description: "The line length where Prettier will try wrap in WXML files.",
      range: { start: 0, end: Infinity, step: 1 }
    },
    wxsSemi: {
      type: "boolean",
      category: "WXS",
      default: true,
      description: "Print semicolons at the ends of statements in WXS code."
    },
    wxsSingleQuote: {
      type: "boolean",
      category: "WXS",
      default: true,
      description: "Use single quotes instead of double quotes in WXS code."
    },
    wxsTabWidth: {
      type: "int",
      category: "WXS",
      default: 2,
      description: "Number of spaces per indentation level in WXS code.",
      range: { start: 0, end: Infinity, step: 1 }
    }
  },
  defaultOptions: {
    printWidth: 80,
    tabWidth: 2
  }
};

export default plugin;
export const { parsers, printers, options, defaultOptions } = plugin;
export { languages };