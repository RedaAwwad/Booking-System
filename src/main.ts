import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Booking System API')
    .setDescription('API documentation for Amadeus and Skyscanner Integrations')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
  console.log('Application Running on port', process.env.PORT ?? 3000);
  console.log('Swagger UI available at http://localhost:' + (process.env.PORT ?? 3000) + '/api');
}
bootstrap();
