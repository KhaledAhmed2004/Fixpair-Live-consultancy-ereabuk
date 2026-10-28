"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.allowedOrigins = void 0;
exports.allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://dashboard.getfixpair.com',
    'http://dashboard.getfixpair.com',
    'https://getfixpair.com',
    'http://getfixpair.com',
    'https://www.getfixpair.com',
    'http://www.getfixpair.com',
    'https://api.getfixpair.com',
    'http://api.getfixpair.com',
    'https://ereabook-updated-work.vercel.app',
    'https://www.ereabook-updated-work.vercel.app',
];
// Keep HTTP and Socket.IO origins in sync.
exports.corsOptions = {
    origin: exports.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
    ],
    optionsSuccessStatus: 200,
};
