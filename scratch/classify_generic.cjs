const fs = require('fs');
const all = JSON.parse(fs.readFileSync('scratch/all_converted_details.json', 'utf8'));

console.log('--- Arrange-Word with generic prompts (no clue) ---');
const arrangeGeneric = all.filter(a => a.cv.startsWith('arrange') && /^(?:arrange|put|reorder|make)/i.test(a.prompt) && !/means|clue|opposite|synonym|bird|animal|place|thing|food/i.test(a.prompt));
console.log('Total arrange generic:', arrangeGeneric.length);
arrangeGeneric.forEach(a => console.log(`  [${a.id}] ${a.targetWord} (${a.options.split(', ').length} tiles): "${a.prompt}"`));

console.log('\n--- Picture-Recognition / Spelling-Choice with generic prompts ---');
const picGeneric = all.filter(a => (a.cv.startsWith('picture') || a.cv.startsWith('spelling')) && !/means|clue|opposite|synonym|bird|animal|place|thing|food/i.test(a.prompt));
console.log('Total pic/spelling generic:', picGeneric.length);
picGeneric.forEach(a => console.log(`  [${a.id}] (${a.cv}) ${a.targetWord} | prompt: "${a.prompt}" | options: ${a.options}`));

console.log('\n--- Word-Completion with generic prompts ---');
const wcGeneric = all.filter(a => a.cv.startsWith('word-completion') && !/means|clue|opposite|synonym|bird|animal|place|thing|food/i.test(a.prompt));
console.log('Total word-completion generic:', wcGeneric.length);
wcGeneric.slice(0, 10).forEach(a => console.log(`  [${a.id}] ${a.targetWord} | template: ${a.template} | options: ${a.options} | prompt: "${a.prompt}"`));
