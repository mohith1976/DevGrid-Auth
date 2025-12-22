import { Injectable } from '@nestjs/common';

@Injectable()
export class StatsService {
  getSvgForUser(username: string): string {
    const name = username || 'demo';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="450" height="120" viewBox="0 0 450 120" role="img" aria-label="DevGrid stats for ${name}">
  <rect width="100%" height="100%" fill="#0b1226" rx="6"/>
  <text x="24" y="40" fill="#ffffff" font-size="20" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">DevGrid Stats</text>
  <text x="24" y="70" fill="#9aa4c0" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">${name}</text>
  <text x="24" y="95" fill="#9aa4c0" font-size="12" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Commits: 123 • PRs: 45 • Stars: 10</text>
</svg>`;
  }
}
