import * as doc from "prettier/doc";
import { parse } from "@babel/parser";
import generate from "@babel/generator";

const { group, hardline, indent, join, line, softline /*, ifBreak*/ } = doc.builders;

const ignoreStartComment = "<!-- prettier-ignore-start -->";
const ignoreEndComment = "<!-- prettier-ignore-end -->";

// Helper: determine if inner lines of a mustache form a simple identifier (single line)
function isSimpleMustacheIdentifier(innerLines) {
  if (!Array.isArray(innerLines) || innerLines.length !== 1) return false;
  const s = innerLines[0];
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(s);
}

// Helper: build doc for multi-line mustache printed text, or return null if not applicable
function buildMultiLineMustacheDocFromPrinted(printedText) {
  if (typeof printedText !== "string" || !printedText.includes("\n")) return null;
  const rawLines = printedText.split("\n").map((s) => s.trim());
  if (rawLines[0] !== "{{" || rawLines[rawLines.length - 1] !== "}}") return null;

  const innerLines = rawLines.slice(1, rawLines.length - 1);
  const simple = isSimpleMustacheIdentifier(innerLines);

  const contentDoc = [];
  for (let li = 1; li < rawLines.length - 1; li++) {
    contentDoc.push(hardline, rawLines[li]);
  }

  if (simple) {
    // Simple identifier like "title": content aligns with '{{', '}}' at parent indent
    return [
      indent([
        hardline,
        "{{",
        ...contentDoc,
      ]),
      hardline,
      "}}",
      hardline,
    ];
  }

  // Complex expression: indent inner content, align '}}' with '{{'
  return [
    indent([
      hardline,
      "{{",
      indent(contentDoc),
      hardline,
      "}}",
    ]),
    hardline,
  ];
}

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

