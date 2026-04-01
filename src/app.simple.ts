import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import pdf from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Upload directory
const uploadDir = './uploads';
fs.mkdir(uploadDir, { recursive: true });

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Resume Screener API is running' });
});

// Get all candidates
app.get('/candidates', async (req, res) => {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        matchScores: {
          include: { job: true },
        },
      },
    });
    res.json({ success: true, data: candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch candidates' });
  }
});

// Create candidate
app.post('/candidates', async (req, res) => {
  try {
    const { name, email, phone, location, linkedinUrl, githubUrl, portfolioUrl } = req.body;
    
    const candidate = await prisma.candidate.create({
      data: { name, email, phone, location, linkedinUrl, githubUrl, portfolioUrl },
    });
    
    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ success: false, error: 'Failed to create candidate' });
  }
});

// Upload resume
app.post('/candidates/:id/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const candidateId = req.params.id as string;
    const file = req.file;
    
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, error: 'Only PDF files are allowed' });
    }

    // Save file
    const fileName = `${uuidv4()}.pdf`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Extract text from PDF
    const pdfData = await pdf(file.buffer);
    const resumeText = pdfData.text;

    // Extract basic skills (simplified)
    const commonSkills = [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
      'AWS', 'Docker', 'MongoDB', 'PostgreSQL', 'Git', 'Agile'
    ];
    
    const skills = commonSkills.filter(skill => 
      resumeText.toLowerCase().includes(skill.toLowerCase())
    );

    // Update candidate with resume data
    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        resumePath: filePath,
        resumeText,
        skills,
      },
    });

    res.json({ 
      success: true, 
      data: candidate,
      message: 'Resume uploaded and processed successfully' 
    });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ success: false, error: 'Failed to upload resume' });
  }
});

// Create job posting
app.post('/jobs', async (req, res) => {
  try {
    const { title, description, requirements, department, location, employmentType, salaryRange, postedBy } = req.body;
    
    const job = await prisma.jobPosting.create({
      data: { title, description, requirements, department, location, employmentType, salaryRange, postedBy },
    });
    
    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, error: 'Failed to create job posting' });
  }
});

// Get all jobs
app.get('/jobs', async (req, res) => {
  try {
    const jobs = await prisma.jobPosting.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

// Simple matching (without AI for now)
app.post('/match', async (req, res) => {
  try {
    const { jobId, candidateIds } = req.body;
    
    // Get job details
    const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Get candidates
    const whereClause = candidateIds ? 
      { id: { in: candidateIds }, resumeText: { not: null } } : 
      { resumeText: { not: null } };
    
    const candidates = await prisma.candidate.findMany({
      where: whereClause,
    });

    // Simple keyword matching (placeholder for AI)
    const jobKeywords = job.requirements.toLowerCase().split(' ');
    const matches = candidates.map(candidate => {
      const resumeText = (candidate.resumeText || '').toLowerCase();
      const matchCount = jobKeywords.filter(keyword => 
        keyword.length > 3 && resumeText.includes(keyword)
      ).length;
      
      const score = (matchCount / jobKeywords.length) * 100;
      
      return {
        candidateId: candidate.id,
        candidate,
        score: Math.round(score),
        matchedKeywords: jobKeywords.filter(keyword => 
          keyword.length > 3 && resumeText.includes(keyword)
        ),
      };
    }).sort((a, b) => b.score - a.score);

    res.json({ 
      success: true, 
      data: {
        job,
        matches,
        summary: {
          totalCandidates: candidates.length,
          averageScore: Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length),
        },
      }
    });
  } catch (error) {
    console.error('Error matching candidates:', error);
    res.status(500).json({ success: false, error: 'Failed to match candidates' });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 AI Resume Screener API running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/health`);
  console.log('🤖 Simplified Version - Ready for testing!');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
