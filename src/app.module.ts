import { HazelModule, ConfigModule } from '@hazeljs/core';
import { AIModule } from '@hazeljs/ai';
import { AgentModule } from '@hazeljs/agent';
import { RagModule } from '@hazeljs/rag';
import { PrismaModule } from '@hazeljs/prisma';
import { WebSocketModule } from '@hazeljs/websocket';
import { SwaggerModule } from '@hazeljs/swagger';
import { CacheModule } from '@hazeljs/cache';
import { MemoryModule } from '@hazeljs/memory';

import { CandidateController } from './controllers/candidate.controller';
import { CandidateService } from './services/candidate.service';
import { ResumeService } from './services/resume.service';
import { RAGService } from './services/rag.service';
import { ScreeningAgent } from './agents/screening.agent';

@HazelModule({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    
    // AI Stack
    AIModule.forRoot({
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          organization: process.env.OPENAI_ORG,
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
        },
      },
      defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'anthropic',
      defaultModel: process.env.DEFAULT_AI_PROVIDER === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4',
      cache: {
        enabled: true,
        ttl: 3600,
      },
    }),
    
    AgentModule.forRoot({
      runtime: { 
        defaultMaxSteps: 10, 
        enableObservability: true 
      },
      agents: [ScreeningAgent],
    }),
    
    RagModule.forRoot({
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small',
      },
    }),
    
    // Database & Infrastructure
    PrismaModule.forRoot({
      databaseUrl: process.env.DATABASE_URL,
    }),
    
    WebSocketModule.forRoot({
      port: parseInt(process.env.PORT || '3001'),
      path: '/ws',
    }),
    
    SwaggerModule.forRoot({
      title: 'AI Resume Screener API',
      description: 'AI-powered resume screening and candidate matching built with HazelJS',
      version: '1.0.0',
      path: '/api/docs',
    }),
    
    CacheModule.forRoot({
      provider: 'memory', // Change to 'redis' for production
      ttl: 3600,
    }),
    
    MemoryModule.forRoot({
      provider: 'memory', // Change to 'prisma' for production
    }),
  ],
  
  controllers: [CandidateController],
  
  providers: [
    CandidateService,
    ResumeService,
    RAGService,
    ScreeningAgent,
  ],
})
export class AppModule {}
