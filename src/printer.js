import * as doc from "prettier/doc";
import embed from "./embed.js";

const { group, hardline, indent, join, line, softline } = doc.builders;

const ignoreStartComment = "<!-- prettier-ignore-start -->";
const ignoreEndComment = "<!-- prettier-ignore-end -->";

function hasIgnoreRanges(comments) {
  if (comments.length === 0) {
    return false;
  }

  comments.sort((left, right) => left.startOffset - right.startOffset);

  let startFound = false;
  for (let idx = 0; idx < comments.length; idx += 1) {
    if (comments[idx].image === ignoreStartComment) {
      startFound = true;
    } else if (startFound && comments[idx].image === ignoreEndComment) {
      return true;
    }
  }

  return false;
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

function isWhitespaceIgnorable(content) {
  // For WXML, we only preserve whitespace if it contains template expressions
  if (content && content.chardata) {
    for (const chardata of content.chardata) {
      const text = chardata.TEXT || chardata.SEA_WS || "";
      if (TEMPLATE_EXPR_REGEX.test(text)) {
        return false;
      }
    }
  }
  return true;
}

function printAttribute(path, opts, print) {
  const node = path.getValue();
  const { Name, EQUALS, STRING } = node;
  
  // Handle quote style for WXML
  let attributeValue = STRING;
  if (opts.wxmlSingleQuote && STRING.startsWith('"') && STRING.endsWith('"')) {
    const content = STRING.slice(1, -1);
    if (!content.includes("'")) {
      attributeValue = `'${content}'`;
    }
  } else if (!opts.wxmlSingleQuote && STRING.startsWith("'") && STRING.endsWith("'")) {
    const content = STRING.slice(1, -1);
    if (!content.includes('"')) {
      attributeValue = `"${content}"`;
    }
  }
  
  return [Name, EQUALS, attributeValue];
}

function printCharData(path, opts, print) {
  const node = path.getValue();
  const { SEA_WS, TEXT } = node;
  
  if (SEA_WS) {
    // In indent mode, filter out pure whitespace
    if (opts.useTabs || opts.tabWidth > 0) {
      const trimmed = SEA_WS.trim();
      return trimmed ? SEA_WS : "";
    }
    return SEA_WS;
  }
  
  return TEXT || "";
}

function printContentFragments(path, print) {
  const node = path.getValue();
  const { CData, Comment, chardata, element, reference } = node;
  
  const fragments = [];
  
  // Add comments with offset tracking
  if (Comment) {
    Comment.forEach((comment, index) => {
      const printed = path.call(print, "Comment", index);
      if (printed && printed !== "") {
        fragments.push({
          offset: comment.location ? comment.location.startOffset : 0,
          printed
        });
      }
    });
  }
  
  // Add character data with offset tracking
  if (chardata) {
    chardata.forEach((cd, index) => {
      const printed = path.call(print, "chardata", index);
      if (printed && printed !== "") {
        fragments.push({
          offset: cd.location ? cd.location.startOffset : 0,
          printed
        });
      }
    });
  }
  
  // Add elements with offset tracking
  if (element) {
    element.forEach((el, index) => {
      const printed = path.call(print, "element", index);
      if (printed && printed !== "") {
        fragments.push({
          offset: el.location ? el.location.startOffset : 0,
          printed
        });
      }
    });
  }
  
  // Add CData (for wxs content)
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

function printContent(path, opts, print) {
  let fragments = printContentFragments(path, print);
  const { Comment } = path.getValue();

  if (hasIgnoreRanges(Comment)) {
    Comment.sort((left, right) => left.startOffset - right.startOffset);

    const ignoreRanges = [];
    let ignoreStart = null;

    // Build up a list of ignored ranges from the original text based on
    // the special prettier-ignore-* comments
    Comment.forEach((comment) => {
      if (comment.image === ignoreStartComment) {
        ignoreStart = comment;
      } else if (ignoreStart && comment.image === ignoreEndComment) {
        ignoreRanges.push({
          start: ignoreStart.startOffset,
          end: comment.endOffset
        });

        ignoreStart = null;
      }
    });

    // Get all content nodes with their offsets
    const contentNodes = [];
    const { element, chardata, CData } = path.getValue();
    
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
    
    // Sort by start offset
    contentNodes.sort((a, b) => a.start - b.start);
    
    const result = [];
    
    contentNodes.forEach(contentNode => {
      const isInIgnoreRange = ignoreRanges.some(range => 
        contentNode.start >= range.start && contentNode.end <= range.end
      );
      
      if (isInIgnoreRange) {
        // Use original text for ignored content
        const originalContent = opts.originalText.slice(contentNode.start, contentNode.end + 1);
        result.push({
          offset: contentNode.start,
          printed: doc.utils.replaceEndOfLine(originalContent)
        });
      } else {
        // Use formatted content
        if (contentNode.type === 'element') {
          const printed = path.call(print, "element", contentNode.index);
          if (printed && printed !== "") {
            result.push({
              offset: contentNode.start,
              printed
            });
          }
        } else if (contentNode.type === 'chardata') {
          const printed = path.call(print, "chardata", contentNode.index);
          if (printed && printed !== "") {
            result.push({
              offset: contentNode.start,
              printed
            });
          }
        }
      }
    });
    
    fragments = result;
  }

  fragments.sort((left, right) => left.offset - right.offset);
  
  const validFragments = fragments.map(({ printed }) => printed).filter(fragment => 
    fragment && fragment !== ""
  );
  
  if (validFragments.length === 0) {
    return "";
  }
  
  // Check if we have multiple elements that need line breaks
  const elementCount = path.getValue().element ? path.getValue().element.length : 0;
  if (elementCount > 1) {
    // Add line breaks between multiple elements
    const result = [];
    for (let i = 0; i < validFragments.length; i++) {
      if (i > 0 && validFragments[i] && validFragments[i-1]) {
        result.push(hardline);
      }
      result.push(validFragments[i]);
    }
    return result;
  }
  
  // Check if content only contains template expressions and whitespace
  const { chardata } = path.getValue();
  const hasOnlyTemplateContent = chardata && chardata.every(cd => {
    const text = cd.TEXT || cd.SEA_WS || "";
    return !text.trim() || TEMPLATE_EXPR_REGEX.test(text);
  });
  
  if (hasOnlyTemplateContent && elementCount === 0) {
    // Keep template expressions inline
    return validFragments;
  }
  
  return validFragments;
}

function printElement(path, opts, print) {
  const node = path.getValue();
  const { OPEN, Name, attribute, START_CLOSE, content, SLASH_CLOSE, SLASH_OPEN, END_NAME, END } = node;
  
  // Check if this element should be ignored based on preceding comment
   const parent = path.getParentNode();
   if (parent && parent.Comment) {
     const elementOffset = node.location ? node.location.startOffset : 0;
     const precedingComment = parent.Comment.find(comment => {
       const commentEnd = comment.location ? comment.location.endOffset : 0;
       return comment.image === "<!-- prettier-ignore -->" && commentEnd < elementOffset;
     });
     
     if (precedingComment && precedingComment.location && node.location) {
       // Return original text for ignored element
       const start = precedingComment.location.startOffset;
       const end = node.location.endOffset;
       return opts.originalText.slice(start, end + 1);
     }
   }
  
  const parts = [OPEN, Name];
  
  // Add attributes
  if (attribute && attribute.length > 0) {
    const usePrintWidth = opts.wxmlPrintWidth !== undefined ? opts.wxmlPrintWidth : opts.printWidth;
    
    // Calculate if attributes should be on same line
    const attributesOnSameLine = join(" ", path.map(print, "attribute"));
    const sameLineLength = Name.length + 1 + attributesOnSameLine.toString().length + 1;
    
    if (sameLineLength <= usePrintWidth) {
      parts.push(" ", attributesOnSameLine);
    } else {
      // Put attributes on new lines
      parts.push(
        indent([hardline, join(hardline, path.map(print, "attribute"))]),
        hardline
      );
    }
  }
  
  // Self-closing tag
  if (SLASH_CLOSE) {
    parts.push(" />");
    return group(parts);
  }
  
  parts.push(START_CLOSE);
  
  // Handle content
  if (content) {
    const contentDoc = path.call(print, "content");
    
    // Convert contentDoc to array if it's not already
    const contentParts = Array.isArray(contentDoc) ? contentDoc : [contentDoc];
    
    if (contentParts.length > 0 && contentParts.some(part => part && part !== "")) {
       // Check if content should be inlined
       const hasElements = content.element && content.element.length > 0;
       const hasOnlySimpleText = content.chardata && content.chardata.length > 0 && 
         content.chardata.every(cd => {
           const text = cd.TEXT || cd.SEA_WS || "";
           return text.trim().length < 50 && !text.includes("\n");
         });
       
       const shouldInline = !hasElements && hasOnlySimpleText;
       
       if (shouldInline) {
         // For inline content
         parts.push(...contentParts);
       } else {
         // For block content
         parts.push(indent([hardline, ...contentParts]), hardline);
       }
     }
  }
  
  // Closing tag
  if (END_NAME) {
    parts.push(SLASH_OPEN, END_NAME, END);
  }
  
  return group(parts);
}

function printDocument(path, opts, print) {
  const node = path.getValue();
  const { element, misc } = node;
  
  const parts = [];
  
  // Add misc comments before elements
  if (misc && misc.length > 0) {
    misc.forEach((miscNode, index) => {
      const printed = path.call(print, "misc", index);
      if (printed && printed !== "") {
        parts.push(printed, hardline);
      }
    });
  }
  
  // Add all elements
  if (element && element.length > 0) {
    element.forEach((el, index) => {
      const printed = path.call(print, "element", index);
      if (printed && printed !== "") {
        if (parts.length > 0) {
          parts.push(hardline);
        }
        parts.push(printed);
      }
    });
  }
  
  if (parts.length > 0) {
    parts.push(hardline);
    return parts;
  }
  
  return "";
}

function printComment(path, opts, print) {
  const node = path.getValue();
  return node.image;
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
    
    switch (node.name) {
      case "attribute":
        return printAttribute(path, opts, print);
      case "chardata":
        return printCharData(path, opts, print);
      case "content":
        return printContent(path, opts, print);
      case "document":
        return printDocument(path, opts, print);
      case "element":
        return printElement(path, opts, print);
      case "Comment":
        return printComment(path, opts, print);
      case "misc":
        return printMisc(path, opts, print);
      default:
        // For simple tokens, just return their value
        return node.image || "";
    }
  }
};

function printMisc(path, opts, print) {
  const node = path.getValue();
  const { Comment, PROCESSING_INSTRUCTION, SEA_WS } = node;
  
  if (Comment) {
    return Comment;
  }
  
  if (PROCESSING_INSTRUCTION) {
    return PROCESSING_INSTRUCTION;
  }
  
  return "";
}

export default printer;