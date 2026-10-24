const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// Helper to get git file at commit
function getGitFile(commit, filePath) {
  try {
    return cp.execSync(`git show ${commit}:${filePath}`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    return null;
  }
}

// Resolver logic
function createResolver(manifest) {
  return {
    resolve: (ref) => {
      if (!ref || !ref.id) return { status: 'invalid' };
      if (ref.id.startsWith('/') && !ref.id.includes('..') && !ref.id.includes('\\')) {
        return { status: 'resolved', asset: { id: ref.id, type: ref.type, source: 'local', path: ref.id } };
      }
      const entry = manifest[ref.id];
      if (!entry) return { status: 'missing', id: ref.id };
      return { status: 'resolved', asset: { ...entry, id: ref.id } };
    }
  };
}

// Check rendering at baseline (eafd7d6 / before needsImage)
function doesRenderImageBaseline(activity, resolver) {
  const isEnglish = activity.subject === 'English' || activity.language?.startsWith('en');

  // 1. picture-recognition :: select (PictureSelectActivity)
  if (activity.category === 'picture-recognition' && activity.variant === 'select') {
    const assetId = isEnglish
      ? (activity.image?.source || `eng-${activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase()}`)
      : `class3-tamil-picture-${activity.id.toLowerCase()}`;
    return resolver.resolve({ id: assetId, type: 'image' }).status === 'resolved';
  }

  // 2. picture-recognition :: word-entry, meaning-match :: word-entry (WordEntryActivity)
  if (activity.variant === 'word-entry') {
    const hasImage = activity.category === 'picture-recognition' || Boolean(activity.image) || /picture|look at the picture/i.test(activity.prompt || '');
    if (!hasImage) return false;
    const semanticKey = activity.targetWord
      ? `eng-${activity.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      : (activity.source?.ewId ? `eng-${activity.source.ewId.toLowerCase()}` : 'unknown');
    const assetId = activity.image?.source || semanticKey;
    return resolver.resolve({ id: assetId, type: 'image' }).status === 'resolved';
  }

  // 3. spelling-choice :: select (SpellingSelectActivity)
  if (activity.category === 'spelling-choice') {
    let assetRef = null;
    if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || /look at the picture/i.test(activity.prompt || '');
      if (isPictureRequired) {
        const wordKey = activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase();
        assetRef = { id: `eng-${wordKey}`, type: 'image' };
      }
    } else {
      const isPicturePrompt = /படத்தில் காணப்படும்/.test(activity.prompt || '');
      if (activity.image?.source || isPicturePrompt) {
        assetRef = { id: activity.image?.source || `class3-tamil-picture-${activity.id.toLowerCase()}`, type: 'image' };
      }
    }
    if (!assetRef) return false;
    return resolver.resolve(assetRef).status === 'resolved';
  }

  // 4. word-completion :: missing-unit (WordCompletionActivity)
  if (activity.category === 'word-completion') {
    let assetRef = null;
    if (activity.image?.source) {
      assetRef = { id: activity.image.source, type: 'image' };
    } else if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || /look at the picture|picture/i.test(activity.prompt || '');
      if (isPictureRequired) {
        const wordKey = activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase();
        assetRef = { id: `eng-${wordKey}`, type: 'image' };
      }
    } else {
      const isPicturePrompt = /படத்தில் காணப்படும்/.test(activity.prompt || '');
      if (isPicturePrompt) {
        assetRef = { id: `class3-tamil-picture-${activity.id.toLowerCase()}`, type: 'image' };
      }
    }
    if (!assetRef) return false;
    return resolver.resolve(assetRef).status === 'resolved';
  }

  // 5. arrange-word :: arrange (ArrangeWordActivity)
  if (activity.category === 'arrange-word') {
    const isTamilPicturePrompt = /படத்தில் காணப்படும்/.test(activity.prompt || '');
    const hasImage = Boolean(activity.image) || /look at the picture/i.test(activity.prompt || '') || isTamilPicturePrompt;
    const assetId = activity.image?.source
      || (isTamilPicturePrompt ? `class3-tamil-picture-${activity.id.toLowerCase()}` : null)
      || (activity.targetWord ? `eng-${activity.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : null);
    if (!hasImage || !assetId) return false;
    return resolver.resolve({ id: assetId, type: 'image' }).status === 'resolved';
  }

  // Other activities (context-choice, meaning-match translate-select) never show pictures
  return false;
}

// Check rendering currently (current code / commit 41b655f)
function doesRenderImageCurrent(activity, resolver) {
  if (activity.needsImage === false) return false;
  const isEnglish = activity.subject === 'English' || activity.language?.startsWith('en');

  // 1. PictureSelectActivity
  if (activity.category === 'picture-recognition' && activity.variant === 'select') {
    const assetId = activity.image?.source
      || (activity.needsImage === false
        ? null
        : (isEnglish
            ? `eng-${activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase()}`
            : `class3-tamil-picture-${activity.id.toLowerCase()}`));
    if (!assetId) return false;
    return resolver.resolve({ id: assetId, type: 'image' }).status === 'resolved';
  }

  // 2. WordEntryActivity
  if (activity.variant === 'word-entry') {
    const hasImage =
      activity.needsImage === true ||
      (activity.needsImage !== false && (Boolean(activity.image) || activity.category === 'picture-recognition'));
    if (!hasImage) return false;
    const semanticKey = activity.targetWord
      ? `eng-${activity.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      : (activity.source?.ewId ? `eng-${activity.source.ewId.toLowerCase()}` : 'unknown');
    const assetId = (activity.targetWord && activity.image?.source?.startsWith('eng-'))
      ? semanticKey
      : (activity.image?.source || semanticKey);
    return resolver.resolve({ id: assetId, type: 'image' }).status === 'resolved';
  }

  // 3. SpellingSelectActivity
  if (activity.category === 'spelling-choice') {
    let assetRef = null;
    if (activity.image?.source) {
      assetRef = { id: activity.image.source, type: 'image' };
    } else if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || activity.needsImage === true;
      if (isPictureRequired) {
        const wordKey = activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase();
        assetRef = { id: `eng-${wordKey}`, type: 'image' };
      }
    } else {
      const isPicturePrompt = /படத்தில் காணப்படும்/.test(activity.prompt || '');
      if (isPicturePrompt) {
        assetRef = { id: `class3-tamil-picture-${activity.id.toLowerCase()}`, type: 'image' };
      }
    }
    if (!assetRef) return false;
    return resolver.resolve(assetRef).status === 'resolved';
  }

  // 4. WordCompletionActivity
  if (activity.category === 'word-completion') {
    let assetRef = null;
    if (activity.image?.source) {
      assetRef = { id: activity.image.source, type: 'image' };
    } else if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || activity.needsImage === true;
      if (isPictureRequired) {
        const wordKey = activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase();
        assetRef = { id: `eng-${wordKey}`, type: 'image' };
      }
    } else {
      const isPicturePrompt = /படத்தில் காணப்படும்/.test(activity.prompt || '');
      if (isPicturePrompt) {
        assetRef = { id: `class3-tamil-picture-${activity.id.toLowerCase()}`, type: 'image' };
      }
    }
    if (!assetRef) return false;
    return resolver.resolve(assetRef).status === 'resolved';
  }

  // 5. ArrangeWordActivity
  if (activity.category === 'arrange-word') {
    let assetRef = null;
    if (activity.image?.source) {
      assetRef = { id: activity.image.source, type: 'image' };
    } else if (activity.needsImage === true) {
      if (isEnglish) {
        const wordKey = activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase();
        assetRef = { id: `eng-${wordKey}`, type: 'image' };
      } else {
        assetRef = { id: `class3-tamil-picture-${activity.id.toLowerCase()}`, type: 'image' };
      }
    }
    if (!assetRef) return false;
    return resolver.resolve(assetRef).status === 'resolved';
  }

  return false;
}

function runAudit() {
  const baselineCommit = 'eafd7d6';
  console.log('Auditing baseline commit:', baselineCommit, 'vs Current working tree\n');

  // Load baseline manifests
  const baseTamilTerm1Manifest = JSON.parse(getGitFile(baselineCommit, 'src/content/class-3/tamil/term-1/assets.json') || '{}');
  const baseTamilFtsManifest = JSON.parse(getGitFile(baselineCommit, 'src/content/class-3/tamil/fts-manifest.json') || '{}');
  const baseEngManifest = JSON.parse(getGitFile(baselineCommit, 'src/content/class-3/english/asset-manifest.json') || '{}');
  const baseCombinedManifest = { ...baseTamilTerm1Manifest, ...baseTamilFtsManifest, ...baseEngManifest };
  const baseResolver = createResolver(baseCombinedManifest);

  // Load current manifests
  const curTamilTerm1Manifest = JSON.parse(fs.readFileSync('src/content/class-3/tamil/term-1/assets.json', 'utf8'));
  const curTamilManifest = fs.existsSync('src/content/class-3/tamil/asset-manifest.json')
    ? JSON.parse(fs.readFileSync('src/content/class-3/tamil/asset-manifest.json', 'utf8'))
    : {};
  const curTamilFtsManifest = fs.existsSync('src/content/class-3/tamil/fts-manifest.json')
    ? JSON.parse(fs.readFileSync('src/content/class-3/tamil/fts-manifest.json', 'utf8'))
    : {};
  const curEngManifest = JSON.parse(fs.readFileSync('src/content/class-3/english/asset-manifest.json', 'utf8'));
  const curCombinedManifest = { ...curTamilTerm1Manifest, ...curTamilManifest, ...curTamilFtsManifest, ...curEngManifest };
  const curResolver = createResolver(curCombinedManifest);

  // Load English activities baseline vs current
  const baseEnglishActivities = [];
  const curEnglishActivities = [];
  for (let m = 1; m <= 8; m++) {
    const baseRaw = getGitFile(baselineCommit, `src/content/class-3/english/module-${m}/activities.json`);
    if (baseRaw) baseEnglishActivities.push(...JSON.parse(baseRaw));
    const curRaw = fs.readFileSync(`src/content/class-3/english/module-${m}/activities.json`, 'utf8');
    curEnglishActivities.push(...JSON.parse(curRaw));
  }

  // Load Tamil activities
  // 1. Term 1 (142 activities)
  const baseTamilTerm1 = JSON.parse(getGitFile(baselineCommit, 'src/content/class-3/tamil/term-1/activities.json') || '[]');
  const curTamilTerm1 = JSON.parse(fs.readFileSync('src/content/class-3/tamil/term-1/activities.json', 'utf8'));
  // 2. Full Tamil (1178 activities in activities.json if present)
  const curTamilFull = fs.existsSync('src/content/class-3/tamil/activities.json')
    ? JSON.parse(fs.readFileSync('src/content/class-3/tamil/activities.json', 'utf8'))
    : [];

  console.log(`Loaded English: baseline=${baseEnglishActivities.length}, current=${curEnglishActivities.length}`);
  console.log(`Loaded Tamil Term 1: baseline=${baseTamilTerm1.length}, current=${curTamilTerm1.length}`);
  console.log(`Loaded Tamil Full (1178 set): ${curTamilFull.length}`);

  // Counts before vs after
  function getCounts(activities, resolver, isBaseline) {
    const fn = isBaseline ? doesRenderImageBaseline : doesRenderImageCurrent;
    const bySubject = {};
    const byCategoryVariant = {};
    let total = 0;
    const renderingList = [];

    for (const act of activities) {
      const renders = fn(act, resolver);
      if (renders) {
        total++;
        const sub = act.subject || 'Unknown';
        bySubject[sub] = (bySubject[sub] || 0) + 1;
        const cv = `${act.category}::${act.variant}`;
        byCategoryVariant[cv] = (byCategoryVariant[cv] || 0) + 1;
        renderingList.push(act);
      }
    }
    return { total, bySubject, byCategoryVariant, renderingList };
  }

  const baseEngCounts = getCounts(baseEnglishActivities, baseResolver, true);
  const curEngCounts = getCounts(curEnglishActivities, curResolver, false);

  const baseTamilTerm1Counts = getCounts(baseTamilTerm1, baseResolver, true);
  const curTamilTerm1Counts = getCounts(curTamilTerm1, curResolver, false);

  console.log('\n======================================================');
  console.log('1. ENGLISH IMAGE COUNTS: BEFORE VS AFTER');
  console.log('======================================================');
  console.log(`Total English Rendering Images: ${baseEngCounts.total} -> ${curEngCounts.total} (Diff: ${curEngCounts.total - baseEngCounts.total})`);
  console.log('\nBreakdown by Category/Variant:');
  const allEngCV = new Set([...Object.keys(baseEngCounts.byCategoryVariant), ...Object.keys(curEngCounts.byCategoryVariant)]);
  for (const cv of Array.from(allEngCV).sort()) {
    const before = baseEngCounts.byCategoryVariant[cv] || 0;
    const after = curEngCounts.byCategoryVariant[cv] || 0;
    console.log(`  ${cv.padEnd(35)}: Before=${String(before).padStart(4)} | After=${String(after).padStart(4)} | Diff=${after - before}`);
  }

  console.log('\n======================================================');
  console.log('1B. TAMIL TERM 1 IMAGE COUNTS: BEFORE VS AFTER');
  console.log('======================================================');
  console.log(`Total Tamil Term 1 Rendering Images: ${baseTamilTerm1Counts.total} -> ${curTamilTerm1Counts.total} (Diff: ${curTamilTerm1Counts.total - baseTamilTerm1Counts.total})`);
  const allTamilCV = new Set([...Object.keys(baseTamilTerm1Counts.byCategoryVariant), ...Object.keys(curTamilTerm1Counts.byCategoryVariant)]);
  for (const cv of Array.from(allTamilCV).sort()) {
    const before = baseTamilTerm1Counts.byCategoryVariant[cv] || 0;
    const after = curTamilTerm1Counts.byCategoryVariant[cv] || 0;
    console.log(`  ${cv.padEnd(35)}: Before=${String(before).padStart(4)} | After=${String(after).padStart(4)} | Diff=${after - before}`);
  }

  // Tamil check: ArrangeWordActivity matching /படத்தில் காணப்படும்/
  console.log('\n======================================================');
  console.log('2. TAMIL ARRANGEWORD CHECK: /படத்தில் காணப்படும்/');
  console.log('======================================================');
  // Check in Term 1
  const lostTamilTerm1 = [];
  for (const act of baseTamilTerm1) {
    if (act.category === 'arrange-word') {
      const renderedBefore = doesRenderImageBaseline(act, baseResolver);
      const curMatch = curTamilTerm1.find(a => a.id === act.id);
      const renderedAfter = curMatch ? doesRenderImageCurrent(curMatch, curResolver) : false;
      if (renderedBefore && !renderedAfter) {
        lostTamilTerm1.push({ act, curMatch });
      }
    }
  }
  console.log(`Tamil Term 1 ArrangeWord activities that rendered before and do not now: ${lostTamilTerm1.length}`);
  lostTamilTerm1.forEach(({ act }) => {
    console.log(`  [${act.id}] prompt: "${act.prompt}" targetWord: "${act.targetWord}"`);
  });

  // Check in Tamil Full 1178 dataset
  const lostTamilFull = [];
  if (curTamilFull.length > 0) {
    for (const act of curTamilFull) {
      if (act.category === 'arrange-word') {
        const renderedBefore = doesRenderImageBaseline(act, curResolver);
        const renderedAfter = doesRenderImageCurrent(act, curResolver);
        if (renderedBefore && !renderedAfter) {
          lostTamilFull.push(act);
        }
      }
    }
    console.log(`Tamil Full (1178) ArrangeWord activities that rendered before and do not now: ${lostTamilFull.length}`);
    lostTamilFull.forEach(act => {
      console.log(`  [${act.id}] prompt: "${act.prompt}" targetWord: "${act.targetWord}" hasImageProp: ${Boolean(act.image)}`);
    });
  }

  // 3. Validator Category IMAGE_LOST
  console.log('\n======================================================');
  console.log('3. VALIDATOR CATEGORY: IMAGE_LOST');
  console.log('======================================================');
  const missingImagesCsv = fs.readFileSync('docs/missing-images.csv', 'utf8').trim().split('\n').slice(1).map(l => l.split(',')[0]);
  const missingSet = new Set(missingImagesCsv);

  const imageLostList = [];
  // Check English
  for (const baseAct of baseEnglishActivities) {
    const renderedBefore = doesRenderImageBaseline(baseAct, baseResolver);
    if (!renderedBefore) continue;
    const curAct = curEnglishActivities.find(a => a.id === baseAct.id);
    const renderedAfter = curAct ? doesRenderImageCurrent(curAct, curResolver) : false;
    if (!renderedAfter && !missingSet.has(baseAct.id)) {
      imageLostList.push({ subject: 'English', id: baseAct.id, category: baseAct.category, variant: baseAct.variant, prompt: baseAct.prompt });
    }
  }
  // Check Tamil Term 1
  for (const baseAct of baseTamilTerm1) {
    const renderedBefore = doesRenderImageBaseline(baseAct, baseResolver);
    if (!renderedBefore) continue;
    const curAct = curTamilTerm1.find(a => a.id === baseAct.id);
    const renderedAfter = curAct ? doesRenderImageCurrent(curAct, curResolver) : false;
    if (!renderedAfter && !missingSet.has(baseAct.id)) {
      imageLostList.push({ subject: 'Tamil', id: baseAct.id, category: baseAct.category, variant: baseAct.variant, prompt: baseAct.prompt });
    }
  }

  console.log(`Total IMAGE_LOST count (excluding missing-images.csv): ${imageLostList.length}`);
  imageLostList.forEach(item => {
    console.log(`  [IMAGE_LOST] ${item.subject} ${item.id} (${item.category}::${item.variant}): ${item.prompt}`);
  });

  // 4. Answerability analysis for the converted text-only English activities
  console.log('\n======================================================');
  console.log('4. ANSWERABILITY ANALYSIS (Missing Images / Text-Only)');
  console.log('======================================================');
  const convertedActivities = [];
  for (const curAct of curEnglishActivities) {
    if (curAct.needsImage === false) {
      convertedActivities.push(curAct);
    }
  }
  console.log(`Total English activities with needsImage === false: ${convertedActivities.length}`);

  const unanswerableList = [];
  for (const act of convertedActivities) {
    let unanswerableReason = null;
    const prompt = act.prompt || '';
    const hasMeaningClue = /means|opposite|synonym|clue|definition|rhyme|sound/i.test(prompt) || prompt.length > 40;
    
    // Condition A: picture-recognition with whole word options and no clue
    if (act.category === 'picture-recognition') {
      if (!hasMeaningClue) {
        unanswerableReason = 'picture-recognition with no clue in prompt';
      }
    }
    // Condition B: arrange-word with 7 or more tiles and no meaning clue
    else if (act.category === 'arrange-word') {
      const tileCount = act.options?.length || act.units?.length || 0;
      if (tileCount >= 7 && !hasMeaningClue) {
        unanswerableReason = `arrange-word with ${tileCount} tiles and no meaning clue`;
      }
    }
    // Condition C: spelling-choice / word-entry with generic prompt
    else if (act.variant === 'word-entry' && !hasMeaningClue) {
      unanswerableReason = 'word-entry with no clue in prompt';
    }

    if (unanswerableReason) {
      unanswerableList.push({
        id: act.id,
        categoryVariant: `${act.category}::${act.variant}`,
        targetWord: act.targetWord,
        prompt: act.prompt,
        options: act.options?.map(o => o.label).join(' | ') || '',
        reason: unanswerableReason
      });
    }
  }

  console.log(`Flagged as UNANSWERABLE: ${unanswerableList.length}`);
  fs.writeFileSync('scratch/unanswerable_flagged.json', JSON.stringify(unanswerableList, null, 2));
}

runAudit();
