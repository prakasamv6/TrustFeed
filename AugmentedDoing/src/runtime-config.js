// Runtime configuration — overwritten at deploy time via Dockerfile / entrypoint.
// Set __TRUSTFEED_LIVE__ = true to use real API data instead of mock data.
window.__TRUSTFEED_LIVE__ = true;
window.__SURVEY_API_URL__ = 'https://trustfeed-survey-ealep.ondigitalocean.app';
