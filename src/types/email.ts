export type ISendEmail = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
    cid?: string;
  }>;
};

