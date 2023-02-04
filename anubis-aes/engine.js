const utf8encoder = new TextEncoder('utf-8')
const utf8decoder = new TextDecoder('utf-8')

function randInt(maxIncl) {
    return Math.floor(Math.random() * (maxIncl + 1))
}

function randomByte() {
    return randInt(0xFF)
}

function randomBlock() {
    let ret = []
    for (let i = 0; i < 16; ++i) ret.push(randomByte())
    return ret
}

function random4bitWrapper(lowerBits) {
    return (Math.floor(Math.random() * 0x0F) << 4) + (lowerBits & 0x0F)
}

function stringToBytes(text) {
    return Array.from(utf8encoder.encode(text))
}

function bytesToString(bytes) {
    return utf8decoder.decode(Uint8Array.from(bytes))
}

function divideIntoBlocks(bytes, size=16) {
    let full
    if (bytes.length > 0) full = bytes.slice() 
    else full = [0x00]  // we want at least one block to be present
    while (full.length % size != 0) full.push(0x00)
    
    let ret = [] 
    for (let start = 0; start < full.length; start += size) {
        ret.push(full.slice(start, start + size))
    }
    return ret
}

function minSuffixToFingerprint(minSuffix) {
    let f = [randomByte(), randomByte(), randomByte()]
    let i
    while (((f[0] + f[1] + f[2]) & 0xFF) % 3 != minSuffix) {
        i = randInt(2)
        f[i] = (f[i] + 1) & 0xFF
    }
    return f
}

function fingerprintToSuffixLength(fingerprint) {
    let sum = fingerprint[0] + fingerprint[1] + fingerprint[2]
    let suffixBlockNum = sum % 256
    if (suffixBlockNum == 0) suffixBlockNum = 256
    return suffixBlockNum
}

function fingerprintToSuffixBlocks(fingerprint) {
    let suffixBlockNum = fingerprintToSuffixLength(fingerprint)
    let ret = []
    for (let i = 0; i < suffixBlockNum; ++i) {
        ret.push(randomBlock())
    }
    ret[ret.length - 1][13] = fingerprint[0]
    ret[ret.length - 1][14] = fingerprint[1]
    ret[ret.length - 1][15] = fingerprint[2]
    return ret
}

function divideIntoBlocksWithNoise(bytes) {
    let base = []

    let noiseByte = randomByte()
    base.push(noiseByte)
    for (let i = 0; i < noiseByte % 16; ++i) base.push(randomByte())

    let fillLength = (16 - (base.length + 1 + bytes.length) % 16) % 16
    let fillByte = random4bitWrapper(fillLength)
    base.push(fillByte)
    for (let i = 0; i < fillLength; ++i) base.push(randomByte())
    let full = base.concat(bytes)

    let blockNumber = full.length / 16
    let minSuffix = (3 - (blockNumber % 3)) % 3
    let suffixFingerprint = minSuffixToFingerprint(minSuffix)
    let suffix = fingerprintToSuffixBlocks(suffixFingerprint)

    let ret = divideIntoBlocks(full).concat(suffix)

    return ret
}

function denoise(noisyBytes) {
    let noiseByte = noisyBytes[0]
    let noiseLength = noiseByte % 16
    let fillByte = noisyBytes[1 + noiseLength]
    let fillLength = fillByte % 16
    let realDataStart = 2 + noiseLength + fillLength

    let suffixFingerprint = noisyBytes.slice(noisyBytes.length - 3)
    let suffixStart = noisyBytes.length - (fingerprintToSuffixLength(suffixFingerprint) * 16)
    
    return noisyBytes.slice(realDataStart, suffixStart)
}

function __crypt(bytes, keyBlock, decode) {
    AES_Init()
    let _keyBlock = keyBlock.slice()
    AES_ExpandKey(_keyBlock)

    let blocks 
    if (decode) blocks = divideIntoBlocks(bytes)
    else blocks = divideIntoBlocksWithNoise(bytes)

    let ret = []
    let _block
    for (let i in blocks) {
        _block = blocks[i].slice()
        if (decode) {
            AES_Decrypt(_block, _keyBlock)
        } else {
            AES_Encrypt(_block, _keyBlock)
        }
        ret = ret.concat(_block)
    }
    AES_Done()
    return ret
}

function encrypt(bytes, keyBlock) { return __crypt(bytes, keyBlock, false) }
function decrypt(bytes, keyBlock) { return __crypt(bytes, keyBlock, true) }

function isCharCodeSafe(code) {
    /* 
    64 characters are deemed "safe" - ASCII between '!' and '_', together with '|'
    Reasons:
     - all of them are ASCII
     - all of them are printable (no control sequences or white spaces)
     - all letters are capital ('A' and 'a' could be mistaken otherwise)
    */
    return (0x21 <= code && code <= 0x5F) || code == 0x7C
}

