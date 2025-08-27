// WXML Plugin Tests - Linus style: test what matters, not what doesn't
const plugin = require('../src/index.js');
const prettier = require('prettier');

describe('WXML Plugin', () => {
  // Basic structure tests - these better work or we're fucked
  test('plugin exports correct structure', () => {
    expect(plugin).toBeDefined();
    expect(plugin.languages).toBeDefined();
    expect(plugin.parsers).toBeDefined();
    expect(plugin.printers).toBeDefined();
  });

  test('supports wxml language', () => {
    const wxmlLang = plugin.languages.find(lang => lang.name === 'wxml');
    expect(wxmlLang).toBeDefined();
    expect(wxmlLang.extensions).toContain('.wxml');
  });

  test('has wxml parser', () => {
    expect(plugin.parsers.wxml).toBeDefined();
    expect(typeof plugin.parsers.wxml.parse).toBe('function');
  });

  test('has wxml printer', () => {
    expect(plugin.printers['html-ast']).toBeDefined();
    expect(typeof plugin.printers['html-ast'].print).toBe('function');
    expect(typeof plugin.printers['html-ast'].embed).toBe('function');
  });

  // Real formatting tests - this is where the rubber meets the road
  describe('WXML Formatting', () => {
    const formatWxml = async (code, options = {}) => {
      return await prettier.format(code, {
        parser: 'wxml',
        plugins: [plugin],
        ...options
      });
    };

    test('formats basic WXML structure', async () => {
      const input = '<view><text>Hello</text></view>';
      const expected = '<view><text>Hello</text></view>\n';
      const result = await formatWxml(input);
      expect(result).toBe(expected);
    });

    test('handles WeChat directives properly', async () => {
      const input = '<view wx:if="{{show}}"><text wx:for="{{items}}" wx:key="id">{{item.name}}</text></view>';
      const result = await formatWxml(input);
      expect(result).toContain('wx:if');
      expect(result).toContain('wx:for');
      expect(result).toContain('wx:key');
    });

    test('formats self-closing tags correctly', async () => {
      const input = '<image src="{{url}}"/><input type="text"/>';
      const result = await formatWxml(input);
      expect(result).toContain('<image');
      expect(result).toContain('<input');
      expect(result).toContain('src=');
    });

    test('preserves data binding expressions', async () => {
      const input = '<text>{{user.name}} - {{user.age}}</text>';
      const result = await formatWxml(input);
      expect(result).toContain('{{user.name}}');
      expect(result).toContain('{{user.age}}');
    });
  });

  // WXS formatting tests - the real challenge
  describe('WXS Formatting', () => {
    const formatWxml = async (code, options = {}) => {
      return await prettier.format(code, {
        parser: 'wxml',
        plugins: [plugin],
        ...options
      });
    };

    test('formats embedded WXS code', async () => {
      const input = '<wxs module="utils">function format(str){return str.toUpperCase();}</wxs>';
      const result = await formatWxml(input);
      expect(result).toContain('function format(str) {');
      expect(result).toContain('return str.toUpperCase();');
    });

    test('handles WXS with custom options', async () => {
      const input = '<wxs module="test">var a=1;var b=2;</wxs>';
      const result = await formatWxml(input, {
        wxsSemi: false,
        wxsSingleQuote: true
      });
      expect(result).toContain('var a = 1');
      expect(result).toContain('var b = 2');
    });

    test('formats complex WXS with multiple functions', async () => {
      const input = '<wxs module="helper">function add(a,b){return a+b;}function multiply(a,b){return a*b;}</wxs>';
      const result = await formatWxml(input);
      expect(result).toContain('function add(a, b) {');
      expect(result).toContain('function multiply(a, b) {');
    });
  });

  // Configuration tests - make sure options actually work
  describe('Configuration Options', () => {
    test('accepts wxmlTabWidth option without errors', async () => {
      const input = '<view><text>Hello</text></view>';
      const result = await prettier.format(input, {
        parser: 'wxml',
        plugins: [plugin],
        wxmlTabWidth: 4
      });
      expect(result).toContain('<view>');
      expect(result).toContain('<text>');
    });

    test('accepts wxmlSingleQuote option without errors', async () => {
      const input = '<view class="container">Content</view>';
      const result = await prettier.format(input, {
        parser: 'wxml',
        plugins: [plugin],
        wxmlSingleQuote: true
      });
      expect(result).toContain('class=');
      expect(result).toContain('Content');
    });
  });

  // Edge cases - because the real world is messy
  describe('Edge Cases', () => {
    const formatWxml = async (code) => {
      return await prettier.format(code, {
        parser: 'wxml',
        plugins: [plugin]
      });
    };

    test('handles empty elements', async () => {
      const input = '<view></view>';
      const expected = '<view></view>\n';
      const result = await formatWxml(input);
      expect(result).toBe(expected);
    });

    test('handles mixed content', async () => {
      const input = '<view>Text <text>{{name}}</text> more text</view>';
      const result = await formatWxml(input);
      expect(result).toContain('{{name}}');
      expect(result).toContain('Text');
      expect(result).toContain('more text');
    });

    test('handles nested structures', async () => {
      const input = '<view><view><view><text>Deep</text></view></view></view>';
      const result = await formatWxml(input);
      expect(result).toContain('Deep');
    });
  });

  // Stress tests and error handling - the real test of robustness
  describe('Stress Tests & Error Handling', () => {
    const formatWxml = async (code) => {
      return await prettier.format(code, {
        parser: 'wxml',
        plugins: [plugin]
      });
    };

    test('handles malformed XML gracefully', async () => {
      const input = '<view><text>Unclosed tag';
      // Should not throw, should return something reasonable
      await expect(formatWxml(input)).resolves.toBeDefined();
    });

    test('handles deeply nested structures', async () => {
      // 20 levels deep - test stack overflow resistance
      let input = '<view>';
      for (let i = 0; i < 20; i++) {
        input += '<view>';
      }
      input += '<text>Deep</text>';
      for (let i = 0; i < 20; i++) {
        input += '</view>';
      }
      input += '</view>';
      
      const result = await formatWxml(input);
      expect(result).toContain('Deep');
    });

    test('handles large files without memory issues', async () => {
      // Generate a large but valid WXML file
      let input = '<view>';
      for (let i = 0; i < 1000; i++) {
        input += `<text wx:key="${i}">Item ${i}</text>`;
      }
      input += '</view>';
      
      const result = await formatWxml(input);
      expect(result).toContain('Item 0');
      expect(result).toContain('Item 999');
    });

    test('handles special characters and unicode', async () => {
      const input = '<text>🚀 中文 العربية \"quotes\" &amp; entities</text>';
      const result = await formatWxml(input);
      expect(result).toContain('🚀');
      expect(result).toContain('中文');
      expect(result).toContain('العربية');
    });

    test('handles complex binding expressions', async () => {
      const input = '<view wx:if="{{user&&user.name&&user.name.length > 0}}">{{user.profile[0].data.items[index].value || \'default\'}}</view>';
      const result = await formatWxml(input);
      expect(result).toContain('user &&');
      expect(result).toContain('profile[0]');
    });

    test('handles mixed WXML and WXS content', async () => {
      const input = `<wxs module="utils">
        function format(str) { return str.toUpperCase(); }
        module.exports = { format: format };
      </wxs>
      <view><text>{{utils.format(name)}}</text></view>`;
      
      const result = await formatWxml(input);
      expect(result).toContain('function format');
      expect(result).toContain('utils.format');
    });

    test('preserves WeChat binding expressions without line breaks', async () => {
      // 长的绑定表达式不应该被换行
      const input = '<text>{{user.profile.personalInfo.fullName}} works at {{user.profile.workInfo.company.name}} in {{user.profile.workInfo.department.name}}</text>';
      const result = await formatWxml(input);
      
      // 确保绑定表达式在同一行
      const lines = result.split('\n');
      const textLine = lines.find(line => line.includes('{{'));
      expect(textLine).toContain('{{user.profile.personalInfo.fullName}}');
      expect(textLine).toContain('{{user.profile.workInfo.company.name}}');
      expect(textLine).toContain('{{user.profile.workInfo.department.name}}');
    });

    test('handles multiple binding expressions in single text node', async () => {
      const input = '<view>Hello {{firstName}} {{lastName}}, you have {{messageCount}} messages and {{notificationCount}} notifications</view>';
      const result = await formatWxml(input);
      
      // 所有绑定表达式应该在同一行
      expect(result).toContain('{{firstName}} {{lastName}}');
      expect(result).toContain('{{messageCount}}');
      expect(result).toContain('{{notificationCount}}');
      
      // 不应该有多余的换行
      const textContent = result.match(/>([^<]*)</)[1];
      expect(textContent).not.toContain('\n');
    });

    test('handles complex JS inline expressions without line breaks', async () => {
      const input = '<text>{{user.name + " works at " + company.name}}</text>';
      const result = await formatWxml(input);
      const textContent = result.trim();
      expect(textContent).not.toContain('\n');
      expect(textContent).toContain('{{user.name + " works at " + company.name}}');
    });

    test('handles conditional expressions in bindings', async () => {
      const input = '<text>{{user.profile ? user.profile.name : "Guest"}}</text>';
      const result = await formatWxml(input);
      const textContent = result.trim();
      expect(textContent).not.toContain('\n');
      expect(textContent).toContain('{{user.profile ? user.profile.name : "Guest"}}');
    });

    test('handles function chains in bindings', async () => {
      const input = '<text>{{items.filter(item => item.active).map(item => item.name).join(", ").toUpperCase()}}</text>';
      const result = await formatWxml(input);
      const textContent = result.trim();
      expect(textContent).not.toContain('\n');
      expect(textContent).toContain('{{items.filter(item => item.active).map(item => item.name).join(", ").toUpperCase()}}');
    });
  });
});