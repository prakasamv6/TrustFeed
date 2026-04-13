export const environment = {
  apiBase: window.location.origin + '/api',
  mockMode: !(window as any).__TRUSTFEED_LIVE__,
  surveyApiUrl: (window as any).__SURVEY_API_URL__ || '',
};
