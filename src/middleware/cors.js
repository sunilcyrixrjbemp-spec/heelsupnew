// worker/src/middleware/cors.js

const ALLOWED_ORIGINS = [
    'https://heelsup.in',
    'https://www.heelsup.in',
    'http://localhost:3000',
    'http://localhost:8787',
];

export function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

export function handleOptions(request) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function addCors(response, request) {
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
}