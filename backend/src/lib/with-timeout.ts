export class RequestTimeoutError extends Error {
    readonly timeoutMs: number;
    readonly code: string;

    constructor(code: string, timeoutMs: number) {
        super(code);
        this.name = 'RequestTimeoutError';
        this.timeoutMs = timeoutMs;
        this.code = code;
    }
}

export async function withTimeout(
    promise: PromiseLike<unknown>,
    timeoutMs: number,
    code: string,
): Promise<any> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new RequestTimeoutError(code, timeoutMs)), timeoutMs);
    });

    return Promise.race<any>([Promise.resolve(promise), timeoutPromise]);
}

export function isRequestTimeoutError(error: unknown): error is RequestTimeoutError {
    return error instanceof RequestTimeoutError;
}
