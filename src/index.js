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
    // Whether to render <text> contents strictly (preserve newlines, avoid indentation inside <text>)
    wxmlStrictText: {
      type: "boolean",
      category: "WXML",
      default: true,
      description:
        "Render <text> contents strictly: preserve newlines/whitespace and avoid indentation that would inject spaces."
    },
    // Comma-separated tag names whose children prefer breaking onto their own lines
    wxmlPreferBreakTags: {
      type: "string",
      category: "WXML",
      default: "wxs,template",
      description:
        "Comma-separated list of tag names whose children are placed on separate lines by default (e.g., 'wxs,template')."
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
    },
    // Advanced: pass through Babel options for <wxs> formatting via Prettier rc (as JSON string)
    wxsBabelParserOptions: {
      type: "string",
      category: "WXS",
      default: undefined,
      description: "Advanced: JSON string for @babel/parser options used for parsing <wxs> JavaScript. E.g., '{\"plugins\":[\"optionalChaining\"]}'"
    },
    wxsBabelGeneratorOptions: {
      type: "string",
      category: "WXS",
      default: undefined,
      description: "Advanced: JSON string for @babel/generator options used for emitting <wxs> JavaScript."
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