import { Injectable } from '@hazeljs/core';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import pdf from 'pdf-parse';

@Injectable()
export class ResumeService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadResume(file: Buffer, originalName: string): Promise<{ filePath: string; fileName: string }> {
    const fileExtension = path.extname(originalName);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(this.uploadDir, fileName);

    await fs.writeFile(filePath, file);
    
    return { filePath, fileName };
  }

  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const data = await pdf(fileBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  async extractResumeData(resumeText: string): Promise<{
    skills: string[];
    experience: any[];
    education: any[];
    contactInfo: any;
  }> {
    // This would typically use an AI model to extract structured data
    // For now, we'll implement basic keyword extraction
    
    const commonSkills = [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++',
      'AWS', 'Docker', 'Kubernetes', 'MongoDB', 'PostgreSQL', 'MySQL',
      'Git', 'Agile', 'Scrum', 'REST API', 'GraphQL', 'Machine Learning',
      'Data Analysis', 'Project Management', 'Leadership', 'Communication'
    ];

    const foundSkills = commonSkills.filter(skill => 
      resumeText.toLowerCase().includes(skill.toLowerCase())
    );

    // Basic email and phone extraction
    const emailMatch = resumeText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const phoneMatch = resumeText.match(/(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);

    return {
      skills: foundSkills,
      experience: [], // Would be populated by AI extraction
      education: [],  // Would be populated by AI extraction
      contactInfo: {
        email: emailMatch?.[0],
        phone: phoneMatch?.[0]
      }
    };
  }

  async deleteResume(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Failed to delete resume file: ${error}`);
    }
  }
}
