import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UploadedFile,
  UseInterceptors,
  Query,
  HttpStatus,
  HttpError,
  FileInterceptor
} from '@hazeljs/core';
import { CandidateService } from '../services/candidate.service';
import { ResumeService } from '../services/resume.service';
import { RAGService } from '../services/rag.service';
import { ScreeningAgent } from '../agents/screening.agent';
import { 
  CreateCandidateDto, 
  UploadResumeDto, 
  MatchCandidatesDto,
  JobPostingDto,
  ScreeningSessionDto 
} from '../dto/candidate.dto';

@Controller({ path: '/candidates' })
export class CandidateController {
  constructor(
    private candidateService: CandidateService,
    private resumeService: ResumeService,
    private ragService: RAGService,
    private screeningAgent: ScreeningAgent
  ) {}

  @Post()
  async createCandidate(@Body() createCandidateDto: CreateCandidateDto) {
    try {
      const candidate = await this.candidateService.create(createCandidateDto);
      return {
        success: true,
        data: candidate,
        message: 'Candidate created successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create candidate: ${error.message}`
      );
    }
  }

  @Get()
  async getAllCandidates(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    try {
      const candidates = await this.candidateService.findAll(page, limit);
      return {
        success: true,
        data: candidates,
        message: 'Candidates retrieved successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to retrieve candidates: ${error.message}`
      );
    }
  }

  @Get('/:id')
  async getCandidate(@Param('id') id: string) {
    try {
      const candidate = await this.candidateService.findById(id);
      if (!candidate) {
        throw new HttpError(HttpStatus.NOT_FOUND, 'Candidate not found');
      }
      return {
        success: true,
        data: candidate,
        message: 'Candidate retrieved successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to retrieve candidate: ${error.message}`
      );
    }
  }

  @Post('/:id/upload-resume')
  @UseInterceptors(FileInterceptor('resume'))
  async uploadResume(
    @Param('id') id: string,
    @UploadedFile('resume') file: Express.Multer.File
  ) {
    try {
      if (!file) {
        throw new HttpError(HttpStatus.BAD_REQUEST, 'No file uploaded');
      }

      // Check if file is PDF
      if (file.mimetype !== 'application/pdf') {
        throw new HttpError(HttpStatus.BAD_REQUEST, 'Only PDF files are allowed');
      }

      // Upload file
      const { filePath } = await this.resumeService.uploadResume(file.buffer, file.originalname);
      
      // Extract text from PDF
      const resumeText = await this.resumeService.extractTextFromPDF(filePath);
      
      // Extract structured data
      const resumeData = await this.resumeService.extractResumeData(resumeText);
      
      // Update candidate with resume info
      const candidate = await this.candidateService.updateResume(id, {
        resumePath: filePath,
        resumeText,
        skills: resumeData.skills,
        experience: resumeData.experience,
        education: resumeData.education
      });

      // Embed resume in RAG system
      await this.ragService.embedResume(id, resumeText, resumeData.skills);

      return {
        success: true,
        data: candidate,
        message: 'Resume uploaded and processed successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to upload resume: ${error.message}`
      );
    }
  }

  @Post('/match')
  async matchCandidates(@Body() matchDto: MatchCandidatesDto) {
    try {
      const { jobId, candidateIds, experienceLevel, requiredSkills } = matchDto;

      // Get job details
      const job = await this.candidateService.findJobById(jobId);
      if (!job) {
        throw new HttpError(HttpStatus.NOT_FOUND, 'Job posting not found');
      }

      // Get candidates to analyze
      const candidates = await this.candidateService.findCandidatesForMatching(
        candidateIds, 
        experienceLevel, 
        requiredSkills
      );

      // Analyze each candidate using the screening agent
      const candidateAnalyses = [];
      for (const candidate of candidates) {
        if (!candidate.resumeText) {
          continue; // Skip candidates without resumes
        }

        const analysis = await this.screeningAgent.analyzeCandidate({
          resumeText: candidate.resumeText,
          jobDescription: job.description,
          jobRequirements: job.requirements,
          candidateId: candidate.id
        });

        candidateAnalyses.push(analysis);
      }

      // Rank candidates
      const rankedResults = await this.screeningAgent.rankCandidates({
        candidateAnalyses,
        topK: 20
      });

      // Save match scores to database
      await this.candidateService.saveMatchScores(jobId, rankedResults.rankedCandidates);

      return {
        success: true,
        data: rankedResults,
        message: 'Candidate matching completed successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to match candidates: ${error.message}`
      );
    }
  }

  @Post('/screening-session')
  async startScreeningSession(@Body() sessionDto: ScreeningSessionDto) {
    try {
      const { jobId, candidateIds, experienceLevel } = sessionDto;

      // Get job details
      const job = await this.candidateService.findJobById(jobId);
      if (!job) {
        throw new HttpError(HttpStatus.NOT_FOUND, 'Job posting not found');
      }

      // Create screening session
      const session = await this.candidateService.createScreeningSession(jobId);

      // Get candidates
      const candidates = await this.candidateService.findCandidatesForMatching(
        candidateIds,
        experienceLevel
      );

      // Run full screening workflow
      const candidateAnalyses = [];
      for (const candidate of candidates) {
        if (!candidate.resumeText) {
          continue;
        }

        const analysis = await this.screeningAgent.analyzeCandidate({
          resumeText: candidate.resumeText,
          jobDescription: job.description,
          jobRequirements: job.requirements,
          candidateId: candidate.id
        });

        candidateAnalyses.push(analysis);
      }

      // Rank and save results
      const rankedResults = await this.screeningAgent.rankCandidates({
        candidateAnalyses
      });

      await this.candidateService.saveScreeningResults(session.id, rankedResults.rankedCandidates);

      return {
        success: true,
        data: {
          sessionId: session.id,
          results: rankedResults
        },
        message: 'Screening session started successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to start screening session: ${error.message}`
      );
    }
  }

  @Get('/screening-session/:sessionId')
  async getScreeningSession(@Param('sessionId') sessionId: string) {
    try {
      const session = await this.candidateService.getScreeningSession(sessionId);
      if (!session) {
        throw new HttpError(HttpStatus.NOT_FOUND, 'Screening session not found');
      }

      return {
        success: true,
        data: session,
        message: 'Screening session retrieved successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to retrieve screening session: ${error.message}`
      );
    }
  }

  @Post('/jobs')
  async createJobPosting(@Body() jobDto: JobPostingDto) {
    try {
      const job = await this.candidateService.createJob(jobDto);
      
      // Extract skills and embed in RAG
      const skills = await this.ragService.extractSkillsFromText(
        `${job.description} ${job.requirements}`
      );
      
      await this.ragService.embedJob(job.id, job.description, job.requirements, skills);

      return {
        success: true,
        data: job,
        message: 'Job posting created successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create job posting: ${error.message}`
      );
    }
  }

  @Get('/jobs')
  async getAllJobs() {
    try {
      const jobs = await this.candidateService.findAllJobs();
      return {
        success: true,
        data: jobs,
        message: 'Job postings retrieved successfully'
      };
    } catch (error) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to retrieve job postings: ${error.message}`
      );
    }
  }
}
