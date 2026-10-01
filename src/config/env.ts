export const env = {
  isDevelopment: import.meta.env.MODE === 'development',
  isProduction: import.meta.env.MODE === 'production',
  apiUrl: import.meta.env.VITE_API_URL || '',
};
