import { ContentAnalyzer } from "./ContentAnalyser";
import { createTimestamp, formatIdentifier, parseCalendarDate } from "./utils/date";
import { RateLimitedFetcher, RateLimiterConfig } from "./RateLimitedFetcher";

interface CalendarCapture {
    items: [number, number, number][];
}

interface TimeCapture {
    colls: string[][];
    items: [number, number, number][];
}

interface Snapshot {
    timestamp: number;
    url: string;
    content?: string;
    similarity?: number;
}


interface AnalysisResult {
    url: string;
    firstCapture: Date;
    lastCapture: Date;
    totalCaptures: number;
    similarSince: Date | null;
    similarityScore: number;
    significantChanges: {
        date: Date;
        otherDate: Date;
        similarityDrop: number;
    }[];
    recommendUpdate: boolean;
}


export class WaybackScraper {
    private baseUrl = 'https://web.archive.org';
    private contentAnalyzer: ContentAnalyzer;
    private fetcher: RateLimitedFetcher;

    constructor(
        private readonly url: string,
        private readonly similarityThreshold: number = 0.85,
        rateLimiterConfig?: Partial<RateLimiterConfig>
    ) {
        this.contentAnalyzer = new ContentAnalyzer();
        this.fetcher = new RateLimitedFetcher(rateLimiterConfig);
    }

    private encodeUrl(): string {
        return encodeURIComponent(this.url);
    }

    async analyzeWebsiteHistory(yearRange: number = 7, maxYearlyCaptures: number = 1): Promise<AnalysisResult> {
        const currentContent = await this.contentAnalyzer.fetchContent(this.fetcher, this.url);
        const captures = await this.getAllCaptures(yearRange, maxYearlyCaptures);

        // Analyze each capture for similarity
        const analyzedCaptures: Snapshot[] = [];
        for (const capture of captures) {
            const content = await this.contentAnalyzer.fetchContent(this.fetcher, capture.url);
            const similarity = this.contentAnalyzer.compareSites(currentContent, content);
            analyzedCaptures.push({
                ...capture,
                content,
                similarity
            });
        }

        // Find when the website became similar to current version
        const significantChanges = [];
        let similarSince: Date | null = null;
        let previousSimilarity = 1;
        let previousDate = new Date();

        for (let i = analyzedCaptures.length - 1; i >= 0; i--) {
            const capture = analyzedCaptures[i];
            if (capture.similarity) {
                // Check for significant changes
                if (previousSimilarity - capture.similarity > 0.15) { // 15% change threshold
                    significantChanges.push({
                        date: new Date(capture.timestamp),
                        otherDate: previousDate,
                        similarityDrop: previousSimilarity - capture.similarity
                    });
                }

                // Update similar since date
                if (capture.similarity >= this.similarityThreshold) {
                    similarSince = new Date(capture.timestamp);
                }

                previousSimilarity = capture.similarity;
                previousDate = new Date(capture.timestamp);
            }
        }

        const firstCapture = new Date(captures[0].timestamp);
        const lastCapture = new Date(captures[captures.length - 1].timestamp);
        const averageSimilarity = analyzedCaptures.reduce((sum, capture) =>
            sum + (capture.similarity || 0), 0) / analyzedCaptures.length;

        return {
            url: this.url,
            firstCapture,
            lastCapture,
            totalCaptures: captures.length,
            similarSince,
            similarityScore: averageSimilarity,
            significantChanges,
            recommendUpdate: this.shouldRecommendUpdate(similarSince, averageSimilarity)
        };
    }

    private shouldRecommendUpdate(similarSince: Date | null, averageSimilarity: number): boolean {
        if (!similarSince) return false;

        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        return similarSince < twoYearsAgo && averageSimilarity > 0.85;
    }

    async getYearCaptures(year: number, maxYearlyCaptures: number): Promise<Map<string, Snapshot[]>> {
        const captures = new Map<string, Snapshot[]>();
        const calendarUrl = `${this.baseUrl}/__wb/calendarcaptures/2?url=${this.encodeUrl()}&date=${year}&groupby=day`;

        try {
            const data = await this.fetcher.fetchJson<CalendarCapture>(calendarUrl);

            for (const [dateNum, status, count] of data.items) {
                if (status === 301 || count === 0) continue;

                const { month, day } = parseCalendarDate(dateNum);
                const identifier = formatIdentifier(year, month, day);

                const dayCaptures = await this.getDayCaptures(identifier);
                if (dayCaptures.length > 0) {
                    captures.set(identifier, dayCaptures);
                    if (captures.size >= maxYearlyCaptures) {
                        break;
                    }
                }
            }

            return captures;
        } catch (error) {
            console.error(`Error fetching year captures for ${year}:`, error);
            throw error;
        }
    }

    private async getDayCaptures(identifier: string): Promise<Snapshot[]> {
        const timeUrl = `${this.baseUrl}/__wb/calendarcaptures/2?url=${this.encodeUrl()}&date=${identifier}`;

        try {
            const data = await this.fetcher.fetchJson<TimeCapture>(timeUrl);

            return data.items
                .filter(([_, status]) => status === 200)
                .map(([time]) => ({
                    timestamp: createTimestamp(identifier, time),
                    url: this.createWaybackUrl(identifier, time)
                }));
        } catch (error) {
            console.error(`Error fetching day captures for ${identifier}:`, error);
            return [];
        }
    }

    private createWaybackUrl(date: string, time: number): string {
        const timeStr = time.toString().padStart(6, '0');
        return `${this.baseUrl}/web/${date}${timeStr}/${this.url}`;
    }

    async getAllCaptures(yearRange: number = 7, maxYearlyCaptures: number = 1): Promise<Snapshot[]> {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - yearRange;
        const allCaptures: Snapshot[] = [];

        // Loop backwards from current year to start year
        for (let year = currentYear; year >= startYear; year--) {
            try {
                console.log(`Fetching captures for year ${year}...`);
                const yearCaptures = await this.getYearCaptures(year, maxYearlyCaptures);
                for (const captures of yearCaptures.values()) {
                    allCaptures.push(...captures);
                }
            } catch (error) {
                console.error(`Error processing year ${year}:`, error);
                continue;
            }
        }

        // Sort captures by timestamp
        return allCaptures.sort((a, b) => a.timestamp - b.timestamp);
    }
}