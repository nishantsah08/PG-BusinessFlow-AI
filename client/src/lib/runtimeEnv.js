export const getViteEnv = (key, fallback = '') => {
    let env;

    try {
        env = new Function('try { return import.meta.env; } catch (error) { return undefined; }')();
    } catch (_error) {
        env = undefined;
    }

    const value = env && Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
    return value ?? fallback;
};

export const isProductionApp = () => getViteEnv('VITE_APP_ENV', 'development') === 'production';
