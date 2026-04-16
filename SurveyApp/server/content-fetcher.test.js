const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchUniqueContent, validateDatasetReadiness } = require('./content-fetcher');

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North_America', 'South_America', 'Antarctica', 'Australia'];
const MEDIA_TYPES = ['text', 'image', 'video'];

function countBy(items, key) {
  return items.reduce((accumulator, item) => {
    const value = item[key];
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

test('fetchUniqueContent returns a balanced 14-item dataset-backed session', async () => {
  const items = await fetchUniqueContent(14);

  assert.equal(items.length, 14);

  const truthCounts = countBy(items, 'groundTruth');
  assert.equal(truthCounts.ai, 7);
  assert.equal(truthCounts.human, 7);

  const mediaCounts = countBy(items, 'contentType');
  for (const mediaType of MEDIA_TYPES) {
    assert.ok(mediaCounts[mediaType] > 0, `expected at least one ${mediaType} item`);
  }

  for (const continent of CONTINENTS) {
    const continentItems = items.filter(item => item.continent === continent);
    assert.equal(continentItems.length, 2, `expected exactly 2 items for ${continent}`);
    assert.equal(continentItems.filter(item => item.groundTruth === 'ai').length, 1, `expected 1 AI item for ${continent}`);
    assert.equal(continentItems.filter(item => item.groundTruth === 'human').length, 1, `expected 1 human item for ${continent}`);
  }

  const mediaUrls = items
    .flatMap(item => [item.imageUrl, item.videoUrl])
    .filter(Boolean);

  for (const url of mediaUrls) {
    assert.ok(url.startsWith('/dataset/'), `expected local dataset URL, received ${url}`);
  }
});

test('fetchUniqueContent remains balanced across repeated runs', async () => {
  for (let index = 0; index < 5; index += 1) {
    const items = await fetchUniqueContent(14);
    const truthCounts = countBy(items, 'groundTruth');

    assert.equal(items.length, 14);
    assert.equal(truthCounts.ai, 7);
    assert.equal(truthCounts.human, 7);

    for (const continent of CONTINENTS) {
      const continentItems = items.filter(item => item.continent === continent);
      assert.equal(continentItems.length, 2, `run ${index + 1}: expected 2 items for ${continent}`);
    }
  }
});

test('validateDatasetReadiness reports the dataset can satisfy the survey contract', () => {
  const dataset = validateDatasetReadiness();

  assert.equal(dataset.ready, true);
  assert.equal(dataset.requiredSessionSize, 14);
  assert.ok(dataset.totalItems >= 14);
  assert.equal(dataset.issues.length, 0);
  assert.ok(dataset.mediaCounts.text > 0);
  assert.ok(dataset.mediaCounts.image > 0);
  assert.ok(dataset.mediaCounts.video > 0);

  for (const continent of CONTINENTS) {
    const entry = dataset.continents.find(item => item.continent === continent);
    assert.ok(entry, `expected dataset summary for ${continent}`);
    assert.ok(entry.total >= 2, `expected at least 2 total items for ${continent}`);
    assert.ok(entry.ai >= 1, `expected at least 1 AI item for ${continent}`);
    assert.ok(entry.human >= 1, `expected at least 1 human item for ${continent}`);
  }
});
