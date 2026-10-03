/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from '@google/genai';
import config from '../config';
import { logger, errorLogger } from '../shared/logger';

export interface IConsultationAiSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  recommendations: string[];
}

export interface ITranscriptChunk {
  speakerRole: string;
  text: string;
  timestamp?: Date | number;
}

export interface ISummaryMetadata {
  clientName?: string;
  consultantName?: string;
  durationSeconds?: number;
  consultationTopic?: string;
}

/**
 * Generates an intelligent structured summary from transcripts when Gemini AI is rate-limited or offline.
 */
const generateIntelligentFallback = (
  transcripts: ITranscriptChunk[],
  metadata?: ISummaryMetadata,
): IConsultationAiSummary => {
  const clientName = metadata?.clientName || 'Client';
  const consultantName = metadata?.consultantName || 'Consultant';

  // 1. Deduplicate consecutive or identical speech chunks
  const cleaned: { speakerRole: string; text: string }[] = [];
  let lastText = '';
  for (const t of transcripts) {
    const trimmed = (t.text || '').trim();
    if (!trimmed || trimmed.toLowerCase() === lastText.toLowerCase()) continue;
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
  const keyPoints: string[] = [];
  const clientPoints: string[] = [];
  const consultantPoints: string[] = [];

  for (const item of cleaned) {
    const speakerLabel = item.speakerRole === 'user' ? clientName : consultantName;
    const formatted = `${speakerLabel}: ${item.text}`;
    if (!keyPoints.includes(formatted) && keyPoints.length < 10) {
      keyPoints.push(formatted);
    }
    if (item.speakerRole === 'user' && item.text.length > 3) {
      clientPoints.push(item.text);
    } else if (item.speakerRole !== 'user' && item.text.length > 3) {
      consultantPoints.push(item.text);
    }
  }

  // 3. Extract recommendations & action items from consultant statements
  const recommendations: string[] = [];
  const actionItems: string[] = [];

  const adviceKeywords = ['eat', 'balance', 'exercise', 'habit', 'should', 'need', 'recommend', 'try', 'avoid', 'check', 'follow'];
  for (const c of consultantPoints) {
    const lower = c.toLowerCase();
    if (adviceKeywords.some((kw) => lower.includes(kw))) {
      if (!recommendations.includes(c)) recommendations.push(c);
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
  } else if (clientPoints.length > 0) {
    overview = `The consultation covered inquiries regarding ${clientPoints.slice(0, 4).join(', ')}.`;
  } else {
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
const generateConsultationSummary = async (
  transcripts: ITranscriptChunk[],
  metadata?: ISummaryMetadata,
): Promise<IConsultationAiSummary> => {
  // If no transcripts exist or transcript is too short
  if (!transcripts || transcripts.length === 0) {
    return {
      overview: 'No transcript recorded for this consultation.',
      keyPoints: ['No dialogue chunks captured.'],
      actionItems: ['Consultant may provide manual notes and recommendations.'],
      recommendations: [],
    };
  }

  const clientLabel = metadata?.clientName ? `Client (${metadata.clientName})` : 'Client';
  const consultantLabel = metadata?.consultantName ? `Consultant (${metadata.consultantName})` : 'Consultant';

  const dialogue = transcripts
    .map((t) => {
      const speaker = t.speakerRole === 'user' ? clientLabel : consultantLabel;
      return `[${speaker}]: ${t.text}`;
    })
    .join('\n');

  const apiKey = config.gemini?.apiKey;
  if (!apiKey) {
    logger.warn('Gemini API Key is not configured. Generating intelligent fallback summary.');
    return generateIntelligentFallback(transcripts, metadata);
  }

  const prompt = `You are an expert AI consultation analyzer. Analyze the following consultation transcript and produce a structured, professional summary in English.

Consultation Context:
- Client: ${metadata?.clientName || 'User'}
- Consultant: ${metadata?.consultantName || 'Consultant'}
- Duration: ${metadata?.durationSeconds ? `${Math.round(metadata.durationSeconds / 60)} minutes` : 'Live session'}

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
    const ai = new GoogleGenAI({ apiKey });
    const model = config.gemini?.model || 'gemini-3.6-flash';

    logger.info(`Generating Gemini consultation summary using model: ${model}`);

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '{}';
    
    // Clean up code blocks if needed
    const cleanedJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed: IConsultationAiSummary = JSON.parse(cleanedJson);

    return {
      overview: parsed.overview || 'Consultation summary generated.',
      keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : ['Consultation completed.'],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error: any) {
    errorLogger.error('Gemini AI summary generation failed (will use intelligent fallback):', error.message || error);
    
    // Graceful intelligent fallback
    return generateIntelligentFallback(transcripts, metadata);
  }
};

export const GeminiHelper = {
  generateConsultationSummary,
};
