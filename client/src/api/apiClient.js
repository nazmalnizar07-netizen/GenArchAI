import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 120000, // 120s — AI generation can take 90-120s on cold starts
    headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const message = error.response?.data?.error || error.message || 'Something went wrong';
        console.error('API Error:', message);
        return Promise.reject({ message });
    }
);

export default api;
