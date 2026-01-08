# Environment Variables Checklist

When creating your new Render service in Frankfurt, make sure to add these variables:

## Critical
- `MONGO_URI`: Connection string for your database.
- `JWT_SECRET`: Secret for authentication.
- `PORT`: (Render sets this automatically, usually 10000, but good to check).

## API Keys (Autonomous Advisor)
- `OPENAI_API_KEY`: For OpenAI models.
- `GEMINI_API_KEY`: For Google Gemini models.

## Optional / Bifrost
- `BIFROST_URL`: **NOT NEEDED** anymore (since we are moving to Frankfurt).
- `NODE_ENV`: Set to `production`.
