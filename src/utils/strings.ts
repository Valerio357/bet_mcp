export const normalizeTeamName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/fc|ssc|uc|ac|calcio|football|club/gi, "")
    .replace(/[^a-z]/g, "")
    .trim();
