import { parse as wxmlParse } from "@wxml/parser";

// Protect wxs content from XML parser
// Matches <wxs ...> opening tags, correctly handling > inside quoted attribute values
function protectWxsContent(text, protectedItems) {
  let wxsIndex = 0;
  return text.replace(
    /(<wxs(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/wxs>)/g,
    (match, openTag, content, closeTag) => {
      const placeholder = `__WXS_CONTENT_${wxsIndex}__`;
      protectedItems.push({
        placeholder,
        content: content.trim(),
        type: "WXS_CONTENT",
      });
      wxsIndex++;
      return `${openTag}${placeholder}${closeTag}`;
    }
  );
}

// Skip a quoted string literal starting at text[start]; returns the index just past the closing quote.
function skipStringLiteral(text, start) {
  const quote = text[start];
  let j = start + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") {
      j += 2; // Skip escaped character (e.g. \", \})
      continue;
    }
    if (ch === quote) {
      return j + 1;
    }
    j++;
  }
  return text.length;
}

// Skip a comment starting at text[start] ("//" or "/*"); returns the index just past it.
function skipComment(text, start) {
  if (start >= text.length) return start;
  if (text[start] === "/" && text[start + 1] === "/") {
    let j = start + 2;
    while (j < text.length && text[j] !== "\n") j++;
    return j;
  }
  if (text[start] === "/" && text[start + 1] === "*") {
    let j = start + 2;
    while (j < text.length - 1 && !(text[j] === "*" && text[j + 1] === "/"))
      j++;
    return Math.min(j + 2, text.length);
  }
  return start;
}

// Protect template expressions from XML parser.
// Robust to strings, comments and escaped braces inside the expression,
// e.g. {{ '}}' }}, {{ /* }} */ }}, {{ {a: "}"} }}.
function protectTemplateExpressions(text, protectedItems) {
  let templateIndex = 0;
  let result = "";
  let i = 0;

  while (i < text.length) {
    // Look for opening {{
    if (i < text.length - 1 && text[i] === "{" && text[i + 1] === "{") {
      let start = i;
      i += 2; // Skip {{

      // Find the matching }}
      let braceCount = 1;
      let expressionStart = i;

      while (i < text.length && braceCount > 0) {
        const ch = text[i];
        if (ch === "'" || ch === '"' || ch === "`") {
          i = skipStringLiteral(text, i);
          continue;
        }
        if (ch === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
          i = skipComment(text, i);
          continue;
        }
        if (ch === "\\") {
          i += 2; // Skip escaped character inside the expression
          continue;
        }
        if (ch === "{") {
          braceCount++;
        } else if (ch === "}") {
          braceCount--;
          if (braceCount === 0 && i < text.length - 1 && text[i + 1] === "}") {
            // Found matching }}
            const content = text.slice(expressionStart, i);
            const placeholder = `__TEMPLATE_EXPR_${templateIndex}__`;
            protectedItems.push({
              placeholder,
              content: content, // Keep original spacing
              type: "TEMPLATE_EXPR",
            });
            templateIndex++;
            result += placeholder;
            i += 2; // Skip }}
            break;
          }
        }
        i++;
      }

      // If we didn't find a matching }}, treat as regular text
      if (braceCount > 0) {
        result += text.slice(start, expressionStart);
        i = expressionStart;
      }
    } else {
      result += text[i];
      i++;
    }
  }

  return result;
}

// Preprocess text for XML parsing
function preprocessText(text) {
  const protectedItems = [];

  let processedText = protectWxsContent(text, protectedItems);
  processedText = protectTemplateExpressions(processedText, protectedItems);

  return { processedText, protectedItems };
}

// Restore protected content in AST
// Restore a single string property
function restoreStringProperty(str, protectedItems) {
  if (!str || typeof str !== "string") return str;

  protectedItems.forEach(({ placeholder, content, type }) => {
    if (str.includes(placeholder)) {
      if (type === "WXS_CONTENT") {
        str = str.replaceAll(placeholder, content);
      } else if (type === "TEMPLATE_EXPR") {
        str = str.replaceAll(placeholder, `{{${content}}}`);
      }
    }
  });

  return str;
}

// Restore attribute values
function restoreAttributeValue(value, protectedItems) {
  if (!value || typeof value !== "string") return value;

  for (const { placeholder, content, type } of protectedItems) {
    if (value.includes(placeholder)) {
      if (type === "WXS_CONTENT") {
        value = value.replaceAll(placeholder, content);
      } else if (type === "TEMPLATE_EXPR") {
        value = value.replaceAll(placeholder, `{{${content}}}`);
      }
    }
  }

  return value;
}

// Recursively restore protected content in AST
function restoreProtectedContent(node, protectedItems) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((child) => restoreProtectedContent(child, protectedItems));
  }

  // Restore string properties
  if (node.image) {
    node.image = restoreStringProperty(node.image, protectedItems);
  }

  // Restore attribute values
  if (node.value !== undefined) {
    node.value = restoreAttributeValue(node.value, protectedItems);
  }
  if (node.rawValue !== undefined) {
    node.rawValue = restoreAttributeValue(node.rawValue, protectedItems);
  }

  // Recursively process all object properties
  Object.keys(node).forEach((key) => {
    if (typeof node[key] === "object") {
      node[key] = restoreProtectedContent(node[key], protectedItems);
    }
  });

  return node;
}

const parser = {
  parse(text) {
    // Preprocess text for XML parsing
    const { processedText, protectedItems } = preprocessText(text);

    // Parse with @wxml/parser
    let ast = wxmlParse(processedText);

    // Restore protected content
    ast = restoreProtectedContent(ast, protectedItems);

    // Add comment tokens to AST for ignore functionality
    ast.commentTokens = ast.comments || [];

    return ast;
  },
  astFormat: "wxml",
  locStart(node) {
    return node.location ? node.location.startOffset : 0;
  },
  locEnd(node) {
    return node.location ? node.location.endOffset : 0;
  },
};

export default parser;
