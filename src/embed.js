import * as doc from "prettier/doc";

const {
  dedentToRoot,
  group,
  hardline,
  indent,
  join,
  line,
  literalline,
  softline
} = doc.builders;

// Get the start and end element tags from the current node on the tree
function getElementTags(path, opts, print) {
  const node = path.getValue();
  const { OPEN, Name, attribute, START_CLOSE, SLASH_OPEN, END_NAME, END } =
    node;

  const parts = [OPEN, Name];

  if (attribute.length > 0) {
    parts.push(indent([line, join(line, path.map(print, "attribute"))]));
  }

  if (!opts.bracketSameLine) {
    parts.push(softline);
  }

  return {
    openTag: group([...parts, START_CLOSE]),
    closeTag: group([SLASH_OPEN, END_NAME, END])
  };
}

// Get the name of the parser for WXS content
function getParser(node, opts) {
  const tagName = node.Name || node.name;
  if (!tagName) {
    return null;
  }
  
  const parser = tagName.toLowerCase();

  // Only handle wxs tags
  if (parser !== "wxs") {
    return null;
  }

  // Check if babel parser is available
  if (
    opts.plugins.some(
      (plugin) =>
        typeof plugin !== "string" &&
        plugin.parsers &&
        Object.prototype.hasOwnProperty.call(plugin.parsers, "babel")
    )
  ) {
    return "babel";
  }

  return "babel"; // Default to babel for WXS
}

// Get the source string from the content of the wxs element
function getSource(content) {
  return content.chardata
    .map((node) => {
      const { SEA_WS, TEXT } = node;
      const image = SEA_WS || TEXT;

      return {
        offset: node.location.startOffset,
        printed: image
      };
    })
    .sort(({ offset }) => offset)
    .map(({ printed }) => printed)
    .join("");
}

function embed(path, opts) {
  const node = path.getValue();

  // If the node isn't an element node, then skip
  if (!node || typeof node !== "object") {
    return;
  }

  // Only handle wxs tags
  const parser = getParser(node, opts);
  if (!parser) {
    return;
  }

  // If the node is self-closing, then skip
  if (!node.content) {
    return;
  }

  // If the node does not actually contain content, or it contains any content
  // that is not just plain text, then skip.
  const content = node.content;
  if (
    content.chardata.length === 0 ||
    content.CData.length > 0 ||
    content.Comment.length > 0 ||
    content.element.length > 0 ||
    content.PROCESSING_INSTRUCTION.length > 0 ||
    content.reference.length > 0
  ) {
    return;
  }

  return async function (textToDoc, print) {
    // Get the open and close tags of this element
    const { openTag, closeTag } = getElementTags(path, opts, print);
    
    // Get WXS-specific options
    const wxsOptions = {
      ...opts,
      parser,
      semi: opts.wxsSemi !== undefined ? opts.wxsSemi : true,
      singleQuote: opts.wxsSingleQuote !== undefined ? opts.wxsSingleQuote : true,
      tabWidth: opts.wxsTabWidth !== undefined ? opts.wxsTabWidth : opts.tabWidth || 2,
      printWidth: opts.printWidth || 80,
      // Ensure proper JavaScript formatting
      bracketSpacing: true,
      arrowParens: "avoid"
    };

    const source = getSource(content);
    
    try {
      const docNode = await textToDoc(source, wxsOptions);
      
      // Ensure we return a valid document
      if (!docNode) {
        return group([
          openTag,
          literalline,
          indent(source),
          hardline,
          closeTag
        ]);
      }
      
      return group([
        openTag,
        indent([hardline, docNode]),
        hardline,
        closeTag
      ]);
    } catch (error) {
      // If formatting fails, return the original content with proper indentation
      const lines = source.split('\n').map(line => line.trim()).filter(line => line);
      const indentedLines = lines.map(line => `  ${line}`);
      
      return group([
        openTag,
        hardline,
        indentedLines.join('\n'),
        hardline,
        closeTag
      ]);
    }
  };
}

export default embed;