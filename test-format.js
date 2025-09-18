import prettier from 'prettier';
import fs from 'fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node test-format.js <file-path>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('Input content:', JSON.stringify(content));
  
  const result = await prettier.format(content, {
    parser: 'wxml',
    plugins: ['./src/index.js']
  });
  console.log('Success! Formatted result:', JSON.stringify(result));
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}