// Prettier Plugin for WeChat Mini Program
// 支持 WXML 和 WXS 文件的格式化

const prettier = require('prettier');
const { doc } = require('prettier');
const { group, indent, join, line, softline, hardline, literalline, dedentToRoot } = doc.builders;

// 直接引入 HTML 解析器
let htmlParser;
try {
  htmlParser = require('prettier/plugins/html');
} catch (e) {
  try {
    htmlParser = require('prettier/parser-html');
  } catch (e2) {
    // 如果都找不到，使用简单的解析器
    htmlParser = null;
  }
}

// WXML 解析器
function parse(text, parsers, options) {
  if (htmlParser && htmlParser.parsers && htmlParser.parsers.html) {
    return htmlParser.parsers.html.parse(text, parsers, options);
  }
  
  // 如果 HTML 解析器可用
  if (parsers && parsers.html) {
    return parsers.html.parse(text, parsers, options);
  }
  
  throw new Error('HTML parser not available');
}

// WXS 嵌入处理
function embed(path, options) {
  const node = path.getValue();
  
  if (node.type === 'element' && node.name === 'wxs') {
    // 检查是否有文本内容
    const textNode = node.children && node.children.find(child => child.type === 'text');
    if (textNode && textNode.value && textNode.value.trim()) {
      const wxsCode = textNode.value.trim();
      
      return async (textToDoc, print, path, options) => {
          try {
              // 使用 JavaScript 解析器格式化 WXS 代码
               // 直接使用 prettier.format 格式化代码
                const wxsOptions = {
                  parser: 'babel',
                  printWidth: options.wxsPrintWidth || 80,
                  tabWidth: options.wxsTabWidth || 2,
                  semi: options.wxsSemi !== false,
                  singleQuote: options.wxsSingleQuote !== false
                };
                
                const formattedCodeString = await prettier.format(wxsCode, wxsOptions);
                
                // 移除末尾的换行符并分割成行
                const lines = formattedCodeString.trim().split('\n');
                const formattedCode = lines.length === 1 ? lines[0] : join(hardline, lines);
              
              // 构建属性字符串
              let attrs = '';
              if (node.attrs && node.attrs.length > 0) {
                attrs = ' ' + node.attrs.map(attr => `${attr.name}="${attr.value}"`).join(' ');
              }
              
              return group([
                   `<wxs${attrs}>`,
                   literalline,
                   dedentToRoot(doc.utils.replaceEndOfLine(formattedCode)),
                   hardline,
                   '</wxs>'
                 ]);
           } catch (error) {
             // 如果格式化失败，返回原始代码但保持结构
             console.error('WXS formatting error:', error);
             
             // 构建属性字符串
             let attrs = '';
             if (node.attrs && node.attrs.length > 0) {
               attrs = ' ' + node.attrs.map(attr => `${attr.name}="${attr.value}"`).join(' ');
             }
             
             return group([
               `<wxs${attrs}>`,
               hardline,
               indent(wxsCode),
               hardline,
               '</wxs>'
             ]);
           }
        };
      }
  }
  
  return null;
}

// 获取 HTML 打印器
const htmlPrinter = require('prettier/plugins/html').printers.html;

// 检测文本是否包含微信绑定表达式
function containsWechatBinding(text) {
  return /\{\{[^}]*\}\}/.test(text);
}

// 格式化绑定表达式中的 JavaScript 代码（同步版本）
function formatBindingExpression(text) {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, jsCode) => {
    try {
      // 使用同步的方式格式化 JavaScript 代码
      const trimmedCode = jsCode.trim();
      // 简单的空格格式化规则
      const formatted = trimmedCode
        .replace(/&&/g, ' && ')
        .replace(/\|\|/g, ' || ')
        .replace(/\s+/g, ' ')
        .replace(/\s*([<>=!]+)\s*/g, ' $1 ')
        .replace(/\s*([+\-*/])\s*/g, ' $1 ')
        .replace(/\s+/g, ' ')
        .trim();
      return `{{${formatted}}}`;
    } catch (e) {
      // 如果格式化失败，返回原始内容
      return match;
    }
  });
}

// 递归收集元素的文本内容，保持原始格式
function collectTextContent(node) {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type === 'interpolation') {
    // 从源码位置重建插值表达式
    const sourceSpan = node.sourceSpan;
    if (sourceSpan && sourceSpan.start && sourceSpan.end) {
      const content = sourceSpan.start.file.content;
      return content.substring(sourceSpan.start.offset, sourceSpan.end.offset);
    }
    return `{{${node.value || ''}}}`;
  }
  if (node.children) {
    return node.children.map(collectTextContent).join('');
  }
  return '';
}

