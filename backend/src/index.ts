import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { summariesRouter } from './routes/summaries.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Privacy Policy
app.get('/privacy', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Page Summary Extension</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
    h1 { color: #2563eb; }
    h2 { color: #1e40af; margin-top: 30px; }
    p { margin: 15px 0; }
    ul { margin: 15px 0; padding-left: 30px; }
    .updated { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: January 31, 2026</p>

  <h2>Overview</h2>
  <p>Page Summary ("the Extension") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.</p>

  <h2>Information We Collect</h2>
  <ul>
    <li><strong>Google Account Information:</strong> When you sign in, we receive your name, email address, and profile picture from Google to create your account.</li>
    <li><strong>Page Summaries:</strong> When you save a summary, we store the page title, URL, summary text, and key points you choose to save.</li>
    <li><strong>Page Content:</strong> The Extension temporarily processes webpage content locally in your browser to generate summaries. This content is not sent to our servers unless you explicitly save a summary.</li>
  </ul>

  <h2>How We Use Your Information</h2>
  <ul>
    <li>To provide and maintain the Extension's functionality</li>
    <li>To store and sync your saved summaries across devices</li>
    <li>To authenticate your identity via Google Sign-In</li>
  </ul>

  <h2>Data Storage</h2>
  <p>Your data is stored securely on servers provided by Vercel and Vercel Postgres. We implement appropriate security measures to protect your information.</p>

  <h2>Data Sharing</h2>
  <p>We do not sell, trade, or share your personal information with third parties. Your saved summaries are private and only accessible to you.</p>

  <h2>Your Rights</h2>
  <ul>
    <li>You can delete individual summaries at any time from your dashboard</li>
    <li>You can sign out to disconnect your Google account</li>
    <li>You can uninstall the Extension to stop all data collection</li>
  </ul>

  <h2>Contact</h2>
  <p>For questions about this privacy policy, please contact us through the Chrome Web Store listing.</p>
</body>
</html>
  `);
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/summaries', summariesRouter);

// Error handler
app.use(errorHandler);

// Start server (only in development)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Page Summary API running on http://localhost:${PORT}`);
  });
}

export default app;
