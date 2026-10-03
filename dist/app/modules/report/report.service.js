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
exports.ReportService = void 0;
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const consultation_model_1 = require("../consultation/consultation.model");
const report_model_1 = require("./report.model");
const videoSession_model_1 = require("../videoSession/videoSession.model");
const transcription_model_1 = require("../transcription/transcription.model");
const geminiHelper_1 = require("../../../helpers/geminiHelper");
const socketHelper_1 = require("../../../helpers/socketHelper");
const generateConsultationPDF = (reportData) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        var _a, _b, _c;
        try {
            const doc = new pdfkit_1.default({ margin: 36, size: 'A4', bufferPages: true });
            const fileName = `report-${reportData.consultationId}-${Date.now()}.pdf`;
            const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'reports');
            if (!fs_1.default.existsSync(uploadDir)) {
                fs_1.default.mkdirSync(uploadDir, { recursive: true });
            }
            const filePath = path_1.default.join(uploadDir, fileName);
            const stream = fs_1.default.createWriteStream(filePath);
            doc.pipe(stream);
            // --- Color Palette from Reference Design ---
            const textPrimary = '#0f172a'; // Deep slate / black
            const textSecondary = '#64748b'; // Muted slate gray
            const textDark = '#1e293b';
            const blueAccent = '#2563eb'; // Vibrant Blue
            const purpleAccent = '#7c3aed'; // Gemini Purple
            const greenAccent = '#059669'; // Emerald Green
            const orangeAccent = '#ea580c'; // Vibrant Orange
            const borderLight = '#e2e8f0'; // Light gray border
            const cardBgLight = '#f8fafc'; // Card inner bg
            const aiCardBg = '#fbfaff'; // AI card soft lavender bg
            const aiCardBorder = '#e0e7ff';
            const contentWidth = 523; // 595 - 72 (margins)
            const leftMargin = 36;
            const ensurePageSpace = (neededHeight) => {
                if (doc.y + neededHeight > 780) {
                    doc.addPage();
                    doc.y = 36;
                }
            };
            // ─── 1. Header (Brand Left / Service Log Right) ───
            // Brand Logo & Subtitle
            doc
                .font('Helvetica-Bold')
                .fontSize(22)
                .fillColor(textPrimary)
                .text('Fixpair', leftMargin, 36);
            doc
                .font('Helvetica-Bold')
                .fontSize(7.5)
                .fillColor(blueAccent)
                .text('YOUR PROFESSIONAL IN YOUR POCKET', leftMargin, 63);
            // Right Header: Service log, ID, Date
            const formattedDate = reportData.date
                ? new Date(reportData.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                })
                : new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                });
            const callId = `rep_call_${String(reportData.consultationId).slice(-9)}`;
            doc
                .font('Helvetica-Bold')
                .fontSize(13)
                .fillColor(textPrimary)
                .text('Service log', leftMargin, 36, { align: 'right', width: contentWidth });
            doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(textSecondary)
                .text(`ID:  ${callId}`, leftMargin, 52, { align: 'right', width: contentWidth });
            doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(textSecondary)
                .text(`Date: ${formattedDate}`, leftMargin, 64, { align: 'right', width: contentWidth });
            // ─── 2. Metadata Info Card (2x2 Grid) ───
            const metaBoxY = 82;
            const metaBoxHeight = 58;
            doc
                .roundedRect(leftMargin, metaBoxY, contentWidth, metaBoxHeight, 8)
                .fillAndStroke('#ffffff', borderLight);
            const colWidth = contentWidth / 4;
            const durationSec = reportData.duration || 0;
            const durMin = Math.floor(durationSec / 60);
            const durSec = durationSec % 60;
            const durationStr = `${durMin} min ${durSec} sec`;
            // Col 1: Category
            doc
                .font('Helvetica-Bold')
                .fontSize(6.5)
                .fillColor(textSecondary)
                .text('CATEGORY', leftMargin + 16, metaBoxY + 12);
            doc
                .font('Helvetica-Bold')
                .fontSize(9.5)
                .fillColor(textPrimary)
                .text(reportData.bookingType || 'instant', leftMargin + 16, metaBoxY + 26);
            // Col 2: Advisor
            doc
                .font('Helvetica-Bold')
                .fontSize(6.5)
                .fillColor(textSecondary)
                .text('ADVISOR', leftMargin + colWidth + 10, metaBoxY + 12);
            doc
                .font('Helvetica-Bold')
                .fontSize(9.5)
                .fillColor(textPrimary)
                .text(reportData.consultantName || 'Advisor', leftMargin + colWidth + 10, metaBoxY + 26, { width: colWidth - 15, ellipsis: true });
            // Col 3: Conversation Duration
            doc
                .font('Helvetica-Bold')
                .fontSize(6.5)
                .fillColor(textSecondary)
                .text('CONVERSATION DURATION', leftMargin + colWidth * 2 + 5, metaBoxY + 12);
            doc
                .font('Helvetica-Bold')
                .fontSize(9.5)
                .fillColor(textPrimary)
                .text(durationStr, leftMargin + colWidth * 2 + 5, metaBoxY + 26);
            // Col 4: Status
            doc
                .font('Helvetica-Bold')
                .fontSize(6.5)
                .fillColor(textSecondary)
                .text('STATUS', leftMargin + colWidth * 3 + 5, metaBoxY + 12);
            doc
                .font('Helvetica-Bold')
                .fontSize(9.5)
                .fillColor(greenAccent)
                .text('Successfully completed', leftMargin + colWidth * 3 + 5, metaBoxY + 26);
            doc.y = metaBoxY + metaBoxHeight + 14;
            // ─── Helper: Draw Section Header with Vertical Bar ───
            const drawSectionHeader = (title, barColor) => {
                ensurePageSpace(45);
                const curY = doc.y;
                doc
                    .roundedRect(leftMargin, curY + 1, 3.5, 12, 1.5)
                    .fill(barColor);
                doc
                    .font('Helvetica-Bold')
                    .fontSize(11)
                    .fillColor(textPrimary)
                    .text(title, leftMargin + 10, curY);
                doc.y = curY + 18;
            };
            // ─── Helper: Draw Empty State Dashed Card ───
            const drawEmptyStateCard = (message) => {
                ensurePageSpace(40);
                const cardY = doc.y;
                doc
                    .roundedRect(leftMargin, cardY, contentWidth, 34, 6)
                    .dash(4, { space: 3 })
                    .strokeColor(borderLight)
                    .stroke()
                    .undash();
                doc
                    .font('Helvetica-Oblique')
                    .fontSize(8.5)
                    .fillColor(textSecondary)
                    .text(message, leftMargin, cardY + 11, {
                    align: 'center',
                    width: contentWidth,
                });
                doc.y = cardY + 44;
            };
            // ─── 3. Gemini AI Summary Card ───
            const summaryText = reportData.summary || ((_a = reportData.aiSummary) === null || _a === void 0 ? void 0 : _a.overview) || 'No transcript recorded for this consultation.';
            const keyPointsList = (reportData.keyPoints && reportData.keyPoints.length > 0)
                ? reportData.keyPoints
                : ((_b = reportData.aiSummary) === null || _b === void 0 ? void 0 : _b.keyPoints) || ['No dialogue chunks captured.'];
            ensurePageSpace(160);
            const aiCardStartY = doc.y;
            // Calculate required heights for AI card
            doc.font('Helvetica').fontSize(8.5);
            const execTextHeight = doc.heightOfString(summaryText, { width: contentWidth - 36 });
            const execBoxHeight = Math.max(34, execTextHeight + 16);
            let keyPointsHeight = 0;
            keyPointsList.forEach((pt) => {
                keyPointsHeight += doc.heightOfString(pt, { width: contentWidth - 55 }) + 6;
            });
            const keyPointsBoxHeight = Math.max(34, keyPointsHeight + 14);
            const totalAiCardHeight = 52 + 18 + execBoxHeight + 16 + keyPointsBoxHeight + 16;
            // Draw Main AI Card Container
            doc
                .roundedRect(leftMargin, aiCardStartY, contentWidth, totalAiCardHeight, 10)
                .fillAndStroke(aiCardBg, aiCardBorder);
            // AI Header Icon: Purple Circle with crisp vector star
            const starCx = leftMargin + 22;
            const starCy = aiCardStartY + 24;
            doc.circle(starCx, starCy, 12).fill(purpleAccent);
            // Vector 4-point Sparkle in white
            doc.save();
            doc.moveTo(starCx, starCy - 6)
                .lineTo(starCx + 1.8, starCy - 1.8)
                .lineTo(starCx + 6, starCy)
                .lineTo(starCx + 1.8, starCy + 1.8)
                .lineTo(starCx, starCy + 6)
                .lineTo(starCx - 1.8, starCy + 1.8)
                .lineTo(starCx - 6, starCy)
                .lineTo(starCx - 1.8, starCy - 1.8)
                .closePath()
                .fill('#ffffff');
            doc.restore();
            // AI Title (Model name badge omitted as requested)
            doc
                .font('Helvetica-Bold')
                .fontSize(11.5)
                .fillColor('#1e1b4b')
                .text('Gemini AI Summary', leftMargin + 42, aiCardStartY + 14);
            // AI Subtitle
            doc
                .font('Helvetica')
                .fontSize(7.5)
                .fillColor(textSecondary)
                .text('Auto-generated intelligence from live consultation transcription', leftMargin + 42, aiCardStartY + 29);
            // AI Inner Subsection 1: Executive Summary (Clean vector document icon)
            const execHeaderY = aiCardStartY + 50;
            // Vector Doc Icon
            doc
                .roundedRect(leftMargin + 18, execHeaderY - 1, 8.5, 10.5, 1)
                .strokeColor(purpleAccent)
                .lineWidth(0.8)
                .stroke();
            doc
                .moveTo(leftMargin + 20, execHeaderY + 2.5)
                .lineTo(leftMargin + 24.5, execHeaderY + 2.5)
                .stroke();
            doc
                .moveTo(leftMargin + 20, execHeaderY + 5.5)
                .lineTo(leftMargin + 24.5, execHeaderY + 5.5)
                .stroke();
            doc
                .font('Helvetica-Bold')
                .fontSize(8.5)
                .fillColor(purpleAccent)
                .text('Executive Summary', leftMargin + 31, execHeaderY);
            const execBoxY = execHeaderY + 14;
            doc
                .roundedRect(leftMargin + 14, execBoxY, contentWidth - 28, execBoxHeight, 6)
                .fillAndStroke('#ffffff', borderLight);
            doc
                .font('Helvetica')
                .fontSize(8.5)
                .fillColor(textDark)
                .text(summaryText, leftMargin + 24, execBoxY + 8, {
                width: contentWidth - 48,
                lineGap: 2.5,
            });
            // AI Inner Subsection 2: Key Discussion Points (Clean vector target/circle icon)
            const pointsHeaderY = execBoxY + execBoxHeight + 12;
            // Vector Target Icon
            doc
                .circle(leftMargin + 22, pointsHeaderY + 4, 3.5)
                .strokeColor(greenAccent)
                .lineWidth(0.8)
                .stroke();
            doc
                .circle(leftMargin + 22, pointsHeaderY + 4, 1.5)
                .fill(greenAccent);
            doc
                .font('Helvetica-Bold')
                .fontSize(8.5)
                .fillColor(greenAccent)
                .text('Key Discussion Points', leftMargin + 31, pointsHeaderY);
            const pointsBoxY = pointsHeaderY + 14;
            doc
                .roundedRect(leftMargin + 14, pointsBoxY, contentWidth - 28, keyPointsBoxHeight, 6)
                .fillAndStroke('#ffffff', borderLight);
            let currentPtY = pointsBoxY + 8;
            keyPointsList.forEach((pt) => {
                // Vector green dot bullet
                doc.circle(leftMargin + 26, currentPtY + 4.5, 2).fill(greenAccent);
                doc
                    .font('Helvetica')
                    .fontSize(8.5)
                    .fillColor(textDark)
                    .text(pt, leftMargin + 34, currentPtY, {
                    width: contentWidth - 68,
                    lineGap: 2.5,
                });
                const itemH = doc.heightOfString(pt, { width: contentWidth - 68 });
                currentPtY += itemH + 6;
            });
            doc.y = aiCardStartY + totalAiCardHeight + 14;
            // ─── 4. Steps Taken Section ───
            drawSectionHeader('Steps taken', blueAccent);
            const stepsList = (reportData.stepsTaken && reportData.stepsTaken.length > 0)
                ? reportData.stepsTaken
                : (_c = reportData.aiSummary) === null || _c === void 0 ? void 0 : _c.actionItems;
            if (stepsList && stepsList.length > 0) {
                ensurePageSpace(60);
                const stepsBoxStartY = doc.y;
                doc.font('Helvetica').fontSize(8.5);
                let totalStepsH = 14;
                stepsList.forEach((st) => {
                    totalStepsH += Math.max(22, doc.heightOfString(st, { width: contentWidth - 55 }) + 8);
                });
                doc
                    .roundedRect(leftMargin, stepsBoxStartY, contentWidth, totalStepsH, 8)
                    .fillAndStroke('#ffffff', borderLight);
                let stepY = stepsBoxStartY + 10;
                stepsList.forEach((step, idx) => {
                    // Number Pill
                    doc
                        .roundedRect(leftMargin + 14, stepY, 16, 16, 8)
                        .fill('#e0f2fe');
                    doc
                        .font('Helvetica-Bold')
                        .fontSize(7.5)
                        .fillColor(blueAccent)
                        .text(`${idx + 1}`, leftMargin + 14, stepY + 3.5, { align: 'center', width: 16 });
                    // Step Text
                    doc
                        .font('Helvetica')
                        .fontSize(8.5)
                        .fillColor(textDark)
                        .text(step, leftMargin + 38, stepY + 2.5, {
                        width: contentWidth - 55,
                        lineGap: 2,
                    });
                    const stepH = doc.heightOfString(step, { width: contentWidth - 55 });
                    stepY += Math.max(22, stepH + 8);
                });
                doc.y = stepsBoxStartY + totalStepsH + 14;
            }
            else {
                drawEmptyStateCard('No steps or action items were added for this consultation.');
            }
            // ─── 5. Recommended Products & Tools Section ───
            drawSectionHeader('Recommended Products & Tools', greenAccent);
            if (reportData.recommendedProducts &&
                reportData.recommendedProducts.length > 0) {
                ensurePageSpace(75);
                const prodY = doc.y;
                const numItems = Math.min(3, reportData.recommendedProducts.length);
                const gap = 10;
                const itemWidth = (contentWidth - gap * (numItems - 1)) / numItems;
                const itemHeight = 56;
                reportData.recommendedProducts.slice(0, 3).forEach((item, idx) => {
                    const itemX = leftMargin + idx * (itemWidth + gap);
                    // Card Container
                    doc
                        .roundedRect(itemX, prodY, itemWidth, itemHeight, 7)
                        .fillAndStroke('#ffffff', borderLight);
                    // Thumbnail placeholder / box with clean vector toolbox icon
                    doc
                        .roundedRect(itemX + 8, prodY + 9, 38, 38, 5)
                        .fill('#f1f5f9');
                    doc
                        .roundedRect(itemX + 17, prodY + 20, 20, 16, 2)
                        .strokeColor('#94a3b8')
                        .lineWidth(0.8)
                        .stroke();
                    doc
                        .moveTo(itemX + 22, prodY + 20)
                        .lineTo(itemX + 22, prodY + 24)
                        .stroke();
                    doc
                        .moveTo(itemX + 32, prodY + 20)
                        .lineTo(itemX + 32, prodY + 24)
                        .stroke();
                    // Product Details
                    const textX = itemX + 52;
                    const textW = itemWidth - 96;
                    doc
                        .font('Helvetica-Bold')
                        .fontSize(7.5)
                        .fillColor(textPrimary)
                        .text(item.name || 'Product', textX, prodY + 10, {
                        width: textW,
                        height: 20,
                        ellipsis: true,
                    });
                    const priceStr = item.price ? (item.price.startsWith('€') || item.price.startsWith('$') ? item.price : `€${item.price}`) : '€0.00';
                    doc
                        .font('Helvetica-Bold')
                        .fontSize(8)
                        .fillColor(blueAccent)
                        .text(priceStr, textX, prodY + 34);
                    // Buy Button
                    const buyBtnX = itemX + itemWidth - 42;
                    const buyBtnY = prodY + 28;
                    doc
                        .roundedRect(buyBtnX, buyBtnY, 34, 16, 4)
                        .fillAndStroke('#f8fafc', borderLight);
                    doc
                        .font('Helvetica-Bold')
                        .fontSize(6.5)
                        .fillColor(textDark)
                        .text('Buy ->', buyBtnX, buyBtnY + 4, {
                        align: 'center',
                        width: 34,
                        link: item.buyLink || undefined,
                    });
                });
                doc.y = prodY + itemHeight + 14;
            }
            else {
                drawEmptyStateCard('No recommended products or tools were added for this consultation.');
            }
            // ─── 6. Helpful Links Section ───
            drawSectionHeader('Helpful Links', blueAccent);
            if (reportData.links && reportData.links.length > 0) {
                ensurePageSpace(45);
                reportData.links.forEach((link) => {
                    ensurePageSpace(32);
                    const linkCardY = doc.y;
                    doc
                        .roundedRect(leftMargin, linkCardY, contentWidth, 26, 6)
                        .fillAndStroke(cardBgLight, borderLight);
                    // Vector Link chain graphic
                    doc
                        .circle(leftMargin + 13, linkCardY + 13, 2.5)
                        .strokeColor(blueAccent)
                        .lineWidth(0.8)
                        .stroke();
                    doc
                        .circle(leftMargin + 18, linkCardY + 13, 2.5)
                        .strokeColor(blueAccent)
                        .lineWidth(0.8)
                        .stroke();
                    doc
                        .moveTo(leftMargin + 13, linkCardY + 13)
                        .lineTo(leftMargin + 18, linkCardY + 13)
                        .stroke();
                    doc
                        .font('Helvetica')
                        .fontSize(8)
                        .fillColor(blueAccent)
                        .text(link, leftMargin + 26, linkCardY + 8, {
                        width: contentWidth - 55,
                        ellipsis: true,
                        link: link,
                        underline: true,
                    });
                    // Clean Arrow indicator
                    doc
                        .font('Helvetica-Bold')
                        .fontSize(7.5)
                        .fillColor(textSecondary)
                        .text('->', leftMargin + contentWidth - 18, linkCardY + 8);
                    doc.y = linkCardY + 32;
                });
                doc.y += 2;
            }
            else {
                drawEmptyStateCard('No external links were attached for this consultation.');
            }
            // ─── 7. Attached Photos Section ───
            drawSectionHeader('Attached Photos', orangeAccent);
            if (reportData.images && reportData.images.length > 0) {
                ensurePageSpace(115);
                const imgStartY = doc.y;
                const imgSize = 95;
                const imgGap = 12;
                reportData.images.slice(0, 4).forEach((imgUrl, idx) => {
                    const imgX = leftMargin + idx * (imgSize + imgGap);
                    const fileName = path_1.default.basename(imgUrl);
                    const localPath = path_1.default.join(process.cwd(), 'uploads', 'image', fileName);
                    // Card frame for image
                    doc
                        .roundedRect(imgX, imgStartY, imgSize, imgSize, 8)
                        .fillAndStroke('#ffffff', borderLight);
                    if (fs_1.default.existsSync(localPath)) {
                        try {
                            doc.image(localPath, imgX + 4, imgStartY + 4, {
                                fit: [imgSize - 8, imgSize - 8],
                                align: 'center',
                                valign: 'center',
                            });
                        }
                        catch (err) {
                            console.error(`Failed to add image thumbnail: ${localPath}`, err);
                        }
                    }
                    else {
                        doc
                            .font('Helvetica')
                            .fontSize(7.5)
                            .fillColor(textSecondary)
                            .text('Image Attached', imgX, imgStartY + 42, { align: 'center', width: imgSize });
                    }
                });
                doc.y = imgStartY + imgSize + 14;
            }
            else {
                drawEmptyStateCard('No photos or attachments were uploaded for this consultation.');
            }
            // ─── 8. Consultant Notes (if provided) ───
            if (reportData.notes && reportData.notes !== summaryText) {
                drawSectionHeader('Consultant Notes & Observations', blueAccent);
                ensurePageSpace(45);
                const notesY = doc.y;
                doc.font('Helvetica').fontSize(8.5);
                const notesH = doc.heightOfString(reportData.notes, { width: contentWidth - 24 }) + 16;
                doc
                    .roundedRect(leftMargin, notesY, contentWidth, Math.max(34, notesH), 6)
                    .fillAndStroke('#ffffff', borderLight);
                doc
                    .font('Helvetica')
                    .fontSize(8.5)
                    .fillColor(textDark)
                    .text(reportData.notes, leftMargin + 12, notesY + 8, {
                    width: contentWidth - 24,
                    lineGap: 2.5,
                });
                doc.y = notesY + Math.max(34, notesH) + 14;
            }
            // ─── 9. Page Numbering & Footer ───
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc
                    .font('Helvetica')
                    .fontSize(7.5)
                    .fillColor('#94a3b8')
                    .text(`Generated by Fixpair Live Consultancy  ·  Confidential  ·  Page ${i + 1} of ${range.count}`, leftMargin, 810, { align: 'center', width: contentWidth });
            }
            doc.end();
            stream.on('finish', () => {
                resolve(`/reports/${fileName}`);
            });
            stream.on('error', err => {
                reject(err);
            });
        }
        catch (error) {
            reject(error);
        }
    });
});
const createReport = (user, payload, files) => __awaiter(void 0, void 0, void 0, function* () {
    const { consultationId, summary, keyPoints, stepsTaken, recommendedProducts, notes, links, conversation, } = payload;
    const consultation = yield consultation_model_1.Consultation.findById(consultationId).populate('user consultant');
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    if (consultation.status !== 'completed') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Report can only be generated for completed consultations');
    }
    const existingReport = yield report_model_1.Report.findOne({ consultation: consultationId });
    if (existingReport) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Report already exists for this consultation');
    }
    if (consultation.consultant._id.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the assigned consultant can finalize the report');
    }
    // Use conversation from payload if provided, otherwise fetch from Transcripts, fallback to mock
    let finalConversation = conversation;
    if (!finalConversation) {
        // Attempt to fetch real transcripts from the video session
        const transcripts = yield transcription_model_1.Transcript.find({
            consultation: consultationId,
        })
            .sort({ timestamp: 1 })
            .lean();
        if (transcripts && transcripts.length > 0) {
            finalConversation = transcripts
                .map(t => `${t.speakerRole}: ${t.text}`)
                .join('\n');
        }
        else {
            // Mock conversation capture from external API
            const mockConversation = [
                {
                    sender: 'user',
                    text: 'Hello, I need some advice on my case.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 30),
                },
                {
                    sender: 'consultant',
                    text: 'Sure, I can help with that. Please tell me more.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 25),
                },
                {
                    sender: 'user',
                    text: 'It is about a contract dispute.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 20),
                },
                {
                    sender: 'consultant',
                    text: 'I see. I will review the documents and get back to you.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 15),
                },
            ];
            finalConversation = mockConversation
                .map(msg => `${msg.sender}: ${msg.text}`)
                .join('\n');
        }
    }
    // Fetch duration from VideoSession
    const videoSession = yield videoSession_model_1.VideoSession.findOne({
        consultation: consultationId,
    });
    const duration = (videoSession === null || videoSession === void 0 ? void 0 : videoSession.duration) || 0;
    // Process links
    let parsedLinks = links;
    if (typeof links === 'string') {
        try {
            parsedLinks = JSON.parse(links);
        }
        catch (_a) {
            parsedLinks = [links];
        }
    }
    if (!Array.isArray(parsedLinks))
        parsedLinks = parsedLinks ? [parsedLinks] : [];
    // Process keyPoints
    let parsedKeyPoints = keyPoints;
    if (typeof keyPoints === 'string') {
        try {
            parsedKeyPoints = JSON.parse(keyPoints);
        }
        catch (_b) {
            parsedKeyPoints = [keyPoints];
        }
    }
    // Process stepsTaken
    let parsedStepsTaken = stepsTaken;
    if (typeof stepsTaken === 'string') {
        try {
            parsedStepsTaken = JSON.parse(stepsTaken);
        }
        catch (_c) {
            parsedStepsTaken = [stepsTaken];
        }
    }
    // Process recommendedProducts
    let parsedRecommendedProducts = recommendedProducts;
    if (typeof recommendedProducts === 'string') {
        try {
            parsedRecommendedProducts = JSON.parse(recommendedProducts);
        }
        catch (_d) {
            parsedRecommendedProducts = [];
        }
    }
    if (!Array.isArray(parsedRecommendedProducts))
        parsedRecommendedProducts = [];
    // Process images
    let payloadImages = payload.images || [];
    if (typeof payloadImages === 'string') {
        try {
            payloadImages = JSON.parse(payloadImages);
        }
        catch (_e) {
            payloadImages = [payloadImages];
        }
    }
    if (!Array.isArray(payloadImages))
        payloadImages = payloadImages ? [payloadImages] : [];
    const imageFiles = [...((files === null || files === void 0 ? void 0 : files.image) || []), ...((files === null || files === void 0 ? void 0 : files.images) || [])];
    const uploadedImages = imageFiles.map((file) => `/image/${file.filename}`);
    const images = [...uploadedImages, ...payloadImages];
    // Fetch or generate AI Summary
    let aiSummary = consultation.aiSummary;
    if (!aiSummary || !aiSummary.overview) {
        try {
            aiSummary = yield generateOrGetAiSummary(consultationId);
        }
        catch (err) {
            console.error('Failed to generate AI summary for report:', err);
        }
    }
    const finalSummary = summary || (aiSummary === null || aiSummary === void 0 ? void 0 : aiSummary.overview) || '';
    const finalKeyPoints = Array.isArray(parsedKeyPoints) && parsedKeyPoints.length > 0
        ? parsedKeyPoints
        : (aiSummary === null || aiSummary === void 0 ? void 0 : aiSummary.keyPoints) || [];
    const finalStepsTaken = Array.isArray(parsedStepsTaken) && parsedStepsTaken.length > 0
        ? parsedStepsTaken
        : (aiSummary === null || aiSummary === void 0 ? void 0 : aiSummary.actionItems) || [];
    const finalRecommendedProducts = Array.isArray(parsedRecommendedProducts)
        ? parsedRecommendedProducts
        : [];
    const reportData = {
        consultationId: consultation._id,
        date: consultation.date || consultation.createdAt,
        bookingType: consultation.bookingType || 'instant',
        status: consultation.status || 'completed',
        userName: consultation.user.name,
        userEmail: consultation.user.email,
        consultantName: consultation.consultant.name,
        consultantEmail: consultation.consultant.email,
        conversation: finalConversation,
        duration,
        summary: finalSummary,
        keyPoints: finalKeyPoints,
        stepsTaken: finalStepsTaken,
        recommendedProducts: finalRecommendedProducts,
        notes,
        links: parsedLinks,
        images,
        aiSummary,
    };
    const pdfUrl = yield generateConsultationPDF(reportData);
    const report = yield report_model_1.Report.create({
        consultation: consultationId,
        user: consultation.user._id,
        consultant: consultation.consultant._id,
        summary: finalSummary,
        keyPoints: finalKeyPoints,
        stepsTaken: finalStepsTaken,
        recommendedProducts: finalRecommendedProducts,
        conversation: finalConversation,
        duration,
        notes,
        links: parsedLinks,
        images,
        pdfUrl,
        aiSummary,
    });
    return report;
});
const generateOrGetAiSummary = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const consultation = yield consultation_model_1.Consultation.findById(consultationId).populate('user consultant');
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    // 1. If already generated on the consultation, return it
    if (consultation.aiSummary && consultation.aiSummary.overview) {
        return consultation.aiSummary;
    }
    // 2. Fetch all transcripts
    const transcripts = yield transcription_model_1.Transcript.find({ consultation: consultationId })
        .sort({ timestamp: 1 })
        .lean();
    const videoSession = yield videoSession_model_1.VideoSession.findOne({
        consultation: consultationId,
    });
    const duration = (videoSession === null || videoSession === void 0 ? void 0 : videoSession.duration) || 0;
    const clientName = ((_a = consultation.user) === null || _a === void 0 ? void 0 : _a.name) || 'Client';
    const consultantName = ((_b = consultation.consultant) === null || _b === void 0 ? void 0 : _b.name) || 'Consultant';
    const summary = yield geminiHelper_1.GeminiHelper.generateConsultationSummary(transcripts.map((t) => ({ speakerRole: t.speakerRole, text: t.text })), {
        clientName,
        consultantName,
        durationSeconds: duration,
    });
    // 3. Save to Consultation document
    yield consultation_model_1.Consultation.findByIdAndUpdate(consultationId, {
        $set: { aiSummary: summary },
    });
    // 4. Also update Report if it already exists
    yield report_model_1.Report.findOneAndUpdate({ consultation: consultationId }, { $set: { aiSummary: summary } });
    // 5. Emit real-time socket events
    const payload = {
        consultationId,
        aiSummary: summary,
    };
    socketHelper_1.socketHelper.emitToUser(consultation.user._id.toString(), 'ai-summary-ready', payload);
    socketHelper_1.socketHelper.emitToUser(consultation.consultant._id.toString(), 'ai-summary-ready', payload);
    socketHelper_1.socketHelper.emitToRoom(`consultation:${consultationId}`, 'ai-summary-ready', payload);
    return summary;
});
const getTotalConsultations = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const consultantId = user.id;
    const totalConsultations = yield consultation_model_1.Consultation.countDocuments({
        consultant: consultantId,
        status: 'completed',
    });
    return totalConsultations;
});
const getReports = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = {};
    if (user.role === 'USER') {
        filter.user = user.id;
    }
    else if (user.role === 'CONSULTANT') {
        filter.consultant = user.id;
    }
    // Admin sees all
    const reportQuery = new QueryBuilder_1.default(report_model_1.Report.find(filter), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    // Limit fields for list view: exclude conversation
    reportQuery.modelQuery.select('-conversation');
    const result = yield reportQuery.modelQuery.populate([
        { path: 'user', select: 'name image avatar' },
        { path: 'consultant', select: 'name image avatar' },
        { path: 'consultation', select: 'status date bookingType duration' },
    ]);
    const meta = yield reportQuery.getPaginationInfo();
    return { meta, result };
});
const getSingleReport = (user, id) => __awaiter(void 0, void 0, void 0, function* () {
    let report = null;
    if (mongoose_1.default.Types.ObjectId.isValid(id)) {
        report = yield report_model_1.Report.findById(id).populate([
            { path: 'user', select: 'name image avatar' },
            { path: 'consultant', select: 'name image avatar' },
            {
                path: 'consultation',
                select: 'status date bookingType perMinuteRate totalAmount',
            },
        ]);
        // Fallback: If not found by Report ID, check if it's a Consultation ID
        if (!report) {
            report = yield report_model_1.Report.findOne({ consultation: id }).populate([
                { path: 'user', select: 'name image avatar' },
                { path: 'consultant', select: 'name image avatar' },
                {
                    path: 'consultation',
                    select: 'status date bookingType perMinuteRate totalAmount',
                },
            ]);
        }
    }
    if (!report) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Report not found');
    }
    // Access control
    if (user.role === 'USER' && report.user._id.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Access denied');
    }
    if (user.role === 'CONSULTANT' &&
        report.consultant._id.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Access denied');
    }
    return report;
});
const updateReport = (user, id, payload, files) => __awaiter(void 0, void 0, void 0, function* () {
    let report = null;
    if (mongoose_1.default.Types.ObjectId.isValid(id)) {
        report = yield report_model_1.Report.findById(id);
        if (!report) {
            report = yield report_model_1.Report.findOne({ consultation: id });
        }
    }
    if (!report) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Report not found');
    }
    // Access control: only assigned consultant or admin can edit
    const isConsultant = user.role === 'CONSULTANT' &&
        report.consultant.toString() === user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isConsultant && !isAdmin) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the assigned consultant can edit this report');
    }
    const consultation = yield consultation_model_1.Consultation.findById(report.consultation).populate('user consultant');
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    const { summary, keyPoints, stepsTaken, recommendedProducts, notes, links, conversation, } = payload;
    if (summary !== undefined) {
        report.summary = summary;
    }
    if (notes !== undefined) {
        report.notes = notes;
    }
    if (conversation !== undefined) {
        report.conversation = conversation;
    }
    if (links !== undefined) {
        let parsedLinks = links;
        if (typeof links === 'string') {
            try {
                parsedLinks = JSON.parse(links);
            }
            catch (_a) {
                parsedLinks = [links];
            }
        }
        if (!Array.isArray(parsedLinks)) {
            parsedLinks = parsedLinks ? [parsedLinks] : [];
        }
        report.links = parsedLinks;
    }
    if (keyPoints !== undefined) {
        let parsedKeyPoints = keyPoints;
        if (typeof keyPoints === 'string') {
            try {
                parsedKeyPoints = JSON.parse(keyPoints);
            }
            catch (_b) {
                parsedKeyPoints = [keyPoints];
            }
        }
        if (Array.isArray(parsedKeyPoints)) {
            report.keyPoints = parsedKeyPoints;
        }
    }
    if (stepsTaken !== undefined) {
        let parsedStepsTaken = stepsTaken;
        if (typeof stepsTaken === 'string') {
            try {
                parsedStepsTaken = JSON.parse(stepsTaken);
            }
            catch (_c) {
                parsedStepsTaken = [stepsTaken];
            }
        }
        if (Array.isArray(parsedStepsTaken)) {
            report.stepsTaken = parsedStepsTaken;
        }
    }
    if (recommendedProducts !== undefined) {
        let parsedRecommendedProducts = recommendedProducts;
        if (typeof recommendedProducts === 'string') {
            try {
                parsedRecommendedProducts = JSON.parse(recommendedProducts);
            }
            catch (_d) {
                parsedRecommendedProducts = [];
            }
        }
        if (Array.isArray(parsedRecommendedProducts)) {
            report.recommendedProducts = parsedRecommendedProducts;
        }
    }
    const imageFiles = [...((files === null || files === void 0 ? void 0 : files.image) || []), ...((files === null || files === void 0 ? void 0 : files.images) || [])];
    const uploadedImages = imageFiles.map((file) => `/image/${file.filename}`);
    let currentImages = report.images || [];
    if (payload.images !== undefined) {
        let payloadImages = payload.images;
        if (typeof payloadImages === 'string') {
            try {
                payloadImages = JSON.parse(payloadImages);
            }
            catch (_e) {
                payloadImages = [payloadImages];
            }
        }
        if (!Array.isArray(payloadImages)) {
            payloadImages = payloadImages ? [payloadImages] : [];
        }
        currentImages = payloadImages;
    }
    if (uploadedImages.length > 0) {
        currentImages = [...currentImages, ...uploadedImages];
    }
    report.images = currentImages;
    // Prepare updated report data for regenerating PDF
    const reportData = {
        consultationId: consultation._id,
        date: consultation.date || consultation.createdAt,
        bookingType: consultation.bookingType || 'instant',
        status: consultation.status || 'completed',
        userName: consultation.user.name,
        userEmail: consultation.user.email,
        consultantName: consultation.consultant.name,
        consultantEmail: consultation.consultant.email,
        conversation: report.conversation,
        duration: report.duration || 0,
        summary: report.summary || '',
        keyPoints: report.keyPoints || [],
        stepsTaken: report.stepsTaken || [],
        recommendedProducts: report.recommendedProducts || [],
        notes: report.notes,
        links: report.links,
        images: report.images,
        aiSummary: report.aiSummary,
    };
    const pdfUrl = yield generateConsultationPDF(reportData);
    report.pdfUrl = pdfUrl;
    yield report.save();
    const updatedReport = yield report_model_1.Report.findById(report._id).populate([
        { path: 'user', select: 'name image avatar' },
        { path: 'consultant', select: 'name image avatar' },
        {
            path: 'consultation',
            select: 'status date bookingType perMinuteRate totalAmount',
        },
    ]);
    return updatedReport;
});
exports.ReportService = {
    createReport,
    updateReport,
    getReports,
    getSingleReport,
    getTotalConsultations,
    generateOrGetAiSummary,
};
