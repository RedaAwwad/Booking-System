import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AmadeusService {
  private accessToken: string;
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('AMADEUS_CLIENT_ID');
    const clientSecret = this.configService.get<string>('AMADEUS_CLIENT_SECRET');
    const baseUrl = this.configService.get<string>('AMADEUS_BASE_URL') || 'https://test.api.amadeus.com';

    if (!clientId || !clientSecret) {
      throw new HttpException('Amadeus credentials not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const data = new URLSearchParams();
      data.append('grant_type', 'client_credentials');
      data.append('client_id', clientId);
      data.append('client_secret', clientSecret);

      const response = await lastValueFrom(
        this.httpService.post(`${baseUrl}/v1/security/oauth2/token`, data, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      this.accessToken = response.data.access_token;
      // Expires in seconds from response. Add buffer of 10 seconds.
      this.tokenExpiry = Date.now() + (response.data.expires_in - 10) * 1000;

      return this.accessToken;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to authenticate with Amadeus',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchFlightOffers(params: {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    returnDate: string;
    adults: number;
    max: number;
  }) {
    const token = await this.getAccessToken();
    const baseUrl = this.configService.get<string>('AMADEUS_BASE_URL') || 'https://test.api.amadeus.com';

    try {
      const response = await lastValueFrom(
        this.httpService.get(`${baseUrl}/v2/shopping/flight-offers`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params,
        }),
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to fetch flight offers from Amadeus',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
