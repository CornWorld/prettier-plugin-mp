import { parse as xmlToolsParse } from "@xml-tools/parser";

function createError(message, options) {
  const error = new SyntaxError(
    message +
      " (" +
      options.loc.start.line +
      ":" +
      options.loc.start.column +
      ")"
  );

  return Object.assign(error, options);
}

function simplifyCST(node) {
  switch (node.name) {
    case "attribute": {
      const { Name, EQUALS, STRING } = node.children;

      return {
        name: "attribute",
        Name: Name[0].image,
        EQUALS: EQUALS[0].image,
        STRING: STRING[0].image,
        location: node.location
      };
    }
    case "chardata": {
      const { SEA_WS, TEXT } = node.children;

      return {
        name: "chardata",
        SEA_WS: SEA_WS ? SEA_WS[0].image : null,
        TEXT: TEXT ? TEXT[0].image : null,
        location: node.location
      };
    }
    case "content": {
      const {
        CData,
        Comment,
        chardata,
        element,
        PROCESSING_INSTRUCTION,
        reference
      } = node.children;

      return {
        name: "content",
        CData: CData || [],
        Comment: Comment ? Comment.map(simplifyCST) : [],
        chardata: chardata ? chardata.map(simplifyCST) : [],
        element: element ? element.map(simplifyCST) : [],
        PROCESSING_INSTRUCTION: PROCESSING_INSTRUCTION || [],
        reference: reference ? reference.map(simplifyCST) : [],
        location: node.location
      };
    }
    case "docTypeDecl": {
      const { DocType, Name, externalID, CLOSE } = node.children;

      return {
        name: "docTypeDecl",
        DocType: DocType[0].image,
        Name: Name[0].image,
        externalID: externalID ? simplifyCST(externalID[0]) : null,
        CLOSE: CLOSE[0].image,
        location: node.location
      };
    }
    case "document": {
      const { docTypeDecl, element, misc, prolog } = node.children;

      return {
        name: "document",
        docTypeDecl: docTypeDecl ? simplifyCST(docTypeDecl[0]) : null,
        element: element ? element.map(simplifyCST) : [],
        misc: (misc || [])
          .filter((child) => !child.children.SEA_WS)
          .map(simplifyCST),
        prolog: prolog ? simplifyCST(prolog[0]) : null,
        location: node.location
      };
    }
    case "element": {
      const {
        OPEN,
        Name,
        attribute,
        START_CLOSE,
        content,
        SLASH_OPEN,
        END_NAME,
        END,
        SLASH_CLOSE
      } = node.children;

      return {
        name: "element",
        OPEN: OPEN[0].image,
        Name: Name[0].image,
        attribute: attribute ? attribute.map(simplifyCST) : [],
        START_CLOSE: START_CLOSE ? START_CLOSE[0].image : null,
        content: content ? simplifyCST(content[0]) : null,
        SLASH_OPEN: SLASH_OPEN ? SLASH_OPEN[0].image : null,
        END_NAME: END_NAME ? END_NAME[0].image : null,
        END: END ? END[0].image : null,
        SLASH_CLOSE: SLASH_CLOSE ? SLASH_CLOSE[0].image : null,
        location: node.location
      };
    }
    case "externalID": {
      const { Public, PubIDLiteral, System, SystemLiteral } = node.children;

      return {
        name: "externalID",
        Public: Public ? Public[0].image : null,
        PubIDLiteral: PubIDLiteral ? PubIDLiteral[0].image : null,
        System: System ? System[0].image : null,
        SystemLiteral: SystemLiteral ? SystemLiteral[0].image : null,
        location: node.location
      };
    }
    case "misc": {
      const { Comment, PROCESSING_INSTRUCTION, SEA_WS } = node.children;

      return {
        name: "misc",
        Comment: Comment ? Comment[0].image : null,
        PROCESSING_INSTRUCTION: PROCESSING_INSTRUCTION
          ? PROCESSING_INSTRUCTION[0].image
          : null,
        SEA_WS: SEA_WS ? SEA_WS[0].image : null,
        location: node.location
      };
    }
    case "prolog": {
      const { XMLDeclOpen, attribute, SPECIAL_CLOSE } = node.children;

      return {
        name: "prolog",
        XMLDeclOpen: XMLDeclOpen[0].image,
        attribute: attribute ? attribute.map(simplifyCST) : [],
        SPECIAL_CLOSE: SPECIAL_CLOSE[0].image,
        location: node.location
      };
    }
    case "reference": {
      const { CharRef, EntityRef } = node.children;

      return {
        name: "reference",
        CharRef: CharRef ? CharRef[0].image : null,
        EntityRef: EntityRef ? EntityRef[0].image : null,
        location: node.location
      };
    }
    case "Comment": {
      return {
        name: "Comment",
        image: node.image,
        startOffset: node.startOffset,
        endOffset: node.endOffset,
        location: node.location
      };
    }
    default: {
      return {
        name: node.name,
        image: node.image,
        location: node.location
      };
    }
  }
}

