export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumePath?: string;
  createdAt: Date;
  updatedAt: Date;
  resumeText?: string;
  resumeEmbedding?: number[];
  skills?: string[];
  experience?: any;
  education?: any;
}

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements: string;
  department?: string;
  location?: string;
  employmentType?: string;
  salaryRange?: string;
  postedBy: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  jobEmbedding?: number[];
  extractedSkills?: string[];
  experienceLevel?: string;
}

export interface MatchScore {
  id: string;
  candidateId: string;
  jobId: string;
  overallScore: number;
  skillMatch: number;
  experienceMatch: number;
  educationMatch: number;
  locationMatch: number;
  reasoning?: string;
  createdAt: Date;
  candidate?: Candidate;
  job?: JobPosting;
}

export interface ScreeningSession {
  id: string;
  jobId: string;
  status: string;
  createdAt: Date;
  completedAt?: Date;
  sessionId: string;
  agentMemory?: any;
  job?: JobPosting;
  rankings?: CandidateRanking[];
}

export interface CandidateRanking {
  id: string;
  sessionId: string;
  candidateId: string;
  rank: number;
  score: number;
  reasoning?: string;
  shortlisted: boolean;
  session?: ScreeningSession;
  candidate?: Candidate;
}
