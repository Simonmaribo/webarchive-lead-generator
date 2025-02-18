import { WaybackScraper } from "./WebScraper";

async function analyzeWebsite(url: string, yearRange: number = 7, maxYearlyCaptures: number = 1) {
    const scraper = new WaybackScraper(url, 0.85, {
        maxRequestsPerMinute: 10, // 15 is the MAX, but to ensure we dont get into the 5 minute penalty, we set it to 10
        retryAttempts: 6,
        retryDelay: 5000,
    });
    if (yearRange * maxYearlyCaptures > 10) {
        console.warn('Warning: You are requesting a large number of captures, this may take a long time and could result in rate limiting.');
    }

    const startTime = Date.now();
    try {
        const analysis = await scraper.analyzeWebsiteHistory(yearRange, maxYearlyCaptures);
        console.log('Website Analysis Results:');
        console.log('--------------------------');
        console.log(`Analysis Time: ${(Date.now() - startTime) / 1000} seconds`);
        console.log(`URL: ${analysis.url}`);
        console.log(`First Capture: ${analysis.firstCapture.toLocaleDateString()}`);
        console.log(`Last Capture: ${analysis.lastCapture.toLocaleDateString()}`);
        console.log(`Total Captures: ${analysis.totalCaptures}`);
        console.log(`Similar Since: ${analysis.similarSince?.toLocaleDateString() || 'N/A'}`);
        console.log(`Average Similarity Score: ${(analysis.similarityScore * 100).toFixed(2)}%`);

        if (analysis.significantChanges.length > 0) {
            console.log('\nSignificant Changes:');
            analysis.significantChanges.forEach(change => {
                console.log(`${change.date.toLocaleDateString()} -> ${change.otherDate.toLocaleDateString()}: ${(change.similarityDrop * 100).toFixed(2)}% change`);
            });
        }

        if (analysis.recommendUpdate) {
            console.log('\n⚠️ Recommendation: Website update recommended');
        }

        return analysis;
    } catch (error) {
        console.error('Error analyzing website:', error);
        throw error;
    }
}

// Example batch analysis
async function analyzeBatch(urls: string[], yearRange: number = 7) {
    const results = new Map<string, Awaited<ReturnType<typeof analyzeWebsite>>>();
    for (const url of urls) {
        try {
            const result = await analyzeWebsite(url, yearRange);
            results.set(url, result);
        } catch (error) {
            console.error(`Error analyzing ${url}:`, error);
        }
    }
    return results;
}

analyzeWebsite('https://example.com', 7, 1);