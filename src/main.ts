import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  
  // Global middleware
  app.useGlobalMiddleware([
    // CORS middleware
    {
      name: 'cors',
      handler: (req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      }
    },
    
    // Request logging
    {
      name: 'logger',
      handler: (req: any, res: any, next: any) => {
        const start = Date.now();
        console.log(`🚀 ${req.method} ${req.url} - ${new Date().toISOString()}`);
        
        res.on('finish', () => {
          const duration = Date.now() - start;
          console.log(`✅ ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
        });
        
        next();
      }
    }
  ]);

  await app.listen(process.env.PORT || 3000);
  
  console.log('🎯 AI Resume Screener API is running!');
  console.log(`📖 API Documentation: http://localhost:${process.env.PORT || 3000}/api/docs`);
  console.log(`🔗 WebSocket Endpoint: ws://localhost:${process.env.PORT || 3000}/ws`);
  console.log('🤖 Powered by HazelJS - AI-Native Backend Framework');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
