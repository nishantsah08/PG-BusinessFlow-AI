export const getViteEnv = (key, fallback = '') => {
    const runtimeEnv = globalThis && typeof globalThis === 'object'
        ? globalThis.__PGBF_RUNTIME_ENV__
        : undefined;

    const value = runtimeEnv && Object.prototype.hasOwnProperty.call(runtimeEnv, key) ? runtimeEnv[key] : undefined;
    return value ?? fallback;
};

export const isProductionApp = () => ['production', 'preprod'].includes(getViteEnv('VITE_APP_ENV', 'development'));
