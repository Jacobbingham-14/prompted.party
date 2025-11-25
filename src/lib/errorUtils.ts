/**
 * Error handling utilities for secure error messaging
 * Maps internal database errors to user-friendly messages without exposing implementation details
 */

interface ErrorWithCode {
  code?: string;
  message?: string;
}

/**
 * Maps database error codes to user-friendly messages
 * Prevents leaking internal database structure and implementation details
 */
export const getUserFriendlyErrorMessage = (error: unknown): string => {
  const err = error as ErrorWithCode;

  // Map specific PostgreSQL error codes to friendly messages
  if (err?.code === '23505') {
    return 'This item already exists.';
  }
  
  if (err?.code === '23503') {
    return 'Cannot perform this action due to related data.';
  }
  
  if (err?.code === '23502') {
    return 'Required information is missing.';
  }
  
  if (err?.code === '42501') {
    return 'You do not have permission to perform this action.';
  }
  
  if (err?.code === 'PGRST116') {
    return 'The requested item was not found.';
  }

  // Generic error message for all other cases
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Logs detailed error information only in development mode
 * Prevents sensitive error details from being exposed in production
 */
export const logErrorInDev = (context: string, error: unknown): void => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]:`, error);
  }
};