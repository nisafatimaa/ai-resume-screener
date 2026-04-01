import { IsString, IsEmail, IsOptional, IsArray, IsUrl, IsEnum } from 'class-validator';
import { Expose, Transform } from 'class-transformer';

export class CreateCandidateDto {
  @Expose()
  @IsString()
  name: string;

  @Expose()
  @IsEmail()
  email: string;

  @Expose()
  @IsOptional()
  @IsString()
  phone?: string;

  @Expose()
  @IsOptional()
  @IsString()
  location?: string;

  @Expose()
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @Expose()
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @Expose()
  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;
}

export class UploadResumeDto {
  @Expose()
  @IsString()
  candidateId: string;
}

export class JobPostingDto {
  @Expose()
  @IsString()
  title: string;

  @Expose()
  @IsString()
  description: string;

  @Expose()
  @IsString()
  requirements: string;

  @Expose()
  @IsOptional()
  @IsString()
  department?: string;

  @Expose()
  @IsOptional()
  @IsString()
  location?: string;

  @Expose()
  @IsOptional()
  @IsEnum(['full-time', 'part-time', 'contract', 'internship'])
  employmentType?: string;

  @Expose()
  @IsOptional()
  @IsString()
  salaryRange?: string;

  @Expose()
  @IsString()
  postedBy: string;
}

export class MatchCandidatesDto {
  @Expose()
  @IsString()
  jobId: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  candidateIds?: string[];

  @Expose()
  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];
}

export class ScreeningSessionDto {
  @Expose()
  @IsString()
  jobId: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  candidateIds?: string[];

  @Expose()
  @IsOptional()
  @IsString()
  experienceLevel?: string;
}
