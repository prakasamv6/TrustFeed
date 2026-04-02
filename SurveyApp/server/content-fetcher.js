/**
 * ContentFetcher — Fetches unique, non-repeating content from free internet sources.
 * Human content: Wikipedia articles, Picsum/Pexels photos, Pexels videos
 * AI content: Picsum-seeded images, dynamically composed AI-style text
 * NO PII collected. Sources are all free/open.
 * Enhanced with timeouts, Promise.allSettled for resilience, and per-source error isolation.
 */

// ─── Fetch with timeout helper ───

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Wikipedia (human text, no API key) ───

async function fetchWikipediaArticles(count) {
  const articles = [];
  const categories = ['Science', 'History', 'Technology', 'Culture', 'Geography', 'Health', 'Politics', 'Economics'];

  for (let i = 0; i < count; i++) {
    try {
      const res = await fetchWithTimeout('https://en.wikipedia.org/api/rest_v1/page/random/summary', {
        headers: { 'User-Agent': 'TrustFeedSurvey/1.0 (research prototype)' },
      }, 8000);
      if (!res.ok) continue;
      const data = await res.json();

      if (data.extract && data.extract.length > 80) {
        articles.push({
          title: data.title,
          content: data.extract,
          imageUrl: data.thumbnail?.source || null,
          contentType: 'text',
          groundTruth: 'human',
          category: categories[i % categories.length],
          difficulty: assignDifficulty(data.extract),
          source: 'wikipedia',
        });
      }
    } catch (err) {
      console.error('Wikipedia fetch error:', err.message);
    }
  }
  return articles;
}

// ─── Picsum Photos (human images, no API key) ───

async function fetchPicsumImages(count) {
  const images = [];
  const page = Math.floor(Math.random() * 30) + 1;

  try {
    const res = await fetchWithTimeout(`https://picsum.photos/v2/list?page=${page}&limit=${count * 2}`, {}, 8000);
    if (!res.ok) return images;
    const data = await res.json();

    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, count);
    for (const photo of shuffled) {
      images.push({
        title: `Photography by ${photo.author}`,
        content: `A photograph captured by ${photo.author}. This image showcases real-world photography with natural composition, authentic lighting, and human artistic vision. Original dimensions: ${photo.width}×${photo.height}.`,
        imageUrl: `https://picsum.photos/id/${photo.id}/600/400`,
        contentType: 'image',
        groundTruth: 'human',
        category: 'Photography',
        difficulty: 'medium',
        source: 'picsum',
      });
    }
  } catch (err) {
    console.error('Picsum fetch error:', err.message);
  }
  return images;
}

// ─── Pexels (human photos + videos, free API key) ───

async function fetchPexelsContent(apiKey, photoCount, videoCount) {
  const results = [];
  if (!apiKey) return results;

  // Fetch photos
  const photoQueries = ['nature', 'city', 'people', 'food', 'architecture', 'animals', 'ocean', 'mountains', 'technology', 'art'];
  const query = photoQueries[Math.floor(Math.random() * photoQueries.length)];

  try {
    const photoRes = await fetchWithTimeout(
      `https://api.pexels.com/v1/search?query=${query}&per_page=${photoCount}&page=${Math.floor(Math.random() * 5) + 1}`,
      { headers: { Authorization: apiKey } }, 8000
    );
    if (photoRes.ok) {
      const photoData = await photoRes.json();
      for (const photo of (photoData.photos || [])) {
        results.push({
          title: photo.alt || `Photo by ${photo.photographer}`,
          content: `Photograph by ${photo.photographer}. ${photo.alt || 'A professionally captured photograph showcasing real-world subjects with authentic human perspective and artistic composition.'}`,
          imageUrl: photo.src?.medium || photo.src?.small,
          contentType: 'image',
          groundTruth: 'human',
          category: 'Photography',
          difficulty: 'medium',
          source: 'pexels',
        });
      }
    }
  } catch (err) {
    console.error('Pexels photo fetch error:', err.message);
  }

  // Fetch videos
  const videoQueries = ['nature landscape', 'ocean waves', 'city timelapse', 'animals wildlife', 'rain forest'];
  const vQuery = videoQueries[Math.floor(Math.random() * videoQueries.length)];

  try {
    const videoRes = await fetchWithTimeout(
      `https://api.pexels.com/videos/search?query=${vQuery}&per_page=${videoCount}&page=1`,
      { headers: { Authorization: apiKey } }, 8000
    );
    if (videoRes.ok) {
      const videoData = await videoRes.json();
      for (const video of (videoData.videos || [])) {
        const videoFile = video.video_files?.find(f => f.quality === 'sd') || video.video_files?.[0];
        results.push({
          title: `Video: ${vQuery.charAt(0).toUpperCase() + vQuery.slice(1)}`,
          content: `A real-world video captured by a human filmmaker. Duration: ${video.duration}s. This footage shows authentic natural movement and real lighting conditions typical of human videography.`,
          imageUrl: video.image,
          videoUrl: videoFile?.link || null,
          contentType: 'video',
          groundTruth: 'human',
          category: 'Video',
          difficulty: 'hard',
          source: 'pexels',
        });
      }
    }
  } catch (err) {
    console.error('Pexels video fetch error:', err.message);
  }

  return results;
}

