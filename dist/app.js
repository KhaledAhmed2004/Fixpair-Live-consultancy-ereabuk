"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const http_status_codes_1 = require("http-status-codes");
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const routes_1 = __importDefault(require("./routes"));
const morgen_1 = require("./shared/morgen");
const app = (0, express_1.default)();
//morgan
app.use(morgen_1.Morgan.successHandler);
app.use(morgen_1.Morgan.errorHandler);
//body parser
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'https://ereabook-updated-work.vercel.app',
        'https://www.ereabook-updated-work.vercel.app',
    ],
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '1gb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1gb' }));
//file retrieve
app.use(express_1.default.static('uploads'));
app.use('/public', express_1.default.static('public'));
app.use(express_1.default.static('public'));
//router
app.use('/api/v1', routes_1.default);
//live response
app.get('/', (req, res) => {
    const date = new Date(Date.now());
    res.send(`<h1 style="text-align:center; color:#173616; font-family:Verdana;">Beep-beep! The server is alive and kicking.</h1>
    <p style="text-align:center; color:#173616; font-family:Verdana;">${date}</p>
    `);
});
//global error handle
app.use(globalErrorHandler_1.default);
//handle not found route;
app.use((req, res) => {
    res.status(http_status_codes_1.StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Not found',
        errorMessages: [
            {
                path: req.originalUrl,
                message: "API DOESN'T EXIST",
            },
        ],
    });
});
exports.default = app;
