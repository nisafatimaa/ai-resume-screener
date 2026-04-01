import { Injectable } from '@hazeljs/core';
import { PrismaService } from '@hazeljs/prisma';
import { Candidate, JobPosting, MatchScore, ScreeningSession, CandidateRanking } from '../entities/candidate.entity';

@Injectable()
export class CandidateService {
  constructor(private prisma: PrismaService) {}

  async create(candidateData: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  }): Promise<Candidate> {
    return this.prisma.client.candidate.create({
      data: candidateData,
    });
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ candidates: Candidate[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const [candidates, total] = await Promise.all([
      this.prisma.client.candidate.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          matchScores: {
            include: {
              job: true,
            },
          },
        },
      }),
      this.prisma.client.candidate.count(),
    ]);

    return { candidates, total };
  }

  async findById(id: string): Promise<Candidate | null> {
    return this.prisma.client.candidate.findUnique({
      where: { id },
      include: {
        matchScores: {
          include: {
            job: true,
          },
        },
      },
    });
  }

  async updateResume(id: string, resumeData: {
    resumePath?: string;
    resumeText?: string;
    skills?: string[];
    experience?: any;
    education?: any;
  }): Promise<Candidate> {
    return this.prisma.client.candidate.update({
      where: { id },
      data: resumeData,
    });
  }

  async findCandidatesForMatching(
    candidateIds?: string[],
    experienceLevel?: string,
    requiredSkills?: string[]
  ): Promise<Candidate[]> {
    const where: any = {
      resumeText: { not: null }, // Only candidates with resumes
    };

    if (candidateIds && candidateIds.length > 0) {
      where.id = { in: candidateIds };
    }

    if (requiredSkills && requiredSkills.length > 0) {
      where.skills = {
        hasSome: requiredSkills,
      };
    }

    return this.prisma.client.candidate.findMany({
      where,
      include: {
        matchScores: false, // Exclude for performance
      },
    });
  }

  async createJob(jobData: {
    title: string;
    description: string;
    requirements: string;
    department?: string;
    location?: string;
    employmentType?: string;
    salaryRange?: string;
    postedBy: string;
  }): Promise<JobPosting> {
    return this.prisma.client.jobPosting.create({
      data: jobData,
    });
  }

  async findAllJobs(): Promise<JobPosting[]> {
    return this.prisma.client.jobPosting.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        matchScores: false,
        applications: false,
      },
    });
  }

  async findJobById(id: string): Promise<JobPosting | null> {
    return this.prisma.client.jobPosting.findUnique({
      where: { id },
    });
  }

  async saveMatchScores(jobId: string, rankedCandidates: any[]): Promise<void> {
    const matchData = rankedCandidates.map((candidate, index) => ({
      candidateId: candidate.candidateId,
      jobId,
      overallScore: candidate.scores.overallScore,
      skillMatch: candidate.scores.skillMatch,
      experienceMatch: candidate.scores.experienceMatch,
      educationMatch: candidate.scores.educationMatch,
      locationMatch: candidate.scores.locationMatch || 0,
      reasoning: candidate.scores.reasoning,
    }));

    await this.prisma.client.$transaction(async (tx) => {
      // Delete existing scores for this job
      await tx.matchScore.deleteMany({
        where: { jobId },
      });

      // Create new scores
      await tx.matchScore.createMany({
        data: matchData,
      });
    });
  }

  async createScreeningSession(jobId: string): Promise<ScreeningSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return this.prisma.client.screeningSession.create({
      data: {
        jobId,
        sessionId,
        status: 'active',
      },
      include: {
        job: true,
      },
    });
  }

  async saveScreeningResults(sessionId: string, rankedCandidates: any[]): Promise<void> {
    const rankingData = rankedCandidates.map((candidate) => ({
      sessionId,
      candidateId: candidate.candidateId,
      rank: candidate.rank,
      score: candidate.scores.overallScore,
      reasoning: candidate.scores.reasoning,
      shortlisted: candidate.shortlisted,
    }));

    await this.prisma.client.$transaction(async (tx) => {
      // Delete existing rankings for this session
      await tx.candidateRanking.deleteMany({
        where: { sessionId },
      });

      // Create new rankings
      await tx.candidateRanking.createMany({
        data: rankingData,
      });

      // Update session status
      await tx.screeningSession.update({
        where: { sessionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    });
  }

  async getScreeningSession(sessionId: string): Promise<ScreeningSession | null> {
    return this.prisma.client.screeningSession.findUnique({
      where: { sessionId },
      include: {
        job: true,
        rankings: {
          include: {
            candidate: true,
          },
          orderBy: { rank: 'asc' },
        },
      },
    });
  }

  async getTopCandidatesForJob(jobId: string, limit: number = 10): Promise<Candidate[]> {
    const matchScores = await this.prisma.client.matchScore.findMany({
      where: { jobId },
      orderBy: { overallScore: 'desc' },
      take: limit,
      include: {
        candidate: true,
      },
    });

    return matchScores.map(score => score.candidate);
  }

  async searchCandidates(query: string): Promise<Candidate[]> {
    return this.prisma.client.candidate.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { skills: { hasSome: [query] } },
          { location: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        matchScores: false,
      },
    });
  }

  async deleteCandidate(id: string): Promise<void> {
    await this.prisma.client.candidate.delete({
      where: { id },
    });
  }

  async updateCandidate(id: string, updateData: Partial<Candidate>): Promise<Candidate> {
    return this.prisma.client.candidate.update({
      where: { id },
      data: updateData,
    });
  }
}
