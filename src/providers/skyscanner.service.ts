import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { SearchFlightsSkyScannerDto } from 'src/aggrecator/DTO/flight-search.dto';

@Injectable()
export class SkyscannerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private getHeaders() {
    const apiKey = this.configService.get<string>('SKYSCANNER_API_KEY');
    const apiHost = this.configService.get<string>('SKYSCANNER_API_HOST');

    if (!apiKey) {
      throw new HttpException(
        'Skyscanner API key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': apiHost,
    };
  }

  async searchFlights(params: SearchFlightsSkyScannerDto) {
    const baseUrl = this.configService.get<string>('SKYSCANNER_BASE_URL')
    console.log(`[Skyscanner] Base URL: ${baseUrl}`);

    try {
      console.log(`[Skyscanner] Requesting: ${baseUrl}`);
      
      const response = await lastValueFrom(
        this.httpService.get(`${baseUrl}`, {
          headers: this.getHeaders(),
          params,
        }),
      );

      console.log(`[Skyscanner] Response received`);
      return response.data;
    } catch (error) {
      console.error('[Skyscanner] Error Data:', error.response?.data);
      
      const errorMsg = error.response?.data?.message === "API doesn't exists"
        ? "RapidAPI Error: The API doesn't exist. Please check your SKYSCANNER_API_HOST and SKYSCANNER_BASE_URL in .env match the exact RapidAPI package you subscribed to."
        : (error.response?.data || 'Failed to fetch flights from Skyscanner');

      throw new HttpException(
        errorMsg,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}