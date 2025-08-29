import * as doc from "prettier/doc";
import prettier from "prettier";
import { parse } from "@babel/parser";
import generate from "@babel/generator";

const { group, hardline, indent, join, line, softline /*, ifBreak*/ } = doc.builders;

const ignoreStartComment = "<!-- prettier-ignore-start -->";
const ignoreEndComment = "<!-- prettier-ignore-end -->";

function buildIgnoreRanges(ast, comments) {
  const ranges = [];
  
  // Use commentTokens from AST if available, otherwise fall back to comments parameter
  const commentSource = ast && ast.commentTokens ? ast.commentTokens : comments;
  commentSource.sort((left, right) => left.startOffset - right.startOffset);

  let start = null;
  for (let idx = 0; idx < commentSource.length; idx += 1) {
    const comment = commentSource[idx];
    if (comment.image === ignoreStartComment) {
      start = comment.startOffset || 0;
    } else if (start !== null && comment.image === ignoreEndComment) {
      const end = comment.endOffset || 0;
      ranges.push({ start, end });
      start = null;
    }
  }

  return ranges;
}

function printAttribute(path, opts, print) {
  const node = path.getValue();
  const { key, value, rawValue } = node;
  
  // Handle boolean attributes (no value)
  if (value === null) {
    return key;
  }
  
  // Normalize attribute value quoting per wxmlSingleQuote
  let attributeValue = rawValue != null ? rawValue : value;
  if (typeof attributeValue === "string") {
    attributeValue = normalizeAttrValueForWxmlQuotes(attributeValue, opts);
  }
  
  return `${key}=${attributeValue}`;
}

function printStartTag(path, opts, print) {
  const node = path.getValue();
  const parts = ["<", node.name];

  if (node.attributes && node.attributes.length > 0) {
    const attributeDocs = node.attributes.map((attr) => {
      return printAttribute({ getValue: () => attr }, opts, print);
    });

    // Calculate approximate length to decide line breaks
    const attributesLength = attributeDocs.reduce((sum, current) => sum + String(current).length + 1, 0);
    const printWidth = (typeof opts.wxmlPrintWidth === 'number') ? opts.wxmlPrintWidth : (opts.printWidth || 80);
    const approximateLength = node.name.length + 1 + attributesLength; // "<" + name + space + attrs

    const shouldBreak = approximateLength > printWidth || (node.selfClosing && node.attributes.length >= 4);

    if (shouldBreak) {
      // Break attributes to multiple lines
      const indentedAttributes = indent([
        softline,
        join(hardline, attributeDocs)
      ]);
      parts.push(indentedAttributes, hardline);
    } else {
      // Keep on same line
      parts.push(" ", join(" ", attributeDocs));
    }
  }

  if (node.selfClosing) {
    parts.push(" />");
  } else {
    parts.push(">");
  }

  return parts;
}

function printEndTag(path, opts, print) {
  const node = path.getValue();
  return `</${node.name}>`;
}

// Quick syntax check via Babel to avoid Prettier throwing parser errors
function canParseWithBabel(jsCode) {
  try {
    parse(jsCode, {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowSuperOutsideMethod: true
    });
    return true;
  } catch {
    return false;
  }
}

// Use Prettier to format JS inside <wxs>
function formatWxsByPrettier(jsCode, opts) {
  const semi = opts.wxsSemi !== false; // default true
  const singleQuote = opts.wxsSingleQuote !== false; // default true
  const tabWidth = typeof opts.wxsTabWidth === 'number' ? opts.wxsTabWidth : (opts.tabWidth || 2);
  const printWidth = typeof opts.wxmlPrintWidth === 'number' ? opts.wxmlPrintWidth : (opts.printWidth || 80);
  try {
    // Avoid invoking Prettier when code is syntactically invalid to prevent global errors
    if (!canParseWithBabel(jsCode)) return null;
    const formatted = prettier.format(jsCode, {
      parser: 'babel',
      semi,
      singleQuote,
      tabWidth,
      printWidth,
      // isolate to avoid recursive plugin involvement
      plugins: [],
      // filename hint helps parser inference and pragma behaviors
      filepath: 'inline.wxs.js'
    });
    return formatted.trimEnd();
  } catch (e) {
    return null;
  }
}

