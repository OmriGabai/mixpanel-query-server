require('dotenv').config();

const requiredEnvVars = [
  'OPENAI_API_KEY',
  'MIXPANEL_SERVICE_ACCOUNT_USERNAME',
  'MIXPANEL_SERVICE_ACCOUNT_SECRET',
  'MIXPANEL_PROJECT_ID'
];

function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\nCopy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

validateEnv();

module.exports = {
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  mixpanel: {
    username: process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME,
    secret: process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET,
    projectId: process.env.MIXPANEL_PROJECT_ID
  }
};