// Pre-process template expressions to avoid XML parsing issues
function preprocessTemplateExpressions(text) {
  const protectedItems = [];
  let processedText = text;
  
  // First protect wxs content
  let wxsIndex = 0;
  processedText = processedText.replace(/(<wxs[^>]*>)([\s\S]*?)(<\/wxs>)/g, (match, openTag, content, closeTag) => {
    const placeholder = `__WXS_CONTENT_${wxsIndex}__`;
    protectedItems.push({ 
      placeholder, 
      content: content.trim(), 
      original: match, 
      type: 'WXS_CONTENT'
    });
    wxsIndex++;
    return `${openTag}${placeholder}${closeTag}`;
  });
  
  // Then protect template expressions
  let templateIndex = 0;
  processedText = processedText.replace(/\{\{([^}]+)\}\}/g, (match, content) => {
    const placeholder = `__TEMPLATE_EXPR_${templateIndex}__`;
    protectedItems.push({ 
      placeholder, 
      content: content.trim(), 
      original: match, 
      type: 'TEMPLATE_EXPR'
    });
    templateIndex++;
    return `{{${placeholder}}}`;
  });
  
  return { processedText, protectedItems };
}

// Restore protected content in AST
function restoreProtectedContent(node, protectedItems) {
  if (!node || typeof node !== 'object') return node;
  
  // Handle different node types
  if (node.TEXT) {
    protectedItems.forEach(({ placeholder, content, original, type }) => {
      if (node.TEXT.includes(placeholder)) {
        if (type === 'WXS_CONTENT') {
          node.TEXT = node.TEXT.replace(placeholder, content);
        } else if (type === 'TEMPLATE_EXPR') {
          node.TEXT = node.TEXT.replace(`{{${placeholder}}}`, original);
        }
      }
    });
  }
  
  if (node.STRING) {
    protectedItems.forEach(({ placeholder, content, original, type }) => {
      if (node.STRING.includes(placeholder)) {
        if (type === 'WXS_CONTENT') {
          node.STRING = node.STRING.replace(placeholder, content);
        } else if (type === 'TEMPLATE_EXPR') {
          node.STRING = node.STRING.replace(`{{${placeholder}}}`, original);
        }
      }
    });
  }
  
  // Recursively process children
  if (Array.isArray(node)) {
    return node.map(child => restoreProtectedContent(child, protectedItems));
  }
  
  Object.keys(node).forEach(key => {
    if (typeof node[key] === 'object') {
      node[key] = restoreProtectedContent(node[key], protectedItems);
    }
  });
  
  return node;
}

// Check if text has multiple root elements
function hasMultipleRoots(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('<')) return false;
  
  // Find the end of the first root element
  let depth = 0;
  let inTag = false;
  let inString = false;
  let stringChar = null;
  let firstRootEnd = -1;
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prevChar = i > 0 ? trimmed[i - 1] : null;
    
    if (inString) {
      if (char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '<') {
      inTag = true;
      if (trimmed[i + 1] === '/') {
        depth--;
      } else if (trimmed[i + 1] !== '!' && trimmed[i + 1] !== '?') {
        depth++;
      }
    } else if (char === '>' && inTag) {
      inTag = false;
      if (prevChar === '/') {
        depth--;
      }
      if (depth === 0 && firstRootEnd === -1) {
        firstRootEnd = i;
      }
    }
  }
  
  if (firstRootEnd === -1) return false;
  
  // Check if there's more content after the first root
  const remaining = trimmed.slice(firstRootEnd + 1).trim();
  return remaining.length > 0 && remaining.startsWith('<');
}

const parser = {
  parse(text) {
    try {
      // Pre-process template expressions
      const { processedText, protectedItems } = preprocessTemplateExpressions(text);
      
      // Check for multiple roots and wrap if necessary
      let needsUnwrapping = false;
      let textToParse = processedText;
      
      if (hasMultipleRoots(processedText)) {
        textToParse = `<__wxml_root__>${processedText}</__wxml_root__>`;
        needsUnwrapping = true;
      }
      
      const { cst, tokenVector, lexErrors, parseErrors } = xmlToolsParse(textToParse);

      if (lexErrors.length > 0) {
        throw createError(lexErrors[0].message, {
          loc: {
            start: {
              line: lexErrors[0].line,
              column: lexErrors[0].column
            }
          }
        });
      }

      if (parseErrors.length > 0) {
        throw createError(parseErrors[0].message, {
          loc: {
            start: {
              line: parseErrors[0].token.startLine,
              column: parseErrors[0].token.startColumn
            }
          }
        });
      }

      // Extract comment tokens from tokenVector
      const commentTokens = tokenVector.filter(token => 
        token.tokenType && token.tokenType.name === 'Comment'
      );

      let ast = simplifyCST(cst);
      
      // Restore protected content
      ast = restoreProtectedContent(ast, protectedItems);
      
      // Unwrap virtual root if it was added
      if (needsUnwrapping && ast.name === 'document' && ast.element && ast.element.length === 1) {
        const rootElement = ast.element[0];
        if (rootElement.Name === '__wxml_root__') {
          // Extract child elements from the virtual root
          const childElements = [];
          if (rootElement.content && rootElement.content.element) {
            childElements.push(...rootElement.content.element);
          }
          // Create a new document with multiple root elements
          ast = {
            name: 'document',
            element: childElements,
            misc: ast.misc || [],
            docTypeDecl: ast.docTypeDecl || null,
            prolog: ast.prolog || null,
            location: ast.location
          };
        }
      }
      
      // Add comment tokens to AST for ignore functionality
      ast.commentTokens = commentTokens;
      
      return ast;
    } catch (error) {
      throw createError(error.message, {
        loc: { start: { line: 1, column: 1 } }
      });
    }
  },
  astFormat: "wxml",
  locStart(node) {
    return node.location ? node.location.startOffset : 0;
  },
  locEnd(node) {
    return node.location ? node.location.endOffset : 0;
  }
};

export default parser;