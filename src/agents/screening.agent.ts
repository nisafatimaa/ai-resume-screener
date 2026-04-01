import { Agent, Tool } from '@hazeljs/agent';
import { Injectable } from '@hazeljs/core';
import { RAGService } from '../services/rag.service';

@Injectable()
@Agent({
  name: 'screening-agent',
  description: 'AI-powered resume screening agent that evaluates candidates against job requirements',
  systemPrompt: `You are an expert recruitment screening agent. Your role is to:
  1. Analyze candidate resumes against job requirements
  2. Provide detailed scoring and reasoning
  3. Rank candidates based on their suitability
  4. Identify top candidates for interviews
  
  Always be objective, fair, and focus on skills and experience that match the job requirements.
  Avoid bias and consider transferable skills.`,
  enableMemory: true,
  enableRAG: true,
})
export class ScreeningAgent {
  constructor(private ragService: RAGService) {}

  @Tool({
    description: 'Analyze a candidate resume against job requirements and provide detailed scoring',
    parameters: [
      { name: 'resumeText', type: 'string', required: true, description: 'The full text of the candidate resume' },
      { name: 'jobDescription', type: 'string', required: true, description: 'The job description' },
      { name: 'jobRequirements', type: 'string', required: true, description: 'The job requirements' },
      { name: 'candidateId', type: 'string', required: true, description: 'Unique identifier for the candidate' },
    ],
  })
  async analyzeCandidate(input: {
    resumeText: string;
    jobDescription: string;
    jobRequirements: string;
    candidateId: string;
  }) {
    const { resumeText, jobDescription, jobRequirements, candidateId } = input;

    // Calculate detailed match scores using RAG service
    const scores = await this.ragService.calculateMatchScore(
      resumeText,
      jobDescription,
      jobRequirements
    );

    // Extract additional skills
    const extractedSkills = await this.ragService.extractSkillsFromText(resumeText);

    return {
      candidateId,
      scores,
      extractedSkills,
      analysis: {
        strengths: this.identifyStrengths(resumeText, jobRequirements),
        gaps: this.identifyGaps(resumeText, jobRequirements),
        recommendations: this.generateRecommendations(scores, extractedSkills),
      },
    };
  }

  @Tool({
    description: 'Rank multiple candidates for a specific job position',
    parameters: [
      { name: 'candidateAnalyses', type: 'array', required: true, description: 'Array of candidate analysis results' },
      { name: 'topK', type: 'number', required: false, description: 'Number of top candidates to return' },
    ],
  })
  async rankCandidates(input: {
    candidateAnalyses: any[];
    topK?: number;
  }) {
    const { candidateAnalyses, topK = 10 } = input;

    // Sort candidates by overall score
    const rankedCandidates = candidateAnalyses
      .sort((a, b) => b.scores.overallScore - a.scores.overallScore)
      .slice(0, topK)
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
        shortlisted: index < 3, // Top 3 are shortlisted
      }));

    return {
      rankedCandidates,
      summary: {
        totalCandidates: candidateAnalyses.length,
        shortlistedCount: rankedCandidates.filter(c => c.shortlisted).length,
        averageScore: candidateAnalyses.reduce((sum, c) => sum + c.scores.overallScore, 0) / candidateAnalyses.length,
      },
    };
  }

  @Tool({
    description: 'Generate interview questions for a specific candidate and job',
    parameters: [
      { name: 'resumeText', type: 'string', required: true, description: 'Candidate resume text' },
      { name: 'jobDescription', type: 'string', required: true, description: 'Job description' },
      { name: 'candidateSkills', type: 'array', required: true, description: 'List of candidate skills' },
    ],
  })
  async generateInterviewQuestions(input: {
    resumeText: string;
    jobDescription: string;
    candidateSkills: string[];
  }) {
    const { resumeText, jobDescription, candidateSkills } = input;

    const prompt = `
    Based on the candidate's resume and the job requirements, generate 5-8 targeted interview questions.
    
    Candidate Resume:
    ${resumeText}
    
    Job Description:
    ${jobDescription}
    
    Candidate Skills: ${candidateSkills.join(', ')}
    
    Generate questions that:
    1. Test technical skills mentioned in the resume
    2. Explore experience relevant to the job
    3. Assess problem-solving abilities
    4. Evaluate cultural fit
    5. Clarify any gaps or concerns
    
    Return as JSON with categories: technical, behavioral, situational
    `;

    try {
      // This would use the AI service to generate questions
      // For now, return structured placeholder questions
      return {
        technical: [
          'Can you describe your experience with the main technologies listed in your resume?',
          'How have you applied your skills to solve complex problems in previous roles?',
        ],
        behavioral: [
          'Tell me about a time when you had to learn a new technology quickly.',
          'Describe a situation where you had to work with a difficult team member.',
        ],
        situational: [
          'How would you approach a project with unclear requirements?',
          'What would you do if you missed a project deadline?',
        ],
      };
    } catch (error) {
      console.error('Error generating interview questions:', error);
      return { error: 'Failed to generate interview questions' };
    }
  }

  @Tool({
    description: 'Provide feedback on why a candidate was or was not selected',
    parameters: [
      { name: 'candidateAnalysis', type: 'object', required: true, description: 'Complete candidate analysis' },
      { name: 'selected', type: 'boolean', required: true, description: 'Whether the candidate was selected' },
    ],
  })
  async generateFeedback(input: {
    candidateAnalysis: any;
    selected: boolean;
  }) {
    const { candidateAnalysis, selected } = input;

    if (selected) {
      return {
        message: 'Congratulations! You have been selected for an interview.',
        strengths: candidateAnalysis.analysis.strengths,
        nextSteps: 'Our recruitment team will contact you within 2-3 business days to schedule an interview.',
      };
    } else {
      return {
        message: 'Thank you for your interest. We have decided to move forward with other candidates whose experience more closely matches our current needs.',
        feedback: 'We encourage you to apply for future positions that better align with your qualifications.',
        suggestions: candidateAnalysis.analysis.recommendations,
      };
    }
  }

  private identifyStrengths(resumeText: string, jobRequirements: string): string[] {
    // Simple keyword matching for strengths
    // In production, this would use more sophisticated NLP
    const requirements = jobRequirements.toLowerCase().split(' ');
    const resume = resumeText.toLowerCase();
    
    return requirements
      .filter(req => req.length > 3 && resume.includes(req))
      .slice(0, 5);
  }

  private identifyGaps(resumeText: string, jobRequirements: string): string[] {
    // Identify missing requirements
    const requirements = jobRequirements.toLowerCase().split(' ');
    const resume = resumeText.toLowerCase();
    
    return requirements
      .filter(req => req.length > 3 && !resume.includes(req))
      .slice(0, 3);
  }

  private generateRecommendations(scores: any, skills: string[]): string[] {
    const recommendations: string[] = [];
    
    if (scores.skillMatch < 70) {
      recommendations.push('Consider developing additional technical skills mentioned in the job requirements');
    }
    
    if (scores.experienceMatch < 70) {
      recommendations.push('Highlight more relevant experience in your resume');
    }
    
    if (skills.length < 5) {
      recommendations.push('Add more specific skills and technologies to your resume');
    }
    
    return recommendations;
  }
}
