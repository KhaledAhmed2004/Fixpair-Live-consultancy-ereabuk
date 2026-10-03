"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../app/modules/auth/auth.route");
const user_route_1 = require("../app/modules/user/user.route");
const review_route_1 = require("../app/modules/review/review.route");
const consultation_route_1 = require("../app/modules/consultation/consultation.route");
const faq_route_1 = require("../app/modules/faq/faq.route");
const terms_route_1 = require("../app/modules/terms/terms.route");
const privacy_route_1 = require("../app/modules/privacy/privacy.route");
const report_route_1 = require("../app/modules/report/report.route");
const videoSession_route_1 = require("../app/modules/videoSession/videoSession.route");
const payment_route_1 = require("../app/modules/payment/payment.route");
const admin_route_1 = require("../app/modules/admin/admin.route");
const consultantOverview_route_1 = require("../app/modules/consultantOverview/consultantOverview.route");
const recommendation_route_1 = require("../app/modules/recommendation/recommendation.route");
const transcription_route_1 = require("../app/modules/transcription/transcription.route");
const notification_route_1 = require("../app/modules/notification/notification.route");
const customerSupport_route_1 = require("../app/modules/customerSupport/customerSupport.route");
const agora_route_1 = require("../app/modules/agora/agora.route");
const consultancyType_route_1 = require("../app/modules/consultancyType/consultancyType.route");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: '/user',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/review',
        route: review_route_1.ReviewRoutes,
    },
    {
        path: '/consultation',
        route: consultation_route_1.ConsultationRoutes,
    },
    {
        path: '/consultations',
        route: consultation_route_1.ConsultationRoutes,
    },
    {
        path: '/faq',
        route: faq_route_1.FaqRoutes,
    },
    {
        path: '/terms',
        route: terms_route_1.TermsRoutes,
    },
    {
        path: '/privacy',
        route: privacy_route_1.PrivacyRoutes,
    },
    {
        path: '/report',
        route: report_route_1.ReportRoutes,
    },
    {
        path: '/video-session',
        route: videoSession_route_1.VideoSessionRoutes,
    },
    {
        path: '/payment',
        route: payment_route_1.PaymentRoutes,
    },
    {
        path: '/admin',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/consultant',
        route: consultantOverview_route_1.ConsultantOverviewRoutes,
    },
    {
        path: '/recommendation',
        route: recommendation_route_1.RecommendationRoutes,
    },
    {
        path: '/transcription',
        route: transcription_route_1.TranscriptionRoutes,
    },
    {
        path: '/notification',
        route: notification_route_1.NotificationRoutes,
    },
    {
        path: '/customer-support',
        route: customerSupport_route_1.CustomerSupportRoutes,
    },
    {
        path: '/agora',
        route: agora_route_1.AgoraRoutes,
    },
    {
        path: '/consultancy-type',
        route: consultancyType_route_1.ConsultancyTypeRoutes,
    },
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
