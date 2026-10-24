const fs = require('fs');
const all = JSON.parse(fs.readFileSync('scratch/all_converted_details.json', 'utf8'));

const wcList = all.filter(a => a.cv.startsWith('word-completion'));
console.log('Total word-completion in converted:', wcList.length);

const genericWc = [];
for (const a of wcList) {
  // Check if prompt is just "Complete the word:" or "Choose the missing letter to complete the word."
  const isGeneric = /^complete the word\.?:?$/i.test(a.prompt) || /^choose the missing letter/i.test(a.prompt);
  if (isGeneric) {
    genericWc.push(a);
  }
}

console.log('Word completions with purely generic prompt (no sentence):', genericWc.length);
genericWc.forEach(a => {
  console.log(`  [${a.id}] word: "${a.targetWord}", template: "${a.template}", options: [${a.options}], prompt: "${a.prompt}"`);
});

const sentenceWc = wcList.filter(a => !genericWc.includes(a));
console.log('\nWord completions WITH sentence context:', sentenceWc.length);
sentenceWc.slice(0, 5).forEach(a => {
  console.log(`  [${a.id}] word: "${a.targetWord}", prompt: "${a.prompt}"`);
});
