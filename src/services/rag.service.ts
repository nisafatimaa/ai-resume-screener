import { Injectable } from '@hazeljs/core';
import { RAGPipeline, MemoryVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';
import { AIService } from '@hazeljs/ai';

@Injectable()
export class RAGService {
  private resumeRAG: RAGPipeline;
  private jobRAG: RAGPipeline;
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
    this.initializeRAG();
  }

  private async initializeRAG(): Promise<void> {
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    });

    // Resume vector store for candidate matching
    const resumeVectorStore = new MemoryVectorStore(embeddings);
    this.resumeRAG = new RAGPipeline({
      vectorStore: resumeVectorStore,
      embeddingProvider: embeddings,
      topK: 10,
    });
    await this.resumeRAG.initialize();

    // Job vector store for job similarity
    const jobVectorStore = new MemoryVectorStore(embeddings);
    this.jobRAG = new RAGPipeline({
      vectorStore: jobVectorStore,
      embeddingProvider: embeddings,
      topK: 5,
    });
    await this.jobRAG.initialize();
  }

  async embedResume(candidateId: string, resumeText: string, skills: string[]): Promise<void> {
    const document = {
      id: candidateId,
      content: resumeText,
      metadata: {
        type: 'resume',
        skills: skills.join(', '),
        candidateId,
      },
    };

    await this.resumeRAG.addDocuments([document]);
  }

  async embedJob(jobId: string, jobDescription: string, requirements: string, skills: string[]): Promise<void> {
    const combinedText = `${jobDescription}\n\nRequirements: ${requirements}`;
    
    const document = {
      id: jobId,
      content: combinedText,
      metadata: {
        type: 'job',
        skills: skills.join(', '),
        jobId,
      },
    };

    await this.jobRAG.addDocuments([document]);
  }

  async findMatchingCandidates(jobDescription: string, requirements: string, topK: number = 10): Promise<{
    candidates: Array<{
      candidateId: string;
      score: number;
      content: string;
      metadata: any;
    }>;
  }> {
    const query = `${jobDescription}\n\nRequirements: ${requirements}`;
    
    const results = await this.resumeRAG.search(query, { topK });
    
    return {
      candidates: results.map(result => ({
        candidateId: result.metadata?.candidateId,
        score: result.score,
        content: result.content,
        metadata: result.metadata,
      })),
    };
  }

  async calculateMatchScore(resumeText: string, jobDescription: string, requirements: string): Promise<{
    overallScore: number;
    skillMatch: number;
    experienceMatch: number;
    educationMatch: number;
    reasoning: string;
  }> {
    const prompt = `
    Analyze the match between a resume and job requirements. Provide detailed scoring:

    Resume:
    ${resumeText}

    Job Description:
    ${jobDescription}

    Requirements:
    ${requirements}

    Return a JSON object with:
    - overallScore: 0-100 overall match percentage
    - skillMatch: 0-100 skill alignment score
    - experienceMatch: 0-100 experience relevance score
    - educationMatch: 0-100 education match score
    - reasoning: detailed explanation for the scores

    Focus on concrete skills, experience level, and qualifications match.
    `;

    try {
      const provider = process.env.DEFAULT_AI_PROVIDER || 'anthropic';
      const model = provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4';
      
      const response = await this.aiService.complete({
        messages: [{ role: 'user', content: prompt }],
        provider: provider as any,
        model,
        outputType: 'json',
      });

      return response.content as any;
    } catch (error) {
      console.error('Error calculating match score:', error);
      // Return fallback scores
      return {
        overallScore: 50,
        skillMatch: 50,
        experienceMatch: 50,
        educationMatch: 50,
        reasoning: 'AI scoring unavailable - using default values',
      };
    }
  }

  async extractSkillsFromText(text: string): Promise<string[]> {
    const prompt = `
    Extract technical and professional skills from the following text. 
    Return only a JSON array of skill strings.

    Text:
    ${text}

    Focus on:
    - Programming languages
    - Frameworks and libraries
    - Tools and platforms
    - Professional skills (e.g., "Project Management", "Leadership")
    - Certifications
    `;

    try {
      const response = await this.aiService.complete({
        messages: [{ role: 'user', content: prompt }],
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        outputType: 'json',
      });

      return response.content as string[];
    } catch (error) {
      console.error('Error extracting skills:', error);
      return [];
    }
  }
}
