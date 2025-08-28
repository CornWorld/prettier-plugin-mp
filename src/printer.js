import * as doc from "prettier/doc";
import embed from "./embed.js";

const { group, hardline, indent, join, line, softline, ifBreak } = doc.builders;

const ignoreStartComment = "<!-- prettier-ignore-start -->";
const ignoreEndComment = "<!-- prettier-ignore-end -->";

function hasIgnoreRanges(comments) {
  if (comments.length === 0) {
    return false;
  }
  
  // Reuse buildIgnoreRanges logic to avoid duplication
  return buildIgnoreRanges(null, comments).length > 0;
}

function buildIgnoreRanges(ast, comments) {
  const ranges = [];
  
  // Use commentTokens from AST if available, otherwise fall back to comments parameter
  const commentSource = ast.commentTokens || comments;
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

// Template expression regex for {{ }} patterns
const TEMPLATE_EXPR_REGEX = /\{\{[^}]*\}\}/g;

function printAttribute(path, opts, print) {
  const node = path.getValue();
  const { key, value, rawValue } = node;
  
  // Handle boolean attributes (no value)
  if (value === null) {
    return key;
  }
  
  // Use rawValue (restored content) if available, otherwise use value
  let attributeValue = rawValue || value;
  
  // Ensure proper quoting for attribute values
  if (!attributeValue.startsWith('"') && !attributeValue.startsWith("'")) {
    // Value doesn't have quotes, add them based on preference
    if (opts.wxmlSingleQuote) {
      attributeValue = `'${attributeValue}'`;
    } else {
      attributeValue = `"${attributeValue}"`;
    }
  } else {
    // Handle quote style conversion for already quoted values
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
  
  return `${key}=${attributeValue}`;
}

function printCharData(path, opts, print) {
  const node = path.getValue();
  const { value } = node;
  
  if (!value) {
    return "";
  }
  
  // 如果文本内容仅包含空白字符，完全忽略
  if (value.trim() === "") {
    return "";
  }
  
  // 对于有实际内容的文本，去除两端空白
  return value.trim();
}

function addContentFragments(fragments, items, path, print, key) {
  if (!items) return;
  
  items.forEach((item, index) => {
    const printed = path.call(print, key, index);
    if (printed && printed !== "") {
      fragments.push({
        offset: item.location ? item.location.startOffset : 0,
        printed
      });
    }
  });
}

function printContentFragments(path, print) {
  const node = path.getValue();
  const { CData, Comment, chardata, element } = node;
  
  const fragments = [];
  
  // Add all content types using the helper function
  addContentFragments(fragments, Comment, path, print, "Comment");
  addContentFragments(fragments, chardata, path, print, "chardata");
  addContentFragments(fragments, element, path, print, "element");
  
  // CData has different structure, handle separately
  if (CData) {
    CData.forEach((cdata, index) => {
      fragments.push({
        offset: cdata.startOffset || 0,
        printed: cdata
      });
    });
  }
  
  return fragments;
}

function collectContentNodes(path) {
  const contentNodes = [];
  const { element, chardata, Comment } = path.getValue();
  
  if (element) {
    element.forEach((el, index) => {
      if (el.location) {
        contentNodes.push({
          type: 'element',
          index,
          start: el.location.startOffset,
          end: el.location.endOffset,
          node: el
        });
      }
    });
  }
  
  if (chardata) {
    chardata.forEach((cd, index) => {
      if (cd.location) {
        contentNodes.push({
          type: 'chardata',
          index,
          start: cd.location.startOffset,
          end: cd.location.endOffset,
          node: cd
        });
      }
    });
  }
  
  if (Comment) {
    Comment.forEach((comment, index) => {
      if (comment.location) {
        contentNodes.push({
          type: 'comment',
          index,
          start: comment.location.startOffset,
          end: comment.location.endOffset,
          node: comment
        });
      }
    });
  }
  
  return contentNodes.sort((a, b) => a.start - b.start);
}

function processContentNode(contentNode, path, opts, print, ignoreRanges) {
  const isInIgnoreRange = ignoreRanges.some(range => 
    contentNode.start >= range.start && contentNode.end <= range.end
  );
  
  if (isInIgnoreRange) {
    const originalContent = opts.originalText.slice(contentNode.start, contentNode.end + 1);
    return {
      offset: contentNode.start,
      printed: doc.utils.replaceEndOfLine(originalContent)
    };
  }
  
  let printed;
  if (contentNode.type === 'element') {
    printed = path.call(print, "element", contentNode.index);
  } else if (contentNode.type === 'chardata') {
    printed = path.call(print, "chardata", contentNode.index);
  } else if (contentNode.type === 'comment') {
    printed = path.call(print, "Comment", contentNode.index);
  }
  
  if (printed && printed !== "") {
    return {
      offset: contentNode.start,
      printed
    };
  }
  
  return null;
}

function processIgnoredContent(path, opts, print) {
  const { Comment } = path.getValue();
  const ignoreRanges = buildIgnoreRanges(path.getValue(), Comment);
  const contentNodes = collectContentNodes(path);
  
  const result = [];
  contentNodes.forEach(contentNode => {
    const processed = processContentNode(contentNode, path, opts, print, ignoreRanges);
    if (processed) {
      result.push(processed);
    }
  });
  
  return result;
}

function shouldKeepInline(path) {
  const { chardata, element } = path.getValue();
  const elementCount = element ? element.length : 0;
  const hasOnlyTemplateContent = chardata && chardata.every(cd => {
    const text = cd.TEXT || cd.SEA_WS || "";
    return !text.trim() || TEMPLATE_EXPR_REGEX.test(text);
  });
  
  return hasOnlyTemplateContent && elementCount === 0;
}

function printContent(path, opts, print) {
  let fragments = printContentFragments(path, print);
  const { Comment } = path.getValue();

  if (hasIgnoreRanges(Comment)) {
    fragments = processIgnoredContent(path, opts, print);
  }

  fragments.sort((left, right) => left.offset - right.offset);
  
  const validFragments = fragments.map(({ printed }) => printed).filter(fragment => 
    fragment && fragment !== ""
  );
  
  if (validFragments.length === 0) {
    return "";
  }
  
  if (validFragments.length > 1) {
    return validFragments;
  }
  
  if (shouldKeepInline(path)) {
    return validFragments;
  }
  
  return validFragments;
}

function printElement(path, opts, print) {
  const node = path.getValue();
  const parts = [];
  
  // Print start tag
  if (node.startTag) {
    parts.push(path.call(print, "startTag"));
  }
  
  // Handle children
  if (node.children && node.children.length > 0) {
    const childrenParts = [];
    
    for (let i = 0; i < node.children.length; i++) {
      const printed = path.call(print, "children", i);
      if (printed && printed !== "") {
        childrenParts.push(printed);
      }
    }
    
    if (childrenParts.length > 0) {
      // Check if content should be inlined
      const hasOnlySimpleText = node.children.length === 1 && 
        node.children[0].type === "WXText" && 
        node.children[0].value && 
        node.children[0].value.trim().length < 50 && 
        !node.children[0].value.includes("\n");
      
      if (hasOnlySimpleText) {
        // For inline content
        parts.push(...childrenParts);
      } else {
        // For block content - add proper line breaks and indentation
        if (childrenParts.length > 0) {
          const childrenWithBreaks = [];
          for (let i = 0; i < childrenParts.length; i++) {
            if (i > 0) {
              childrenWithBreaks.push(hardline);
            }
            childrenWithBreaks.push(childrenParts[i]);
          }
          parts.push(indent([hardline, ...childrenWithBreaks]), hardline);
        }
      }
    }
  }
  
  // Print end tag
  if (node.endTag) {
    parts.push(path.call(print, "endTag"));
  }
  
  return group(parts);
}

function printDocument(path, opts, print) {
  const node = path.getValue();
  const { body } = node;
  
  if (!body || body.length === 0) {
    return "";
  }
  
  const parts = [];
  let lastWasElement = false;
  
  body.forEach((child, index) => {
    const printed = path.call(print, "body", index);
    const isElement = child.type === 'WXElement'; // 正确检查是否是元素节点
    
    if (printed && printed !== "") {
      // 只在两个元素节点之间添加换行
      if (parts.length > 0 && isElement && lastWasElement) {
        parts.push(hardline);
      }
      parts.push(printed);
    }
    
    // 更新 lastWasElement，只有当节点有实际输出时才更新
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
  embed,
  preprocess(ast, options) {
    // Build ignore ranges from comment tokens
    if (ast.commentTokens && ast.commentTokens.length > 0) {
      ast.ignoreRanges = buildIgnoreRanges(ast, ast.commentTokens);
    }
    return ast;
  },
  print(path, opts, print) {
    const node = path.getValue();
    const ast = path.stack[0]; // Get root AST
    
    // Check if current node is in ignore range
    if (ast.ignoreRanges && node.location) {
      const nodeStart = node.location.startOffset;
      const nodeEnd = node.location.endOffset;
      
      for (const range of ast.ignoreRanges) {
        if (nodeStart >= range.start && nodeEnd <= range.end) {
          // Return original text for ignored nodes
          return opts.originalText.slice(nodeStart, nodeEnd);
        }
      }
    }
    
    switch (node.type) {
      case "WXAttribute":
        return printAttribute(path, opts, print);
      case "WXCharData":
        return printCharData(path, opts, print);
      case "WXContent":
        return printContent(path, opts, print);
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
        // For simple tokens, just return their value
        return node.image || "";
    }
  }
};

function printStartTag(path, opts, print) {
  const node = path.getValue();
  const parts = [`<${node.name}`];
  
  if (node.attributes && node.attributes.length > 0) {
    const attributeDocs = [];
    for (let i = 0; i < node.attributes.length; i++) {
      attributeDocs.push(path.call(print, "attributes", i));
    }
    
    // Calculate approximate length to decide if we need to break
    const printWidth = opts.wxmlPrintWidth || opts.printWidth || 80;
    const tagName = node.name;
    const approximateLength = tagName.length + 2; // < and >
    
    // Estimate attribute lengths (rough approximation)
    let attributesLength = 0;
    if (node.attributes) {
      attributesLength = node.attributes.reduce((sum, attr) => {
        const keyLength = attr.key ? attr.key.length : 0;
        const valueLength = attr.value ? attr.value.length + 3 : 0; // +3 for =""
        return sum + keyLength + valueLength + 1; // +1 for space
      }, 0);
    }
    
    if (approximateLength + attributesLength > printWidth) {
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
          result += ` ${attr.key}="${attr.value}"`;
        }
      }
      result += ">";
    }
    
    // Print content with proper JavaScript formatting
    if (node.value) {
      result += "\n";
      // Apply basic JavaScript formatting rules
      let jsCode = node.value.trim();
      
      // Add space before function parentheses: function( -> function (
      jsCode = jsCode.replace(/function\s*\(/g, 'function (');
      
      // Handle semicolons based on options
       if (opts.wxsSemi === false) {
         // Remove semicolons at end of lines
         jsCode = jsCode.replace(/;\s*$/gm, '');
       } else {
         // Ensure semicolons at end of statements (but not before { or after })
         jsCode = jsCode.replace(/([^;\s{}])\s*$/gm, (match, p1) => {
           // Don't add semicolon if line ends with { or }
           if (p1 === '{' || p1 === '}') return match;
           return p1 + ';';
         });
       }
      
      // Handle quotes based on options
      if (opts.wxsSingleQuote !== false) {
        // Convert double quotes to single quotes for strings
        jsCode = jsCode.replace(/"([^"]*)"/g, "'$1'");
      }
      
      // Split into lines and add indentation
      const lines = jsCode.split('\n');
      const indentedLines = lines.map(line => 
        line.trim() ? `  ${line}` : line
      );
      result += indentedLines.join('\n');
      result += "\n";
    }
    
    // Print end tag manually
    if (node.endTag) {
      result += `</${node.endTag.name}>`;
    }
    
    return result;
  }
  
  return "";
}

export default printer;