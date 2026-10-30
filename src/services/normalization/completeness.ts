export interface CompletenessSummary {
  score: number; // 0 to 1
  missingFields: string[];
  invalidFields: string[];
}

export function calculateCompleteness(data: Record<string, any>, requiredFields: string[]): CompletenessSummary {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
    // Additional validation logic can be added here
  }
  
  const totalFields = requiredFields.length;
  const validFieldsCount = totalFields - missingFields.length - invalidFields.length;
  
  return {
    score: validFieldsCount / totalFields,
    missingFields,
    invalidFields
  };
}
