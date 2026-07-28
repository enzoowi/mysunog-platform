import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Eagerly wake up the backend (useful for Vercel/serverless cold starts)
// This fires immediately when the JS bundle loads, before the user can even type their credentials.
api.get('/health').catch(() => { /* silently ignore if it fails or backend is already awake */ });