import { json } from '@sveltejs/kit';

/**
 * Standard error response format
 */
export interface ApiError {
    error: string;
    message: string;
    details?: any;
}

/**
 * Create a standardized error response
 */
export function errorResponse(
    status: number,
    message: string,
    details?: any
): Response {
    return json(
        {
            error: getErrorName(status),
            message,
            ...(details && { details }),
        } as ApiError,
        { status }
    );
}

/**
 * Get error name from status code
 */
function getErrorName(status: number): string {
    switch (status) {
        case 400:
            return 'Bad Request';
        case 401:
            return 'Unauthorized';
        case 403:
            return 'Forbidden';
        case 404:
            return 'Not Found';
        case 409:
            return 'Conflict';
        case 422:
            return 'Unprocessable Entity';
        case 500:
            return 'Internal Server Error';
        default:
            return 'Error';
    }
}

/**
 * Handle errors and return appropriate response
 */
export function handleError(error: any): Response {
    // Validation errors (from zod)
    if (error.name === 'ZodError') {
        return errorResponse(422, 'Validation failed', error.errors);
    }

    // Database constraint violations
    if (error.code === '23505') {
        return errorResponse(409, error.message || 'Resource already exists');
    }

    // Not found errors
    if (error.message?.includes('not found')) {
        return errorResponse(404, error.message);
    }

    // Default to 500 for unknown errors
    console.error('API Error:', error);
    return errorResponse(500, error.message || 'Internal server error');
}

