import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import config from '../config';
import { errorLogger, logger } from '../shared/logger';
import { ISendEmail } from '../types/email';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: Number(config.email.port),
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

const sendEmail = async (values: ISendEmail) => {
  try {
    const defaultLogoPath = path.join(
      process.cwd(),
      'public',
      'images',
      'logo.png',
    );
    const attachments = values.attachments ? [...values.attachments] : [];

    // Automatically attach CID logo if file exists and not already provided
    if (
      fs.existsSync(defaultLogoPath) &&
      !attachments.some(a => a.cid === 'fixpair-logo')
    ) {
      attachments.push({
        filename: 'logo.png',
        path: defaultLogoPath,
        cid: 'fixpair-logo',
      });
    }

    const info = await transporter.sendMail({
      from: `"${config.branding.projectName || 'Fixpair'}" <${config.email.from}>`,
      to: values.to,
      subject: values.subject,
      html: values.html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    logger.info('Mail send successfully', info.accepted);
  } catch (error) {
    errorLogger.error('Email', error);
  }
};

export const emailHelper = {
  sendEmail,
};

