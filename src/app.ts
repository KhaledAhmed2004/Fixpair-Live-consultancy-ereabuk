import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './routes';
import { Morgan } from './shared/morgen';
import { corsOptions } from './config/cors';
const app = express();

//morgan
app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);

// Handle CORS (including OPTIONS preflight) before parsers and routes.
app.use(cors(corsOptions));
//body parser
app.use(cookieParser());
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

//file retrieve
app.use(express.static('uploads'));
app.use('/public', express.static('public'));
app.use(express.static('public'));

//router
app.use('/api/v1', router);

//live response
app.get('/', (req: Request, res: Response) => {
  const date = new Date(Date.now());
  const dbStatus =
    mongoose.connection.readyState === 1
      ? '🟢 Connected'
      : mongoose.connection.readyState === 2
        ? '🟡 Connecting...'
        : '🔴 Disconnected';

  res.send(
    `<h1 style="text-align:center; color:#173616; font-family:Verdana;">Beep-beep! The server is alive and kicking.</h1>
    <p style="text-align:center; color:#173616; font-family:Verdana;">Database Status: <strong>${dbStatus}</strong></p>
    <p style="text-align:center; color:#555; font-family:Verdana; font-size: 13px;">${date}</p>
    `,
  );
});

//global error handle
app.use(globalErrorHandler);

//handle not found route;
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
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

export default app;