function characterToSafe(c) {
    let code = c.charCodeAt()
    if (isCharCodeSafe(code)) return c
    else if (  // lowercase to uppercase
        0x61 <= code && code <= 0x7A
        ) return String.fromCharCode(code - 0x20)
    else if (  // fancy As
        (0xC0 <= code && code <= 0xC5) ||
        (0xE0 <= code && code <= 0xE5) ||
        (0x0100 <= code && code <= 0x0105)
        ) return 'A'
    else if (  // fancy Es
        (0xC8 <= code && code <= 0xCB) || 
        (0xE8 <= code && code <= 0xEB) ||
        (0x0112 <= code && code <= 0x011B)
        ) return 'E'
    else if (  // fancy Is
        (0xCC <= code && code <= 0xCF) || 
        (0xEC <= code && code <= 0xEF) ||
        (0x0128 <= code && code <= 0x0131)
        ) return 'I'
    else if (  // fancy Os
        (0xD2 <= code && code <= 0xD6) || 
        (0xF2 <= code && code <= 0xF6) || 
        code == 0xD8 || 
        code == 0xF8 ||
        (0x014C <= code && code <= 0x0151)
        ) return 'O'
    else if (  // fancy Us
        (0xD9 <= code && code <= 0xDC) || 
        (0xF9 <= code && code <= 0xFC) ||
        (0x0168 <= code && code <= 0x0173)
        ) return 'U'
    else if (  // fancy Ys
        code == 0xDD || 
        code == 0xFD ||
        (0x0176 <= code && code <= 0x0178)
        ) return 'Y'
    else return null
}

function textToSafe(text) {
    let ret = ''
    let safe
    for (let i = 0; i < text.length; i++) {
        safe = characterToSafe(text[i])
        if (safe) ret += safe
    }
    return ret
}

/** Turns a safe byte into a value between 0x00 and 0x3F */
function groundSafeByte(safeByte) {
    if (safeByte == 0x7C) return 0x00
    else return safeByte - 0x20
}

function ungroundSafeByte(groundedSafeByte) {
    if (groundedSafeByte == 0x00) return 0x7C
    else return groundedSafeByte + 0x20
}

/** 
 * There are 64 possible safe bytes, so they carry only 6 bits of information
 * This function compresses them, so that every 3 bytes carry 4 safe ones
 */
function compressSafeBytes(safeBytes) {
    _bytes = safeBytes.map(groundSafeByte)
    while (_bytes.length % 4 != 0) _bytes.push(0x00)
    let ret = []
    for (let s = 0; s < _bytes.length; s += 4) {
        ret.push(
            (_bytes[s] << 2) + (_bytes[s+1] >> 4),
            ((_bytes[s+1] & 0b001111) << 4) + (_bytes[s+2] >> 2),
            ((_bytes[s+2] & 0b000011) << 6) + _bytes[s+3]
        )
    }
    return ret
}

/**
 * Reverses `compressSafeBytes`. 
 * Can also be used to make safe bytes out of any normal ones
 */
function decompressSafeBytes(compressed) {
    _bytes = compressed.slice()
    while (_bytes.length % 3 != 0) _bytes.push(0x00)
    let ret = []
    for (let s = 0; s < _bytes.length; s += 3) {
        ret.push(
            _bytes[s] >> 2,
            ((_bytes[s] & 0b00000011) << 4) + ((_bytes[s+1] & 0b11110000) >> 4),
            ((_bytes[s+1] & 0b00001111) << 2) + ((_bytes[s+2] & 0b11000000) >> 6),
            _bytes[s+2] & 0b00111111
        )
    }
    return ret.map(ungroundSafeByte)
}

function keyTextToSafeBlock(text) {
    let safeText = textToSafe(text)
    let safeBytes = stringToBytes(safeText)
    let compressed = compressSafeBytes(safeBytes)
    let blockList = divideIntoBlocks(compressed, 24)
    let block192 = blockList[0]
    for (let i = 1; i < blockList.length; i++) {
        for (let b = 0; b < 24; b++) {
            block192[b] ^= blockList[i][b]
        }
    }
    return block192
}

function randomSafeCharacters(size=32) {
    let bytes = []
    for (let i = 0; i < size; ++i) {
        bytes.push(ungroundSafeByte(randInt(0x3F)))
    }
    let ret = bytesToString(bytes)
    return ret
}

function encryptText(text, keyText) {
    let randKeyPre = randomSafeCharacters(32)
    let randKeyPost = randomSafeCharacters(32)
    let keyBlock = keyTextToSafeBlock(randKeyPre + keyText + randKeyPost)
    let textBytes = stringToBytes(text)
    let encryptedBytes = encrypt(textBytes, keyBlock)
    let safeBytes = decompressSafeBytes(encryptedBytes)
    let safeCypher = bytesToString(safeBytes)
    let encased = randKeyPre + safeCypher + randKeyPost

    return encased
}

function decryptText(cypher, keyText) {
    let safeCypher = textToSafe(cypher)
    let randKeyPre = safeCypher.substring(0, 32)
    let randKeyPost = safeCypher.substring(safeCypher.length - 32, safeCypher.length)
    let keyBlock = keyTextToSafeBlock(randKeyPre + keyText + randKeyPost)
    
    let safeBytes = stringToBytes(safeCypher.substring(32, safeCypher.length - 32))
    let encryptedBytes = compressSafeBytes(safeBytes)
    let noisyBytes = decrypt(encryptedBytes, keyBlock)
    let textBytes = denoise(noisyBytes)
    let plainText = bytesToString(textBytes)

    return plainText
}


// -----------------------------------------------------------

const preText = document.getElementById('pre-text')
const key = document.getElementById('key')
const postText = document.getElementById('post-text')


function setPostText(text) {
    let sanitised = text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
    postText.innerHTML = sanitised
}

function onEncryptButton() {
    let a = preText.value
    let b = key.value
    let c = encryptText(a, b)
    setPostText(c)
}

function onDecryptButton() {
    let a = preText.value
    let b = key.value
    let c = decryptText(a, b)
    setPostText(c)
}

document.getElementById('encrypt').addEventListener('click', onEncryptButton)
document.getElementById('decrypt').addEventListener('click', onDecryptButton)
