/**
 * Health Controller
 * 
 * Provides service health status for monitoring and deployment verification.
 * No authentication required.
 * No sensitive information returned.
 */

import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  success: boolean;
  service: string;
  status: string;
}

@Controller('/api/v1')
export class HealthController {
  /**
   * GET /api/v1/health
   * 
   * Returns service health status
   * 
   * Response:
   * {
   *   "success": true,
   *   "service": "devgrid-auth",
   *   "status": "healthy"
   * }
   */
  @Get('health')
  health(): HealthResponse {
    return {
      success: true,
      service: 'devgrid-auth',
      status: 'healthy',
    };
  }
}

