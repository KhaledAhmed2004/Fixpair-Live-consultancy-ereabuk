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
exports.GeminiHelper = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const genai_1 = require("@google/genai");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../shared/logger");
/**
 * Generates an intelligent structured summary from transcripts when Gemini AI is rate-limited or offline.
 */
const generateIntelligentFallback = (transcripts, metadata) => {
    const clientName = (metadata === null || metadata === void 0 ? void 0 : metadata.clientName) || 'Client';
    const consultantName = (metadata === null || metadata === void 0 ? void 0 : metadata.consultantName) || 'Consultant';
    // 1. Deduplicate consecutive or identical speech chunks
    const cleaned = [];
    let lastText = '';
    for (const t of transcripts) {
        const trimmed = (t.text || '').trim();
        if (!trimmed || trimmed.toLowerCase() === lastText.toLowerCase())
            continue;
        lastText = trimmed;
        cleaned.push({ speakerRole: t.speakerRole, text: trimmed });
    }
    if (cleaned.length === 0) {
        return {
            overview: 'Consultation completed without recorded speech.',
            keyPoints: ['No dialogue captured during this session.'],
            actionItems: ['Consultant may provide manual notes and recommendations.'],
            recommendations: [],
        };
    }
    // 2. Extract key points and separate client/consultant statements
    const keyPoints = [];
    const clientPoints = [];
    const consultantPoints = [];
    for (const item of cleaned) {
        const speakerLabel = item.speakerRole === 'user' ? clientName : consultantName;
        const formatted = `${speakerLabel}: ${item.text}`;
        if (!keyPoints.includes(formatted) && keyPoints.length < 10) {
            keyPoints.push(formatted);
        }
        if (item.speakerRole === 'user' && item.text.length > 3) {
            clientPoints.push(item.text);
        }
        else if (item.speakerRole !== 'user' && item.text.length > 3) {
            consultantPoints.push(item.text);
        }
    }
    // 3. Extract recommendations & action items from consultant statements
    const recommendations = [];
    const actionItems = [];
    const adviceKeywords = ['eat', 'balance', 'exercise', 'habit', 'should', 'need', 'recommend', 'try', 'avoid', 'check', 'follow'];
    for (const c of consultantPoints) {
        const lower = c.toLowerCase();
        if (adviceKeywords.some((kw) => lower.includes(kw))) {
            if (!recommendations.includes(c))
                recommendations.push(c);
        }
    }
    if (recommendations.length === 0 && consultantPoints.length > 0) {
        recommendations.push(consultantPoints[0]);
    }
    if (recommendations.length === 0) {
        recommendations.push('Follow up on discussed topics and recommendations.');
    }
    actionItems.push('Review consultation recommendations and implement suggested adjustments.');
    if (consultantPoints.length > 0) {
        actionItems.push('Consultant will follow up with additional guidance if required.');
    }
    // 4. Generate a rich overview
    let overview = '';
    if (clientPoints.length > 0 && consultantPoints.length > 0) {
        const topicSummary = clientPoints.slice(0, 3).join(', ');
        const adviceSummary = consultantPoints.slice(0, 2).join(' and ');
        overview = `During the consultation, ${clientName} discussed ${topicSummary}. ${consultantName} provided guidance regarding ${adviceSummary}.`;
    }
    else if (clientPoints.length > 0) {
        overview = `The consultation covered inquiries regarding ${clientPoints.slice(0, 4).join(', ')}.`;
    }
    else {
        overview = `Consultation completed with ${cleaned.length} dialogue turns recorded between ${clientName} and ${consultantName}.`;
    }
    return {
        overview,
        keyPoints: keyPoints.slice(0, 8),
        actionItems,
        recommendations,
    };
};
/**
 * Generates an AI-powered structured consultation summary using Google Gemini.
 */
const generateConsultationSummary = (transcripts, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // If no transcripts exist or transcript is too short
    if (!transcripts || transcripts.length === 0) {
        return {
            overview: 'No transcript recorded for this consultation.',
            keyPoints: ['No dialogue chunks captured.'],
            actionItems: ['Consultant may provide manual notes and recommendations.'],
            recommendations: [],
        };
    }
    const clientLabel = (metadata === null || metadata === void 0 ? void 0 : metadata.clientName) ? `Client (${metadata.clientName})` : 'Client';
    const consultantLabel = (metadata === null || metadata === void 0 ? void 0 : metadata.consultantName) ? `Consultant (${metadata.consultantName})` : 'Consultant';
    const dialogue = transcripts
        .map((t) => {
        const speaker = t.speakerRole === 'user' ? clientLabel : consultantLabel;
        return `[${speaker}]: ${t.text}`;
    })
        .join('\n');
    const apiKey = (_a = config_1.default.gemini) === null || _a === void 0 ? void 0 : _a.apiKey;
    if (!apiKey) {
        logger_1.logger.warn('Gemini API Key is not configured. Generating intelligent fallback summary.');
        return generateIntelligentFallback(transcripts, metadata);
    }
    const prompt = `You are an expert AI consultation analyzer. Analyze the following consultation transcript and produce a structured, professional summary in English.

Consultation Context:
- Client: ${(metadata === null || metadata === void 0 ? void 0 : metadata.clientName) || 'User'}
- Consultant: ${(metadata === null || metadata === void 0 ? void 0 : metadata.consultantName) || 'Consultant'}
- Duration: ${(metadata === null || metadata === void 0 ? void 0 : metadata.durationSeconds) ? `${Math.round(metadata.durationSeconds / 60)} minutes` : 'Live session'}

Transcript:
${dialogue}

Instructions:
1. "overview": Provide a clear 2-3 sentence executive summary of the consultation, highlighting the client's inquiry and the consultant's guidance.
2. "keyPoints": List the main topics, problems, or points discussed.
3. "actionItems": List specific action items and next steps agreed upon or required for the client or consultant.
4. "recommendations": List professional advice and recommendations provided by the consultant.

Return ONLY a valid JSON object matching this schema:
{
  "overview": "string",
  "keyPoints": ["string"],
  "actionItems": ["string"],
  "recommendations": ["string"]
}`;
    try {
        const ai = new genai_1.GoogleGenAI({ apiKey });
        const model = ((_b = config_1.default.gemini) === null || _b === void 0 ? void 0 : _b.model) || 'gemini-3.6-flash';
        logger_1.logger.info(`Generating Gemini consultation summary using model: ${model}`);
        const response = yield ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            },
        });
        const responseText = ((_c = response.text) === null || _c === void 0 ? void 0 : _c.trim()) || '{}';
        // Clean up code blocks if needed
        const cleanedJson = responseText
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
        const parsed = JSON.parse(cleanedJson);
        return {
            overview: parsed.overview || 'Consultation summary generated.',
            keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : ['Consultation completed.'],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
    }
    catch (error) {
        logger_1.errorLogger.error('Gemini AI summary generation failed (will use intelligent fallback):', error.message || error);
        // Graceful intelligent fallback
        return generateIntelligentFallback(transcripts, metadata);
    }
});
exports.GeminiHelper = {
    generateConsultationSummary,
};
