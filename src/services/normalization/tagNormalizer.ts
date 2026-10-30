export function normalizeTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const normalizedSet = new Set<string>();
  
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const clean = tag.trim();
    if (clean.length === 0) continue;
    
    // Title case or standard capitalization to avoid duplicates like "IT" and "it"
    // Keep well-known abbreviations uppercase, else capitalize
    const formatted = clean.toLowerCase() === 'it' ? 'IT' : 
                      clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
                      
    normalizedSet.add(formatted);
  }
  
  return Array.from(normalizedSet);
}