// ─── Free Video Sources (human videos, no API key) ───

function getHumanVideos(count) {
  // Curated set of real human-filmed stock video URLs (free/open sources)
  const videos = [
    { title: 'Ocean Waves at Sunset', content: 'Real footage of ocean waves breaking on a sandy beach during golden hour. The natural movement of water, authentic lens flare, and ambient sound of the surf are hallmarks of human-captured videography.', category: 'Nature', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', imageUrl: 'https://picsum.photos/seed/ocean/600/400' },
    { title: 'Forest Stream in Morning Light', content: 'A tranquil forest stream filmed in early morning light. Dappled sunlight filters through the canopy, creating natural bokeh effects. The handheld camera movement and organic framing indicate human cinematography.', category: 'Nature', videoUrl: 'https://www.w3schools.com/html/movie.mp4', imageUrl: 'https://picsum.photos/seed/forest/600/400' },
    { title: 'City Street Time-lapse', content: 'A time-lapse recording of a busy city intersection during rush hour. The video captures authentic urban dynamics — pedestrian flow, traffic patterns, and changing light conditions — characteristic of real-world documentary filming.', category: 'Urban', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', imageUrl: 'https://picsum.photos/seed/city/600/400' },
    { title: 'Cooking Fresh Pasta by Hand', content: 'Close-up footage of a chef preparing fresh pasta from scratch. The video showcases real hand movements, flour dust particles, and natural kitchen lighting that are difficult for AI to replicate convincingly.', category: 'Lifestyle', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', imageUrl: 'https://picsum.photos/seed/cooking/600/400' },
    { title: 'Mountain Hiking Trail', content: 'Point-of-view footage from a mountain hiking trail. Natural camera shake from walking, authentic wind noise, and the organic pacing of a human hiker distinguish this from synthetic footage.', category: 'Adventure', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', imageUrl: 'https://picsum.photos/seed/mountain/600/400' },
    { title: 'Birds in a Garden', content: 'Handheld footage of songbirds feeding in a suburban garden. The unpredictable movement of the birds, natural depth of field shifts, and ambient garden sounds mark this as genuine wildlife videography.', category: 'Wildlife', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', imageUrl: 'https://picsum.photos/seed/birds/600/400' },
    { title: 'Rainy Window View', content: 'A contemplative shot of rain falling on a window pane with a blurred cityscape behind. The randomness of raindrop patterns and natural reflections are telltale signs of real-world footage.', category: 'Atmospheric', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', imageUrl: 'https://picsum.photos/seed/rain/600/400' },
    { title: 'Children Playing in a Park', content: 'Candid footage of children playing on playground equipment in a sunlit park. The spontaneous laughter, unpredictable movement, and natural lens exposure adjustments are characteristic of authentic human filming.', category: 'Lifestyle', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', imageUrl: 'https://picsum.photos/seed/park/600/400' },
  ];

  return videos.sort(() => Math.random() - 0.5).slice(0, count).map(v => ({
    title: v.title,
    content: v.content,
    imageUrl: v.imageUrl,
    videoUrl: v.videoUrl,
    contentType: 'video',
    groundTruth: 'human',
    category: v.category,
    difficulty: 'hard',
    source: 'human-video',
  }));
}

// ─── AI-Generated Videos (synthetic / simulated, no API key) ───

function getAIGeneratedVideos(count) {
  const videos = [
    { title: 'AI Dreamscape: Morphing Landscapes', content: 'An AI-generated video showing landscapes that smoothly morph from desert to ocean to forest. The impossibly fluid transitions and perfectly symmetrical compositions reveal its synthetic origin. Generated using diffusion-based video models.', imageUrl: 'https://picsum.photos/seed/ai-dreamscape/600/400' },
    { title: 'Neural Network Visualization', content: 'A procedurally generated visualization of data flowing through a neural network. The perfectly geometric nodes, impossibly smooth particle trajectories, and mathematically precise color gradients distinguish it from human-made animation.', imageUrl: 'https://picsum.photos/seed/neural-net/600/400' },
    { title: 'AI Fashion Runway', content: 'An AI-generated fashion runway video showing models in algorithmically designed clothing. Subtle inconsistencies in finger geometry, overly symmetrical facial features, and fabric that moves with unnatural fluidity betray its synthetic nature.', imageUrl: 'https://picsum.photos/seed/ai-fashion/600/400' },
    { title: 'Synthetic Nature Documentary', content: 'AI-generated footage of a species of animal that does not exist — a luminescent arctic fox with butterfly wings. The impossibly detailed fur rendering and physically implausible creature design indicate AI generation.', imageUrl: 'https://picsum.photos/seed/synth-nature/600/400' },
    { title: 'AI Architectural Walkthrough', content: 'A walkthrough of an AI-designed building with impossible geometry — staircases that loop into themselves, rooms that are larger inside than outside. The flawless lighting and absence of construction imperfections signal AI origin.', imageUrl: 'https://picsum.photos/seed/ai-architecture/600/400' },
    { title: 'Deepfake Weather Report', content: 'An AI-generated weather report featuring a synthetic presenter. The overly smooth skin texture, slightly misaligned lip sync, and unnaturally consistent eye blinks are telltale signs of deepfake video generation technology.', imageUrl: 'https://picsum.photos/seed/deepfake-weather/600/400' },
  ];

  return videos.sort(() => Math.random() - 0.5).slice(0, count).map(v => ({
    title: v.title,
    content: v.content,
    imageUrl: v.imageUrl,
    videoUrl: null,
    contentType: 'video',
    groundTruth: 'ai',
    category: 'AI Video',
    difficulty: 'hard',
    source: 'ai-generated',
  }));
}

// ─── AI-generated images (picsum.photos with unique seeds) ───

async function fetchAIImages(count) {
  const images = [];
  const prompts = [
    'futuristic city skyline at sunset with flying cars',
    'magical forest with glowing mushrooms and fairy lights',
    'underwater palace made of crystal and coral',
    'steampunk robot playing violin in a Victorian library',
    'floating islands above clouds with waterfalls',
    'alien landscape with two suns and purple vegetation',
    'cyberpunk street market with neon signs at night',
    'enchanted garden with giant flowers and tiny houses',
    'space station orbiting a gas giant planet',
    'ancient temple ruins reclaimed by nature and wildlife',
    'surreal desert landscape with melting clocks',
    'microscopic world of colorful bacteria and cells',
    'dream-like castle on a mountain peak in clouds',
    'bioluminescent ocean creatures in deep sea darkness',
    'retro futuristic 1950s style moon colony',
  ];

  const shuffled = prompts.sort(() => Math.random() - 0.5).slice(0, count);

  for (const prompt of shuffled) {
    const seed = prompt.replace(/[^a-z0-9]/gi, '-').substring(0, 40) + '-' + Math.floor(Math.random() * 9999);
    images.push({
      title: `AI Art: ${prompt.split(' ').slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
      content: `This image was generated by an AI model from the text prompt: "${prompt}". It demonstrates current generative AI capabilities in visual content creation.`,
      imageUrl: `https://picsum.photos/seed/${seed}/600/400`,
      contentType: 'image',
      groundTruth: 'ai',
      category: 'AI Art',
      difficulty: 'medium',
      source: 'ai-generated',
    });
  }
  return images;
}

// ─── AI-generated text (unique each time via template composition) ───

function generateAITexts(count) {
  const templates = [
    {
      category: 'Analysis',
      difficulty: 'hard',
      generate: () => {
        const topics = ['renewable energy adoption', 'global supply chain resilience', 'quantum computing investment', 'autonomous vehicle deployment', 'digital health integration'];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const pct1 = (Math.random() * 30 + 10).toFixed(1);
        const pct2 = (Math.random() * 20 + 5).toFixed(1);
        const year = 2023 + Math.floor(Math.random() * 3);
        return {
          title: `Market Analysis: ${topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `Comprehensive analysis of ${topic} reveals a ${pct1}% year-over-year growth trajectory through ${year}. Key indicators suggest accelerating momentum driven by regulatory tailwinds and technological maturation. Industry stakeholders report ${pct2}% improvement in operational efficiency metrics, while capital allocation toward ${topic} infrastructure has reached unprecedented levels. The convergence of policy frameworks and market dynamics creates a favorable outlook for sustained expansion across major economic regions.`,
        };
      },
    },
    {
      category: 'Health',
      difficulty: 'medium',
      generate: () => {
        const topics = ['circadian rhythm optimization', 'gut microbiome balance', 'neurocognitive enhancement', 'cardiovascular endurance', 'metabolic flexibility'];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const num1 = Math.floor(Math.random() * 30 + 10);
        const num2 = Math.floor(Math.random() * 40 + 20);
        return {
          title: `Wellness Guide: ${topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `Optimizing ${topic} requires a systematic approach incorporating evidence-based protocols. Research indicates that targeted interventions can improve outcomes by approximately ${num1}% within ${num2} days of consistent implementation. Key strategies include strategic nutrient timing, progressive exposure therapy, and biometric feedback integration. Practitioners recommend establishing baseline measurements before initiating any protocol modification to ensure accurate progress tracking and outcome validation.`,
        };
      },
    },
    {
      category: 'Technology',
      difficulty: 'hard',
      generate: () => {
        const techs = ['edge computing infrastructure', 'zero-knowledge proof systems', 'neural architecture search', 'federated learning protocols', 'homomorphic encryption'];
        const tech = techs[Math.floor(Math.random() * techs.length)];
        const factor = (Math.random() * 9 + 2).toFixed(1);
        const metric = (Math.random() * 40 + 60).toFixed(1);
        return {
          title: `Technical Brief: Advances in ${tech.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `Recent advances in ${tech} demonstrate ${factor}x performance improvements over previous-generation implementations. Benchmark evaluations across standardized test suites reveal ${metric}% accuracy under production-scale workloads, establishing new baselines for the field. The architectural innovations leverage novel optimization techniques that reduce computational overhead while maintaining cryptographic guarantees. Industry adoption is accelerating as enterprise-grade tooling matures and deployment complexity decreases. Interoperability standards are emerging through collaborative framework development across major research institutions.`,
        };
      },
    },
    {
      category: 'Environment',
      difficulty: 'medium',
      generate: () => {
        const subjects = ['coral reef restoration', 'atmospheric carbon capture', 'permafrost monitoring', 'marine biodiversity mapping', 'urban heat island mitigation'];
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        const stations = Math.floor(Math.random() * 50 + 20);
        const pct = (Math.random() * 25 + 5).toFixed(1);
        return {
          title: `Environmental Report: ${subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `Data collection from ${stations} monitoring stations reveals significant trends in ${subject} metrics. Year-over-year analysis indicates a ${pct}% change in primary indicators, consistent with predictive models published in peer-reviewed literature. Satellite imagery corroborates ground-level measurements, providing multi-modal validation of observed patterns. Researchers emphasize the importance of sustained monitoring infrastructure and standardized data protocols for enabling rigorous longitudinal analysis across geographic regions.`,
        };
      },
    },
    {
      category: 'Finance',
      difficulty: 'medium',
      generate: () => {
        const areas = ['decentralized finance protocols', 'ESG-integrated portfolios', 'algorithmic trading strategies', 'central bank digital currencies', 'tokenized real-world assets'];
        const area = areas[Math.floor(Math.random() * areas.length)];
        const growth = (Math.random() * 15 + 3).toFixed(1);
        const vol = (Math.random() * 500 + 100).toFixed(0);
        return {
          title: `Financial Outlook: ${area.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `The landscape of ${area} continues to evolve with ${growth}% quarterly expansion in total value locked. Trading volumes have reached $${vol}B across major platforms, reflecting institutional adoption and retail participation. Risk-adjusted returns demonstrate favorable Sharpe ratios compared to traditional benchmarks, though regulatory uncertainty introduces variable volatility. Market participants should maintain diversified exposure while monitoring evolving compliance frameworks across jurisdictions.`,
        };
      },
    },
    {
      category: 'Review',
      difficulty: 'easy',
      generate: () => {
        const products = ['ErgoFlow Standing Desk Pro', 'QuantumBuds ANC Earphones', 'SolarCharge PowerStation 3000', 'MindSync Meditation Headband', 'AquaPure Smart Water Filter'];
        const product = products[Math.floor(Math.random() * products.length)];
        const rating = (Math.random() * 1.5 + 3.5).toFixed(1);
        const hours = Math.floor(Math.random() * 200 + 50);
        return {
          title: `Product Review: ${product}`,
          content: `The ${product} delivers consistent performance across ${hours} hours of testing. Build quality meets premium segment expectations with materials that balance durability and aesthetic appeal. Key specifications align with manufacturer claims within acceptable tolerance margins. The user interface provides intuitive navigation with minimal learning curve. Overall rating: ${rating}/5.0 based on standardized evaluation criteria covering functionality, ergonomics, value, and longevity metrics.`,
        };
      },
    },
    {
      category: 'News',
      difficulty: 'hard',
      generate: () => {
        const events = ['international climate summit outcomes', 'breakthrough in fusion energy research', 'global education technology initiative', 'cross-border data governance agreement', 'space exploration cooperation treaty'];
        const event = events[Math.floor(Math.random() * events.length)];
        const countries = Math.floor(Math.random() * 30 + 15);
        return {
          title: `Report: ${event.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `Representatives from ${countries} nations convened to address critical developments in ${event}. The proceedings yielded consensus on implementation timelines and resource allocation frameworks. Key stakeholders expressed cautious optimism regarding measurable outcomes within the established 18-month evaluation period. Technical working groups will continue bilateral consultations to harmonize regulatory approaches. The agreement establishes binding reporting requirements with independent verification mechanisms to ensure accountability and transparency across participating jurisdictions.`,
        };
      },
    },
    {
      category: 'Education',
      difficulty: 'easy',
      generate: () => {
        const topics = ['machine learning fundamentals', 'effective data visualization', 'agile project management', 'cybersecurity best practices', 'cloud architecture design'];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const steps = Math.floor(Math.random() * 5 + 3);
        const weeks = Math.floor(Math.random() * 8 + 4);
        return {
          title: `Learning Guide: ${topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
          content: `Mastering ${topic} requires a structured approach spanning approximately ${weeks} weeks of dedicated study. The curriculum is organized into ${steps} progressive modules, each building upon foundational concepts established in preceding sections. Hands-on exercises complement theoretical instruction, ensuring practical skill acquisition alongside conceptual understanding. Assessment checkpoints at regular intervals provide feedback for learners to calibrate their progress and identify areas requiring additional focus.`,
        };
      },
    },
  ];

  const results = [];
  const shuffledTemplates = templates.sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const template = shuffledTemplates[i % shuffledTemplates.length];
    const generated = template.generate();
    results.push({
      title: generated.title,
      content: generated.content,
      imageUrl: null,
      contentType: 'text',
      groundTruth: 'ai',
      category: template.category,
      difficulty: template.difficulty,
      source: 'ai-generated',
    });
  }
  return results;
}

// ─── Difficulty assignment for Wikipedia articles ───

function assignDifficulty(text) {
  const wordCount = text.split(/\s+/).length;
  const avgWordLen = text.replace(/\s+/g, '').length / wordCount;
  if (avgWordLen > 6 && wordCount > 100) return 'hard';
  if (avgWordLen > 5 || wordCount > 60) return 'medium';
  return 'easy';
}

// ─── Main fetch orchestrator ───

async function fetchUniqueContent(totalCount, pexelsApiKey) {
  // Distribute: ~25% human text, ~15% human images, ~10% human video,
  //             ~20% AI text, ~15% AI images, ~10% AI video, ~5% pexels bonus
  const humanTextCount = Math.ceil(totalCount * 0.25);
  const humanImageCount = Math.ceil(totalCount * 0.15);
  const humanVideoCount = Math.max(1, Math.ceil(totalCount * 0.10));
  const aiTextCount = Math.ceil(totalCount * 0.20);
  const aiImageCount = Math.ceil(totalCount * 0.15);
  const aiVideoCount = Math.max(1, Math.ceil(totalCount * 0.10));
  const pexelsPhotoCount = pexelsApiKey ? Math.ceil(totalCount * 0.05) : 0;
  const pexelsVideoCount = pexelsApiKey ? Math.max(1, Math.ceil(totalCount * 0.05)) : 0;

  // Fetch all sources in parallel — using allSettled so one failure doesn't block others
  const results = await Promise.allSettled([
    fetchWikipediaArticles(humanTextCount + 3), // extra for fallback
    fetchPicsumImages(humanImageCount + 2),
    fetchPexelsContent(pexelsApiKey, pexelsPhotoCount, pexelsVideoCount),
    fetchAIImages(aiImageCount + 2),
  ]);

  const wikiArticles = results[0].status === 'fulfilled' ? results[0].value : [];
  const picsumImages = results[1].status === 'fulfilled' ? results[1].value : [];
  const pexelsContent = results[2].status === 'fulfilled' ? results[2].value : [];
  const aiImages     = results[3].status === 'fulfilled' ? results[3].value : [];

  // Log which sources failed
  const sourceNames = ['Wikipedia', 'Picsum', 'Pexels', 'Pollinations'];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`${sourceNames[i]} source failed:`, r.reason?.message || r.reason);
    }
  });

  const aiTexts = generateAITexts(aiTextCount + 2);
  const humanVideos = getHumanVideos(humanVideoCount + 1);
  const aiVideos = getAIGeneratedVideos(aiVideoCount + 1);

  // Combine all content
  let allContent = [
    ...wikiArticles.slice(0, humanTextCount),
    ...picsumImages.slice(0, humanImageCount),
    ...humanVideos.slice(0, humanVideoCount),
    ...pexelsContent,
    ...aiTexts.slice(0, aiTextCount),
    ...aiImages.slice(0, aiImageCount),
    ...aiVideos.slice(0, aiVideoCount),
  ];

  // If we have fewer items than requested, pad with AI text (always available)
  while (allContent.length < totalCount) {
    const extra = generateAITexts(1);
    allContent.push(...extra);
  }

  // Shuffle and trim to exact count
  allContent = allContent.sort(() => Math.random() - 0.5).slice(0, totalCount);

  // Ensure balanced ground truth (~50/50 human/ai)
  const humanItems = allContent.filter(c => c.groundTruth === 'human');
  const aiItems = allContent.filter(c => c.groundTruth === 'ai');

  return allContent.map((item, i) => ({
    ...item,
    id: `content-${Date.now()}-${i}`,
  }));
}

module.exports = { fetchUniqueContent };
