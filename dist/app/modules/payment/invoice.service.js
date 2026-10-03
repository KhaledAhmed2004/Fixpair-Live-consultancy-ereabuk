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
exports.InvoiceService = void 0;
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
const pdfkit_1 = __importDefault(require("pdfkit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const payment_model_1 = require("./payment.model");
const consultation_model_1 = require("../consultation/consultation.model");
const videoSession_model_1 = require("../videoSession/videoSession.model");
const user_model_1 = require("../user/user.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const cache_1 = require("../../utils/cache");
/**
 * Invoice Service
 * Generates PDF invoices for completed consultations
 */
const generateInvoicePDF = (invoiceData) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50, size: 'A4' });
            const fileName = `invoice-${invoiceData.invoiceNumber}.pdf`;
            const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'invoices');
            if (!fs_1.default.existsSync(uploadDir)) {
                fs_1.default.mkdirSync(uploadDir, { recursive: true });
            }
            const filePath = path_1.default.join(uploadDir, fileName);
            const stream = fs_1.default.createWriteStream(filePath);
            doc.pipe(stream);
            // --- Modern PDF Styling ---
            const primaryColor = '#2c3e50';
            const secondaryColor = '#34495e';
            const accentColor = '#3498db';
            const lightGray = '#f1f4f6';
            const borderColor = '#dee2e6';
            const successColor = '#27ae60';
            // Header Background
            doc.rect(0, 0, 612, 120).fill(lightGray);
            // Brand & Title
            doc
                .fillColor(primaryColor)
                .fontSize(24)
                .font('Helvetica-Bold')
                .text('FIXPAIR', 50, 45);
            doc
                .fontSize(10)
                .font('Helvetica')
                .fillColor(secondaryColor)
                .text('Live Consultancy Platform', 50, 75);
            // Invoice Label
            doc
                .fillColor(primaryColor)
                .fontSize(28)
                .font('Helvetica-Bold')
                .text('INVOICE', 0, 45, { align: 'right', width: 545 });
            doc
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(`Invoice #: ${invoiceData.invoiceNumber}`, 0, 80, {
                align: 'right',
                width: 545,
            });
            doc
                .font('Helvetica')
                .text(`Issue Date: ${new Date(invoiceData.invoiceDate || Date.now()).toLocaleDateString()}`, 0, 95, {
                align: 'right',
                width: 545,
            });
            doc.moveDown(4);
            // --- Info Sections ---
            const infoY = 150;
            // Bill To & Consultant Box
            doc.roundedRect(50, infoY, 512, 110, 5).strokeColor(borderColor).stroke();
            // Bill To
            doc
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .fontSize(11)
                .text('BILL TO:', 70, infoY + 15);
            doc.font('Helvetica').fontSize(10).fillColor(secondaryColor);
            doc.text(invoiceData.userName, 70, infoY + 35);
            doc.text(invoiceData.userEmail, 70, infoY + 50);
            // Consultant Info
            doc
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .fontSize(11)
                .text('CONSULTANT:', 330, infoY + 15);
            doc.font('Helvetica').fontSize(10).fillColor(secondaryColor);
            doc.text(invoiceData.consultantName, 330, infoY + 35);
            doc.text(invoiceData.consultantType || 'Professional Consultant', 330, infoY + 50);
            doc.text(`Session Date: ${new Date(invoiceData.date).toLocaleDateString()}`, 330, infoY + 65);
            doc.moveDown(6);
            // --- Table Section ---
            const tableTop = 280;
            // Table Header Background
            doc.rect(50, tableTop, 512, 30).fill(primaryColor);
            // Table Header Text
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
            doc.text('Description', 65, tableTop + 10);
            doc.text('Duration', 280, tableTop + 10);
            doc.text('Rate', 380, tableTop + 10);
            doc.text('Total', 0, tableTop + 10, { align: 'right', width: 530 });
            // --- Table Content ---
            let currentY = tableTop + 40;
            doc.fillColor(primaryColor).font('Helvetica').fontSize(10);
            // Consultation Row
            doc.text('Professional Consultation Session', 65, currentY);
            doc.text(`${invoiceData.duration} min`, 280, currentY);
            doc.text(`$${invoiceData.perMinuteRate}/min`, 380, currentY);
            doc.text(`$${invoiceData.subtotal.toFixed(2)}`, 0, currentY, {
                align: 'right',
                width: 530,
            });
            currentY += 30;
            // Separator Line
            doc
                .moveTo(50, currentY)
                .lineTo(562, currentY)
                .strokeColor(borderColor)
                .lineWidth(0.5)
                .stroke();
            currentY += 15;
            // Platform Fee Row
            doc.fillColor(secondaryColor).fontSize(9);
            doc.text('Platform Service Fee', 65, currentY);
            doc.text('-', 280, currentY);
            doc.text('-', 380, currentY);
            doc.text(`$${invoiceData.platformFee.toFixed(2)}`, 0, currentY, {
                align: 'right',
                width: 530,
            });
            currentY += 40;
            // --- Summary Section ---
            const summaryX = 350;
            // Summary Divider
            doc
                .moveTo(summaryX, currentY)
                .lineTo(562, currentY)
                .strokeColor(primaryColor)
                .lineWidth(1)
                .stroke();
            currentY += 15;
            // Total Amount
            doc
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .fontSize(12)
                .text('TOTAL PAYABLE:', summaryX, currentY);
            doc
                .fontSize(16)
                .fillColor(accentColor)
                .text(`$${invoiceData.totalAmount.toFixed(2)}`, 0, currentY - 2, {
                align: 'right',
                width: 530,
            });
            currentY += 40;
            // Status Badge Styling
            const status = (invoiceData.status || 'unpaid').toUpperCase();
            const statusColor = status === 'PAID' ? successColor : '#e67e22';
            doc
                .fontSize(10)
                .fillColor(secondaryColor)
                .font('Helvetica-Bold')
                .text('PAYMENT STATUS:', summaryX, currentY);
            doc
                .fillColor(statusColor)
                .font('Helvetica-Bold')
                .text(status, summaryX + 110, currentY);
            currentY += 18;
            // Payment Method
            doc
                .fontSize(10)
                .fillColor(secondaryColor)
                .font('Helvetica-Bold')
                .text('PAYMENT METHOD:', summaryX, currentY);
            doc
                .fillColor(primaryColor)
                .font('Helvetica')
                .text(invoiceData.paymentMethod || 'Stripe', summaryX + 110, currentY);
            if (invoiceData.transactionId) {
                currentY += 18;
                doc.fontSize(9).fillColor(secondaryColor).font('Helvetica');
                doc.text(`Transaction Ref: ${invoiceData.transactionId}`, summaryX, currentY);
            }
            // --- Footer ---
            const footerY = 750;
            doc
                .moveTo(50, footerY - 20)
                .lineTo(562, footerY - 20)
                .strokeColor(borderColor)
                .lineWidth(0.5)
                .stroke();
            doc
                .fontSize(8)
                .fillColor('#adb5bd')
                .font('Helvetica')
                .text('This is a computer-generated document. No signature is required.', 50, footerY, { align: 'center' })
                .text('Thank you for choosing Fixpair Live Consultancy!', 50, footerY + 12, { align: 'center' })
                .text('support@fixpair.com | www.fixpair.com', 50, footerY + 24, {
                align: 'center',
            });
            doc.end();
            stream.on('finish', () => resolve(`/invoices/${fileName}`));
            stream.on('error', err => reject(err));
        }
        catch (error) {
            reject(error);
        }
    });
});
const getInvoiceDataFromDB = (user, consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const consultation = yield consultation_model_1.Consultation.findById(consultationId).populate('user consultant');
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    // Access Control: Only the user or consultant involved, or an admin
    if (user.role !== 'SUPER_ADMIN' &&
        user.role !== 'ADMIN' &&
        consultation.user._id.toString() !== user.id &&
        consultation.consultant._id.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized access');
    }
    // The route should only return invoice data for valid completed or billable consultations.
    if (consultation.status !== 'completed' && consultation.consumedAmount <= 0) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invoice not available for this consultation status. Consultation must be completed or have billable charges.');
    }
    // Find associated transaction
    const transaction = yield payment_model_1.Transaction.findOne({
        consultation: consultationId,
        status: 'captured',
    });
    let paymentMethod = 'Not Available';
    if (transaction) {
        if (transaction.provider === 'paypal') {
            paymentMethod = 'PayPal';
        }
        else if (transaction.provider === 'stripe') {
            // Try to get specific method from metadata if available
            paymentMethod = ((_a = transaction.metadata) === null || _a === void 0 ? void 0 : _a.payment_type) || 'Card';
            // Normalize common stripe values
            if (paymentMethod === 'card')
                paymentMethod = 'Credit/Debit Card';
        }
    }
    const actualConsumed = Math.max(0, consultation.consumedAmount - consultation.platformFee);
    const durationInSeconds = consultation.perMinuteRate > 0
        ? (actualConsumed / consultation.perMinuteRate) * 60
        : 0;
    const billableMinutes = consultation.perMinuteRate > 0
        ? Math.ceil(actualConsumed / consultation.perMinuteRate)
        : 0;
    const invoiceData = {
        consultationId: consultation._id,
        invoiceNumber: `INV-${consultation._id.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        date: consultation.date || consultation.createdAt,
        invoiceDate: new Date(),
        duration: Math.floor(durationInSeconds / 60),
        billableMinutes,
        perMinuteRate: consultation.perMinuteRate,
        subtotal: consultation.consumedAmount - consultation.platformFee,
        platformFee: consultation.platformFee,
        totalAmount: consultation.consumedAmount,
        status: consultation.paymentStatus,
        paymentMethod,
        transactionId: (transaction === null || transaction === void 0 ? void 0 : transaction.transactionId) || null,
        user: {
            id: consultation.user._id,
            name: consultation.user.name,
            email: consultation.user.email,
        },
        consultant: {
            id: consultation.consultant._id,
            name: consultation.consultant.name,
            type: consultation.consultant.consultancyType,
        },
    };
    return invoiceData;
});
const generateAndGetInvoicePDF = (user, consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield getInvoiceDataFromDB(user, consultationId);
    const pdfUrl = yield generateInvoicePDF(Object.assign(Object.assign({}, data), { userName: data.user.name, userEmail: data.user.email, consultantName: data.consultant.name, consultantType: data.consultant.type }));
    // Optional: Update or create Invoice record in DB
    yield payment_model_1.Invoice.findOneAndUpdate({ session: consultationId }, {
        user: data.user.id,
        consultant: data.consultant.id,
        invoiceNumber: data.invoiceNumber,
        duration: data.duration,
        perMinuteRate: data.perMinuteRate,
        platformFee: data.platformFee,
        subtotal: data.subtotal,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod,
        status: (data.status === 'pending' ? 'unpaid' : data.status),
        pdfUrl,
    }, { upsert: true, new: true });
    return pdfUrl;
});
const finalizeInvoice = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const consultation = yield consultation_model_1.Consultation.findById(consultationId).populate('user consultant');
    if (!consultation)
        return;
    const session = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    let duration = 0;
    if ((session === null || session === void 0 ? void 0 : session.startedAt) && (session === null || session === void 0 ? void 0 : session.endedAt)) {
        duration = Math.ceil((session.endedAt.getTime() - session.startedAt.getTime()) / 60000);
    }
    else if (session === null || session === void 0 ? void 0 : session.startedAt) {
        console.warn(`[INVOICE] Missing endedAt for consultation ${consultationId}, using Date.now()`);
        duration = Math.ceil((Date.now() - session.startedAt.getTime()) / 60000);
    }
    else {
        console.warn(`[INVOICE] Missing startedAt for consultation ${consultationId}, deriving from consumedAmount`);
        const actualConsumed = Math.max(0, consultation.consumedAmount - consultation.platformFee);
        duration = consultation.perMinuteRate > 0
            ? Math.ceil(actualConsumed / consultation.perMinuteRate)
            : 0;
    }
    const allTransactions = yield payment_model_1.Transaction.find({
        consultation: consultationId,
        status: 'captured',
    });
    const finalSettledAmount = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    const subtotal = finalSettledAmount - consultation.platformFee;
    // Find associated transaction to get provider
    const transaction = yield payment_model_1.Transaction.findOne({
        consultation: consultationId,
        status: 'captured',
    });
    let paymentMethod = 'Stripe';
    if (transaction) {
        if (transaction.provider === 'paypal') {
            paymentMethod = 'PayPal';
        }
        else if (transaction.provider === 'stripe') {
            paymentMethod = ((_a = transaction.metadata) === null || _a === void 0 ? void 0 : _a.payment_type) || 'Card';
            if (paymentMethod === 'card')
                paymentMethod = 'Credit/Debit Card';
        }
    }
    const invoiceData = {
        session: consultation._id,
        user: consultation.user._id,
        consultant: consultation.consultant._id,
        invoiceNumber: `INV-${Date.now()}`,
        duration,
        perMinuteRate: consultation.perMinuteRate,
        platformFee: consultation.platformFee,
        subtotal,
        totalAmount: consultation.consumedAmount,
        paymentMethod,
        status: 'paid',
    };
    const pdfUrl = yield generateInvoicePDF(Object.assign(Object.assign({}, invoiceData), { userName: consultation.user.name, userEmail: consultation.user.email, consultantName: consultation.consultant.name }));
    const invoice = yield payment_model_1.Invoice.create(Object.assign(Object.assign({}, invoiceData), { pdfUrl }));
    // Update consultation status
    yield consultation_model_1.Consultation.findByIdAndUpdate(consultationId, {
        status: 'completed',
        billingStatus: 'completed',
        paymentStatus: 'paid',
        finalSettledAmount,
    });
    // Increment consultant's total consultations and clear cache
    yield user_model_1.User.findByIdAndUpdate(consultation.consultant, {
        $inc: { totalConsultations: 1 },
    });
    cache_1.cacheHelper.clearByPrefix('consultants:recommended');
    cache_1.cacheHelper.clearByPrefix('consultants:list');
    return invoice;
});
exports.InvoiceService = {
    getInvoiceDataFromDB,
    generateAndGetInvoicePDF,
    finalizeInvoice,
};