// Fallback: Use Babel generator to produce stable output close to Prettier
function formatWxsByBabelCompat(jsCode, opts) {
  try {
    const ast = parse(jsCode, {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowSuperOutsideMethod: true
    });
    const useSingle = opts.wxsSingleQuote !== false; // default true
    const { code } = generate(
      ast,
      {
        comments: true,
        compact: false,
        retainLines: false,
        quotes: useSingle ? 'single' : 'double',
        jsescOption: { quotes: useSingle ? 'single' : 'double' },
        semicolons: opts.wxsSemi !== false
      },
      jsCode
    );
    // Minimal stylistic normalization to match Prettier expectations
    let pretty = code.replace(/\bfunction\(/g, 'function (');
    return pretty.trimEnd();
  } catch (e) {
    return null;
  }
}

function indentLines(text, indentSize) {
  const pad = " ".repeat(indentSize);
  return text
    .split("\n")
    .map((l) => (l.trim() ? pad + l : l))
    .join("\n");
}

function normalizeAttrValueForWxmlQuotes(value, opts) {
  if (value == null) return null;
  let attributeValue = String(value);
  if (!attributeValue.startsWith('"') && !attributeValue.startsWith("'")) {
    // add quotes
    attributeValue = opts.wxmlSingleQuote ? `'${attributeValue}'` : `"${attributeValue}"`;
  } else {
    if (opts.wxmlSingleQuote && attributeValue.startsWith('"') && attributeValue.endsWith('"')) {
      const content = attributeValue.slice(1, -1);
      if (!content.includes("'")) {
        attributeValue = `'${content}'`;
      }
    } else if (!opts.wxmlSingleQuote && attributeValue.startsWith("'") && attributeValue.endsWith("'")) {
      const content = attributeValue.slice(1, -1);
      if (!content.includes('"')) {
        attributeValue = `"${content}"`;
      }
    }
  }
  return attributeValue;
}

function enforceWxsStringQuotes(code, useSingleQuote) {
  if (typeof code !== 'string') return code;
  if (useSingleQuote) {
    // Convert simple double-quoted strings (no quotes or backslashes inside) to single-quoted
    return code.replace(/"([^"'\\\n\r]*)"/g, "'$1'");
  } else {
    // Convert simple single-quoted strings (no quotes or backslashes inside) to double-quoted
    return code.replace(/'([^"'\\\n\r]*)'/g, '"$1"');
  }
}

function printMisc(path, opts, print) {
  const node = path.getValue();
  
  // Handle WXScript nodes
  if (node.type === "WXScript") {
    let result = "";
    
    // Print start tag manually
    if (node.startTag) {
      result += `<${node.startTag.name}`;
      if (node.startTag.attributes && node.startTag.attributes.length > 0) {
        for (const attr of node.startTag.attributes) {
          const normalized = attr.value === null
            ? attr.key
            : `${attr.key}=${normalizeAttrValueForWxmlQuotes(attr.value, opts)}`;
          result += ` ${normalized}`;
        }
      }
      result += ">";
    }
    
    // Print content with proper JavaScript formatting
    if (node.value) {
      result += "\n";
      const jsCode = node.value.trim();
      const indentSize = typeof opts.wxsTabWidth === 'number' ? opts.wxsTabWidth : (opts.tabWidth || 2);

      let formatted = formatWxsByPrettier(jsCode, opts);
      if (formatted == null) {
        formatted = formatWxsByBabelCompat(jsCode, opts);
      }
      if (typeof formatted === 'string') {
        // Enforce preferred string quote style for simple literals
        const useSingle = opts.wxsSingleQuote !== false;
        formatted = enforceWxsStringQuotes(formatted, useSingle);
        
        const content = (formatted.endsWith("\n") ? formatted : formatted + "\n");
        result += indentLines(content, indentSize);
      } else {
        throw new Error("Failed to parse/format <wxs> JavaScript");
      }
    }
    
    // Print end tag manually
    if (node.endTag) {
      result += `</${node.endTag.name}>`;
    }
    
    return result;
  }
  
  return "";
}

function printCharData(path, opts, print) {
  const node = path.getValue();
  const { value } = node;
  if (!value) return "";
  if (value.trim() === "") return "";
  return value.trim();
}

function printElement(path, opts, print) {
  const node = path.getValue();
  const parts = [];
  if (node.startTag) {
    parts.push(path.call(print, "startTag"));
  }
  if (node.children && node.children.length > 0) {
    const childrenParts = [];
    for (let i = 0; i < node.children.length; i++) {
      const printed = path.call(print, "children", i);
      if (printed && printed !== "") {
        childrenParts.push(printed);
      }
    }
    if (childrenParts.length > 0) {
      const hasOnlySimpleText = node.children.length === 1 &&
        node.children[0].type === "WXText" &&
        node.children[0].value &&
        node.children[0].value.trim().length < 50 &&
        !node.children[0].value.includes("\n");
      if (hasOnlySimpleText) {
        parts.push(...childrenParts);
      } else {
        const childrenWithBreaks = [];
        for (let i = 0; i < childrenParts.length; i++) {
          if (i > 0) childrenWithBreaks.push(hardline);
          childrenWithBreaks.push(childrenParts[i]);
        }
        parts.push(indent([hardline, ...childrenWithBreaks]), hardline);
      }
    }
  }
  if (node.endTag) {
    parts.push(path.call(print, "endTag"));
  }
  return group(parts);
}

function printDocument(path, opts, print) {
  const node = path.getValue();
  const { body } = node;
  if (!body || body.length === 0) return "";
  const parts = [];
  let lastWasElement = false;
  body.forEach((child, index) => {
    const printed = path.call(print, "body", index);
    const isElement = child.type === 'WXElement';
    if (printed && printed !== "") {
      if (parts.length > 0 && isElement && lastWasElement) {
        parts.push(hardline);
      }
      parts.push(printed);
    }
    if (printed && printed !== "") {
      lastWasElement = isElement;
    }
  });
  if (parts.length > 0) {
    parts.push(hardline);
    return join("", parts);
  }
  return "";
}

function printComment(path, opts, print) {
  const node = path.getValue();
  return `<!--${node.value}-->`;
}

const printer = {
  preprocess(ast, options) {
    if (ast.commentTokens && ast.commentTokens.length > 0) {
      ast.ignoreRanges = buildIgnoreRanges(ast, ast.commentTokens);
    }
    return ast;
  },
  print(path, opts, print) {
    const node = path.getValue();
    const ast = path.stack && path.stack[0];
    if (ast && ast.ignoreRanges && node.location) {
      const nodeStart = node.location.startOffset;
      const nodeEnd = node.location.endOffset;
      for (const range of ast.ignoreRanges) {
        if (nodeStart >= range.start && nodeEnd <= range.end) {
          return opts.originalText.slice(nodeStart, nodeEnd);
        }
      }
    }
    switch (node.type) {
      case "WXAttribute":
        return printAttribute(path, opts, print);
      case "WXCharData":
        return printCharData(path, opts, print);
      case "Program":
        return printDocument(path, opts, print);
      case "WXElement":
        return printElement(path, opts, print);
      case "WXComment":
        return printComment(path, opts, print);
      case "WXScript":
        return printMisc(path, opts, print);
      case "WXStartTag":
        return printStartTag(path, opts, print);
      case "WXEndTag":
        return printEndTag(path, opts, print);
      case "WXText":
        return printCharData(path, opts, print);
      default:
        return node.image || "";
    }
  }
};

export default printer;