export interface SeasonInfo {
    id: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
}

// SEASON 1 ENDS: Jan 26, 2026 00:00 UTC
// SEASON 2 STARTS: Jan 26, 2026 00:00 UTC
const SEASON_1_END_TIMESTAMP = 1769385600000; // Mon Jan 26 2026 00:00:00 UTC
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const getCurrentSeason = (): SeasonInfo => {
    const now = Date.now();

    // If before Jan 26, it's Season 1 (Legacy/Special Event)
    if (now < SEASON_1_END_TIMESTAMP) {
        return {
            id: 1,
            startDate: new Date("2026-01-20T00:00:00Z"), // Approx start of event
            endDate: new Date(SEASON_1_END_TIMESTAMP),
            isActive: true
        };
    }

    // Calculate Season 2+
    // Time elapsed since S2 Start
    const elapsed = now - SEASON_1_END_TIMESTAMP;
    const weeksPassed = Math.floor(elapsed / ONE_WEEK_MS);

    // Season ID starts at 2
    const currentId = 2 + weeksPassed;

    // Start Time of this specific season
    const startMs = SEASON_1_END_TIMESTAMP + (weeksPassed * ONE_WEEK_MS);
    const endMs = startMs + ONE_WEEK_MS;

    return {
        id: currentId,
        startDate: new Date(startMs),
        endDate: new Date(endMs),
        isActive: true
    };
};

export const getSeasonById = (id: number): SeasonInfo => {
    if (id === 1) {
        return {
            id: 1,
            startDate: new Date("2026-01-20T00:00:00Z"),
            endDate: new Date(SEASON_1_END_TIMESTAMP),
            isActive: Date.now() < SEASON_1_END_TIMESTAMP
        };
    }

    // Reverse calc
    const weeksPassed = id - 2;
    const startMs = SEASON_1_END_TIMESTAMP + (weeksPassed * ONE_WEEK_MS);
    const endMs = startMs + ONE_WEEK_MS;

    return {
        id: id,
        startDate: new Date(startMs),
        endDate: new Date(endMs),
        isActive: Date.now() >= startMs && Date.now() < endMs
    };
};

export const getPreviousSeasons = (): SeasonInfo[] => {
    const current = getCurrentSeason();
    const seasons: SeasonInfo[] = [];

    // Push Season 1
    seasons.push(getSeasonById(1));

    // Push subsequent seasons up to current - 1
    for (let i = 2; i < current.id; i++) {
        seasons.push(getSeasonById(i));
    }

    return seasons.reverse(); // Newest first
};
