import { compareTwoStrings } from 'string-similarity';
import { RateLimitedFetcher } from './RateLimitedFetcher';

export class ContentAnalyzer {
    async fetchContent(fetcher: RateLimitedFetcher, url: string): Promise<string> {
        try {

            const html = await fetcher.fetchText(url);
            return this.cleanHtml(html);
        } catch (error) {
            console.error(`Error fetching content from ${url}:`, error);
            return '';
        }
    }

    private cleanHtml(html: string): string {
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    compareSites(current: string, historical: string): number {
        return compareTwoStrings(current, historical);
    }
}