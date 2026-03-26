const parseArray = (str) => {
    if (!str || str === 'character(0)') return [];
    try {
        let cleaned = str.replace(/^c\(/, '').replace(/\)$/, '');
        let matches = [...cleaned.matchAll(/"([^"]+)"|'([^']+)'/g)];
        return matches.map(m => m[1] || m[2]);
    } catch (e) { return [str]; }
};

const getImage = (str) => {
    const arr = parseArray(str);
    if (arr.length && arr[0].startsWith('http')) return arr[0];
    return '/static/images/no-image.jpg';
};
