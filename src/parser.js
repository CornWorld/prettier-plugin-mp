import { parse as wxmlParse } from "@wxml/parser";

// Protect wxs content from XML parser
function protectWxsContent(text, protectedItems) {
  let wxsIndex = 0;
  return text.replace(/(<wxs[^>]*>)([\s\S]*?)(<\/wxs>)/g, (match, openTag, content, closeTag) => {
    const placeholder = `__WXS_CONTENT_${wxsIndex}__`;
    protectedItems.push({ 
      placeholder, 
      content: content.trim(), 
      type: 'WXS_CONTENT'
    });
    wxsIndex++;
    return `${openTag}${placeholder}${closeTag}`;
  });
}

// Protect template expressions from XML parser
function protectTemplateExpressions(text, protectedItems) {
  let templateIndex = 0;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, content) => {
    const placeholder = `__TEMPLATE_EXPR_${templateIndex}__`;
    protectedItems.push({ 
      placeholder, 
      content: content, // Keep original spacing
      type: 'TEMPLATE_EXPR'
    });
    templateIndex++;
    return placeholder;
  });
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
  if (!str || typeof str !== 'string') return str;
  
  protectedItems.forEach(({ placeholder, content, type }) => {
    if (str.includes(placeholder)) {
      if (type === 'WXS_CONTENT') {
        str = str.replaceAll(placeholder, content);
      } else if (type === 'TEMPLATE_EXPR') {
        str = str.replaceAll(placeholder, `{{${content}}}`);
      }
    }
  });
  
  return str;
}

// Restore attribute values
function restoreAttributeValue(value, protectedItems) {
  if (!value || typeof value !== 'string') return value;
  
  for (const { placeholder, content, type } of protectedItems) {
    if (value.includes(placeholder)) {
      if (type === 'WXS_CONTENT') {
        value = value.replaceAll(placeholder, content);
      } else if (type === 'TEMPLATE_EXPR') {
        value = value.replaceAll(placeholder, `{{${content}}}`);
      }
    }
  }
  
  return value;
}

// Recursively restore protected content in AST
function restoreProtectedContent(node, protectedItems) {
  if (!node || typeof node !== 'object') return node;
  
  if (Array.isArray(node)) {
    return node.map(child => restoreProtectedContent(child, protectedItems));
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
  Object.keys(node).forEach(key => {
    if (typeof node[key] === 'object') {
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
  }
};

export default parser;