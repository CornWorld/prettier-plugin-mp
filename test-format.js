import prettier from 'prettier';

try {
  const result = await prettier.format('<view hidden></view>', {
    parser: 'wxml',
    plugins: ['./src/index.js']
  });
  console.log('Success! Formatted result:', JSON.stringify(result));
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}