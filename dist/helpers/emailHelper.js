"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailHelper = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../shared/logger");
const transporter = nodemailer_1.default.createTransport({
    host: config_1.default.email.host,
    port: Number(config_1.default.email.port),
    secure: false,
    auth: {
        user: config_1.default.email.user,
        pass: config_1.default.email.pass,
    },
});
const sendEmail = (values) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const defaultLogoPath = path_1.default.join(process.cwd(), 'public', 'images', 'logo.png');
        const attachments = values.attachments ? [...values.attachments] : [];
        // Automatically attach CID logo if file exists and not already provided
        if (fs_1.default.existsSync(defaultLogoPath) &&
            !attachments.some(a => a.cid === 'fixpair-logo')) {
            attachments.push({
                filename: 'logo.png',
                path: defaultLogoPath,
                cid: 'fixpair-logo',
            });
        }
        const info = yield transporter.sendMail({
            from: `"${config_1.default.branding.projectName || 'Fixpair'}" <${config_1.default.email.from}>`,
            to: values.to,
            subject: values.subject,
            html: values.html,
            attachments: attachments.length > 0 ? attachments : undefined,
        });
        logger_1.logger.info('Mail send successfully', info.accepted);
    }
    catch (error) {
        logger_1.errorLogger.error('Email', error);
    }
});
exports.emailHelper = {
    sendEmail,
};
