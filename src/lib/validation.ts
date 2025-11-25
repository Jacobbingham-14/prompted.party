import { z } from 'zod';

/**
 * Validation schema for player names
 * Prevents XSS, injection attacks, and inappropriate characters
 */
export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Name cannot be empty')
  .max(50, 'Name must be 50 characters or less')
  .regex(
    /^[a-zA-Z0-9\s._-]+$/,
    'Name can only contain letters, numbers, spaces, dots, underscores, and hyphens'
  );

/**
 * Validates a player name and returns the sanitized value
 * Throws ZodError with user-friendly message if validation fails
 */
export const validatePlayerName = (name: string): string => {
  return playerNameSchema.parse(name);
};

/**
 * Validation schema for suggestion form
 * Validates user feedback and prompt ideas
 */
export const suggestionFormSchema = z.object({
  message: z.string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be less than 2000 characters')
});

export type SuggestionFormData = z.infer<typeof suggestionFormSchema>;

/**
 * Validates a suggestion form and returns the sanitized value
 * Throws ZodError with user-friendly message if validation fails
 */
export const validateSuggestionForm = (data: SuggestionFormData): SuggestionFormData => {
  return suggestionFormSchema.parse(data);
};