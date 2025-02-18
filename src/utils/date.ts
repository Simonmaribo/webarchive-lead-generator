export function parseCalendarDate(value: number): { month: number; day: number } {
    const valueStr = value.toString().padStart(4, '0');
    const month = parseInt(valueStr.slice(0, 2));
    const day = parseInt(valueStr.slice(2));
    return { month, day };
}

export function formatIdentifier(year: number, month: number, day: number): string {
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    return `${year}${formattedMonth}${formattedDay}`;
}

export function createTimestamp(date: string, time: number): number {
    const timeStr = time.toString().padStart(6, '0');
    const hours = parseInt(timeStr.slice(0, 2));
    const minutes = parseInt(timeStr.slice(2, 4));
    const seconds = parseInt(timeStr.slice(4));

    const [year, month, day] = date.split('').reduce((acc, char, i) => {
        if (i < 4) acc[0] += char;
        else if (i < 6) acc[1] += char;
        else acc[2] += char;
        return acc;
    }, ['', '', '']).map(str => parseInt(str));

    const timestamp = new Date(year, month - 1, day, hours, minutes, seconds).getTime();
    return timestamp;
}