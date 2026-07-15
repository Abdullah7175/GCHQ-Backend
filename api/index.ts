import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
const express = require('express');

let appInstance: any;

export default async function (req: any, res: any) {
  if (!appInstance) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    
    app.use(helmet());
    app.enableCors({ origin: true, credentials: true });
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    
    app.setGlobalPrefix('api');
    await app.init();
    appInstance = expressApp;
  }
  
  return appInstance(req, res);
}
