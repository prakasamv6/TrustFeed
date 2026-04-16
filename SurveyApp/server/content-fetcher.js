/**
 * ContentFetcher — Loads content from local dataset files.
 * Content is sourced from AugmentedDoing/dataset/ directory organized by continent.
 * Each continent has Text/Images/Videos with AI/NonAI subfolders.
 * NO PII collected. All content is pre-curated.
 */

const fs = require('fs');
const path = require('path');

// ─── Dataset root path ───
// In Docker: /app/dataset (copied by Dockerfile)
// Local dev: ../../AugmentedDoing/dataset (relative to server/)
const DOCKER_DATASET = path.resolve(__dirname, 'dataset');
const LOCAL_DATASET = path.resolve(__dirname, '..', '..', 'AugmentedDoing', 'dataset');
const DATASET_ROOT = fs.existsSync(DOCKER_DATASET) ? DOCKER_DATASET : LOCAL_DATASET;

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North_America', 'South_America', 'Antarctica', 'Australia'];
const MEDIA_TYPES = ['text', 'image', 'video'];
const REQUIRED_SESSION_SIZE = CONTINENTS.length * 2;

function toDatasetUrl(filePath) {
  const relativePath = path.relative(DATASET_ROOT, filePath).replace(/\\/g, '/');
  return `/dataset/${encodeURI(relativePath)}`;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function itemKey(item) {
  return [item.continent, item.contentType, item.groundTruth, item.title, item.imageUrl || '', item.videoUrl || ''].join('|');
}

function pickPreferredItem(items, preferredMedia, usedKeys) {
  const unused = items.filter(item => !usedKeys.has(itemKey(item)));
  if (unused.length === 0) return null;

  for (const mediaType of preferredMedia) {
    const matches = unused.filter(item => item.contentType === mediaType);
    if (matches.length > 0) {
      return shuffle(matches)[0];
    }
  }

  return shuffle(unused)[0];
}

function countBy(items, key) {
  return items.reduce((accumulator, item) => {
    const value = item[key];
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

function loadAllContent() {
  let allContent = [];

  for (const continent of CONTINENTS) {
    allContent.push(
      ...loadTextItems(continent),
      ...loadImageItems(continent),
      ...loadVideoItems(continent),
    );
  }

  return allContent;
}

function validateDatasetReadiness() {
  const allContent = loadAllContent();
  const mediaCounts = countBy(allContent, 'contentType');
  const truthCounts = countBy(allContent, 'groundTruth');
  const continentBreakdown = CONTINENTS.map(continent => {
    const continentItems = allContent.filter(item => item.continent === continent);
    return {
      continent,
      total: continentItems.length,
      ai: continentItems.filter(item => item.groundTruth === 'ai').length,
      human: continentItems.filter(item => item.groundTruth === 'human').length,
      media: countBy(continentItems, 'contentType'),
    };
  });

  const issues = [];

  if (allContent.length < REQUIRED_SESSION_SIZE) {
    issues.push(`dataset has only ${allContent.length} items; requires at least ${REQUIRED_SESSION_SIZE}`);
  }

  for (const mediaType of MEDIA_TYPES) {
    if (!mediaCounts[mediaType]) {
      issues.push(`dataset is missing ${mediaType} content`);
    }
  }

  for (const continent of continentBreakdown) {
    if (continent.total < 2) {
      issues.push(`${continent.continent} has fewer than 2 total items`);
    }
    if (continent.ai < 1) {
      issues.push(`${continent.continent} is missing AI content`);
    }
    if (continent.human < 1) {
      issues.push(`${continent.continent} is missing human content`);
    }
  }

  return {
    ready: issues.length === 0,
    requiredSessionSize: REQUIRED_SESSION_SIZE,
    totalItems: allContent.length,
    truthCounts: {
      ai: truthCounts.ai || 0,
      human: truthCounts.human || 0,
    },
    mediaCounts: MEDIA_TYPES.reduce((accumulator, mediaType) => {
      accumulator[mediaType] = mediaCounts[mediaType] || 0;
      return accumulator;
    }, {}),
    continents: continentBreakdown,
    issues,
  };
}

// ─── Load text items from a continent ───

function loadTextItems(continent) {
  const items = [];
  const basePath = path.join(DATASET_ROOT, continent, 'Text');

  for (const label of ['AI', 'NonAI']) {
    const folder = path.join(basePath, label);
    if (!fs.existsSync(folder)) continue;

    const files = fs.readdirSync(folder).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf-8'));
        const title = data.title || file.replace(/\.json$/, '').replace(/_/g, ' ');
        const content = data.extract || data.content || '';
        if (!content || content.length < 20) continue;

        items.push({
          title,
          content,
          imageUrl: null,
          contentType: 'text',
          groundTruth: label === 'AI' ? 'ai' : 'human',
          category: data.category || data.description || 'General',
          difficulty: data.difficulty || assignDifficulty(content),
          source: `dataset-${continent}`,
          continent,
        });
      } catch (err) {
        console.error(`Error loading ${folder}/${file}:`, err.message);
      }
    }
  }
  return items;
}

// ─── Load image items from a continent ───

function loadImageItems(continent) {
  const items = [];
  const basePath = path.join(DATASET_ROOT, continent, 'Images');

  for (const label of ['AI', 'NonAI']) {
    const folder = path.join(basePath, label);
    if (!fs.existsSync(folder)) continue;

    const files = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    for (const file of files) {
      const title = file.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      const filePath = path.join(folder, file);

      items.push({
        title,
        content: label === 'AI'
          ? `This image was generated by AI. It demonstrates generative AI capabilities in visual content creation from the ${continent.replace('_', ' ')} dataset.`
          : `A real photograph from ${continent.replace('_', ' ')}. This image showcases authentic human photography with natural composition and lighting.`,
        imageUrl: toDatasetUrl(filePath),
        contentType: 'image',
        groundTruth: label === 'AI' ? 'ai' : 'human',
        category: label === 'AI' ? 'AI Art' : 'Photography',
        difficulty: 'medium',
        source: `dataset-${continent}`,
        continent,
      });
    }
  }
  return items;
}

// ─── Load video items from a continent ───

function loadVideoItems(continent) {
  const items = [];
  const basePath = path.join(DATASET_ROOT, continent, 'Videos');

  for (const label of ['AI', 'NonAI']) {
    const folder = path.join(basePath, label);
    if (!fs.existsSync(folder)) continue;

    const files = fs.readdirSync(folder).filter(f => /\.(mp4|webm|mov)$/i.test(f));
    for (const file of files) {
      const title = file.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      const filePath = path.join(folder, file);

      items.push({
        title,
        content: label === 'AI'
          ? `An AI-generated video from the ${continent.replace('_', ' ')} dataset. Synthetic visual content created by generative models.`
          : `Real-world video footage from ${continent.replace('_', ' ')}. Authentic human-captured videography with natural movement.`,
        videoUrl: toDatasetUrl(filePath),
        imageUrl: null,
        contentType: 'video',
        groundTruth: label === 'AI' ? 'ai' : 'human',
        category: label === 'AI' ? 'AI Video' : 'Video',
        difficulty: 'hard',
        source: `dataset-${continent}`,
        continent,
      });
    }
  }
  return items;
}

// ─── Difficulty assignment ───

function assignDifficulty(text) {
  const wordCount = text.split(/\s+/).length;
  const avgWordLen = text.replace(/\s+/g, '').length / wordCount;
  if (avgWordLen > 6 && wordCount > 100) return 'hard';
  if (avgWordLen > 5 || wordCount > 60) return 'medium';
  return 'easy';
}

// ─── Main fetch orchestrator — loads from local dataset ───

async function fetchUniqueContent(totalCount) {
  const allContent = loadAllContent();

  const requestedCount = Math.max(totalCount, REQUIRED_SESSION_SIZE);
  const selected = [];
  const usedKeys = new Set();

  // First pass: guarantee one AI and one human item from each continent.
  CONTINENTS.forEach((continent, continentIndex) => {
    const continentItems = allContent.filter(item => item.continent === continent);

    ['ai', 'human'].forEach((truth, truthIndex) => {
      const pool = continentItems.filter(item => item.groundTruth === truth);
      const preferredMedia = [
        MEDIA_TYPES[(continentIndex + truthIndex) % MEDIA_TYPES.length],
        MEDIA_TYPES[(continentIndex + truthIndex + 1) % MEDIA_TYPES.length],
        MEDIA_TYPES[(continentIndex + truthIndex + 2) % MEDIA_TYPES.length],
      ];
      const picked = pickPreferredItem(pool, preferredMedia, usedKeys);
      if (picked) {
        usedKeys.add(itemKey(picked));
        selected.push(picked);
      }
    });
  });

  // Second pass: fill any remaining slots with the least-represented media type first.
  while (selected.length < requestedCount) {
    const mediaCounts = MEDIA_TYPES.reduce((acc, mediaType) => {
      acc[mediaType] = selected.filter(item => item.contentType === mediaType).length;
      return acc;
    }, {});

    const preferredMedia = [...MEDIA_TYPES].sort((left, right) => mediaCounts[left] - mediaCounts[right]);
    const picked = pickPreferredItem(allContent, preferredMedia, usedKeys);
    if (!picked) break;

    usedKeys.add(itemKey(picked));
    selected.push(picked);
  }

  return selected.map((item, i) => ({
    ...item,
    id: `content-${Date.now()}-${i}`,
  }));
}

module.exports = { fetchUniqueContent, validateDatasetReadiness, DATASET_ROOT };