function parseJsonOption(val) {
  if (!val) return undefined;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  return undefined;
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

function isPlaceholderLikeValue(value) {
  if (value == null) return false;
  let s = String(value);
  // strip surrounding quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  // detect long runs of the same symbol characters (e.g., ======, ------, ______, ......, ~~~~~~)
  return /([=\-_.~*])\1{5,}/.test(s);
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

    // Heuristic: if multiple attributes look like placeholders with long repeated symbols, prefer breaking
    const placeholderCount = (node.attributes || []).reduce((acc, attr) => {
      const raw = attr.rawValue != null ? attr.rawValue : attr.value;
      return acc + (isPlaceholderLikeValue(raw) ? 1 : 0);
    }, 0);
    const placeholderPenalty = placeholderCount > 0 ? placeholderCount * 10 : 0;

    const approximateLength = node.name.length + 1 + attributesLength + placeholderPenalty; // "<" + name + space + attrs

    const shouldBreak =
      approximateLength > printWidth ||
      placeholderCount >= 2 ||
      (node.selfClosing && node.attributes.length >= 4);

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

// Merge default Babel parser options with user-provided ones from Prettier rc
function getBabelParserOptions(opts) {
  const userRaw = (opts && opts.wxsBabelParserOptions) ? opts.wxsBabelParserOptions : undefined;
  const user = parseJsonOption(userRaw) || {};
  return {
    sourceType: 'script',
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: true,
    plugins: [
      // 常见现代语法，尽量容忍更多写法
      'jsx',
      'classProperties',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport',
      'numericSeparator',
      'topLevelAwait',
      'logicalAssignment',
      'objectRestSpread'
    ],
    // allow users to specify additional parser plugins, etc.
    ...user
  };
}

// Merge default Babel generator options with user-provided ones from Prettier rc
function getBabelGeneratorOptions(opts, useSingleQuote) {
  const userRaw = (opts && opts.wxsBabelGeneratorOptions) ? opts.wxsBabelGeneratorOptions : undefined;
  const user = parseJsonOption(userRaw) || {};
  return {
    comments: true,
    compact: false,
    retainLines: false,
    quotes: useSingleQuote ? 'single' : 'double',
    jsescOption: { quotes: useSingleQuote ? 'single' : 'double' },
    semicolons: opts.wxsSemi !== false,
    
    // ===== 关于 wxsPrintWidth 不支持的技术说明 =====
    // 
    // 1. Babel Generator 的设计局限：
    //    @babel/generator 是一个 AST-to-code 转换器，专注于语法正确性而非格式美观。
    //    它没有内置的"列宽感知"逻辑，不会根据 printWidth 自动决定何时换行。
    //    这与 Prettier 的核心格式化引擎完全不同 —— Prettier 有复杂的布局算法。
    //
    // 2. 当前架构的权衡：
    //    - 优势：使用 Babel 解析+生成确保了 WXS 代码的语法兼容性和稳定性
    //    - 劣势：无法提供 Prettier 级别的智能换行和列宽控制
    //    - 现实：大多数 <wxs> 块都比较简短，复杂格式化需求相对较少
    //
    // 3. 替代方案的复杂性：
    //    要真正支持 wxsPrintWidth，需要：
    //    a) 将 WXS 代码交给 Prettier 的 JS 解析器重新格式化
    //    b) 处理 Prettier 与 Babel 在语法支持上的细微差异
    //    c) 确保格式化结果在小程序环境中的兼容性
    //    d) 增加错误处理复杂度（两套解析器的错误需要统一处理）
    //
    // 4. 当前策略：
    //    保持 Babel 生成路径的简洁性，通过 wxsSemi/wxsSingleQuote 提供基础格式控制，
    //    避免引入可能破坏现有项目的复杂格式化逻辑。
    //
    // 如果项目确实需要复杂的 WXS 格式化，建议：
    // - 将复杂逻辑提取到独立的 .js 文件中，用标准 Prettier 格式化
    // - 在 <wxs> 中保持简洁的代码结构
    // =====================================================
    
    ...user
  };
}

// Quick syntax check via Babel to avoid Prettier throwing parser errors
function canParseWithBabel(jsCode, opts) {
  try {
    parse(jsCode, getBabelParserOptions(opts));
    return true;
  } catch {
    return false;
  }
}

// Use Prettier to format JS inside <wxs>
function formatWxsByPrettier(jsCode, opts) {
  // 不再尝试内嵌调用 Prettier（v3 的 format 为 Promise，打印器无法等待），统一走 Babel 生成路径
  return null;
}

// Fallback: Use Babel generator to produce stable output close to Prettier
function formatWxsByBabelCompat(jsCode, opts) {
  try {
    const ast = parse(jsCode, getBabelParserOptions(opts));
    const useSingle = opts.wxsSingleQuote !== false; // default true
    const gen = (generate && (generate.default || generate));
    if (typeof gen !== 'function') {
      throw new TypeError('generate is not a function');
    }
    const { code } = gen(
      ast,
      getBabelGeneratorOptions(opts, useSingle),
      jsCode
    );
    let pretty = code.replace(/\bfunction\(/g, 'function (');
    return pretty.trimEnd();
  } catch (e) {
    // 错误处理说明：解析/生成失败不会直接抛出致命错误，先输出简要错误信息，随后返回 null。
    // 上层 printMisc 在收到 null 后，会抛出一个统一的错误以保留原始内容并中止内嵌格式化。
    try { console.error('[wxs][babel] parse/generate error:', e && e.message); } catch {}
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

function formatInlineJsExpression(expr, opts) {
  if (typeof expr !== 'string') return expr;
  // 1) Collapse any newlines (and surrounding spaces) into a single space
  let s = expr.replace(/[ \t]*[\r\n]+[ \t]*/g, ' ');
  // 2) Normalize spaces around logical operators without touching others
  s = s.replace(/\s*&&\s*/g, ' && ').replace(/\s*\|\|\s*/g, ' || ');
  return s.trim();
}

function formatWxmlInterpolations(text, opts) {
  if (typeof text !== 'string' || text.indexOf('{{') === -1) return text;
  return text.replace(/{{(\s*)([\s\S]*?)(\s*)}}/g, (m, lws, expr, rws) => {
    const formatted = formatInlineJsExpression(expr, opts);
    return `{{${lws}${formatted}${rws}}}`;
  });
}

function normalizeAttrValueForWxmlQuotes(value, opts) {
  if (value == null) return null;
  let attributeValue = String(value);
  // Apply inline expression formatting inside quotes or raw
  const isQuoted = (attributeValue.startsWith('"') && attributeValue.endsWith('"')) || (attributeValue.startsWith("'") && attributeValue.endsWith("'"));
  if (isQuoted) {
    const quote = attributeValue[0];
    let content = attributeValue.slice(1, -1);
    content = formatWxmlInterpolations(content, opts);
    // Decide final quote style based on preference and content
    const preferSingle = !!opts.wxmlSingleQuote;
    if (preferSingle && !content.includes("'")) {
      attributeValue = `'${content}'`;
    } else if (!preferSingle && !content.includes('"')) {
      attributeValue = `"${content}"`;
    } else {
      attributeValue = `${quote}${content}${quote}`;
    }
  } else {
    // Not quoted; first format interpolations then add quotes
    const content = formatWxmlInterpolations(attributeValue, opts);
    attributeValue = opts.wxmlSingleQuote ? `'${content}'` : `"${content}"`;
  }
  return attributeValue;
}

function enforceWxsStringQuotes(code, useSingleQuote) {
  if (typeof code !== 'string') return code;
  if (useSingleQuote) {
    // Convert simple double-quoted strings (no quotes or backslashes inside) to single-quoted
    return code.replace(/\"([^\"'\\\n\r]*)\"/g, "'$1'");
  } else {
    // Convert simple single-quoted strings (no quotes or backslashes inside) to double-quoted
    return code.replace(/'([^\"'\\\n\r]*)'/g, '"$1"');
  }
}

function printMisc(path, opts, print) {
  const node = path.getValue();
  
  // Handle WXScript nodes
  if (node.type === "WXScript") {
    let result = "";
    
    // Print start tag manually
    if (node.startTag) {
      const isSelfClosing = !!node.startTag.selfClosing;
      result += `<${node.startTag.name}`;
      if (node.startTag.attributes && node.startTag.attributes.length > 0) {
        for (const attr of node.startTag.attributes) {
          const normalized = attr.value === null
            ? attr.key
            : `${attr.key}=${normalizeAttrValueForWxmlQuotes(attr.value, opts)}`;
          result += ` ${normalized}`;
        }
      }
      if (isSelfClosing) {
        result += " />";
        return result; // self-closing: no content, no end tag
      } else {
        result += ">";
      }
    }
    
    // Print content with proper JavaScript formatting
    if (node.value) {
      result += "\n";
      const jsCode = node.value.trim();
      const indentSize = typeof opts.wxsTabWidth === 'number' ? opts.wxsTabWidth : (opts.tabWidth || 2);

      let formatted = null; // 不再使用 Prettier 路径
      if (formatted == null) {
        formatted = formatWxsByBabelCompat(jsCode, opts);
      }
      if (typeof formatted === 'string') {
        // Enforce preferred string quote style for simple literals only when formatted
        const useSingle = opts.wxsSingleQuote !== false;
        formatted = enforceWxsStringQuotes(formatted, useSingle);
      } else {
        try {
          const snippet = jsCode.split('\n').slice(0, 5).join('\n');
          console.error('[wxs] Unable to format. First lines:', snippet);
        } catch {}
        // 统一的失败处理：抛出错误以便上层保留原始内容，避免错误输出破坏结构
        throw new Error("Failed to parse/format <wxs> JavaScript");
      }
      const content = (formatted.endsWith("\n") ? formatted : formatted + "\n");
      result += indentLines(content, indentSize);
    }
    
    // Print end tag manually
    if (node.endTag) {
      result += `</${node.endTag.name}>`;
    }
    
    return result;
  }
  
  throw new Error(`printMisc received unknown node type: ${node.type}. This is a bug in the printer.`);
}

function printCharData(path, opts, print) {
  const node = path.getValue();
  const { value } = node;
  if (value == null) return "";
  if (value.trim() === "") {
    // Return whitespace as-is; element-level logic decides whether to keep it
    return value;
  }
  // Normalize inline template expressions
  const normalized = formatWxmlInterpolations(value, opts);
  // Do not trim() here to avoid silently removing significant leading/trailing spaces in text nodes
  return normalized;
}

function printElement(path, opts, print) {
  const node = path.getValue();
  const parts = [];
  if (node.startTag) {
    // <text> 的处理采用 "早退" 策略，但在此之前仍然会打印开始标签
    parts.push(path.call(print, "startTag"));
  }
  if (node.children && node.children.length > 0) {
    // Decide whether to inline children based on their raw content
    const child0 = node.children[0];
    const isTextNodeType = (n) => n && (n.type === "WXText" || n.type === "WXCharData");
    const isTextLikeNode = (n) => isTextNodeType(n) || n.type === "WXInterpolation";
    const getNodeString = (n) => {
      if (isTextNodeType(n)) return typeof n.value === 'string' ? n.value : '';
      if (n.type === 'WXInterpolation') return typeof n.rawValue === 'string' ? n.rawValue : '';
      return '';
    };
    const getNodeLen = (n) => getNodeString(n).length;

    const trimmedLen0 = isTextNodeType(child0) && typeof child0.value === 'string' ? child0.value.trim().length : 0;
    const singleTextInline = node.children.length === 1 &&
      isTextNodeType(child0) &&
      trimmedLen0 > 0 &&
      trimmedLen0 < 50 &&
      !child0.value.includes("\n");

    // Determine if children are purely textual/interpolation
    const onlyTextualChildren = node.children.every((n) => isTextLikeNode(n));
    const hasNewline = node.children.some((n) => getNodeString(n).includes("\n"));
    const totalLen = node.children.reduce((acc, n) => acc + getNodeLen(n), 0);
    const hasMeaningful = node.children.some((n) => (isTextNodeType(n) && typeof n.value === 'string' && n.value.trim() !== '') || n.type === 'WXInterpolation');
    const smallInlineMix = node.children.length <= 3 && onlyTextualChildren && !hasNewline && totalLen < 50 && hasMeaningful;

    const tagName = (node.startTag && node.startTag.name) || (node.endTag && node.endTag.name) || "";
    const lowerName = typeof tagName === "string" ? tagName.toLowerCase() : "";

    // EARLY RETURN for <text>: verbatim children, no manipulation
    // 说明：<text> 的子节点按原样输出，不进行空白折叠或换行控制；如果存在属性则强制不内联。
    if (lowerName === 'text') {
      for (let i = 0; i < node.children.length; i++) {
        const childNode = node.children[i];
        if ((childNode.type === "WXText" || childNode.type === "WXCharData") && typeof childNode.value === 'string') {
          parts.push(childNode.value);
        } else if (childNode.type === 'WXInterpolation' && typeof childNode.rawValue === 'string') {
          parts.push(childNode.rawValue);
        } else {
          parts.push(path.call(print, "children", i));
        }
      }
      if (node.endTag) {
        parts.push(path.call(print, "endTag"));
      }
      return group(parts);
    }

    // Only true block-level tag that must never inline
    const isAlwaysBlock = lowerName === "block";

    // Build prefer-break tags set from options
    const preferBreakTagsInput = (typeof opts.wxmlPreferBreakTags === 'string') ? opts.wxmlPreferBreakTags : '';
    const preferBreakTags = new Set(preferBreakTagsInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
    const isPreferBlock = preferBreakTags.has(lowerName);

    // Attributes presence (for simple <text> rule)
    const attrsArr = (node.startTag && Array.isArray(node.startTag.attributes)) ? node.startTag.attributes : [];
    const hasAnyAttrs = attrsArr.length > 0;

    // Simplified: treat <block> as always-block, selected tags as prefer-break.
    let shouldInline = (singleTextInline || smallInlineMix) && !isAlwaysBlock && !isPreferBlock;
    // Only <text> strictly checks: if it has any attributes, force break (no inline)
    if (lowerName === 'text' && hasAnyAttrs) {
      shouldInline = false;
    }
    // For <text>, baseline: do not inline unless content is short/simple and structure is trivial
    if (lowerName === 'text') {
      shouldInline = false;
      if (!hasAnyAttrs && onlyTextualChildren && !hasNewline && node.children.length === 1) {
        const only = node.children[0];
        const rawCombined = getNodeString(only);
        const trimmed = typeof rawCombined === 'string' ? rawCombined.trim() : '';
        const isSingleMustache = trimmed.startsWith('{{') && trimmed.endsWith('}}');
        const containsMustache = typeof rawCombined === 'string' && rawCombined.includes('{{');
        if (containsMustache && isSingleMustache) {
          const inner = trimmed.slice(2, -2);
          // Complexity heuristics: break if contains object/array literal, or has multiple &&, or both && and ||
          const hasObjectLiteral = /\{[^}]*:/.test(inner);
          const hasArrayLiteral = /\[[^\]]*,[^\]]*\]/.test(inner) || /^\s*\[/.test(inner.trim());
          const andCount = (inner.match(/&&/g) || []).length;
          const hasOr = inner.includes('||');
          const complex = hasObjectLiteral || hasArrayLiteral || andCount >= 2 || (andCount >= 1 && hasOr);
          shouldInline = !complex;
        } else if (isTextNodeType(only)) {
          // single pure text: inline if reasonably short
          shouldInline = trimmed.length <= 50;
        }
      }
    }

    // Note: <text> is handled via early return above; strict text mode is unused.

    // Now collect printed children according to the decision
    const childrenParts = [];
    const childEntries = [];
    for (let i = 0; i < node.children.length; i++) {
      const childNode = node.children[i];
      if (!shouldInline) {
        if ((childNode.type === "WXText" || childNode.type === "WXCharData") && typeof childNode.value === 'string' && childNode.value.trim() === '') {
          continue; // drop whitespace-only nodes when not inlining
        }
      }
      // Normal printing for non-<text> tags; <text> has already early-returned above.
      const printed = path.call(print, "children", i);
      if (printed && printed !== "") {
        childrenParts.push(printed);
        childEntries.push({ index: i, node: childNode, printed });
      }
    }

    if (childrenParts.length > 0) {
      if (shouldInline) {
        parts.push(...childrenParts);
      } else {
        const childrenWithBreaks = [];
        for (let i = 0; i < childrenParts.length; i++) {
          if (i > 0) childrenWithBreaks.push(hardline);
          const entry = childEntries[i];
          const printed = childrenParts[i];
          // Split multi-line text nodes into doc parts separated by hardline
          if (entry && (entry.node.type === "WXText" || entry.node.type === "WXCharData") && typeof printed === "string" && printed.includes("\n")) {
            const lines = printed.split("\n");
            for (let li = 0; li < lines.length; li++) {
              if (li > 0) childrenWithBreaks.push(hardline);
              if (lines[li] !== "") {
                childrenWithBreaks.push(lines[li]);
              }
            }
          } else {
            childrenWithBreaks.push(printed);
          }
        }
        {
          // Special-case: multi-line mustache block like "{{\n  title\n}}" inside non-<text> tag
          let didSpecial = false;
          if (lowerName !== 'text' && childrenParts.length === 1 && childEntries.length === 1) {
          const entry0 = childEntries[0];
          const printed0 = childrenParts[0];
          const raw0 = getNodeString(entry0.node);
          const isTextNode = entry0 && (entry0.node.type === "WXText" || entry0.node.type === "WXCharData");
          if (isTextNode && typeof printed0 === 'string') {
          const mlDoc = buildMultiLineMustacheDocFromPrinted(printed0);
          if (mlDoc) {
            parts.push(...mlDoc);
            didSpecial = true;
          }
          }
          }
          // Normal path
          if (!didSpecial) {
            parts.push(indent([hardline, ...childrenWithBreaks]), hardline);
          }
        }
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
  let lastWasBlock = false; // blocks: element/script/comment
  body.forEach((child, index) => {
    // Drop whitespace-only top-level text nodes to avoid spurious blank lines
    if ((child.type === 'WXText' || child.type === 'WXCharData') && typeof child.value === 'string' && child.value.trim() === '') {
      return;
    }
    const printed = path.call(print, "body", index);
    const isBlock = child.type === 'WXElement' || child.type === 'WXScript' || child.type === 'WXComment';
    if (printed && printed !== "") {
      if (parts.length > 0 && (isBlock || lastWasBlock)) {
        parts.push(hardline);
      }
      parts.push(printed);
    }
    if (printed && printed !== "") {
      lastWasBlock = isBlock;
    }
  });
  if (parts.length > 0) {
    parts.push(hardline);
  }
  return group(parts);
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
      case "WXInterpolation":
        if (!node.rawValue) {
          throw new Error(`WXInterpolation node missing rawValue. This is a bug in the parser or printer.`);
        }
        return node.rawValue;
      default:
        throw new Error(`Unknown node type: ${node.type}. This is a bug in the printer.`);
    }
  }
};

export default printer;