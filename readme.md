# Wayback Website Change Detector

A TypeScript script that helps web agencies identify potential leads by detecting websites that haven't been updated in a while. It uses the Wayback Machine API to analyze historical website changes and determine if a site might need an update.

## Features

- Analyzes website changes over customizable time periods
- Calculates similarity scores between historical versions
- Identifies significant design/content changes
- Provides recommendations for website updates
- Built-in rate limiting to respect Wayback Machine's API constraints
- Configurable retry mechanisms for robust scraping

## Setup

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

## Usage

```typescript
import { WaybackScraper } from "./WebScraper";

async function analyzeWebsite(url: string, yearRange: number = 7, maxYearlyCaptures: number = 1) {
    const scraper = new WaybackScraper(url, 0.85, {
        maxRequestsPerMinute: 10, // 15 is the MAX, but we set to 10 to avoid penalties
        retryAttempts: 6,
        retryDelay: 5000,
    });
    
    if (yearRange * maxYearlyCaptures > 10) {
        console.warn('Warning: You are requesting a large number of captures, this may take a long time and could result in rate limiting.');
    }

    const analysis = await scraper.analyzeWebsiteHistory(yearRange, maxYearlyCaptures);
    return analysis;
}

// Example usage
analyzeWebsite('https://example.com', 7, 1);
```

### Configuration Options

```typescript
const scraper = new WaybackScraper(url, 0.85, {
    maxRequestsPerMinute: 10, // Default: 10, Max: 15
    retryAttempts: 6,        // Number of retry attempts
    retryDelay: 5000         // Delay between retries in ms
});
```

## Rate Limiting

⚠️ **Important**: The Wayback Machine API has strict rate limits:
- Maximum 15 requests per minute
- Exceeding this limit results in a 5-minute penalty
- Default configuration uses 10 requests/minute for safety

## Recommended Setup

### Proxy Configuration

For production use, it's recommended to run the script behind a proxy service:
- Recommended provider: [Smartproxy.com](https://smartproxy.com)
- Helps avoid rate limiting issues
- Enables parallel processing of multiple domains

## Example Output

```
Website Analysis Results:
--------------------------
Analysis Time: 3.2 seconds
URL: https://example.com
First Capture: 2017-01-15
Last Capture: 2024-01-10
Total Captures: 7
Similar Since: 2022-03-15
Average Similarity Score: 85.00%

Significant Changes:
2022-03-15 -> 2022-06-20: 35.20% change
2021-05-10 -> 2021-08-15: 28.50% change

⚠️ Recommendation: Website update recommended
```

## Response Object

The analysis returns an object with the following properties:
- `url`: The analyzed website URL
- `firstCapture`: Date of the first capture
- `lastCapture`: Date of the most recent capture
- `totalCaptures`: Number of captures analyzed
- `similarSince`: Date since the website has remained similar
- `similarityScore`: Average similarity score (0-1)
- `significantChanges`: Array of detected major changes
- `recommendUpdate`: Boolean indicating if an update is recommended

## Notes

- The script uses a similarity threshold of 0.85 (85%) by default to determine significant changes
- Set `yearRange` and `maxYearlyCaptures` carefully to avoid excessive API requests
- Consider implementing additional error handling for production use

## License

MIT