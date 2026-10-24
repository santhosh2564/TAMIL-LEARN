const fs = require('fs');

// Read missing-images.csv
const missingCsv = fs.readFileSync('docs/missing-images.csv', 'utf8').trim().split('\n').slice(1);
const missingMap = new Map();
missingCsv.forEach(line => {
  const parts = line.split(',');
  missingMap.set(parts[0], { targetWord: parts[1], prompt: parts.slice(2).join(',') });
});

// Load all English activities
const englishActivities = [];
for (let m = 1; m <= 8; m++) {
  const acts = JSON.parse(fs.readFileSync(`src/content/class-3/english/module-${m}/activities.json`, 'utf8'));
  englishActivities.push(...acts);
}

const converted = englishActivities.filter(a => a.needsImage === false && missingMap.has(a.id));

console.log(`Total converted activities found in content: ${converted.length}`);

// Breakdown by category/variant
const catVariantCounts = {};
converted.forEach(a => {
  const cv = `${a.category}::${a.variant}`;
  catVariantCounts[cv] = (catVariantCounts[cv] || 0) + 1;
});
console.log('Category / Variant breakdown:', catVariantCounts);

// Audit each activity for answerability
const flagged = [];
const unflagged = [];

for (const act of converted) {
  const prompt = (act.prompt || '').trim();
  const targetWord = (act.targetWord || (Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : act.correctAnswer) || '').trim();
  const cv = `${act.category}::${act.variant}`;
  const options = act.options?.map(o => o.label) || [];
  const tileCount = act.options?.length || act.units?.length || 0;

  let isFlagged = false;
  let reason = '';

  // Rule 1: picture-recognition (select or word-entry) with whole-word options and no clue in the prompt
  if (act.category === 'picture-recognition') {
    // Check if prompt has any clue
    const hasClue = /which|means|describes|animal|bird|fruit|food|thing|person|action/i.test(prompt) && !/^select the correct word\.?$/i.test(prompt) && !/^choose the correct word\.?$/i.test(prompt);
    if (!hasClue || /^select the correct word\.?$/i.test(prompt) || prompt === '') {
      isFlagged = true;
      reason = 'picture-recognition with whole-word options and no meaning clue';
    }
  }

  // Rule 2: arrange-word with 7 or more tiles and no meaning clue
  else if (act.category === 'arrange-word') {
    const hasMeaningClue = /clue|means|meaning|rhymes|opposite|synonym/i.test(prompt) || prompt.length > 50;
    if (tileCount >= 7 && !hasMeaningClue) {
      isFlagged = true;
      reason = `arrange-word with ${tileCount} tiles and no meaning clue`;
    }
  }

  // Rule 3: Check word-completion / spelling-choice / word-entry for missing clues
  else if (act.variant === 'word-entry') {
    isFlagged = true;
    reason = 'word-entry with no picture and no clue in prompt';
  }

  if (isFlagged) {
    flagged.push({
      id: act.id,
      categoryVariant: cv,
      targetWord,
      prompt,
      options: options.join(', '),
      tileCount,
      reason
    });
  } else {
    unflagged.push({
      id: act.id,
      categoryVariant: cv,
      targetWord,
      prompt,
      options: options.join(', '),
      tileCount
    });
  }
}

console.log(`Flagged: ${flagged.length}, Unflagged: ${unflagged.length}`);

fs.writeFileSync('scratch/flagged_details.json', JSON.stringify(flagged, null, 2));
fs.writeFileSync('scratch/all_converted_details.json', JSON.stringify(converted.map(a => ({
  id: a.id,
  cv: `${a.category}::${a.variant}`,
  targetWord: a.targetWord,
  prompt: a.prompt,
  options: a.options?.map(o => o.label).join(', ') || a.units?.join(', ') || '',
  template: a.template
})), null, 2));