// 从原始源码重建元素内容，保持空格
function rebuildElementContent(node) {
  if (!node.sourceSpan || !node.sourceSpan.start || !node.sourceSpan.end) {
    return formatBindingExpression(collectTextContent(node));
  }
  
  const content = node.sourceSpan.start.file.content;
  const fullElement = content.substring(node.sourceSpan.start.offset, node.sourceSpan.end.offset);
  
  // 提取开始标签和结束标签之间的内容
  const openTagMatch = fullElement.match(/^<[^>]*>/);
  const closeTagMatch = fullElement.match(/<\/[^>]*>$/);
  
  if (openTagMatch && closeTagMatch) {
    const openTagEnd = openTagMatch[0].length;
    const closeTagStart = fullElement.length - closeTagMatch[0].length;
    const rawContent = fullElement.substring(openTagEnd, closeTagStart);
    return formatBindingExpression(rawContent);
  }
  
  return formatBindingExpression(collectTextContent(node));
}

// 自定义打印器，处理微信小程序特殊规则
function customPrint(path, options, print) {
  const node = path.getValue();
  
  // 对于元素节点，检查其子节点或属性是否包含绑定表达式或插值
  if (node.type === 'element') {
    const hasBindingInChildren = node.children && node.children.some(child => 
      (child.type === 'text' && containsWechatBinding(child.value)) ||
      child.type === 'interpolation'
    );
    
    const hasBindingInAttrs = node.attrs && node.attrs.some(attr => 
      containsWechatBinding(attr.value || '')
    );
    
    if (hasBindingInChildren || hasBindingInAttrs) {
        // 手动构建单行格式，保持原始空格
        const attrs = node.attrs && node.attrs.length > 0 
          ? node.attrs.map(attr => {
              const name = attr.fullName || attr.name;
              const value = formatBindingExpression(attr.value || '');
              return ` ${name}="${value}"`;
            }).join('') 
          : '';
        
        const openTag = `<${node.name}${attrs}>`;
        const closeTag = `</${node.name}>`;
        const content = rebuildElementContent(node);
        
        return `${openTag}${content}${closeTag}`;
      }
  }
  
  // 其他情况使用原始 HTML 打印器
  return htmlPrinter.print(path, options, print);
}

module.exports = {
  languages: [
    {
      name: 'wxml',
      parsers: ['wxml'],
      extensions: ['.wxml'],
      vscodeLanguageIds: ['wxml']
    }
  ],
  options: {
    wxmlTabWidth: {
      type: 'int',
      category: 'WXML',
      default: 2,
      description: 'Number of spaces per indentation level for WXML.'
    },
    wxmlPrintWidth: {
      type: 'int',
      category: 'WXML',
      default: 80,
      description: 'The line length where Prettier will try wrap for WXML.'
    },
    wxmlSingleQuote: {
      type: 'boolean',
      category: 'WXML',
      default: false,
      description: 'Use single quotes instead of double quotes in WXML attributes.'
    },
    wxsTabWidth: {
      type: 'int',
      category: 'WXS',
      default: 2,
      description: 'Number of spaces per indentation level for WXS code.'
    },
    wxsPrintWidth: {
      type: 'int',
      category: 'WXS',
      default: 80,
      description: 'The line length where Prettier will try wrap for WXS code.'
    },
    wxsSingleQuote: {
      type: 'boolean',
      category: 'WXS',
      default: true,
      description: 'Use single quotes instead of double quotes in WXS code.'
    },
    wxsSemi: {
      type: 'boolean',
      category: 'WXS',
      default: true,
      description: 'Print semicolons at the ends of statements in WXS code.'
    }
  },
  parsers: {
    wxml: {
      parse,
      astFormat: 'html-ast',
      locStart: (node) => node.sourceSpan?.start?.offset || 0,
      locEnd: (node) => node.sourceSpan?.end?.offset || 0,
    },
  },
  printers: {
    'html-ast': {
      print: customPrint,
      embed,
      ...(htmlPrinter.preprocess && { preprocess: htmlPrinter.preprocess }),
      ...(htmlPrinter.getVisitorKeys && { getVisitorKeys: htmlPrinter.getVisitorKeys }),
    },
  },
  options: {},
  defaultOptions: {
    tabWidth: 2,
    printWidth: 80,
    useTabs: false,
  },
};