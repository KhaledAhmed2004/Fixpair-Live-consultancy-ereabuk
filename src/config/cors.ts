import type { CorsOptions } from 'cors';

// Keep HTTP and Socket.IO origins in sync.
export const corsOptions: CorsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://dashboard.getfixpair.com',
    'https://ereabook-updated-work.vercel.app',
    'https://www.ereabook-updated-work.vercel.app',
  ],
  credentials: true,
};
