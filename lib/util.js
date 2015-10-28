export function encodeToSearchString(options) {
    return Object.keys(options)
        .filter(key => key && options[key])
        .reduce((string, key) => string + '&' + `${key}=${encodeURIComponent(options[key])}`, '').slice(1)
}