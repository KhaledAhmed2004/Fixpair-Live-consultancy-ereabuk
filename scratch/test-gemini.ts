function buildIntelligentSummary(transcripts: { speakerRole: string; text: string }[], metadata?: any) {
  // 1. Deduplicate consecutive or identical chunks
  const cleaned: { speakerRole: string; text: string }[] = [];
  let lastText = '';
  for (const t of transcripts) {
    const trimmed = t.text.trim();
    if (!trimmed || trimmed.toLowerCase() === lastText.toLowerCase()) continue;
    lastText = trimmed;
    cleaned.push({ speakerRole: t.speakerRole, text: trimmed });
  }

  if (cleaned.length === 0) {
    return {
      overview: 'Consultation completed without recorded speech.',
      keyPoints: ['No dialogue chunks captured.'],
      actionItems: ['Consultant will provide manual notes.'],
      recommendations: [],
    };
  }

  // 2. Extract key points across the dialogue
  const keyPoints: string[] = [];
  const clientPoints: string[] = [];
  const consultantPoints: string[] = [];

  for (const item of cleaned) {
    const label = item.speakerRole === 'user' ? 'Client' : 'Consultant';
    const formatted = `${label}: ${item.text}`;
    if (!keyPoints.includes(formatted) && keyPoints.length < 10) {
      keyPoints.push(formatted);
    }
    if (item.speakerRole === 'user' && item.text.length > 5) {
      clientPoints.push(item.text);
    } else if (item.speakerRole !== 'user' && item.text.length > 5) {
      consultantPoints.push(item.text);
    }
  }

  // 3. Extract recommendations & action items from consultant statements
  const recommendations: string[] = [];
  const actionItems: string[] = [];

  for (const c of consultantPoints) {
    if (c.toLowerCase().includes('eat') || c.toLowerCase().includes('balance') || c.toLowerCase().includes('exercise') || c.toLowerCase().includes('habit') || c.toLowerCase().includes('should')) {
      if (!recommendations.includes(c)) recommendations.push(c);
    }
  }

  if (recommendations.length === 0 && consultantPoints.length > 0) {
    recommendations.push(consultantPoints[0]);
  }
  if (recommendations.length === 0) {
    recommendations.push('Follow up on discussed topics and recommendations.');
  }

  actionItems.push('Review consultation recommendations and implement suggested lifestyle/work adjustments.');
  if (consultantPoints.length > 0) {
    actionItems.push('Consultant will follow up with additional guidance if required.');
  }

  // 4. Generate a rich overview
  let overview = '';
  if (clientPoints.length > 0 && consultantPoints.length > 0) {
    overview = `During the consultation, the client discussed ${clientPoints.slice(0, 3).join(', ')}. The consultant provided advice on ${consultantPoints.slice(0, 2).join(' and ')}.`;
  } else if (clientPoints.length > 0) {
    overview = `The consultation covered inquiries regarding ${clientPoints.slice(0, 4).join(', ')}.`;
  } else {
    overview = `Consultation completed with ${cleaned.length} dialogue turns recorded between client and consultant.`;
  }

  return {
    overview,
    keyPoints: keyPoints.slice(0, 8),
    actionItems,
    recommendations,
  };
}

const userTranscripts = [
  { speakerRole: 'user', text: 'Maintaining good health is.' },
  { speakerRole: 'user', text: 'Maintaining good health is.' },
  { speakerRole: 'user', text: 'A stand for living a happy and productive life.' },
  { speakerRole: 'user', text: 'A stand for living a happy and productive life.' },
  { speakerRole: 'consultant', text: 'maintaining good health is 10 or living in happy and good and reply' },
  { speakerRole: 'user', text: 'Many people face health problem.' },
  { speakerRole: 'user', text: 'Many people face health problem.' },
  { speakerRole: 'consultant', text: 'thank you' },
  { speakerRole: 'user', text: 'Due to unhealthy eating.' },
  { speakerRole: 'user', text: 'Due to unhealthy eating.' },
  { speakerRole: 'consultant', text: 'to healthy eating habits' },
  { speakerRole: 'user', text: 'Habits.' },
  { speakerRole: 'user', text: 'Habits.' },
  { speakerRole: 'user', text: 'Lack of physics activity stress.' },
  { speakerRole: 'consultant', text: 'like a physics activities' },
  { speakerRole: 'user', text: 'Insufficient slave and.' },
  { speakerRole: 'user', text: 'Insufficient slave and.' },
  { speakerRole: 'user', text: 'Ford Lifestyles.' },
  { speakerRole: 'user', text: 'Ford Lifestyles.' },
  { speakerRole: 'user', text: 'Soy\'s common health issue include.' },
  { speakerRole: 'user', text: 'Soy\'s common health issue include.' },
  { speakerRole: 'user', text: 'Of City Den.' },
  { speakerRole: 'user', text: 'Of City Den.' },
  { speakerRole: 'consultant', text: 'lifestyles soils common health is looking close of city' },
  { speakerRole: 'user', text: 'Get direct high.' },
  { speakerRole: 'user', text: 'Get direct high.' },
  { speakerRole: 'user', text: 'Blood pressure.' },
  { speakerRole: 'user', text: 'Blood pressure.' },
  { speakerRole: 'user', text: 'Hack witnesses and mental mental health problem.' },
  { speakerRole: 'user', text: 'Hack witnesses and mental mental health problem.' },
  { speakerRole: 'user', text: 'Prevent those.' },
  { speakerRole: 'user', text: 'Prevent those.' },
  { speakerRole: 'user', text: 'People.' },
  { speakerRole: 'user', text: 'People.' },
  { speakerRole: 'consultant', text: 'Highway and ice blood pressure and dishes and mental mental health problem to female should eat balance' },
  { speakerRole: 'user', text: 'Balance it.' },
  { speakerRole: 'user', text: 'Exercise.' },
  { speakerRole: 'user', text: 'Exercise.' },
  { speakerRole: 'consultant', text: 'exercise' }
];

console.log('Result from intelligent fallback:');
console.log(JSON.stringify(buildIntelligentSummary(userTranscripts), null, 2));
